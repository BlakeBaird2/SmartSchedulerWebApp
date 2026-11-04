/**
 * The home page's picture: the calendars a student juggles (Google Calendar,
 * Canvas, Apple Calendar, Learning Suite) drawn as hand-sketched icons in an
 * arch, with arrows curving down from each into the laptop and phone below
 * (passed in as children).
 *
 * Drawn on the server. Where the browser supports scroll-driven animations, the
 * arrows draw themselves in as the section scrolls into view; otherwise, and for
 * anyone who prefers less motion, they're simply there.
 *
 * The icons (public/landing/*.webp) are sketches that name the calendars
 * Schedule Smart reads, not an endorsement by their makers.
 */

/** The picture's coordinates: as wide as the laptop and phone below (1000), 330 tall. */
const W = 1000;
const H = 330;

type Point = [number, number];
type Source = { id: string; src: string; at: Point; tilt: number; arrow: [Point, Point, Point, Point] };

/** Left to right in a low arch, each with its arrow: from under it, curving down into the laptop. */
const SOURCES: Source[] = [
  {
    id: "google",
    src: "/landing/google-calendar.webp",
    at: [150, 150],
    tilt: -6,
    arrow: [
      [178, 240],
      [200, 300],
      [295, 278],
      [330, 322],
    ],
  },
  {
    id: "canvas",
    src: "/landing/canvas.webp",
    at: [385, 92],
    tilt: 0,
    arrow: [
      [402, 182],
      [432, 228],
      [446, 270],
      [440, 322],
    ],
  },
  {
    id: "apple",
    src: "/landing/apple-calendar.webp",
    at: [615, 92],
    tilt: 3,
    arrow: [
      [598, 182],
      [568, 228],
      [554, 270],
      [560, 322],
    ],
  },
  {
    id: "learning-suite",
    src: "/landing/learning-suite.webp",
    at: [850, 150],
    // Mirrors Google Calendar's tilt on the other side.
    tilt: 6,
    arrow: [
      [822, 240],
      [800, 300],
      [705, 278],
      [670, 322],
    ],
  },
];

const curve = ([a, b, c, d]: Source["arrow"]) => `M${a[0]} ${a[1]} C${b[0]} ${b[1]} ${c[0]} ${c[1]} ${d[0]} ${d[1]}`;

/** An open arrowhead at the curve's end, pointing the way it arrives. */
function head([, , c, d]: Source["arrow"]): string {
  const len = Math.hypot(d[0] - c[0], d[1] - c[1]);
  const [ux, uy] = [(d[0] - c[0]) / len, (d[1] - c[1]) / len];
  const side = (angle: number) => {
    const [cos, sin] = [Math.cos(angle), Math.sin(angle)];
    return [d[0] - 22 * (ux * cos - uy * sin), d[1] - 22 * (ux * sin + uy * cos)].map((v) => Math.round(v * 10) / 10);
  };
  const [l, r] = [side(0.5), side(-0.5)];
  return `M${l[0]} ${l[1]} L${d[0]} ${d[1]} L${r[0]} ${r[1]}`;
}

const pct = (v: number, of: number) => `${(v / of) * 100}%`;

export function CalendarFunnel({ children }: { children: React.ReactNode }) {
  return (
    <div className="ss-funnel">
      <div
        className="ss-funnel-art"
        role="img"
        aria-label="Google Calendar, Canvas, Apple Calendar and Learning Suite, with arrows from each pointing down into Schedule Smart on a laptop."
      >
        <svg viewBox={`0 0 ${W} ${H}`} aria-hidden>
          {SOURCES.map((s) => (
            <g key={s.id} className="ss-funnel-arrow">
              <path d={curve(s.arrow)} pathLength={1} />
              <path className="ss-funnel-head" d={head(s.arrow)} />
            </g>
          ))}
        </svg>
        {SOURCES.map((s) => (
          // Plain <img>: small fixed sketches; nothing for the image optimiser to do.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={s.id}
            className="ss-funnel-icon"
            src={s.src}
            alt=""
            width={180}
            height={180}
            decoding="async"
            style={{ left: pct(s.at[0], W), top: pct(s.at[1], H), rotate: `${s.tilt}deg` }}
          />
        ))}
      </div>

      {children}
    </div>
  );
}
