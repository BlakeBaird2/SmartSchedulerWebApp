/**
 * Glue between the merged model and the planner: which work gets planned, and
 * where each task ended up.
 */
import { buildPlan, type AtRisk, type Plan, type PlannedBlock } from "./planner";
import { busyIntervals, type Model } from "./model";
import type { PlanPrefs, ScheduledBlock } from "./types";

/** How far ahead the plan looks. Two weeks covers every deadline worth acting on now. */
export const PLAN_DAYS = 14;

export function makePlan(model: Model, prefs: PlanPrefs, now: Date, blocks: ScheduledBlock[] = [], days = PLAN_DAYS): Plan {
  return buildPlan({
    now,
    prefs,
    days,
    fixed: blocks.map((b) => ({ id: b.id, taskId: b.taskId, start: new Date(b.start), end: new Date(b.end) })),
    busy: busyIntervals(model.events),
    tasks: model.tasks
      .filter((t) => !t.done)
      .map((t) => ({ id: t.id, title: t.title, type: t.type, dueAt: t.dueAt ? new Date(t.dueAt) : null, estimate: t.estimate })),
  });
}

export interface PlanIndex {
  blocks: Map<string, PlannedBlock[]>;
  atRisk: Map<string, AtRisk>;
  /** 1-based position in the priority order. */
  rank: Map<string, number>;
}

export function indexPlan(plan: Plan): PlanIndex {
  const blocks = new Map<string, PlannedBlock[]>();
  for (const day of plan.days) {
    for (const b of day.blocks) {
      const list = blocks.get(b.taskId);
      if (list) list.push(b);
      else blocks.set(b.taskId, [b]);
    }
  }
  return {
    blocks,
    atRisk: new Map(plan.atRisk.map((r) => [r.taskId, r])),
    rank: new Map(plan.order.map((id, i) => [id, i + 1])),
  };
}
