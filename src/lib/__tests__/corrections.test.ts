import assert from "node:assert/strict";
import test from "node:test";
import { isDateOnlyCorrection } from "../corrections";
import type { Change } from "../types";

// Tests run with TZ=America/Denver.
const change = (from: string, to: string): Change => ({ id: "x", at: "2026-10-29T12:00:00Z", kind: "due_changed", taskId: "f:t", courseId: null, title: "RDS Lab", from, to });
const endOfOct30 = new Date(2026, 9, 30, 23, 59, 59).toISOString();

test("a Canvas date-only due date moving from the start of its day to 11:59 PM is a correction, not a change", () => {
  assert.equal(isDateOnlyCorrection(change("2026-10-30T00:00:00.000Z", endOfOct30)), true, "read on a server in UTC");
  assert.equal(isDateOnlyCorrection(change(new Date(2026, 9, 30).toISOString(), endOfOct30)), true, "read on a server in the student's zone");
});

test("a due date the class really moved is still reported", () => {
  assert.equal(isDateOnlyCorrection(change("2026-10-29T00:00:00.000Z", endOfOct30)), false, "a day later");
  assert.equal(isDateOnlyCorrection(change("2026-10-30T00:00:00.000Z", new Date(2026, 9, 30, 17, 0).toISOString())), false, "to 5 PM, not the end of the day");
  assert.equal(isDateOnlyCorrection({ ...change("2026-10-30T00:00:00.000Z", endOfOct30), kind: "added" }), false);
});
