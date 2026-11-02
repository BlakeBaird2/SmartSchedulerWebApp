/**
 * Side-by-side placement for things that overlap on a time grid, the way every
 * calendar app does it: overlapping items share the width, each in its own column.
 */
export interface Placed<T> {
  item: T;
  /** 0-based column. */
  col: number;
  /** Columns in this item's overlapping group. */
  cols: number;
}

export function layoutColumns<T>(items: T[], start: (t: T) => number, end: (t: T) => number): Placed<T>[] {
  const sorted = [...items].sort((a, b) => start(a) - start(b) || end(b) - end(a));
  const out: Placed<T>[] = [];
  let group: Placed<T>[] = [];
  let groupEnd = -Infinity;
  let colEnds: number[] = [];

  const flush = () => {
    for (const p of group) p.cols = colEnds.length;
    out.push(...group);
    group = [];
    colEnds = [];
    groupEnd = -Infinity;
  };

  for (const item of sorted) {
    const s = start(item);
    const e = Math.max(end(item), s + 1);
    if (group.length && s >= groupEnd) flush();
    let col = colEnds.findIndex((ce) => ce <= s);
    if (col === -1) {
      col = colEnds.length;
      colEnds.push(e);
    } else colEnds[col] = e;
    group.push({ item, col, cols: 0 });
    groupEnd = Math.max(groupEnd, e);
  }
  flush();
  return out;
}

/**
 * Where an item goes across its day's column: a share of the column's width
 * plus a few pixels, so it reads `calc(left * 100% + leftPx px)` and likewise
 * for the width.
 */
export interface Stacked<T> {
  item: T;
  left: number;
  leftPx: number;
  width: number;
  widthPx: number;
  /** Drawing order: higher draws on top. */
  z: number;
}

/** How far (px) an item on top of another sits in from that one's left edge, as in Google Calendar. */
export const STACK_STEP_PX = 8;
/** However deep the stack, it steps in no more than this many times. */
const STACK_MAX_STEPS = 4;
/** In a run of columns, each one but the last reaches this many columns across, under the next. */
const COLUMN_REACH = 1.7;

/**
 * Overlapping items the way Google Calendar draws them.
 *
 * Items that start close together (less than `sideBySide` ms apart, so the
 * later one would hide the earlier one's title) share columns, reusing a column
 * once its item has ended. Each column but the last reaches 1.7 columns across,
 * running under the next one, which draws on top; the last runs to the right
 * edge.
 *
 * An item that starts later, inside others, goes on top of the topmost of them:
 * nudged a few pixels in from that one's left edge and running all the way to
 * the column's right edge. The ones underneath keep their titles showing above it
 * and a sliver down their side. Later items draw over earlier ones.
 */
export function layoutStack<T>(items: T[], start: (t: T) => number, end: (t: T) => number, sideBySide: number): Stacked<T>[] {
  type Group = { parent: Node | null; colEnds: number[]; members: Node[] };
  type Node = { item: T; s: number; e: number; group: Group; col: number; steps: number; left: number; leftPx: number; width: number; widthPx: number };
  const sorted = [...items].sort((a, b) => start(a) - start(b) || end(b) - end(a));
  const nodes: Node[] = [];
  const groups: Group[] = [];

  const place = (g: Group) => {
    const p = g.parent;
    const step = p && p.steps < STACK_MAX_STEPS ? 1 : 0;
    const from = p ? p.left : 0;
    const fromPx = p ? p.leftPx + step * STACK_STEP_PX : 0;
    const n = g.colEnds.length;
    // One column's width, as a share of the day plus pixels: (right edge - start) / n.
    const w = (1 - from) / n;
    const wPx = fromPx ? -fromPx / n : 0;
    const reach = (c: number) => (c === n - 1 ? 1 : COLUMN_REACH);
    for (const m of g.members) {
      m.steps = (p?.steps ?? 0) + step;
      m.left = from + m.col * w;
      m.leftPx = fromPx + m.col * wPx;
      m.width = w * reach(m.col);
      m.widthPx = wPx * reach(m.col);
    }
  };

  for (const item of sorted) {
    const s = start(item);
    const e = Math.max(end(item), s + 1);
    const overlapping = nodes.filter((n) => n.s < e && s < n.e);
    // Starting about when one it overlaps did: into that one's columns.
    const sibling = overlapping.findLast((n) => s - n.s < sideBySide);
    let group: Group;
    if (sibling) group = sibling.group;
    else {
      // Otherwise on top of the topmost one it overlaps (the one furthest in), or on its own.
      const inset = (n: Node) => n.left * 1000 + n.leftPx;
      const parent = overlapping.reduce<Node | null>((top, n) => (!top || inset(n) >= inset(top) ? n : top), null);
      group = { parent, colEnds: [], members: [] };
      groups.push(group);
    }
    // The first column that's free by now, or a new one.
    let col = group.colEnds.findIndex((ce) => ce <= s);
    if (col === -1) col = group.colEnds.push(e) - 1;
    else group.colEnds[col] = e;
    const node: Node = { item, s, e, group, col, steps: 0, left: 0, leftPx: 0, width: 1, widthPx: 0 };
    group.members.push(node);
    nodes.push(node);
    place(group);
  }
  // Settle every group again in order, now that each has all its columns.
  groups.forEach(place);
  return nodes.map((n, i) => ({ item: n.item, left: n.left, leftPx: n.leftPx, width: n.width, widthPx: n.widthPx, z: i + 1 }));
}
