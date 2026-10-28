"use client";

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { Button } from "./Button";

/**
 * Every pop-up in Schedule Smart is this one component, so they all behave the same way:
 *
 * - a dimmed backdrop; clicking it closes the dialog (unless `dismissible` is false)
 * - Esc closes it, and the X in the top-right corner closes it
 * - focus moves into it when it opens, stays inside while it is open, and returns
 *   to whatever opened it when it closes
 * - actions sit bottom-right in the same order everywhere: the way out first,
 *   the main action last (see DialogActions)
 *
 * `placement="side"` turns it into a panel that slides in from the right (a sheet
 * from the bottom on phones), used for task and event details.
 */
export function Dialog({
  title,
  description,
  label,
  onClose,
  onSubmit,
  dismissible = true,
  placement = "center",
  size = "md",
  hideClose = false,
  elevated = false,
  blurBackground = false,
  className = "",
  style,
  children,
}: {
  /** Heading shown at the top. Omit only when the content draws its own heading; then pass `label`. */
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Accessible name when there is no visible title. */
  label?: string;
  onClose: () => void;
  /** Makes the dialog a form; pressing Enter in a field submits it. */
  onSubmit?: (e: React.FormEvent<HTMLFormElement>) => void;
  dismissible?: boolean;
  placement?: "center" | "side";
  size?: "sm" | "md" | "lg";
  hideClose?: boolean;
  /** Draw above every other dialog (the prototype notice). */
  elevated?: boolean;
  /** Softly blur the page behind, for moments that need full attention (the walkthrough). */
  blurBackground?: boolean;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const titleId = useId();
  const descId = useId();
  const panel = useRef<HTMLElement | null>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const el = panel.current;
    if (el) {
      const first = el.querySelector<HTMLElement>("[data-autofocus], [autofocus]") ?? focusables(el).find((f) => !f.dataset.dialogClose) ?? el;
      first.focus({ preventScroll: true });
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dismissible) {
        e.stopPropagation();
        closeRef.current();
      }
      if (e.key === "Tab" && panel.current) {
        const items = focusables(panel.current);
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.({ preventScroll: true });
    };
  }, [dismissible]);

  const width = size === "sm" ? "max-w-sm" : size === "lg" ? "max-w-lg" : "max-w-md";
  const frame =
    placement === "side"
      ? "panel-enter fixed bg-surface flex flex-col inset-x-0 bottom-0 max-h-[85dvh] rounded-t-2xl border-t border-line shadow-[var(--shadow-lg)] md:inset-y-0 md:right-0 md:left-auto md:w-[26rem] md:max-h-none md:rounded-none md:border-t-0 md:border-l"
      : `fixed inset-x-4 top-[8vh] mx-auto ${width} bg-surface rounded-2xl border border-line shadow-[var(--shadow-lg)] p-5 sm:p-6 fade-in max-h-[84dvh] overflow-y-auto scrollbar-thin`;

  const content = (
    <>
      {title ? (
        <div className="flex items-start gap-3 mb-4">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-xl font-bold leading-snug tracking-tight">
              {title}
            </h2>
            {description ? (
              <p id={descId} className="mt-1 text-sm text-muted leading-relaxed">
                {description}
              </p>
            ) : null}
          </div>
          {hideClose ? null : <Button iconOnly icon={X} label="Close" onClick={onClose} className="-mr-1 -mt-1" data-dialog-close="true" />}
        </div>
      ) : null}
      {children}
    </>
  );

  const shared = {
    role: "dialog",
    "aria-modal": true,
    "aria-labelledby": title ? titleId : undefined,
    "aria-describedby": title && description ? descId : undefined,
    "aria-label": title ? undefined : label,
    tabIndex: -1,
    className: `${frame} ${elevated ? "z-[80]" : "z-50"} ${className}`,
    style,
  } as const;

  return (
    <>
      <div className={`fixed inset-0 bg-black/40 fade-in ${elevated ? "z-[79]" : "z-40"} ${blurBackground ? "backdrop-soft-blur" : ""}`} onClick={dismissible ? onClose : undefined} aria-hidden />
      {onSubmit ? (
        <form ref={(n) => void (panel.current = n)} onSubmit={onSubmit} {...shared}>
          {content}
        </form>
      ) : (
        <div ref={(n) => void (panel.current = n)} {...shared}>
          {content}
        </div>
      )}
    </>
  );
}

/**
 * The row of buttons at the bottom of a dialog. Order is always the same: the way
 * out (Cancel, Keep what's here) first, the main action last, both on the right,
 * where people look for "finish". Anything that resets or removes goes on the far left,
 * away from the main action, so it can't be hit by accident.
 */
export function DialogActions({ children, aside, className = "" }: { children: React.ReactNode; aside?: React.ReactNode; className?: string }) {
  return (
    <div className={`mt-5 pt-4 border-t border-line flex items-center gap-2 flex-wrap ${className}`}>
      {aside ? <div className="mr-auto">{aside}</div> : null}
      <div className="ml-auto flex items-center gap-2">{children}</div>
    </div>
  );
}

function focusables(root: HTMLElement): HTMLElement[] {
  return [
    ...root.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ].filter((el) => el.offsetParent !== null || el === document.activeElement);
}
