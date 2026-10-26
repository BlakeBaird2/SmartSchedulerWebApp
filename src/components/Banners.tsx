"use client";

import { House, Sparkles } from "lucide-react";
import { useApp } from "./context";
import { resetEverything } from "./store";
import { Button, ButtonLink, Callout, TextButton } from "./ui";

/** Messages about the whole app, shown above every screen while they apply. */
export function Banners() {
  const { ws, snapshot, setView } = useApp();
  const broken = ws.feeds.filter((f) => f.enabled && snapshot.feeds[f.id]?.error);

  return (
    <>
      {ws.demo ? (
        <>
          {/* Phones: one slim line, so the screen's own content starts sooner. */}
          <div role="note" className="md:hidden mt-3 flex items-center gap-2.5 rounded-xl border border-accent/25 bg-accent-soft pl-3 pr-1.5 py-1.5 text-sm">
            <Sparkles size={16} className="shrink-0" aria-hidden />
            <span className="flex-1 min-w-0 leading-snug">
              <b className="font-semibold">Sample data.</b> <span className="text-muted">Nothing here is real.</span>
            </span>
            <ButtonLink href="/" size="sm" variant="quiet" icon={House} className="btn-icon" title="Back to the home page">
              <span className="sr-only">Back to the home page</span>
            </ButtonLink>
            <Button size="sm" onClick={resetEverything}>
              Use mine
            </Button>
          </div>
          <div className="hidden md:block">
            <Callout
              tone="sample"
              className="mt-4"
              title="You're looking at sample data."
              actions={
                <>
                  {/* An easy way back out of the sample, to where it started. */}
                  <ButtonLink href="/" variant="quiet" icon={House}>
                    Back to home page
                  </ButtonLink>
                  <Button onClick={resetEverything}>Use my own calendars</Button>
                </>
              }
            >
              Everything here is made up. Press Done on the top task to see the plan move.
            </Callout>
          </div>
        </>
      ) : null}
      {broken.length > 0 ? (
        <Callout
          tone="warning"
          className="mt-4"
          title={broken.length === 1 ? `${broken[0].name} couldn't be read` : `${broken.length} calendars couldn't be read`}
        >
          {broken.length === 1 ? snapshot.feeds[broken[0].id]?.error : "Their last good copies are still shown."}{" "}
          <TextButton onClick={() => setView("settings")}>Check calendars</TextButton>
        </Callout>
      ) : null}
    </>
  );
}
