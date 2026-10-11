import Link from "next/link";
import type { LucideIcon } from "lucide-react";

/**
 * The one button in SmartScheduler. Four looks, each with one job:
 *
 * - primary: the single most important action on a screen (blue). Use it once per screen or dialog.
 * - secondary: every other action (outlined).
 * - quiet: low-stakes actions inside dense lists, such as "Show less" (no outline until hover).
 * - danger: actions that remove things. Always ask before doing them.
 *
 * Icon-only buttons must pass `label`; it becomes the accessible name and the hover tooltip,
 * so the icon never has to be guessed.
 */
export type ButtonVariant = "primary" | "secondary" | "quiet" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

type Common = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  /** Icon after the text, for "go somewhere" buttons (an arrow). */
  trailingIcon?: LucideIcon;
  /** Hide the text and show only the icon. `label` is still required for screen readers and the tooltip. */
  iconOnly?: boolean;
  /** Accessible name and tooltip. Required when iconOnly. */
  label?: string;
  /** Stretch to the full width of the container. */
  block?: boolean;
};

export function buttonClass({ variant = "secondary", size = "md", iconOnly = false, block = false }: Common, extra = ""): string {
  return [
    variant === "primary" ? "btn-primary" : "btn",
    variant === "quiet" ? "btn-quiet" : "",
    variant === "danger" ? "btn-danger" : "",
    size === "lg" ? "btn-lg" : size === "sm" ? "btn-sm" : "",
    iconOnly ? "btn-icon" : "",
    block ? "w-full justify-center" : "",
    extra,
  ]
    .filter(Boolean)
    .join(" ");
}

function Content({ icon: Icon, trailingIcon: Trailing, iconOnly, size, children }: Common & { children?: React.ReactNode }) {
  const px = size === "lg" ? 18 : size === "sm" ? 13 : 15;
  return (
    <>
      {Icon ? <Icon size={px} strokeWidth={2.25} aria-hidden /> : null}
      {iconOnly ? null : children}
      {Trailing && !iconOnly ? <Trailing size={px - 1} aria-hidden /> : null}
    </>
  );
}

export type ButtonProps = Common &
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> & { children?: React.ReactNode; ref?: React.Ref<HTMLButtonElement> };

export function Button({ variant, size, icon, trailingIcon, iconOnly, label, block, className = "", type = "button", children, title, ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClass({ variant, size, iconOnly, block }, className)}
      aria-label={iconOnly ? label : rest["aria-label"]}
      title={title ?? (iconOnly ? label : undefined)}
      {...rest}
    >
      <Content icon={icon} trailingIcon={trailingIcon} iconOnly={iconOnly} size={size}>
        {children}
      </Content>
    </button>
  );
}

/** A link that looks like a button, for actions that go to another page. */
export function ButtonLink({
  href,
  variant,
  size,
  icon,
  trailingIcon,
  block,
  className = "",
  children,
  ...rest
}: Common & { href: string; className?: string; children: React.ReactNode } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "children">) {
  return (
    <Link href={href} className={buttonClass({ variant, size, block }, className)} {...rest}>
      <Content icon={icon} trailingIcon={trailingIcon} size={size}>
        {children}
      </Content>
    </Link>
  );
}

/** An action inside a sentence. Underlined, like every other link, so it reads as clickable. */
export function TextButton({ className = "", type = "button", ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type={type} className={`text-link ${className}`} {...rest} />;
}
