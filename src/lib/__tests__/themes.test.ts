import assert from "node:assert/strict";
import test from "node:test";
import { colorDistance, contrast, CUSTOM_THEME, DARK_INK, inkFor, LIGHT_INK, readable, sanitizeColorPrefs, THEME_ROLES, THEMES, themeColors, themeVars } from "../themes";

test("there are 7 to 10 themes, each with a unique id", () => {
  assert.ok(THEMES.length >= 7 && THEMES.length <= 10, String(THEMES.length));
  assert.equal(new Set(THEMES.map((t) => t.id)).size, THEMES.length);
});

for (const t of THEMES.filter((t) => t.id !== "classic")) {
  test(`${t.name}: text on every colour is easy to read`, () => {
    for (const role of THEME_ROLES) assert.ok(readable(t.colors[role]), `${role} ${t.colors[role]}: ${contrast(t.colors[role], inkFor(t.colors[role])).toFixed(2)}`);
  });
  test(`${t.name}: its four colours are easy to tell apart`, () => {
    for (let i = 0; i < THEME_ROLES.length; i++)
      for (let j = i + 1; j < THEME_ROLES.length; j++) {
        const [a, b] = [t.colors[THEME_ROLES[i]], t.colors[THEME_ROLES[j]]];
        assert.ok(colorDistance(a, b) >= 0.11, `${THEME_ROLES[i]} vs ${THEME_ROLES[j]}: ${colorDistance(a, b).toFixed(3)}`);
      }
  });
}

test("text goes dark on light colours and white on dark ones", () => {
  assert.equal(inkFor("#fde68a"), DARK_INK);
  assert.equal(inkFor("#1f5fae"), LIGHT_INK);
  assert.equal(Math.round(contrast("#000000", "#ffffff")), 21);
});

test("Classic leaves the stylesheet's colours alone; other themes set them", () => {
  assert.deepEqual(themeVars({ theme: "classic", custom: null, calendars: {} }), {});
  const vars = themeVars({ theme: "sherbet", custom: null, calendars: {} });
  assert.equal(vars["--ss-school"], "#ff70a6");
  assert.equal(vars["--ss-school-ink"], DARK_INK);
  assert.equal(vars["--ss-planned"], "#ff9770");
});

test("a theme of your own is used when picked, and kept when another is", () => {
  const custom = { school: "#111111", work: "#222222", personal: "#333333", tasks: "#444444" };
  assert.equal(themeColors({ theme: CUSTOM_THEME, custom, calendars: {} }).work, "#222222");
  assert.equal(themeColors({ theme: "tropical", custom, calendars: {} }).work, THEMES.find((t) => t.id === "tropical")!.colors.work);
});

test("odd stored choices fall back safely", () => {
  assert.deepEqual(sanitizeColorPrefs(null), { theme: "classic", custom: null, calendars: {} });
  assert.equal(sanitizeColorPrefs({ theme: "nope" }).theme, "classic");
  assert.equal(sanitizeColorPrefs({ theme: CUSTOM_THEME }).theme, "classic", "custom without colours");
  const ok = sanitizeColorPrefs({ theme: CUSTOM_THEME, custom: { school: "#AABBCC", work: "#000000", personal: "#ffffff", tasks: "#123456" }, calendars: { a: "#FF0000", b: "red" } });
  assert.equal(ok.theme, CUSTOM_THEME);
  assert.equal(ok.custom?.school, "#aabbcc");
  assert.deepEqual(ok.calendars, { a: "#ff0000" });
});
