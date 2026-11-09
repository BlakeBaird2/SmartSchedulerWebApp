/**
 * Colour themes for the calendar. A theme gives each kind of calendar its own
 * colour: classes and school work, work shifts, personal plans, and the tasks
 * the student scheduled. The student picks one, makes their own, and can still
 * colour a single calendar, a class, or one event (in that order, the most
 * specific wins).
 *
 * The themes are popular palettes from coolors.co, vivid and clearly apart.
 * Every one keeps text on its colours readable (at least 4.5:1, the WCAG AA
 * level for normal text, with white or near-black text, whichever reads better)
 * and its four colours easy to tell apart. Classic is Google Calendar's own
 * colours with white text, as before.
 */

export type ThemeRole = "school" | "work" | "personal" | "tasks";
export const THEME_ROLES: ThemeRole[] = ["school", "work", "personal", "tasks"];
export const ROLE_LABEL: Record<ThemeRole, string> = { school: "School", work: "Work", personal: "Personal", tasks: "Scheduled tasks" };

export type ThemeColors = Record<ThemeRole, string>;

export interface ThemePreset {
  id: string;
  name: string;
  /** A few words about it, under its name. */
  blurb: string;
  colors: ThemeColors;
  /** Text colour on every role, when not worked out from the colour (Classic keeps Google's white). */
  ink?: string;
}

export const THEMES: ThemePreset[] = [
  { id: "classic", name: "Classic", blurb: "Google Calendar's colours", colors: { school: "#f4511e", work: "#039be5", personal: "#33b679", tasks: "#7986cb" }, ink: "#ffffff" },
  // The rest are popular palettes from coolors.co, used as they are (the address is each palette's colours).
  // coolors.co/palette/ff595e-ffca3a-8ac926-1982c4-6a4c93
  { id: "spark", name: "Bright Spark", blurb: "Cherry, cobalt, lime, sunshine", colors: { school: "#ff595e", work: "#1982c4", personal: "#8ac926", tasks: "#ffca3a" } },
  // coolors.co/palette/ffbe0b-fb5607-ff006e-8338ec-3a86ff
  { id: "neon", name: "Neon Pop", blurb: "Hot pink, azure, marigold, violet", colors: { school: "#ff006e", work: "#3a86ff", personal: "#ffbe0b", tasks: "#8338ec" } },
  // coolors.co/palette/9b5de5-f15bb5-fee440-00bbf9-00f5d4
  { id: "electric", name: "Electric", blurb: "Bubblegum, sky, aqua, amethyst", colors: { school: "#f15bb5", work: "#00bbf9", personal: "#00f5d4", tasks: "#9b5de5" } },
  // coolors.co/palette/ef476f-ffd166-06d6a0-118ab2-073b4c
  { id: "tropical", name: "Tropical", blurb: "Watermelon, lagoon, mint, mango", colors: { school: "#ef476f", work: "#118ab2", personal: "#06d6a0", tasks: "#ffd166" } },
  // coolors.co/palette/70d6ff-ff70a6-ff9770-ffd670-e9ff70
  { id: "sherbet", name: "Sherbet", blurb: "Bright pastels", colors: { school: "#ff70a6", work: "#70d6ff", personal: "#ffd670", tasks: "#ff9770" } },
  // coolors.co/palette/f72585-7209b7-3a0ca3-4361ee-4cc9f0
  { id: "ultraviolet", name: "Ultraviolet", blurb: "Magenta, royal blue, cyan, grape", colors: { school: "#f72585", work: "#4361ee", personal: "#4cc9f0", tasks: "#7209b7" } },
  // coolors.co/palette/f94144-f3722c-f8961e-f9c74f-90be6d-43aa8b-577590
  { id: "rainbow", name: "Rainbow", blurb: "Red, slate, jade, gold", colors: { school: "#f94144", work: "#577590", personal: "#43aa8b", tasks: "#f9c74f" } },
  // coolors.co/palette/003049-d62828-f77f00-fcbf49-eae2b7
  { id: "retro", name: "Retro Diner", blurb: "Ketchup, navy, tangerine, mustard", colors: { school: "#d62828", work: "#003049", personal: "#f77f00", tasks: "#fcbf49" } },
  // coolors.co/palette/264653-2a9d8f-e9c46a-f4a261-e76f51
  { id: "coastal", name: "Coastal", blurb: "Terracotta, deep sea, teal, saffron", colors: { school: "#e76f51", work: "#264653", personal: "#2a9d8f", tasks: "#e9c46a" } },
];

export const DEFAULT_THEME = "classic";
export const CUSTOM_THEME = "custom";

/** The student's colour choices, kept with the rest of their setup. */
/** How work you've planned onto the calendar is drawn, so it never reads as a calendar's own event. */
export type PlannedStyle = "soft" | "solid" | "outline" | "striped";

export const PLANNED_STYLES: { id: PlannedStyle; name: string; blurb: string }[] = [
  { id: "soft", name: "Soft", blurb: "A light tint with a bold edge" },
  { id: "solid", name: "Solid", blurb: "Filled, like your other events" },
  { id: "outline", name: "Outline", blurb: "A dashed border" },
  { id: "striped", name: "Striped", blurb: "Diagonal stripes" },
];

