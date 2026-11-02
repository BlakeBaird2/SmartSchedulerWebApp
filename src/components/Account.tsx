"use client";

import { useState } from "react";
import { describeWorkspace } from "@/lib/cloud";
import { sanitizeWorkspace } from "@/lib/workspace";
import { timeAgo } from "@/lib/ui";
import { chooseSetup, cloudAvailable, deleteCloudData, signInCloud, signOutCloud, useCloud, type CloudState } from "./cloud";
import { parseJson } from "./store";
import { useApp } from "./context";
import { SsIcon } from "./SsIcon";

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
