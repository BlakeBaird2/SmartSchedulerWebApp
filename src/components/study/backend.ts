"use client";

import { readRecord, type StudyRecord } from "@/lib/study/results";

/*
 * Where study sessions and their recordings are kept.
 *
 * With Firebase set up (the same four NEXT_PUBLIC_FIREBASE_* keys as sign-in,
 * plus Anonymous sign-in and the rules in firestore.rules), every participant's
 * session goes to Firestore:
 *   studySessions/{id}            the answers and timings, as JSON
 *   studySessions/{id}/chunks/{n} the screen recording, in pieces under 1 MB
 * Participants sign in anonymously, so each can only write their own session;
 * only researchers (an email listed in researchers/{email}) can read them.
 *
 * Without Firebase, everything stays in this browser (IndexedDB), which is
 * enough to try the study and the results page out on one computer.
 *
 * The study uses its own Firebase app ("study"), so a participant signed in to
 * Schedule Smart with Google stays signed in.
 */

const CONFIG = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const usesFirebase = Boolean(CONFIG.apiKey && CONFIG.authDomain && CONFIG.projectId && CONFIG.appId);

/** Firestore documents hold up to 1 MiB; each recording piece stays well under it. */
export const MAX_CHUNK_BYTES = 700 * 1024;

export interface StudyBackend {
  kind: "firebase" | "local";
  /** Get ready to save one participant's session (signs in anonymously on Firebase). */
  begin(): Promise<void>;
  save(rec: StudyRecord): Promise<void>;
  addChunk(sessionId: string, n: number, bytes: Uint8Array): Promise<void>;
  // Researchers
  listSessions(): Promise<StudyRecord[]>;
  readRecording(rec: StudyRecord): Promise<Blob | null>;
}

// ---------------------------------------------------------------------------
// Firebase
// ---------------------------------------------------------------------------

type Fb = {
  auth: typeof import("firebase/auth");
  fs: typeof import("firebase/firestore");
  authInstance: import("firebase/auth").Auth;
  db: import("firebase/firestore").Firestore;
};
let fbPromise: Promise<Fb> | null = null;

function loadFirebase(): Promise<Fb> {
  fbPromise ??= (async () => {
    const [{ initializeApp, getApps }, auth, fs] = await Promise.all([import("firebase/app"), import("firebase/auth"), import("firebase/firestore")]);
    const app = getApps().find((a) => a.name === "study") ?? initializeApp(CONFIG, "study");
    const fb: Fb = { auth, fs, authInstance: auth.getAuth(app), db: fs.getFirestore(app) };
    if (process.env.NEXT_PUBLIC_FIREBASE_EMULATOR === "true") {
      auth.connectAuthEmulator(fb.authInstance, "http://127.0.0.1:9099", { disableWarnings: true });
      fs.connectFirestoreEmulator(fb.db, "127.0.0.1", 8080);
    }
    await fb.authInstance.authStateReady();
    return fb;
  })();
  return fbPromise;
}

async function withRetry<T>(fn: () => Promise<T>, tries = 4): Promise<T> {
  let wait = 1000;
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i >= tries) throw e;
      await new Promise((r) => setTimeout(r, wait));
      wait *= 2;
    }
  }
}

const firebaseBackend: StudyBackend = {
  kind: "firebase",
  async begin() {
    const fb = await loadFirebase();
    if (!fb.authInstance.currentUser) await fb.auth.signInAnonymously(fb.authInstance);
  },
  async save(rec) {
    const fb = await loadFirebase();
    const uid = fb.authInstance.currentUser?.uid;
    if (!uid) throw new Error("Not signed in");
    const { doc, setDoc, serverTimestamp } = fb.fs;
    await withRetry(() =>
      setDoc(doc(fb.db, "studySessions", rec.id), { uid, startedAt: rec.startedAt, record: JSON.stringify(rec), updatedAt: serverTimestamp() }),
    );
  },
  async addChunk(sessionId, n, bytes) {
    const fb = await loadFirebase();
    const { doc, setDoc, Bytes } = fb.fs;
    await withRetry(() => setDoc(doc(fb.db, "studySessions", sessionId, "chunks", String(n).padStart(5, "0")), { n, data: Bytes.fromUint8Array(bytes) }));
  },
  async listSessions() {
    const fb = await loadFirebase();
    const { collection, getDocs, orderBy, query } = fb.fs;
    const snap = await getDocs(query(collection(fb.db, "studySessions"), orderBy("startedAt", "desc")));
    return snap.docs.map((d) => readRecord(d.data().record)).filter((r): r is StudyRecord => r !== null);
  },
  async readRecording(rec) {
    const fb = await loadFirebase();
    const { collection, getDocs, orderBy, query } = fb.fs;
    const snap = await getDocs(query(collection(fb.db, "studySessions", rec.id, "chunks"), orderBy("n")));
    if (snap.empty) return null;
    const parts = snap.docs.map((d) => (d.data().data as import("firebase/firestore").Bytes).toUint8Array() as BlobPart);
    return new Blob(parts, { type: rec.recording.mimeType ?? "video/webm" });
  },
};

/** Researchers sign in with Google to read results. */
export async function researcherSignIn(): Promise<void> {
  const fb = await loadFirebase();
  await fb.auth.signInWithPopup(fb.authInstance, new fb.auth.GoogleAuthProvider());
}

export async function researcherSignOut(): Promise<void> {
  const fb = await loadFirebase();
  await fb.auth.signOut(fb.authInstance);
}

/** The signed-in researcher's email, or null (anonymous participants count as nobody). */
export async function researcherEmail(): Promise<string | null> {
  const fb = await loadFirebase();
  const u = fb.authInstance.currentUser;
  return u && !u.isAnonymous ? u.email : null;
}

// ---------------------------------------------------------------------------
// This browser only (no Firebase)
// ---------------------------------------------------------------------------

function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("schedule-smart-study", 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore("sessions", { keyPath: "id" });
      req.result.createObjectStore("chunks");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function run<T>(store: "sessions" | "chunks", mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return idb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const req = fn(db.transaction(store, mode).objectStore(store));
        req.onsuccess = () => resolve(req.result as T);
        req.onerror = () => reject(req.error);
      }),
  );
}

const localBackend: StudyBackend = {
  kind: "local",
  async begin() {},
  async save(rec) {
    await run("sessions", "readwrite", (s) => s.put(JSON.parse(JSON.stringify(rec))));
  },
  async addChunk(sessionId, n, bytes) {
    await run("chunks", "readwrite", (s) => s.put(new Blob([bytes as BlobPart]), `${sessionId}:${String(n).padStart(5, "0")}`));
  },
  async listSessions() {
    const all = await run<unknown[]>("sessions", "readonly", (s) => s.getAll());
    return all.map(readRecord).filter((r): r is StudyRecord => r !== null).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  },
  async readRecording(rec) {
    const range = IDBKeyRange.bound(`${rec.id}:`, `${rec.id}:￿`);
    const parts = await run<Blob[]>("chunks", "readonly", (s) => s.getAll(range));
    return parts.length ? new Blob(parts, { type: rec.recording.mimeType ?? "video/webm" }) : null;
  },
};

export const backend: StudyBackend = usesFirebase ? firebaseBackend : localBackend;