export const DEFAULT_PLANNED_STYLE: PlannedStyle = "soft";

export interface ColorPrefs {
  /** A theme's id, or "custom" for their own. */
  theme: string;
  /** Their own theme, kept even while another is picked so it's there to come back to. */
  custom: ThemeColors | null;
  /** Calendar (feed) id -> its colour. */
  calendars: Record<string, string>;
  /** How planned work looks on the calendar. */
  planned: PlannedStyle;
}

export function defaultColorPrefs(): ColorPrefs {
  return { theme: DEFAULT_THEME, custom: null, calendars: {}, planned: DEFAULT_PLANNED_STYLE };
}

const HEX = /^#[0-9a-f]{6}$/i;

export function presetById(id: string): ThemePreset | undefined {
  return THEMES.find((t) => t.id === id);
}

/** The colours in use. */
export function themeColors(prefs: ColorPrefs): ThemeColors {
  if (prefs.theme === CUSTOM_THEME && prefs.custom) return prefs.custom;
  return (presetById(prefs.theme) ?? THEMES[0]).colors;
}

// ---------------------------------------------------------------------------
// Contrast
// ---------------------------------------------------------------------------

const channel = (c: number) => {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * channel(n >> 16) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

/** WCAG contrast ratio between two colours, 1 to 21. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export const LIGHT_INK = "#ffffff";
export const DARK_INK = "#111111";

/** The text colour that reads better on `hex`: white, or near-black. */
export function inkFor(hex: string): string {
  return contrast(hex, LIGHT_INK) >= contrast(hex, DARK_INK) ? LIGHT_INK : DARK_INK;
}

/** Whether text on `hex` is easy to read (WCAG AA for normal text). */
export function readable(hex: string): boolean {
  return contrast(hex, inkFor(hex)) >= 4.5;
}

/** How different two colours look (distance in OKLab; about 0.1 and up is easy to tell apart). */
export function colorDistance(a: string, b: string): number {
  const lab = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    const [r, g, bl] = [n >> 16, (n >> 8) & 255, n & 255].map(channel);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * bl);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * bl);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * bl);
    return [
      0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
      1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
      0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
    ];
  };
  const [x, y] = [lab(a), lab(b)];
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
}

// ---------------------------------------------------------------------------
// On the page
// ---------------------------------------------------------------------------

/** CSS variable names each role sets (see schedule-smart.css). */
const VAR: Record<ThemeRole, string> = { school: "--ss-school", work: "--ss-work", personal: "--ss-personal", tasks: "--ss-planned" };

/**
 * The CSS variables for a theme: each role's colour, its text colour, and the
 * soft tint and deep tone some labels use (mixed with the page, so they suit
 * light and dark alike). Classic sets nothing: the stylesheet's own values are
 * Classic, tuned for dark mode too.
 */
export function themeVars(prefs: ColorPrefs): Record<string, string> {
  if (prefs.theme === DEFAULT_THEME || (prefs.theme === CUSTOM_THEME && !prefs.custom)) return {};
  const preset = presetById(prefs.theme);
  const colors = themeColors(prefs);
  const out: Record<string, string> = {};
  for (const role of THEME_ROLES) {
    const c = colors[role];
    out[VAR[role]] = c;
    out[`${VAR[role]}-ink`] = preset?.ink ?? inkFor(c);
    if (role !== "tasks") {
      out[`${VAR[role]}-bg`] = `color-mix(in oklab, ${c} 14%, var(--ss-surface))`;
      out[`${VAR[role]}-fg`] = `color-mix(in oklab, ${c} 75%, var(--ss-ink))`;
    }
  }
  return out;
}

/** Keeps only well-formed choices; anything odd falls back to the default. */
export function sanitizeColorPrefs(raw: unknown): ColorPrefs {
  const out = defaultColorPrefs();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  const r = raw as Record<string, unknown>;
  if (r.custom && typeof r.custom === "object") {
    const c = r.custom as Record<string, unknown>;
    if (THEME_ROLES.every((role) => typeof c[role] === "string" && HEX.test(c[role] as string))) {
      out.custom = Object.fromEntries(THEME_ROLES.map((role) => [role, (c[role] as string).toLowerCase()])) as ThemeColors;
    }
  }
  if (typeof r.theme === "string" && (presetById(r.theme) || (r.theme === CUSTOM_THEME && out.custom))) out.theme = r.theme;
  if (PLANNED_STYLES.some((s) => s.id === r.planned)) out.planned = r.planned as PlannedStyle;
  if (r.calendars && typeof r.calendars === "object" && !Array.isArray(r.calendars)) {
    for (const [id, hex] of Object.entries(r.calendars as Record<string, unknown>).slice(0, 200)) {
      if (id && id.length <= 200 && typeof hex === "string" && HEX.test(hex)) out.calendars[id] = hex.toLowerCase();
    }
  }
  return out;
}
