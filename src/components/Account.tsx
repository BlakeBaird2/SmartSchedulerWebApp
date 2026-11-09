"use client";

import { useEffect, useState } from "react";
import { describeWorkspace, hasOwnData } from "@/lib/cloud";
import { sanitizeWorkspace } from "@/lib/workspace";
import { timeAgo } from "@/lib/ui";
import {
  chooseSetup,
  cloudAvailable,
  deleteCloudData,
  finishEmailSignIn,
  forgetEmailLink,
  sendEmailSignIn,
  signInMethods,
  signInWith,
  signOutCloud,
  useCloud,
  type CloudState,
  type SignInMethod,
} from "./cloud";
import { KEYS, parseJson, readStored, writeStored } from "./store";
import { useApp } from "./context";
import { SsIcon } from "./SsIcon";
import { Button, Dialog, DialogActions, TextButton } from "./ui";

/** One line saying where the student's setup stands. */
export function cloudStatusText(cloud: CloudState, now: Date): string {
  switch (cloud.status) {
    case "connecting":
      return "Connecting to your account…";
    case "saving":
      return "Saving to your account…";
    case "synced":
      return cloud.savedAt ? `Synced ${timeAgo(new Date(cloud.savedAt).toISOString(), now)}` : "Synced across your devices";
    case "error":
      return cloud.error ?? "Sync is paused. Your changes are kept on this device.";
    default:
      return "Only on this device";
  }
}

const METHOD_LABEL: Record<SignInMethod, string> = { apple: "Apple", google: "Google", email: "email" };

/** In the profile menu: a clear Sign in, or who's signed in and how saving is going. */
export function AccountMenuSection({ onDone }: { onDone: () => void }) {
  const cloud = useCloud();
  const { now } = useApp();
  if (!cloudAvailable) return null;
  if (!cloud.user) {
    return (
      <>
        <div className="ss-menu-signin">
          <button
            className="ss-primary"
            onClick={() => {
              onDone();
              openSignIn();
            }}
            disabled={cloud.status === "loading"}
          >
            Sign in
          </button>
          <span>Save your calendars and plan to an account, on every device.</span>
        </div>
        <hr />
      </>
    );
  }
  return (
    <>
      <div className="ss-menu-account">
        <strong>{cloud.user.name ?? cloud.user.email}</strong>
        {cloud.user.name && cloud.user.email ? <span className="ss-menu-email">{cloud.user.email}</span> : null}
        <span data-tone={cloud.status === "error" ? "error" : undefined}>{cloudStatusText(cloud, now)}</span>
      </div>
      <button role="menuitem" onClick={() => void signOutCloud().then(onDone)}>
        <SsIcon name="x" size={16} /> Sign out
      </button>
      <hr />
    </>
  );
}

