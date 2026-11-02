import assert from "node:assert/strict";
import test from "node:test";
import { describeWorkspace, firstSync, hasOwnData, readCloudWorkspace, resync, sameWorkspace } from "../cloud";
import { defaultWorkspace } from "../workspace";
import type { Workspace } from "../types";

const feed = (id: string) => ({ id, url: `https://example.edu/${id}.ics`, name: id, role: "school" as const, provider: "other" as const, color: "#000000", enabled: true });
const withFeeds = (...ids: string[]): Workspace => ({ ...defaultWorkspace(), feeds: ids.map(feed) });

test("sample data and an empty setup aren't the student's own", () => {
  assert.equal(hasOwnData(defaultWorkspace()), false);
  assert.equal(hasOwnData({ ...withFeeds("a"), demo: true }), false);
  assert.equal(hasOwnData(withFeeds("a")), true);
});

test("the first sign-in uploads, downloads, or asks", () => {
  assert.equal(firstSync(withFeeds("a"), null), "upload", "an empty account takes this device's setup");
  assert.equal(firstSync(defaultWorkspace(), withFeeds("a")), "download", "a new device takes the account's");
  assert.equal(firstSync({ ...withFeeds("x"), demo: true }, withFeeds("a")), "download", "sample data never wins");
  assert.equal(firstSync(withFeeds("a"), withFeeds("a")), "same");
  assert.equal(firstSync(withFeeds("a"), withFeeds("b")), "ask", "two different setups: the student picks");
  assert.equal(firstSync(defaultWorkspace(), null), "none");
});

test("the same setup matches whatever order its fields are in", () => {
  const a = withFeeds("a");
  const b = JSON.parse(JSON.stringify(Object.fromEntries(Object.entries(a).reverse()))) as Workspace;
  assert.equal(sameWorkspace(a, b), true);
});

test("a damaged or empty account copy counts as none", () => {
  assert.equal(readCloudWorkspace("{not json"), null);
  assert.equal(readCloudWorkspace(42), null);
  assert.equal(readCloudWorkspace(JSON.stringify(defaultWorkspace())), null);
  assert.equal(readCloudWorkspace(JSON.stringify(withFeeds("a")))?.feeds.length, 1);
});

test("a setup is described in a few words", () => {
  assert.equal(describeWorkspace(withFeeds("a", "b")), "a (example.edu), b (example.edu)");
  assert.equal(describeWorkspace({ ...withFeeds("a"), done: { x: "2026-11-01T00:00:00Z" } }), "a (example.edu) · 1 done");
});

test("a device that has synced before takes what changed elsewhere, saves what changed here, and asks only when both did", () => {
  const base = withFeeds("a");
  const elsewhere = withFeeds("a", "b");
  const here = { ...withFeeds("a"), manualTasks: [{ id: "m", title: "Buy paper", courseId: null, type: "assignment" as const, dueAt: null }] };
  assert.equal(resync(base, elsewhere, base), "download", "another device added a calendar");
  assert.equal(resync(here, base, base), "upload", "this device changed while offline");
  assert.equal(resync(base, base, base), "same");
  assert.equal(resync(here, elsewhere, base), "ask", "both changed");
  assert.equal(resync(elsewhere, elsewhere, base), "same", "both made the same change");
  assert.equal(resync(here, null, base), "upload", "the account's copy was deleted: this device's goes back up");
});
