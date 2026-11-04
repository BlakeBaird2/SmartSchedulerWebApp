"use client";

import { useEffect, useState } from "react";
import { describeWorkspace, hasOwnData } from "@/lib/cloud";
import { sanitizeWorkspace } from "@/lib/workspace";
import { timeAgo } from "@/lib/ui";
import { chooseSetup, cloudAvailable, deleteCloudData, signInCloud, signOutCloud, useCloud, type CloudState } from "./cloud";
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

/** In the profile menu: sign in to sync, or who's signed in and how sync is going. */
export function AccountMenuSection({ onDone }: { onDone: () => void }) {
  const cloud = useCloud();
  const { now } = useApp();
  if (!cloudAvailable) return null;
  if (!cloud.user) {
    return (
      <>
        <button role="menuitem" onClick={() => void signInCloud().then(onDone)} disabled={cloud.status === "loading"}>
          <SsIcon name="refresh" size={16} /> Sign in to sync your devices
        </button>
        <hr />
      </>
    );
  }
  return (
    <>
      <div className="ss-menu-account">
        <strong>{cloud.user.name ?? cloud.user.email}</strong>
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
        <strong>{cloud.user ? `Signed in as ${cloud.user.email ?? cloud.user.name}` : "Sync your phone and laptop"}</strong>
        <p>
          {cloud.user
            ? `${cloudStatusText(cloud, now)}. Your calendars, classes, schedule and settings are kept in your account and stay the same on every device you sign in on.`
            : "Sign in with Google and your calendars, classes, schedule and settings are kept in your account, the same on every device you sign in on. Without signing in, everything stays in this browser only."}
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
          <button className="ss-primary" onClick={() => void signInCloud()} disabled={cloud.status === "loading"}>
            Sign in with Google
          </button>
        )}
      </div>
    </div>
  );
}

/** During setup: someone who already uses Schedule Smart elsewhere signs in instead. */
export function SetupSignIn() {
  const cloud = useCloud();
  if (!cloudAvailable || cloud.user) return null;
  return (
    <p className="ss-setup-signin">
      Already use Schedule Smart on another device?{" "}
      <button type="button" onClick={() => void signInCloud()} disabled={cloud.status === "loading"}>
        Sign in to bring your calendars
      </button>
    </p>
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
 * The first step of setup when sign-in is available: sign in with Google so the
 * setup is kept in an account, or carry on with this browser only. Someone who
 * already has a setup in their account gets it straight away and skips the rest.
 */
export function AccountStep({ onNext }: { onNext: () => void }) {
  const cloud = useCloud();
  const checking = cloud.status === "loading" || cloud.status === "connecting";
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold">Save your schedule to your Google account?</h2>
        <p className="mt-1 text-sm text-muted leading-relaxed">
          Sign in and your calendars, classes and plan are kept in your account, the same on your phone and your laptop. If you already use Schedule Smart
          on another device, everything comes across. Or skip it and keep everything in this browser only. You can sign in any time from your profile menu.
        </p>
      </div>
      <div className="flex flex-col gap-2.5">
        <Button
          variant="primary"
          block
          data-autofocus
          disabled={checking}
          onClick={() => {
            answeredThisVisit = true;
            void signInCloud();
          }}
        >
          <GoogleMark />
          {checking ? "Checking your account…" : "Continue with Google"}
        </Button>
        <Button
          block
          onClick={() => {
            snoozeSignIn(ASK_AGAIN_DAYS);
            onNext();
          }}
        >
          Not now, use this browser only
        </Button>
      </div>
      {cloud.error ? <p className="text-sm text-danger">{cloud.error}</p> : null}
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
      title="Keep your schedule on all your devices?"
      description="Right now your calendars and plan are saved in this browser only. Sign in with Google to keep them in your account and see the same schedule on your phone and laptop."
      onClose={() => close(ASK_AGAIN_DAYS)}
      size="sm"
    >
      <Button
        variant="primary"
        block
        data-autofocus
        onClick={() => {
          answeredThisVisit = true;
          setOpen(false);
          void signInCloud();
        }}
      >
        <GoogleMark />
        Sign in with Google
      </Button>
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
