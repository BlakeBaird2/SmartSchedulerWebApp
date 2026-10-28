"use client";

import { useMemo, useState } from "react";
import { format, isYesterday } from "date-fns";
import { blocksByTask, unfinishedToAsk } from "@/lib/todos";
import { clockRange } from "@/lib/ui";
import { courseStyle, useApp } from "./context";
import { Button, Dialog, DialogActions, TextButton } from "./ui";

/** How many tasks the question lists by name. */
const SHOWN = 5;

/**
 * The morning question: work whose scheduled time ended before today without
 * being ticked off. Yes puts it back on the to-do list; No leaves it off (it
 * stays on the calendar and in Upcoming). Closing it asks again next time the
 * app opens.
 *
 * Only asked when the student chose "ask" for unfinished work; the other choices
 * (back at midnight, or never off the list) need no question.
 */
export function UnfinishedPrompt({ blocked }: { blocked: boolean }) {
  const { model, ws, now, answerUnfinished, setSettingsPanel } = useApp();
  const [later, setLater] = useState(false);

  const asked = useMemo(() => {
    if (ws.unfinished !== "ask") return [];
    const mine = blocksByTask(ws.blocks);
    return unfinishedToAsk(model.tasks, mine, now, ws.unfinishedAnswers).map((task) => {
      const last = [...(mine.get(task.id) ?? [])].sort((a, b) => Date.parse(b.end) - Date.parse(a.end))[0];
      return { task, start: new Date(last.start), end: new Date(last.end) };
    });
  }, [ws.unfinished, ws.blocks, ws.unfinishedAnswers, model.tasks, now]);

  if (later || blocked || asked.length === 0) return null;
  const ids = asked.map((a) => a.task.id);
  const when = asked.every((a) => isYesterday(a.end)) ? "from yesterday" : "from before today";

  return (
    <Dialog
      title={`Put unfinished tasks ${when} back on your to-do list?`}
      description={
        asked.length === 1
          ? "Its time came and went without it being ticked off."
          : `${asked.length} tasks had their time come and go without being ticked off.`
      }
      onClose={() => setLater(true)}
      size="sm"
    >
      <ul className="space-y-1.5">
        {asked.slice(0, SHOWN).map(({ task, start, end }) => {
          const course = task.courseId ? model.courseById.get(task.courseId) : undefined;
          return (
            <li key={task.id} className="rounded-lg border border-line px-3 py-2 text-sm" style={courseStyle(course?.color)}>
              <div className="font-semibold leading-snug">{task.title}</div>
              <div className="text-xs text-muted">
                {course ? <span className="course-text font-medium">{course.code} · </span> : null}
                Was on {format(start, "EEE")}, {clockRange(start, end)}
              </div>
            </li>
          );
        })}
      </ul>
      {asked.length > SHOWN ? <p className="mt-2 text-xs text-muted">And {asked.length - SHOWN} more.</p> : null}
      <p className="mt-3 text-xs text-muted leading-relaxed">
        No leaves them off the list. They stay on your calendar and in Upcoming, and you can put any one back from its details.
      </p>
      <DialogActions
        aside={
          <TextButton
            className="text-xs text-muted"
            onClick={() => {
              setLater(true);
              setSettingsPanel("schedule");
            }}
          >
            Change this in Settings
          </TextButton>
        }
      >
        <Button data-smart-event="unfinished_left_off" onClick={() => answerUnfinished(ids, false)}>
          No
        </Button>
        <Button variant="primary" data-autofocus data-smart-event="unfinished_returned" onClick={() => answerUnfinished(ids, true)}>
          {asked.length === 1 ? "Yes, put it back" : "Yes, put them back"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
