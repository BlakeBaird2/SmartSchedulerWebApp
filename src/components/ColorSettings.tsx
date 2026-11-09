"use client";

import { CalendarRange, Check, ChevronDown, Moon, Palette, Sun, SquareCheckBig, type LucideIcon } from "lucide-react";
import { EVENT_COLORS } from "@/lib/eventColors";
import { CUSTOM_THEME, PLANNED_STYLES, presetById, readable, ROLE_LABEL, THEME_ROLES, THEMES, themeColors, inkFor, type PlannedStyle, type ThemeColors, type ThemeRole } from "@/lib/themes";
import { useApp } from "./context";
import { useTheme } from "./store";
import { Card, CardHeader, ColorSwatches, SegmentedControl } from "./ui";

/*
 * Settings → Appearance. Light or dark at the top, then three groups that open
 * one at a time, each showing what's set while closed: how planned tasks look,
 * the colour theme (and your own), and colours for single calendars and classes.
 * One event's colour is picked from the event itself, on the calendar.
 */

/** A group of settings that opens on click, showing its current choice while closed. */
function Group({ icon: Icon, title, hint, value, children }: { icon: LucideIcon; title: string; hint: string; value?: string; children: React.ReactNode }) {
  return (
    <details className="ss-setting-group">
      <summary>
        <span className="ss-setting-icon" aria-hidden>
          <Icon size={18} />
        </span>
        <span className="ss-setting-text">
          <strong>{title}</strong>
          <span>{hint}</span>
        </span>
        {value ? <span className="ss-setting-value">{value}</span> : null}
        <ChevronDown size={18} className="ss-setting-chevron" aria-hidden />
      </summary>
      <div className="ss-setting-body">{children}</div>
    </details>
  );
}

/** A little planned block in each look, drawn by the calendar's own styles. */
function PlannedStyleCard({ style, picked, onPick }: { style: (typeof PLANNED_STYLES)[number]; picked: boolean; onPick: () => void }) {
  return (
    <button type="button" role="radio" aria-checked={picked} onClick={onPick} className={`ss-style-card ${picked ? "is-picked" : ""}`}>
      <span className="ss-style-preview" aria-hidden>
        <span className="ss-event ss-planned ss-event-sample" data-look={style.id === "soft" ? undefined : style.id}>
          <strong>Problem Set 4</strong>
          <span>1:00 – 2:00</span>
        </span>
      </span>
      <span className="ss-style-name">
        {style.name}
        {picked ? <Check size={15} aria-label="In use" /> : null}
      </span>
      <span className="ss-style-blurb">{style.blurb}</span>
    </button>
  );
}

function Section({ title, hint, children }: { title: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader level={3} title={title} hint={hint} />
      <div className="mt-4">{children}</div>
    </Card>
  );
}

/** What each role looks like on a theme's card: a little event in its colour. */
const SAMPLE: Record<ThemeRole, string> = { school: "Class", work: "Shift", personal: "Gym", tasks: "Study" };

function ThemeCard({ name, blurb, colors, ink, picked, onPick }: { name: string; blurb: string; colors: ThemeColors; ink?: string; picked: boolean; onPick: () => void }) {
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={picked}
      className={`text-left rounded-xl border p-3 transition bg-surface hover:border-line-strong ${picked ? "border-accent ring-2 ring-accent/40" : "border-line"}`}
    >
      <div className="grid grid-cols-2 gap-1" aria-hidden>
        {THEME_ROLES.map((role) => (
          <span
            key={role}
            className="rounded-md px-2 py-1 text-[11px] font-semibold truncate"
            style={{ background: colors[role], color: ink ?? inkFor(colors[role]) }}
          >
            {SAMPLE[role]}
          </span>
        ))}
      </div>
      <div className="mt-2.5 flex items-center gap-1.5">
        <span className="font-semibold text-sm flex-1 min-w-0 truncate">{name}</span>
        {picked ? <Check size={16} className="text-accent shrink-0" aria-label="In use" /> : null}
      </div>
      <div className="text-xs text-muted truncate">{blurb}</div>
    </button>
  );
}