/** Settings → This browser: the account, with sign in or out and a way to delete what it holds. */
export function AccountCard() {
  const cloud = useCloud();
  const { now } = useApp();
  const [busy, setBusy] = useState(false);
  if (!cloudAvailable) return null;
  return (
    <div className="ss-account-card">
      <div>
        <strong>{cloud.user ? `Signed in as ${cloud.user.email ?? cloud.user.name}` : "You're not signed in"}</strong>
        <p>
          {cloud.user
            ? `${cloud.user.method ? `With ${METHOD_LABEL[cloud.user.method]}. ` : ""}${cloudStatusText(cloud, now)}. Your calendars, classes, plan and settings are saved to your account and are the same on every device you sign in on.`
            : "Your calendars and plan are saved in this browser only. Sign in to keep them in your account and use them on your phone and laptop."}
        </p>
      </div>
      <div className="ss-account-actions">
        {cloud.user ? (
          <>
            <button className="ss-quiet-button" onClick={() => void signOutCloud()}>
              Sign out
            </button>
            <button
              className="ss-quiet-button ss-danger-text"
              disabled={busy}
              onClick={async () => {
                if (!window.confirm("Delete everything saved in your account and sign out? This device keeps its own copy.")) return;
                setBusy(true);
                try {
                  await deleteCloudData();
                } finally {
                  setBusy(false);
                }
              }}
            >
              Delete my account data
            </button>
          </>
        ) : (
          <button className="ss-primary" onClick={openSignIn} disabled={cloud.status === "loading"}>
            Sign in
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * The first time a device with its own setup signs in to an account that has a
 * different one, the student picks which to keep. The other is replaced.
 */
export function CloudChoiceDialog() {
  const cloud = useCloud();
  if (!cloud.choice) return null;
  const local = sanitizeWorkspace(parseJson(cloud.choice.local));
  const remote = sanitizeWorkspace(parseJson(cloud.choice.remote));
  return (
    <div className="ss-backdrop">
      <section className="ss-modal" role="dialog" aria-modal="true" aria-labelledby="cloud-choice-title">
        <div className="ss-modal-head">
          <div>
            <span className="ss-eyebrow">YOUR ACCOUNT</span>
            <h2 id="cloud-choice-title">Which setup should this device use?</h2>
          </div>
        </div>
        <p className="ss-modal-lead">This device and your account each have a setup. Pick one to keep everywhere; the other is replaced.</p>
        <div className="ss-choice-cards">
          <button type="button" onClick={() => void chooseSetup("account")}>
            <strong>The one in my account</strong>
            <span>{describeWorkspace(remote)}</span>
          </button>
          <button type="button" onClick={() => void chooseSetup("device")}>
            <strong>The one on this device</strong>
            <span>{describeWorkspace(local)}</span>
          </button>
        </div>
      </section>
    </div>
  );
}

/** Google's "G", so the sign-in button is recognisable at a glance. */
export function GoogleMark({ size = 18 }: { size?: number }) {
  return (
    <span className="shrink-0 grid place-items-center rounded-full bg-white p-[3px]" aria-hidden>
    <svg width={size} height={size} viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z" />
    </svg>
    </span>
  );
}

/** Apple's logo, for the Sign in with Apple button. */
function AppleMark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M16.37 12.62c-.03-2.66 2.17-3.94 2.27-4-1.24-1.81-3.16-2.06-3.84-2.09-1.63-.17-3.19.96-4.02.96-.84 0-2.11-.94-3.47-.91-1.78.03-3.43 1.04-4.35 2.63-1.86 3.22-.47 7.98 1.33 10.6.89 1.27 1.93 2.71 3.3 2.66 1.33-.05 1.83-.86 3.43-.86 1.6 0 2.05.86 3.45.83 1.43-.02 2.33-1.29 3.2-2.58 1.01-1.47 1.42-2.9 1.44-2.97-.03-.01-2.76-1.06-2.79-4.21ZM13.73 4.81c.73-.89 1.23-2.12 1.09-3.35-1.05.04-2.33.7-3.08 1.58-.67.78-1.27 2.04-1.11 3.24 1.17.09 2.37-.6 3.1-1.47Z" />
    </svg>
  );
}

const OPEN_SIGN_IN = "prio:open-sign-in";
/** Set when the page was opened as /app#signin, until the sign-in window opens. */
let signInFromLink = false;

/** Open the sign-in window from anywhere. */
export function openSignIn() {
  window.dispatchEvent(new Event(OPEN_SIGN_IN));
}

/**
 * The one way to sign in, used everywhere: Continue with Apple, Continue with
 * Google, or an email link. Signing in the first time makes the account, so
 * there is no separate sign-up and no password to remember.
 */
export function SignInPanel() {
  const cloud = useCloud();
  const [busy, setBusy] = useState<SignInMethod | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const loading = cloud.status === "loading";
  const confirming = cloud.emailLinkNeedsEmail;

  const withProvider = async (method: "apple" | "google") => {
    setBusy(method);
    setError(null);
    answeredThisVisit = true;
    const problem = await signInWith(method);
    setBusy(null);
    if (problem) setError(problem);
  };

  const withEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const address = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      setError("Enter your email address, like name@school.edu.");
      return;
    }
    setBusy("email");
    setError(null);
    answeredThisVisit = true;
    const problem = confirming ? await finishEmailSignIn(address) : await sendEmailSignIn(address);
    setBusy(null);
    if (problem) setError(problem);
    else if (!confirming) setSentTo(address);
  };

  if (sentTo) {
    return (
      <div className="ss-signin" aria-live="polite">
        <div className="ss-signin-sent">
          <strong>Check your email</strong>
          <p>
            We sent a sign-in link to <b>{sentTo}</b>. Open it on this device to finish signing in. It can take a minute; check spam if it doesn&apos;t
            show up.
          </p>
        </div>
        <div className="ss-signin-row">
          <TextButton onClick={() => setSentTo(null)}>Use a different email</TextButton>
          <TextButton onClick={() => void sendEmailSignIn(sentTo)}>Send it again</TextButton>
        </div>
      </div>
    );
  }

  return (
    <div className="ss-signin">
      {confirming ? (
        <p className="ss-signin-note">You opened a sign-in link. Enter the email it was sent to, to finish signing in.</p>
      ) : (
        <>
          {signInMethods.apple ? (
            <button type="button" className="ss-signin-provider ss-signin-apple" disabled={loading || busy !== null} onClick={() => void withProvider("apple")}>
              <AppleMark />
              {busy === "apple" ? "Signing in…" : "Continue with Apple"}
            </button>
          ) : null}
          {signInMethods.google ? (
            <button type="button" className="ss-signin-provider" disabled={loading || busy !== null} onClick={() => void withProvider("google")}>
              <GoogleMark />
              {busy === "google" ? "Signing in…" : "Continue with Google"}
            </button>
          ) : null}
          {signInMethods.email ? <div className="ss-signin-or">or</div> : null}
        </>
      )}
      {signInMethods.email || confirming ? (
        <form className="ss-signin-email" onSubmit={(e) => void withEmail(e)} noValidate>
          <label htmlFor="signin-email">Email</label>
          <input
            id="signin-email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="name@school.edu"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading || busy !== null}
          />
          <button type="submit" className="ss-primary" disabled={loading || busy !== null}>
            {busy === "email" ? (confirming ? "Signing in…" : "Sending…") : confirming ? "Finish signing in" : "Continue with email"}
          </button>
        </form>
      ) : null}
      {error ? (
        <p className="ss-signin-error" role="alert">
          {error}
        </p>
      ) : null}
      {confirming ? null : (
        <p className="ss-signin-fine">New here? Signing in creates your free account. No password needed.</p>
      )}
    </div>
  );
}

