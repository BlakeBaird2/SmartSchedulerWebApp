"use client";

import { CircleAlert, Info, Sparkles, type LucideIcon } from "lucide-react";

/**
 * Card: one box = one group. Everything inside a card belongs together (Gestalt:
 * common region), and the card's title says what the group is.
 */
export function Card({
  as: Tag = "section",
  padding = "md",
  className = "",
  children,
  ...rest
}: {
  as?: "section" | "div" | "article";
  padding?: "none" | "sm" | "md" | "lg";
  className?: string;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLElement>) {
  const pad = padding === "none" ? "" : padding === "sm" ? "p-3" : padding === "lg" ? "p-6 sm:p-8" : "p-4 sm:p-5";
  return (
    <Tag className={`card ${pad} ${className}`} {...rest}>
      {children}
    </Tag>
  );
}

/** The heading row of a card: a title, an optional one-line hint under it, and an optional action on the right. */
export function CardHeader({
  title,
  hint,
  action,
  level = 2,
  className = "",
}: {
  title: React.ReactNode;
  hint?: React.ReactNode;
  action?: React.ReactNode;
  level?: 2 | 3;
  className?: string;
}) {
  const H = level === 2 ? "h2" : "h3";
  return (
    <div className={`flex items-start gap-3 flex-wrap ${className}`}>
      <div className="min-w-0 flex-1 basis-48">
        <H className="text-lg font-bold leading-snug">{title}</H>
        {hint ? <div className="mt-0.5 text-sm text-muted leading-relaxed">{hint}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/** Small uppercase label above a group of items inside a card ("WORK ON", "TUESDAY, OCT 13"). */
export function SectionLabel({
  children,
  tone = "default",
  className = "",
  as: Tag = "div",
}: {
  children: React.ReactNode;
  tone?: "default" | "alert";
  className?: string;
  as?: "div" | "h3";
}) {
  return <Tag className={`section-title ${tone === "alert" ? "!text-danger" : ""} ${className}`}>{children}</Tag>;
}

const CALLOUT: Record<"info" | "warning" | "sample", { icon: LucideIcon; frame: string }> = {
  info: { icon: Info, frame: "border border-line-strong bg-surface-2" },
  sample: { icon: Sparkles, frame: "border border-dashed border-line-strong bg-surface-2" },
  warning: { icon: CircleAlert, frame: "border-2 border-fg bg-surface" },
};

/**
 * A message about the screen, set apart from the content: sample data, a missing
 * setup step, a calendar that failed to load. The tone sets its icon and border,
 * so a warning never relies on colour alone. Actions sit on the right.
 */
export function Callout({
  tone = "info",
  title,
  icon,
  actions,
  className = "",
  children,
}: {
  tone?: "info" | "warning" | "sample";
  title: React.ReactNode;
  icon?: LucideIcon;
  actions?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  const meta = CALLOUT[tone];
  const Icon = icon ?? meta.icon;
  return (
    <div role={tone === "warning" ? "alert" : "note"} className={`${meta.frame} px-4 py-3 flex items-start gap-3 flex-wrap ${className}`}>
      <Icon size={18} className="shrink-0 mt-0.5" aria-hidden />
      <div className="min-w-0 flex-1 basis-60">
        <p className="font-semibold leading-snug">{title}</p>
        {children ? <div className="mt-0.5 text-sm text-muted leading-relaxed">{children}</div> : null}
      </div>
      {actions ? <div className="flex items-center gap-2 flex-wrap">{actions}</div> : null}
    </div>
  );
}

/**
 * What a list shows when it has nothing in it: what is missing, why, and the one
 * thing to do about it. Never a blank space.
 */
export function EmptyState({
  icon: Icon,
  title,
  action,
  compact = false,
  className = "",
  children,
}: {
  icon?: LucideIcon;
  title: React.ReactNode;
  action?: React.ReactNode;
  compact?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={`text-center ${compact ? "px-3 py-5" : "card px-6 py-10"} ${className}`}>
      {Icon ? <Icon size={compact ? 20 : 28} className="mx-auto text-muted" aria-hidden /> : null}
      <p className={`${Icon ? "mt-2" : ""} font-semibold`}>{title}</p>
      {children ? <div className="mt-1 text-sm text-muted leading-relaxed max-w-md mx-auto">{children}</div> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