/** A colour from Google's set, the theme's colour (none of their own), or any colour at all. */
function ColorChoice({ value, themeHex, onChange, label }: { value: string | null; themeHex: string; onChange: (hex: string | null) => void; label: string }) {
  const own = value && !EVENT_COLORS.some((c) => c.hex.toLowerCase() === value.toLowerCase()) ? value : null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(null)}
        aria-pressed={value === null}
        title="The theme's colour"
        className={`h-7 px-2.5 rounded-full text-xs font-semibold border ${value === null ? "border-accent ring-2 ring-accent/40" : "border-line-strong"}`}
        style={{ background: themeHex, color: inkFor(themeHex) }}
      >
        Theme
      </button>
      <ColorSwatches colors={EVENT_COLORS} value={value} onChange={onChange} label={label} />
      <label
        className={`relative w-7 h-7 rounded-full border cursor-pointer overflow-hidden ${own ? "border-accent ring-2 ring-accent/40" : "border-line-strong"}`}
        title="Any colour"
        style={{ background: own ?? "conic-gradient(#f43f5e, #f59e0b, #84cc16, #06b6d4, #6366f1, #d946ef, #f43f5e)" }}
      >
        <span className="sr-only">Any colour for {label}</span>
        <input type="color" className="absolute inset-0 opacity-0 cursor-pointer" value={own ?? value ?? themeHex} onChange={(e) => onChange(e.target.value.toLowerCase())} />
      </label>
    </div>
  );
}

