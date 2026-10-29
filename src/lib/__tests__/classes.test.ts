import assert from "node:assert/strict";
import test from "node:test";
import { classHidden, classHint } from "../classes";

// Tests run with TZ=America/Denver.
const NOW = new Date(2026, 9, 28, 12);
const day = (m: number, d: number, y = 2026) => new Date(y, m - 1, d).getTime();
const thisTerm = [day(10, 20), day(11, 3)];

test("a normal class has no hint", () => {
  assert.equal(classHint({ code: "STAT 121", title: "Principles of Statistics" }, thisTerm, NOW), null);
  assert.equal(classHint({ code: "CS 142", title: "Intro to Programming" }, [], NOW), null, "nothing posted yet is still a class");
});

test("courses the student helps teach are spotted by name", () => {
  for (const title of ["STAT 121 TA", "TAs - Chemistry 105", "Teaching Assistant Training", "BIO 100 Sandbox", "Grader resources", "Course Template", "Blueprint: WRTG 150"]) {
    assert.equal(classHint({ code: "X", title }, thisTerm, NOW)?.reason, "teaching", title);
  }
});

test("a department called TA, or a word containing ta, is not mistaken for a TA course", () => {
  assert.equal(classHint({ code: "TA 101", title: "Theatre Arts" }, thisTerm, NOW), null);
  assert.equal(classHint({ code: "STAT 121", title: "Data and Tables" }, thisTerm, NOW), null);
});

test("pages that aren't classes are spotted by name", () => {
  for (const title of ["New Student Orientation", "Pre-Med Advisement", "Library Research Guide", "Writing Center", "Ski Club"]) {
    assert.equal(classHint({ code: "X", title }, thisTerm, NOW)?.reason, "not-a-class", title);
  }
});

test("a class with nothing since three weeks ago is from an earlier term", () => {
  const hint = classHint({ code: "HIST 201", title: "US History" }, [day(3, 2), day(4, 20)], NOW);
  assert.equal(hint?.reason, "past");
  assert.match(hint!.label, /Apr 2026/);
  assert.equal(classHint({ code: "HIST 201", title: "US History" }, [day(10, 10)], NOW), null, "two and a half weeks ago is still this term");
});

test("the student's own choice always wins over the hint", () => {
  const hint = classHint({ code: "STAT 121 TA", title: "" }, thisTerm, NOW);
  assert.equal(classHidden(undefined, hint), true, "left out until they decide");
  assert.equal(classHidden(false, hint), false, "ticked back in");
  assert.equal(classHidden(undefined, null), false);
  assert.equal(classHidden(true, null), true, "unticked by hand");
});
