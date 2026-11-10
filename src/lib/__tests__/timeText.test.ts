import assert from "node:assert/strict";
import test from "node:test";
import { lengthText, parseLength, parseTime, timeLabel, timeSteps } from "../timeText";

const at = (h: number, m = 0) => h * 60 + m;

test("times read the way a time list shows them", () => {
  assert.equal(timeLabel(0), "12:00 AM");
  assert.equal(timeLabel(at(9, 5)), "9:05 AM");
  assert.equal(timeLabel(at(12, 30)), "12:30 PM");
  assert.equal(timeLabel(at(23, 45)), "11:45 PM");
  assert.equal(timeLabel(24 * 60), "12:00 AM", "midnight at the end of the day");
});

test("a typed time with am or pm is taken as it is", () => {
  assert.equal(parseTime("3pm"), at(15));
  assert.equal(parseTime("3:37 pm"), at(15, 37));
  assert.equal(parseTime("3.37PM"), at(15, 37));
  assert.equal(parseTime("330p"), at(15, 30));
  assert.equal(parseTime("9a"), at(9));
  assert.equal(parseTime("12am"), 0);
  assert.equal(parseTime("12pm"), at(12));
  assert.equal(parseTime("noon"), at(12));
});

test("a 24-hour time is taken as it is", () => {
  assert.equal(parseTime("15:30"), at(15, 30));
  assert.equal(parseTime("1530"), at(15, 30));
  assert.equal(parseTime("09:00"), at(9));
  assert.equal(parseTime("0:45"), 45);
});

test("an hour without am or pm is read the way people mean it", () => {
  assert.equal(parseTime("9"), at(9), "9 is the morning");
  assert.equal(parseTime("3"), at(15), "3 is the afternoon");
  assert.equal(parseTime("12:15"), at(12, 15));
  // An end time is the first one after the start.
  assert.equal(parseTime("11", at(10)), at(11));
  assert.equal(parseTime("1", at(10)), at(13));
  assert.equal(parseTime("4:10", at(16)), at(16, 10));
  assert.equal(parseTime("12", at(13)), 24 * 60, "midnight tonight");
  assert.equal(parseTime("12am", at(22)), 24 * 60);
});

test("things that aren't times are turned away", () => {
  for (const bad of ["", "abc", "3:75", "13pm", "25", "3:5:0"]) assert.equal(parseTime(bad), null, bad);
});

test("typed lengths", () => {
  assert.equal(parseLength("45"), 45);
  assert.equal(parseLength("45 min"), 45);
  assert.equal(parseLength("1h"), 60);
  assert.equal(parseLength("1.5 hours"), 90);
  assert.equal(parseLength("1.5"), 90, "a number with a decimal is hours");
  assert.equal(parseLength("1h 20m"), 80);
  assert.equal(parseLength("1h20m"), 80);
  assert.equal(parseLength("1 hour and 20 minutes"), 80);
  assert.equal(parseLength("2 hrs"), 120);
  assert.equal(parseLength("1:20"), 80);
  for (const bad of ["", "soon", "0", "3 days", "-5"]) assert.equal(parseLength(bad), null, bad);
});

test("lengths read short", () => {
  assert.equal(lengthText(10), "10 min");
  assert.equal(lengthText(60), "1 hr");
  assert.equal(lengthText(80), "1 hr 20 min");
  assert.equal(lengthText(150), "2.5 hrs");
});

test("a time list goes in steps", () => {
  assert.deepEqual(timeSteps(at(9, 10), at(10)), [at(9, 15), at(9, 30), at(9, 45), at(10)]);
});
