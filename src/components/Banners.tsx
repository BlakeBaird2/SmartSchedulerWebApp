"use client";

import { useApp } from "./context";
import { resetEverything } from "./store";
import { Button, Callout, TextButton } from "./ui";

/** Messages about the whole app, shown above every screen while they apply. */
export function Banners() {
  const { ws, snapshot, setView } = useApp();
  const broken = ws.feeds.filter((f) => f.enabled && snapshot.feeds[f.id]?.error);

  return (
    <>
      {ws.demo ? (
        <Callout
          tone="sample"
          className="mt-4"
          title="You're looking at sample data."
          actions={<Button onClick={resetEverything}>Use my own calendars</Button>}
        >
          Everything here is made up. Press Done on the top task to see the plan move.
        </Callout>
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
