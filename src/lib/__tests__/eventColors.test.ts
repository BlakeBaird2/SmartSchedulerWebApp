import assert from "node:assert/strict";
import test from "node:test";
import { EVENT_COLORS, gcalColorId, repeats, seriesKey } from "../eventColors";

test("one meeting of a repeating event belongs to its series", () => {
  assert.equal(seriesKey("feed1:abc123@google.com@2026-10-06T15:00:00.000Z"), "feed1:abc123@google.com");
  assert.equal(seriesKey("weekly:job@2026-10-06"), "weekly:job");
  assert.equal(seriesKey("feed1:abc123@google.com"), "feed1:abc123@google.com", "an @ inside the id stays");
  assert.equal(seriesKey("feed1:one-off"), "feed1:one-off");
  assert.ok(repeats("weekly:job@2026-10-06"));
  assert.ok(!repeats("feed1:abc123@google.com"));
});

test("the colours are Google Calendar's eleven, each once", () => {
  assert.equal(EVENT_COLORS.length, 11);
  assert.deepEqual(
    EVENT_COLORS.map((c) => Number(c.id)).sort((a, b) => a - b),
    Array.from({ length: 11 }, (_, i) => i + 1),
  );
  assert.equal(gcalColorId("#D50000"), "11");
  assert.equal(gcalColorId("#123456"), null);
  assert.equal(gcalColorId(null), null);
});