export function ColorsPanel() {
  const { ws, model, update } = useApp();
  const prefs = ws.colors;
  const current = themeColors(prefs);
  const basePreset = presetById(prefs.theme) ?? THEMES[0];
  const setPrefs = (patch: Partial<typeof prefs>) => update((w) => ({ ...w, colors: { ...w.colors, ...patch } }));
  const setOwn = (role: ThemeRole, hex: string) => setPrefs({ theme: CUSTOM_THEME, custom: { ...current, [role]: hex } });
  const feedThemeHex = (role: "school" | "personal") => current[role];
  const { theme: mode, toggle } = useTheme();

  const themeName = prefs.theme === CUSTOM_THEME ? "Your own" : basePreset.name;
  const plannedName = PLANNED_STYLES.find((p) => p.id === prefs.planned)?.name ?? "Soft";
  const ownCount = Object.keys(prefs.calendars).length + model.visibleCourses.filter((c) => ws.courseEdits[c.id]?.color).length;

  return (
    <div className="space-y-3">
      <Section title="Light or dark" hint="For this device.">
        <SegmentedControl
          label="Light or dark"
          value={mode}
          onChange={(t) => (t !== mode ? toggle() : undefined)}
          options={[
            { id: "light", label: "Light", icon: Sun },
            { id: "dark", label: "Dark", icon: Moon },
          ]}
        />
      </Section>

      <Group icon={SquareCheckBig} title="Planned tasks" hint="How work you plan onto your calendar looks" value={plannedName}>
        <div className="ss-style-grid" role="radiogroup" aria-label="How planned tasks look">
          {PLANNED_STYLES.map((st) => (
            <PlannedStyleCard key={st.id} style={st} picked={prefs.planned === st.id} onPick={() => setPrefs({ planned: st.id as PlannedStyle })} />
          ))}
        </div>
      </Group>

      <Group icon={Palette} title="Colour theme" hint="Colours for classes, work, personal plans and planned tasks" value={themeName}>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {THEMES.map((t) => (
            <ThemeCard key={t.id} name={t.name} blurb={t.blurb} colors={t.colors} ink={t.ink} picked={prefs.theme === t.id} onPick={() => setPrefs({ theme: t.id })} />
          ))}
          {prefs.custom ? (
            <ThemeCard name="Your own" blurb="The colours you picked" colors={prefs.custom} picked={prefs.theme === CUSTOM_THEME} onPick={() => setPrefs({ theme: CUSTOM_THEME })} />
          ) : null}
        </div>
        <details className="ss-setting-sub">
          <summary>
            Make your own
            <ChevronDown size={16} aria-hidden />
          </summary>
          <p className="ss-setting-note">
            {prefs.theme === CUSTOM_THEME ? "Your own theme is in use. Change any colour." : `Starts from ${basePreset.name}. Change any colour to make it yours.`}
          </p>
          <ul className="space-y-3">
            {THEME_ROLES.map((role) => (
              <li key={role} className="flex items-center gap-3 flex-wrap">
                <label className="relative w-10 h-10 rounded-lg border border-line-strong cursor-pointer overflow-hidden shrink-0" style={{ background: current[role] }}>
                  <span className="sr-only">{ROLE_LABEL[role]} colour</span>
                  <input type="color" className="absolute inset-0 opacity-0 cursor-pointer" value={current[role]} onChange={(e) => setOwn(role, e.target.value.toLowerCase())} />
                </label>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold">{ROLE_LABEL[role]}</div>
                  <div className="text-xs text-muted">
                    {current[role]}
                    {readable(current[role]) ? null : <span className="text-danger font-medium"> · text on it may be hard to read; try a darker or lighter shade</span>}
                  </div>
                </div>
                <span className="rounded-md px-2.5 py-1 text-xs font-semibold" style={{ background: current[role], color: inkFor(current[role]) }} aria-hidden>
                  {SAMPLE[role]} 9:00
                </span>
              </li>
            ))}
          </ul>
        </details>
      </Group>

      {ws.feeds.length > 0 || model.visibleCourses.length > 0 ? (
        <Group icon={CalendarRange} title="Calendars & classes" hint="Give one calendar or class its own colour" value={ownCount ? `${ownCount} custom` : "Theme colours"}>
          {ws.feeds.length > 0 ? (
            <>
              <h4 className="ss-setting-subhead">Calendars</h4>
              <ul className="space-y-4">
                {ws.feeds.map((f) => (
                  <li key={f.id}>
                    <div className="text-sm font-semibold">{f.name}</div>
                    <div className="text-xs text-muted mb-2">{f.role === "school" ? "School calendar" : "Personal calendar"}</div>
                    <ColorChoice
                      label={`Colour for ${f.name}`}
                      value={prefs.calendars[f.id] ?? null}
                      themeHex={feedThemeHex(f.role === "school" ? "school" : "personal")}
                      onChange={(hex) =>
                        update((w) => {
                          const calendars = { ...w.colors.calendars };
                          if (hex) calendars[f.id] = hex;
                          else delete calendars[f.id];
                          return { ...w, colors: { ...w.colors, calendars } };
                        })
                      }
                    />
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {model.visibleCourses.length > 0 ? (
            <>
              <h4 className="ss-setting-subhead">Classes</h4>
              <p className="ss-setting-note">A class&apos;s colour wins over its calendar&apos;s, here and on your to-do list.</p>
              <ul className="space-y-4">
                {model.visibleCourses.map((c) => (
                  <li key={c.id}>
                    <div className="text-sm font-semibold mb-2">
                      {c.code}
                      {c.title && c.title !== c.code ? <span className="text-muted font-normal"> · {c.title}</span> : null}
                    </div>
                    <ColorChoice
                      label={`Colour for ${c.code}`}
                      value={ws.courseEdits[c.id]?.color ?? null}
                      themeHex={current.school}
                      onChange={(hex) =>
                        update((w) => {
                          const edit = { ...w.courseEdits[c.id] };
                          if (hex) edit.color = hex;
                          else delete edit.color;
                          const courseEdits = { ...w.courseEdits };
                          if (Object.keys(edit).length) courseEdits[c.id] = edit;
                          else delete courseEdits[c.id];
                          return { ...w, courseEdits };
                        })
                      }
                    />
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          <p className="ss-setting-note">One event in a colour of its own? Open it on the calendar and pick one there.</p>
        </Group>
      ) : null}
    </div>
  );
}
