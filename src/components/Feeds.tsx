"use client";

import { useState } from "react";
import { CircleAlert, Eye, EyeOff, Link as LinkIcon, Pencil, Plus, Trash } from "lucide-react";
import { feedIdFor, normalizeFeedUrl, PROVIDER_LABEL } from "@/lib/feeds/url";
import { fetchFeedFromApi } from "@/lib/sync";
import type { FeedConfig, FeedResult, FeedRole, Provider } from "@/lib/types";
import { plural, timeAgo } from "@/lib/ui";
import { courseStyle, useApp, wireGray } from "./context";
import { LINK_HELP } from "./calendarGuide";
import { Button } from "./ui";

/** What a calendar contributed, in a few words. */
export function feedSummary(result: FeedResult | null | undefined, role: FeedRole): string {
  if (!result) return "Not read yet";
  if (role === "personal") {
    const busy = result.events.filter((e) => e.busy).length;
    return busy ? `${plural(busy, "event")} used as busy time` : "No upcoming events";
  }
  const tasks = result.tasks.filter((t) => !t.generated).length;
  const meetings = result.events.filter((e) => e.kind === "class").length;
  const parts = [plural(result.courses.length, "class", "classes"), `${tasks} due`];
  if (meetings) parts.push(plural(meetings, "class meeting"));
  return parts.join(" · ");
}

/**
 * Paste a link, and it is read, sorted into classes, and added in one step.
 * `primary` draws Add as the screen's main action; turn it off where something
 * else on screen is the main action.
 */
export function FeedAdder({ autoFocus = false, primary = true }: { autoFocus?: boolean; primary?: boolean }) {
  const { ws, addFeed, timezone } = useApp();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setAdded(null);
    let url: string;
    try {
      url = normalizeFeedUrl(value);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That link can't be used.");
      return;
    }
    if (ws.feeds.some((f) => f.id === feedIdFor(url))) {
      setError("That calendar is already added.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await fetchFeedFromApi(url, "auto", timezone);
      const past = addFeed(result);
      setValue("");
      const label = result.provider === "other" ? result.calendarName || "Calendar" : PROVIDER_LABEL[result.provider];
      setAdded(
        `Added ${label}: ${feedSummary(result, result.role)}.` +
          (past ? ` ${plural(past, "item")} already past due ${past === 1 ? "was" : "were"} marked done. Untick any you still owe.` : ""),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "That calendar could not be read.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-2">
      {/* The field and its button share one height, so they read as one control. */}
      <div className="flex items-stretch gap-2">
        <label className="relative flex flex-1 min-w-0">
          <span className="sr-only">Calendar link</span>
          <LinkIcon size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint pointer-events-none" />
          <input
            type="text"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            autoFocus={autoFocus}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
            }}
            placeholder="Paste a calendar link (https://… or webcal://…)"
            className="input pl-9 h-full"
            disabled={busy}
          />
        </label>
        <Button type="submit" variant={primary ? "primary" : "secondary"} icon={Plus} className="shrink-0" disabled={busy || !value.trim()}>
          {busy ? "Reading…" : "Add calendar"}
        </Button>
      </div>
      {error ? (
        <p className="text-sm text-danger flex gap-1.5" role="alert">
          <CircleAlert size={15} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </p>
      ) : null}
      {added ? (
        <p className="text-sm font-semibold" role="status">
          {added}
        </p>
      ) : null}
    </form>
  );
}

function RoleSwitch({ feed }: { feed: FeedConfig }) {
  const { setFeedRole } = useApp();
  return (
    <div className="seg !p-0.5" role="group" aria-label={`What ${feed.name} is for`}>
      {(["school", "personal"] as FeedRole[]).map((r) => (
        <button
          key={r}
          type="button"
          className="!py-1 !px-2 !text-xs"
          aria-pressed={feed.role === r}
          onClick={() => setFeedRole(feed.id, r)}
          title={r === "school" ? "Classes and assignments come from this calendar" : "Only used to know when you're busy"}
        >
          {r === "school" ? "School" : "Personal"}
        </button>
      ))}
    </div>
  );
}

