"use client";

import { useSyncExternalStore } from "react";
import { firstSync, hasOwnData, readCloudWorkspace, resync, sameWorkspace } from "@/lib/cloud";
import { sanitizeWorkspace } from "@/lib/workspace";
import { KEYS, onStoredChange, parseJson, readStored, writeStored } from "./store";

/*
 * Signing in with Google to keep the same setup on a phone and a laptop
 * (Firebase Authentication and Firestore). It is optional: without the Firebase
 * keys, or until someone signs in, the app works as before, from this browser
 * alone.
 *
 * Each account has one document, users/{uid}, holding the workspace as JSON
 * with when and from which device it was last saved. Only its owner can read or
 * write it (firestore.rules). The copy in this browser stays the one the app
 * works from: a change here is saved to the account a moment later, and a
 * change saved from another device arrives here as it happens. Whichever device
 * saved last wins. Firebase is only downloaded when it's configured.
 */

// Written out in full so Next.js builds the values into the page.
const CONFIG = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/** Whether this deployment has a Firebase project to sign in to. */
export const cloudAvailable = Boolean(CONFIG.apiKey && CONFIG.authDomain && CONFIG.projectId && CONFIG.appId);

export type CloudStatus = "off" | "loading" | "signed-out" | "connecting" | "synced" | "saving" | "error";

export interface CloudState {
  status: CloudStatus;
  user: { name: string | null; email: string | null; photo: string | null } | null;
  /** Both this device and the account have a setup, and they differ: the student picks one. */
  choice: { local: string; remote: string } | null;
  error: string | null;
  savedAt: number | null;
}

let state: CloudState = { status: cloudAvailable ? "loading" : "off", user: null, choice: null, error: null, savedAt: null };
const listeners = new Set<() => void>();
const set = (patch: Partial<CloudState>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};

export function useCloud(): CloudState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => state,
  );
}

/** How long after a change it is saved, so a burst of edits is one save. */
const SAVE_AFTER_MS = 1200;
/** Firestore documents hold up to 1 MiB; stay well under it. */
const MAX_BYTES = 900_000;

type Firebase = {
  auth: typeof import("firebase/auth");
  fs: typeof import("firebase/firestore");
  authInstance: import("firebase/auth").Auth;
  db: import("firebase/firestore").Firestore;
};
let fb: Firebase | null = null;
let started = false;
let docRef: import("firebase/firestore").DocumentReference | null = null;
/** The workspace JSON last saved to or taken from the account. */
let lastSynced: string | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let stops: (() => void)[] = [];
let accountId: string | null = null;

/** Remember the setup this device and the account now agree on, so the next visit knows what changed where. */
function agreeOn(raw: string) {
  lastSynced = raw;
  if (accountId) writeStored(KEYS.cloud, JSON.stringify({ uid: accountId, base: raw }));
}

function deviceId(): string {
  let id = readStored(KEYS.device);
  if (!id) {
    id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Math.random()).slice(2);
    writeStored(KEYS.device, id);
  }
  return id;
}

/** Load Firebase and follow the signed-in account. Safe to call more than once. */
export function startCloud() {
  if (!cloudAvailable || started || typeof window === "undefined") return;
  started = true;
  void (async () => {
    try {
      const [{ initializeApp }, auth, fs] = await Promise.all([import("firebase/app"), import("firebase/auth"), import("firebase/firestore")]);
      const app = initializeApp(CONFIG);
      fb = { auth, fs, authInstance: auth.getAuth(app), db: fs.getFirestore(app) };
      // For development and tests: Firebase's emulators on this computer instead of the real project.
      if (process.env.NEXT_PUBLIC_FIREBASE_EMULATOR === "true") {
        auth.connectAuthEmulator(fb.authInstance, "http://127.0.0.1:9099", { disableWarnings: true });
        fs.connectFirestoreEmulator(fb.db, "127.0.0.1", 8080);
      }
      auth.onAuthStateChanged(fb.authInstance, (user) => {
        stopLive();
        if (!user) {
          set({ status: "signed-out", user: null, choice: null, error: null });
          return;
        }
        set({ status: "connecting", user: { name: user.displayName, email: user.email, photo: user.photoURL }, error: null });
        void attach(user.uid);
      });
      // Leaving the page saves a change that was still waiting.
      window.addEventListener("pagehide", () => {
        if (saveTimer) void save();
      });
    } catch {
      set({ status: "error", error: "Sign-in couldn't load. Check your connection and reload." });
    }
  })();
}

async function attach(uid: string) {
  if (!fb) return;
  accountId = uid;
  const { doc, getDoc } = fb.fs;
  docRef = doc(fb.db, "users", uid);
  let remoteRaw: unknown = null;
  try {
    const snap = await getDoc(docRef);
    remoteRaw = snap.exists() ? snap.data().workspace : null;
  } catch {
    set({ status: "error", error: "Couldn't reach your account. Your changes are kept on this device." });
    return;
  }
  const localRaw = readStored(KEYS.workspace);
  const local = sanitizeWorkspace(parseJson(localRaw));
  const remote = readCloudWorkspace(remoteRaw);
  // A device that has synced with this account before knows what they last agreed on.
  const known = parseJson<{ uid?: string; base?: string }>(readStored(KEYS.cloud));
  const base = known?.uid === uid && typeof known.base === "string" ? sanitizeWorkspace(parseJson(known.base)) : null;
  const plan = base ? resync(local, remote, base) : firstSync(local, remote);
  if (plan === "download") take(remoteRaw as string);
  else if (plan === "upload") await save();
  else if (plan === "ask") set({ choice: { local: localRaw ?? "", remote: remoteRaw as string } });
  else {
    if (plan === "same" && localRaw) agreeOn(localRaw);
    set({ status: "synced" });
  }
  live();
}

