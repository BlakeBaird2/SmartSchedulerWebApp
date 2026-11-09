"use client";

import { useSyncExternalStore } from "react";
import posthog from "posthog-js";
import { firstSync, hasOwnData, readCloudWorkspace, resync, sameWorkspace } from "@/lib/cloud";
import { sanitizeWorkspace } from "@/lib/workspace";
import { KEYS, inStudy, onStoredChange, parseJson, readStored, writeStored } from "./store";

/*
 * Signing in (Apple, Google, or a link sent by email) to keep the same setup on
 * a phone and a laptop (Firebase Authentication and Firestore). Signing in the
 * first time creates the account; there are no passwords. It is optional: without the Firebase
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

/**
 * Whether this deployment has a Firebase project to sign in to. Never inside the
 * usability study: it runs on sample data and must not sync with anyone's account.
 */
export const cloudAvailable = Boolean(CONFIG.apiKey && CONFIG.authDomain && CONFIG.projectId && CONFIG.appId) && !inStudy;

/**
 * The ways to sign in this site offers, from NEXT_PUBLIC_SIGN_IN_METHODS (for
 * example "apple,google,email"). Each must also be turned on in Firebase
 * (FIREBASE_SETUP.md); Google alone when the setting is missing.
 */
const METHODS = (process.env.NEXT_PUBLIC_SIGN_IN_METHODS ?? "google")
  .split(",")
  .map((m) => m.trim().toLowerCase())
  .filter(Boolean);
export const signInMethods = {
  apple: METHODS.includes("apple"),
  google: METHODS.includes("google") || !METHODS.some((m) => m === "apple" || m === "email"),
  email: METHODS.includes("email"),
};

export type CloudStatus = "off" | "loading" | "signed-out" | "connecting" | "synced" | "saving" | "error";
/** How the account signs in, for "Signed in with …". */
export type SignInMethod = "apple" | "google" | "email";

export interface CloudState {
  status: CloudStatus;
  user: { name: string | null; email: string | null; photo: string | null; method: SignInMethod | null } | null;
  /** An email sign-in link was opened on a device that doesn't know which email it was sent to: ask for it. */
  emailLinkNeedsEmail: boolean;
  /** Both this device and the account have a setup, and they differ: the student picks one. */
  choice: { local: string; remote: string } | null;
  error: string | null;
  savedAt: number | null;
}

let state: CloudState = { status: cloudAvailable ? "loading" : "off", user: null, emailLinkNeedsEmail: false, choice: null, error: null, savedAt: null };
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
let posthogDistinctId: string | null = null;

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
          if (posthogDistinctId) {
            posthog.reset();
            posthogDistinctId = null;
          }
          set({ status: "signed-out", user: null, choice: null, error: null });
          return;
        }
        if (posthogDistinctId && posthogDistinctId !== user.uid) posthog.reset();
        posthog.identify(user.uid, {
          email: user.email ?? undefined,
          name: user.displayName ?? undefined,
        });
        posthogDistinctId = user.uid;
        set({ status: "connecting", user: { name: user.displayName, email: user.email, photo: user.photoURL, method: methodOf(user) }, error: null });
        void attach(user.uid);
      });
      // Opened the link from a sign-in email: finish signing in.
      if (auth.isSignInWithEmailLink(fb.authInstance, window.location.href)) {
        const email = readStored(KEYS.signInEmail);
        if (email) void finishEmailSignIn(email);
        else set({ emailLinkNeedsEmail: true });
      }
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

function methodOf(user: import("firebase/auth").User): SignInMethod | null {
  const ids = user.providerData.map((p) => p.providerId);
  if (ids.includes("apple.com")) return "apple";
  if (ids.includes("google.com")) return "google";
  if (ids.includes("password") || ids.includes("emailLink") || user.email) return "email";
  return null;
}

/** What went wrong, in a sentence for the sign-in screen; null when the person just closed the window. */
function signInError(e: unknown): string | null {
  const code = (e as { code?: string }).code ?? "";
  switch (code) {
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
    case "auth/user-cancelled":
      return null;
    case "auth/account-exists-with-different-credential":
      return "That email already has a Schedule Smart account. Sign in the way you did before (Apple, Google or email).";
    case "auth/invalid-email":
      return "That doesn't look like an email address.";
    case "auth/invalid-action-code":
    case "auth/expired-action-code":
      return "That sign-in link has expired or was already used. Send yourself a new one.";
    case "auth/operation-not-allowed":
      return "This way of signing in isn't turned on yet. Try another.";
    case "auth/network-request-failed":
      return "Couldn't reach the internet. Check your connection and try again.";
    case "auth/too-many-requests":
      return "Too many tries. Wait a minute and try again.";
    default:
      return "Couldn't sign in. Try again.";
  }
}

/** Sign in with Apple or Google, in a pop-up (or by going there and back where pop-ups are blocked). Returns an error to show, if any. */
export async function signInWith(method: "apple" | "google"): Promise<string | null> {
  if (!fb) return "Sign-in is still loading. Try again in a moment.";
  const { GoogleAuthProvider, OAuthProvider, signInWithPopup, signInWithRedirect } = fb.auth;
  let provider: import("firebase/auth").AuthProvider;
  if (method === "apple") {
    const apple = new OAuthProvider("apple.com");
    apple.addScope("email");
    apple.addScope("name");
    provider = apple;
  } else provider = new GoogleAuthProvider();
  try {
    await signInWithPopup(fb.authInstance, provider);
    return null;
  } catch (e) {
    const code = (e as { code?: string }).code ?? "";
    // Some phones block pop-ups; going there and back works.
    if (code === "auth/popup-blocked" || code === "auth/operation-not-supported-in-this-environment") {
      await signInWithRedirect(fb.authInstance, provider);
      return null;
    }
    return signInError(e);
  }
}

/** Email a sign-in link. Opening it signs in (and makes the account the first time). Returns an error to show, if any. */
export async function sendEmailSignIn(email: string): Promise<string | null> {
  if (!fb) return "Sign-in is still loading. Try again in a moment.";
  try {
    await fb.auth.sendSignInLinkToEmail(fb.authInstance, email, { url: `${window.location.origin}/app`, handleCodeInApp: true });
    writeStored(KEYS.signInEmail, email);
    return null;
  } catch (e) {
    return signInError(e);
  }
}

/** Finish signing in from an email link opened on this page. Returns an error to show, if any. */
export async function finishEmailSignIn(email: string): Promise<string | null> {
  if (!fb) return "Sign-in is still loading. Try again in a moment.";
  try {
    await fb.auth.signInWithEmailLink(fb.authInstance, email, window.location.href);
    writeStored(KEYS.signInEmail, null);
    set({ emailLinkNeedsEmail: false });
    // Tidy the sign-in code out of the address bar.
    const url = new URL(window.location.href);
    for (const k of ["apiKey", "oobCode", "mode", "lang", "continueUrl", "tenantId"]) url.searchParams.delete(k);
    window.history.replaceState(null, "", url);
    return null;
  } catch (e) {
    const message = signInError(e);
    set({ error: message });
    return message;
  }
}

/** Stop waiting on an email link (the person gave up, or will send a new one). */
export function forgetEmailLink() {
  set({ emailLinkNeedsEmail: false });
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
