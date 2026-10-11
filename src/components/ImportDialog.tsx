"use client";

import type { Workspace } from "@/lib/types";
import { plural } from "@/lib/ui";
import { Button, Dialog, DialogActions } from "./ui";

/** Opening someone's setup link would overwrite this browser's setup, so ask first. */
export function ImportDialog({ incoming, onConfirm, onCancel }: { incoming: Workspace; onConfirm: () => void; onCancel: () => void }) {
  return (
    <Dialog
      title="Replace this browser's setup?"
      description={`The link you opened has ${plural(incoming.feeds.length, "calendar")} and its own settings. Importing replaces the calendars and settings already in this browser.`}
      onClose={onCancel}
      dismissible={false}
      hideClose
    >
      <ul className="text-sm space-y-1">
        {incoming.feeds.map((f) => (
          <li key={f.id} className="truncate">
            · {f.name} <span className="text-muted">({f.role})</span>
          </li>
        ))}
      </ul>
      <DialogActions>
        <Button onClick={onCancel}>Keep what&apos;s here</Button>
        <Button variant="primary" onClick={onConfirm}>
          Import
        </Button>
      </DialogActions>
    </Dialog>
  );
}
