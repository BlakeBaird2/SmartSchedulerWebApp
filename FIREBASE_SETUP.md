# Signing in and syncing devices (Firebase)

SmartScheduler can keep the same setup on a phone and a laptop: sign in once on
each (with Apple, Google, or a link sent to your email) and your calendars,
classes, schedule, done marks and settings stay the same on both, updating live.
Signing in the first time creates the account; there are no passwords. It uses Firebase's free plan
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

## Sign-in methods: Apple, Google and email

Which buttons the sign-in window shows comes from one setting in Vercel:

| Name | Value |
| --- | --- |
| `NEXT_PUBLIC_SIGN_IN_METHODS` | `apple,google,email` (any of the three; Google alone if it's missing) |

Turn each one on in Firebase **before** adding it here, then **Redeploy**. A
method listed here but not turned on in Firebase shows a button that fails.

### Google (done in step 2 above)

Authentication → Sign-in method → Google → Enabled.

### Email (a sign-in link, no password)

1. Authentication → **Sign-in method** → **Add new provider** → **Email/Password**.
2. Turn on **Email/Password** *and* **Email link (passwordless sign-in)** → **Save**.
   (The first switch has to be on for the second to work. The app never asks
   for a password.)
3. Authentication → **Settings → Authorized domains**: make sure
   `smartschedulerwebapp.vercel.app` is listed (it already is if Google sign-in works).
4. Optional: Authentication → **Templates → Email address sign-in**: set the
   sender name to `Schedule Smart` so the email is easy to recognise. The
   link email comes from `noreply@<your-project>.firebaseapp.com`; ask testers
   to check spam the first time.

The person types their email, gets a link, and opens it **on the same device**
to finish. Opened on another device, the app asks for the email once more.

### Apple (needs a paid Apple Developer account, $99/year)

Sign in with Apple can only be set up from an Apple Developer Program
membership (developer.apple.com/programs). With one:

1. In **Certificates, Identifiers & Profiles → Identifiers**, open (or create) an
   **App ID** and tick **Sign In with Apple**.
2. **Identifiers → + → Services IDs**: create one (e.g. `com.smartscheduler.web`;
   this is the *Services ID*). Tick **Sign In with Apple** → **Configure**:
   - Primary App ID: the one from step 1.
   - Domains: `<your-project>.firebaseapp.com`
   - Return URLs: `https://<your-project>.firebaseapp.com/__/auth/handler`
   (Use your project's `authDomain`, the `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` value.)
3. **Keys → +**: name it, tick **Sign In with Apple** → Configure → pick the App
   ID → Register. **Download the .p8 file** (only once) and note the **Key ID**.
   Your **Team ID** is at the top right of the developer site.
4. Firebase: Authentication → **Sign-in method** → **Add new provider** →
   **Apple** → Enable, and fill in the **Services ID**, **Apple team ID**,
   **Key ID** and the **private key** (paste the contents of the .p8) → Save.
5. Add `apple` to `NEXT_PUBLIC_SIGN_IN_METHODS` in Vercel and redeploy.

People who choose "Hide my email" get a private relay address; that's fine,
the app only uses it as their account name.

**One account per email.** Firebase keeps one account per email address by
default, so someone who signed in with Google and later asks for an email link
to the same address reaches the same account. If they try a different method
whose email clashes, the window tells them to sign in the way they did before.

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