/**
 * The sign-in window: opened by any Sign in button (openSignIn), by /app#signin
 * (the home page's Sign in), or by an email link that needs its address. It
 * closes itself once signed in. While setup is showing it stays shut: setup's
 * first step is the same sign-in, so a window on top of it would ask twice.
 */
export function SignInDialog({ duringSetup }: { duringSetup: boolean }) {
  const cloud = useCloud();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(OPEN_SIGN_IN, show);
    // The home page's Sign in arrives as /app#signin. (Remembered outside the
    // effect, which React may run twice, so tidying the address doesn't lose it.)
    if (window.location.hash === "#signin") {
      // During setup the sign-in step is already on screen; just tidy the address.
      if (!duringSetup) signInFromLink = true;
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
    const timer = signInFromLink
      ? setTimeout(() => {
          signInFromLink = false;
          show();
        }, 0)
      : undefined;
    return () => {
      window.removeEventListener(OPEN_SIGN_IN, show);
      clearTimeout(timer);
    };
    // Only how the page was opened matters, so this runs once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shown = cloudAvailable && !duringSetup && !cloud.user && (open || cloud.emailLinkNeedsEmail);
  if (!shown) return null;
  return (
    <Dialog
      title={cloud.emailLinkNeedsEmail ? "Finish signing in" : "Sign in to Schedule Smart"}
      description={cloud.emailLinkNeedsEmail ? undefined : "Save your calendars and plan to your account, and pick up where you left off on any device."}
      onClose={() => {
        setOpen(false);
        forgetEmailLink();
      }}
      size="sm"
    >
      <SignInPanel />
    </Dialog>
  );
}

/** How long "Not now" keeps the sign-in pop-up away. */
const ASK_AGAIN_DAYS = 7;
/** Set once the student has answered the question this visit (during setup, or in the pop-up). */
let answeredThisVisit = false;

/** Don't ask again for a while (`days`), or ever. */
export function snoozeSignIn(days: number | "never") {
  answeredThisVisit = true;
  writeStored(KEYS.signInAsk, days === "never" ? "never" : new Date(Date.now() + days * 86_400_000).toISOString());
}

function mayAsk(now: Date): boolean {
  if (answeredThisVisit) return false;
  const until = readStored(KEYS.signInAsk);
  if (until === "never") return false;
  return !until || !(Date.parse(until) > now.getTime());
}

/**
 * The first step of setup when sign-in is available: sign in (Apple, Google or
 * email) so the setup is kept in an account, or carry on without one. Someone
 * who already has a setup in their account gets it straight away and skips the rest.
 */
export function AccountStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold">Sign in to save your schedule</h2>
        <p className="mt-1 text-sm text-muted leading-relaxed">Your calendars and plan are saved to your account, so they&apos;re on your phone and laptop.</p>
      </div>
      <SignInPanel />
      <button
        type="button"
        className="ss-signin-skip"
        onClick={() => {
          snoozeSignIn(ASK_AGAIN_DAYS);
          onNext();
        }}
      >
        Continue without an account
      </button>
    </div>
  );
}

/**
 * Someone who uses Schedule Smart without an account is asked, once in a while,
 * whether to sign in so their setup is kept across devices. Waits for a quiet
 * moment: never over another pop-up, nor straight after setup asked the same.
 */
export function SignInPrompt({ blocked }: { blocked: boolean }) {
  const cloud = useCloud();
  const { ws, now } = useApp();
  const [open, setOpen] = useState(false);
  const eligible = cloudAvailable && cloud.status === "signed-out" && hasOwnData(ws) && !blocked;

  useEffect(() => {
    if (!eligible || open) return;
    // A moment after the app opens, once nothing else is asking for attention.
    const timer = setInterval(() => {
      if (!mayAsk(new Date())) return clearInterval(timer);
      if (document.querySelector('[role="dialog"]')) return;
      clearInterval(timer);
      setOpen(true);
    }, 2500);
    return () => clearInterval(timer);
  }, [eligible, open]);

  if (!open || !eligible || cloud.user || !mayAsk(now)) return null;
  const close = (days: number | "never") => {
    snoozeSignIn(days);
    setOpen(false);
  };

  return (
    <Dialog
      title="Save your schedule to an account?"
      description="Right now your calendars and plan are only in this browser. Sign in to keep them safe and see the same schedule on your phone and laptop."
      onClose={() => close(ASK_AGAIN_DAYS)}
      size="sm"
    >
      <SignInPanel />
      <DialogActions
        aside={
          <TextButton className="text-xs text-muted" onClick={() => close("never")}>
            Don&apos;t ask again
          </TextButton>
        }
      >
        <Button onClick={() => close(ASK_AGAIN_DAYS)}>Not now</Button>
      </DialogActions>
    </Dialog>
  );
}
