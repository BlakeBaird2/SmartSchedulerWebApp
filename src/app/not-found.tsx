import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, House } from "lucide-react";
import { PrototypeBadge } from "@/components/Prototype";
import { ButtonLink, Wordmark } from "@/components/ui";

export const metadata: Metadata = {
  title: "Page not found · SmartScheduler",
  robots: { index: false },
};

/**
 * Any address that doesn't exist. Same wireframe look as the rest of the prototype,
 * says plainly what happened, restates what SmartScheduler does, and offers the
 * two ways back, so it is never a dead end.
 */
export default function NotFound() {
  return (
    <div className="min-h-dvh flex flex-col">
      <header className="border-b border-line-strong">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-2">
          <Link href="/" className="shrink-0" aria-label="SmartScheduler home page">
            <Wordmark />
          </Link>
          <PrototypeBadge />
        </div>
      </header>
      <main className="flex-1 grid place-items-center px-4 py-16">
        <div className="max-w-lg w-full border-2 border-fg p-6 sm:p-8">
          <p className="section-title">Page not found</p>
          <h1 className="mt-2 text-3xl font-bold leading-tight">There&apos;s nothing at this address.</h1>
          <p className="mt-3 text-muted leading-relaxed">
            The link may be mistyped, or the page may have moved. SmartScheduler shows you exactly what to work on in every free gap of your day. Pick up
            from one of these:
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <ButtonLink href="/app" variant="primary" trailingIcon={ArrowRight}>
              Open SmartScheduler
            </ButtonLink>
            <ButtonLink href="/" icon={House}>
              Home page
            </ButtonLink>
          </div>
        </div>
      </main>
    </div>
  );
}
