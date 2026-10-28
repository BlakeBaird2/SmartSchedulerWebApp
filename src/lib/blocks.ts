/**
 * Putting work on the calendar, moving it, resizing it and taking it off again.
 *
 * Times snap to the quarter hour, and a block is never shorter than a quarter of
 * an hour. Every change stamps `updatedAt`, which a sync with Google Calendar can
 * use later to tell which side changed last.
 */
import type { ScheduledBlock } from "./types";

export const SNAP_MINUTES = 15;
export const MIN_BLOCK_MINUTES = 15;
const MINUTE = 60_000;

/** The nearest quarter hour, in minutes. */
export function snapMinutes(minutes: number, step = SNAP_MINUTES): number {
  return Math.round(minutes / step) * step;
}

export function blockMinutes(block: Pick<ScheduledBlock, "start" | "end">): number {
  return Math.round((Date.parse(block.end) - Date.parse(block.start)) / MINUTE);
}

/** New time set aside for a task, as long as it's expected to take. */
export function makeBlock(id: string, task: { id: string; title: string }, start: Date, minutes: number, at: Date): ScheduledBlock {
  const length = Math.max(MIN_BLOCK_MINUTES, Math.round(minutes));
  return {
    id,
    taskId: task.id,
    title: task.title,
    start: start.toISOString(),
    end: new Date(start.getTime() + length * MINUTE).toISOString(),
    color: null,
    externalId: null,
    updatedAt: at.toISOString(),
  };
}

/** The same block at a new start, keeping its length. */
export function moveBlock(block: ScheduledBlock, start: Date, at: Date): ScheduledBlock {
  const length = Date.parse(block.end) - Date.parse(block.start);
  return { ...block, start: start.toISOString(), end: new Date(start.getTime() + length).toISOString(), updatedAt: at.toISOString() };
}

/** The same block with a new end, never shorter than the shortest block. */
export function resizeBlock(block: ScheduledBlock, end: Date, at: Date): ScheduledBlock {
  const earliest = Date.parse(block.start) + MIN_BLOCK_MINUTES * MINUTE;
  return { ...block, end: new Date(Math.max(earliest, end.getTime())).toISOString(), updatedAt: at.toISOString() };
}

/** Swap in a changed block, or add a new one. */
export function putBlock(blocks: ScheduledBlock[], block: ScheduledBlock): ScheduledBlock[] {
  return blocks.some((b) => b.id === block.id) ? blocks.map((b) => (b.id === block.id ? block : b)) : [...blocks, block];
}

export function dropBlock(blocks: ScheduledBlock[], id: string): ScheduledBlock[] {
  return blocks.filter((b) => b.id !== id);
}
