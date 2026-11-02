# Signing in and syncing devices (Firebase)

SmartScheduler can keep the same setup on a phone and a laptop: sign in with
Google once on each and your calendars, classes, schedule, done marks and
settings stay the same on both, updating live. It uses Firebase's free plan
(Authentication + Firestore). It is **optional**: without the keys below, the app
works exactly as before, from the browser alone, and Firebase is never
downloaded.

## What's stored

- One document per account, `users/{uid}`, holding the setup as JSON, when it
  was saved and which device saved it. Calendar contents are not stored; each
  device reads the calendar links itself.
- Only the signed-in owner can read, change or delete their document
  ([`firestore.rules`](firestore.rules)). Nothing else in the database is
  readable or writable.
- **Delete my account data** (Settings → This browser) deletes the document and
  signs out. Signing out keeps what's on that device.

## Set it up (about 10 minutes)

1. Go to [console.firebase.google.com](https://console.firebase.google.com) →
   **Create a project** (any name, e.g. `schedule-smart`). Google Analytics isn't
   needed.
2. **Build → Authentication → Get started → Sign-in method → Google** → turn it
   on, pick a support email, **Save**.
3. **Authentication → Settings → Authorized domains → Add domain**:
   `smartschedulerwebapp.vercel.app` (and any other domain the app is served
   from). `localhost` is already there for development.
4. **Build → Firestore Database → Create database** → pick a location near your
   users (e.g. `nam5 (United States)`) → **Start in production mode** → Create.
5. In Firestore, open the **Rules** tab, replace everything with the contents of
   [`firestore.rules`](firestore.rules), and **Publish**.
6. **Project settings** (the gear) → **General → Your apps → Web (`</>`)** →
   register an app (no Hosting needed). Copy four values from the
   `firebaseConfig` it shows: `apiKey`, `authDomain`, `projectId`, `appId`.
7. In Vercel: **Project → Settings → Environment Variables**, add (for
   Production, Preview and Development):

   | Name | Value |
   | --- | --- |
   | `NEXT_PUBLIC_FIREBASE_API_KEY` | `apiKey` |
   | `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `authDomain` (like `your-project.firebaseapp.com`) |
   | `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `projectId` |
   | `NEXT_PUBLIC_FIREBASE_APP_ID` | `appId` |

   Then **Deployments → Redeploy**. These values are built into the page, so
   they only take effect after a new build.
8. For local development, copy [`.env.example`](.env.example) to `.env.local`,
   fill in the same four values, and restart `npm run dev`.

A Firebase web API key is meant to be public; what protects the data is the
security rules (step 5) and the authorized domains (step 3).

**Docker:** `NEXT_PUBLIC_` values are read at build time, so pass them to
`docker build` (for example as `--build-arg`s exported to the environment of
`npm run build`).

## How syncing behaves

- The copy in the browser stays the one the app works from, so it opens
  instantly and works offline. A change is saved to the account about a second
  later; a change saved from another device arrives within a moment.
- **First sign-in on a device:**
  - if the account is empty, this device's setup is uploaded;
  - if this device has nothing of its own (or only sample data), it takes the
    account's and skips setup;
  - if both have a setup and they differ, the student picks which to keep.
- **Later visits:** each device remembers the setup it last agreed on with the
  account. If only the account changed, the device takes it; if only the device
  changed (say, while offline), it's saved up; if both changed, the student
  picks.
- Two devices editing at the same moment: the last save wins.
- Sample data and an empty setup are never saved over a real one. **Start over**
  on a device signs it out rather than emptying the account.

## Develop and test without a project

Firebase's emulators run sign-in and the database on your computer:

```bash
npm install -g firebase-tools   # needs Java for the Firestore emulator
firebase emulators:start --only auth,firestore --project demo-schedule-smart
```

Then run the app with any values for the four keys, plus
`NEXT_PUBLIC_FIREBASE_EMULATOR=true` (see `.env.example`). The emulator's sign-in
page lets you make up Google accounts.