/** Follow changes both ways until signing out. */
function live() {
  if (!fb || !docRef) return;
  const { onSnapshot } = fb.fs;
  const me = deviceId();
  stops.push(
    onStoredChange(KEYS.workspace, (raw) => {
      // Starting over on this device signs out, rather than emptying the account.
      if (raw === null) {
        void signOutCloud();
        return;
      }
      if (state.choice || raw === lastSynced) return;
      if (saveTimer) clearTimeout(saveTimer);
      set({ status: "saving" });
      saveTimer = setTimeout(() => void save(), SAVE_AFTER_MS);
    }),
  );
  stops.push(
    onSnapshot(
      docRef,
      (snap) => {
        // Our own save coming back, or nothing there yet.
        if (snap.metadata.hasPendingWrites || !snap.exists()) return;
        const data = snap.data();
        if (data.device === me) return;
        if (state.choice) {
          set({ choice: { ...state.choice, remote: String(data.workspace ?? "") } });
          return;
        }
        // A change made here and still waiting to save is newer; it goes up and wins.
        if (saveTimer) return;
        const incoming = readCloudWorkspace(data.workspace);
        const here = sanitizeWorkspace(parseJson(readStored(KEYS.workspace)));
        if (incoming && !sameWorkspace(incoming, here)) take(data.workspace as string);
      },
      () => set({ status: "error", error: "Lost touch with your account. Changes are kept on this device until it's back." }),
    ),
  );
}

function stopLive() {
  stops.forEach((s) => s());
  stops = [];
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
  docRef = null;
  lastSynced = null;
  accountId = null;
}

/** Make the account's setup this device's. */
function take(raw: string) {
  const ws = readCloudWorkspace(raw);
  if (!ws) return;
  const json = JSON.stringify(ws);
  agreeOn(json);
  writeStored(KEYS.workspace, json);
  // A new device that signs in skips setup: its calendars are already chosen.
  const ui = parseJson<Record<string, unknown>>(readStored(KEYS.ui)) ?? {};
  if (ui.setupDone !== true) writeStored(KEYS.ui, JSON.stringify({ ...ui, setupDone: true, view: "calendar" }));
  set({ status: "synced", savedAt: Date.now(), error: null });
}

/** Save this device's setup to the account. Sample data and an empty setup are never saved over it. */
async function save() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
  if (!fb || !docRef) return;
  const raw = readStored(KEYS.workspace);
  if (!raw || raw === lastSynced) {
    set({ status: "synced" });
    return;
  }
  if (!hasOwnData(sanitizeWorkspace(parseJson(raw)))) {
    set({ status: "synced" });
    return;
  }
  if (raw.length > MAX_BYTES) {
    set({ status: "error", error: "Your setup is too big to sync. It's kept on this device." });
    return;
  }
  const { setDoc, serverTimestamp } = fb.fs;
  try {
    await setDoc(docRef, { workspace: raw, updatedAt: serverTimestamp(), device: deviceId() });
    agreeOn(raw);
    set({ status: "synced", savedAt: Date.now(), error: null });
  } catch {
    set({ status: "error", error: "Couldn't save to your account. Your changes are kept on this device." });
  }
}

export async function signInCloud() {
  if (!fb) return;
  const { GoogleAuthProvider, signInWithPopup, signInWithRedirect } = fb.auth;
  const provider = new GoogleAuthProvider();
  try {
    await signInWithPopup(fb.authInstance, provider);
  } catch (e) {
    const code = (e as { code?: string }).code ?? "";
    // Some phones block pop-ups; going to Google and back works there.
    if (code === "auth/popup-blocked" || code === "auth/operation-not-supported-in-this-environment") await signInWithRedirect(fb.authInstance, provider);
    else if (code !== "auth/popup-closed-by-user" && code !== "auth/cancelled-popup-request") set({ error: "Couldn't sign in. Try again." });
  }
}

/** Sign out. What's on this device stays; the account keeps its copy. */
export async function signOutCloud() {
  if (!fb) return;
  if (saveTimer) await save();
  stopLive();
  await fb.auth.signOut(fb.authInstance);
}

/** Pick which setup to keep when this device and the account both have one. */
export async function chooseSetup(keep: "account" | "device") {
  const choice = state.choice;
  if (!choice) return;
  set({ choice: null });
  if (keep === "account") take(choice.remote);
  else {
    lastSynced = null;
    await save();
  }
}

/** Delete the account's copy and sign out. This device keeps its own. */
export async function deleteCloudData() {
  if (!fb || !docRef) return;
  const { deleteDoc } = fb.fs;
  const ref = docRef;
  stopLive();
  writeStored(KEYS.cloud, null);
  try {
    await deleteDoc(ref);
  } finally {
    await fb.auth.signOut(fb.authInstance);
  }
}