export function FeedList({ manage = false }: { manage?: boolean }) {
  const { ws, snapshot, removeFeed, update, now } = useApp();
  if (ws.feeds.length === 0) return null;
  return (
    <ul className="space-y-2">
      {ws.feeds.map((feed) => {
        const state = snapshot.feeds[feed.id];
        return (
          <li key={feed.id} className={`rounded-xl border border-line bg-surface px-3 py-2.5 ${feed.enabled ? "" : "opacity-60"}`}>
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="w-2.5 h-2.5 shrink-0 rounded-full" style={{ background: feed.role === "personal" ? wireGray(feed.color) : "var(--fg)" }} aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate" title={feed.name}>
                  {feed.name}
                  {feed.provider !== "other" && PROVIDER_LABEL[feed.provider] !== feed.name ? (
                    <span className="text-muted font-normal"> · {PROVIDER_LABEL[feed.provider]}</span>
                  ) : null}
                </div>
                <div className="text-xs text-muted truncate">
                  {feedSummary(state?.result, feed.role)}
                  {manage && state?.syncedAt ? <span className="text-faint"> · read {timeAgo(state.syncedAt, now)}</span> : null}
                </div>
              </div>
              <RoleSwitch feed={feed} />
              {manage ? (
                <Button
                  iconOnly
                  icon={feed.enabled ? Eye : EyeOff}
                  label={feed.enabled ? `Turn off ${feed.name} for now` : `Turn ${feed.name} back on`}
                  aria-pressed={!feed.enabled}
                  onClick={() => update((w) => ({ ...w, feeds: w.feeds.map((f) => (f.id === feed.id ? { ...f, enabled: !f.enabled } : f)) }))}
                />
              ) : null}
              <Button
                iconOnly
                icon={Trash}
                label={`Remove ${feed.name}`}
                onClick={() => {
                  if (!manage || window.confirm(`Remove ${feed.name}? Its classes and work leave your plan.`)) removeFeed(feed.id);
                }}
              />
            </div>
            {feed.role === "school" ? <ClassChips feedId={feed.id} /> : null}
            {state?.error ? (
              <p className="mt-1.5 text-xs text-danger flex gap-1.5">
                <CircleAlert size={13} className="shrink-0 mt-px" />
                <span>
                  {state.error}
                  {state.result ? " Showing the last copy that worked." : ""}
                </span>
              </p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

/** The classes a school calendar brought in. Click one to give it a better short name. */
function ClassChips({ feedId }: { feedId: string }) {
  const { model, update } = useApp();
  const [editing, setEditing] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const courses = model.courses.filter((c) => c.feedId === feedId);
  if (courses.length === 0) return null;

  const save = (id: string) => {
    const code = value.trim().slice(0, 24);
    if (code) update((w) => ({ ...w, courseEdits: { ...w.courseEdits, [id]: { ...w.courseEdits[id], code } } }));
    setEditing(null);
  };

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-5">
      {courses.map((c) =>
        editing === c.id ? (
          <form
            key={c.id}
            onSubmit={(e) => {
              e.preventDefault();
              save(c.id);
            }}
          >
            <input
              autoFocus
              aria-label={`New short name for ${c.title}`}
              className="input input-sm !w-32 !py-0.5"
              value={value}
              maxLength={24}
              onChange={(e) => setValue(e.target.value)}
              onBlur={() => save(c.id)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setEditing(null);
              }}
            />
          </form>
        ) : (
          <button
            key={c.id}
            type="button"
            className="pill pill-course"
            aria-pressed={true}
            style={courseStyle(c.color)}
            title={c.title === c.code ? "Click to rename" : `${c.title} · click to rename`}
            onClick={() => {
              setEditing(c.id);
              setValue(c.code);
            }}
          >
            <span className="course-dot" />
            <span className="course-text">{c.code}</span>
            <Pencil size={11} className="text-faint" />
          </button>
        ),
      )}
      <span className="text-[11px] text-faint">Tap a class to rename it.</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Where to find each link
// ---------------------------------------------------------------------------

export function ProviderHelp() {
  const [tab, setTab] = useState<Provider>("canvas");
  const current = LINK_HELP.find((h) => h.id === tab)!;
  return (
    <div className="rounded-xl border border-line bg-surface-2 p-3">
      <div className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Where do I find my link?</div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {LINK_HELP.map((h) => (
          <button key={h.id} type="button" className="pill" aria-pressed={tab === h.id} onClick={() => setTab(h.id)}>
            {h.label}
          </button>
        ))}
      </div>
      <ol className="list-decimal pl-5 space-y-1 text-sm leading-relaxed">
        {current.steps.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
      {current.note ? <p className="mt-2 text-xs text-muted leading-relaxed">{current.note}</p> : null}
    </div>
  );
}
