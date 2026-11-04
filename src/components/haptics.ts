"use client";

/*
 * A small tap you can feel, when something is picked up or a page turns.
 *
 * Phones that support the web's Vibration API (Chrome and most browsers on
 * Android) get a short buzz. Safari on iPhone has no vibration API, but since
 * iOS 18 it plays the system's haptic tick when a switch (an
 * <input type="checkbox" switch>) is toggled, so a hidden one is toggled
 * instead. Anywhere neither works, nothing happens.
 */

let toggle: HTMLLabelElement | null = null;

/** A hidden switch whose toggling iOS answers with a haptic tick. */
function iosSwitch(): HTMLLabelElement | null {
  if (typeof document === "undefined") return null;
  if (toggle?.isConnected) return toggle;
  const label = document.createElement("label");
  label.setAttribute("aria-hidden", "true");
  label.style.cssText = "position:fixed;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;left:-100px;top:0";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.setAttribute("switch", "");
  input.tabIndex = -1;
  label.appendChild(input);
  document.body.appendChild(label);
  toggle = label;
  return label;
}

const isIOS = () => typeof navigator !== "undefined" && /iP(hone|ad|od)/.test(navigator.userAgent) && !("vibrate" in navigator);

/** A short tap: `ms` long where the phone can vibrate, otherwise iOS's tick. */
export function haptic(ms = 12) {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(ms);
      return;
    }
    if (isIOS()) iosSwitch()?.click();
  } catch {
    // Feeling it is a nicety; never let it break anything.
  }
}
