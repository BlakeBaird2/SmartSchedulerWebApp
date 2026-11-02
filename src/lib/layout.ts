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
export const STACK_STEP_PX = 12;
/** However deep the stack, it steps in no more than this many times. */
const STACK_MAX_STEPS = 4;

/**
 * Overlapping items the way Google Calendar draws them. Items that start at
 * about the same time (closer than `sideBySide` ms, so the first one's title
 * would be hidden) sit side by side. An item that starts later, inside others,
 * goes on top of them, as wide as the topmost one: nudged in a few pixels from
 * its left edge and running to the same right edge, so the one underneath still
 * shows its title above it and a sliver down its side. Later items draw over
 * earlier ones.
 */
export function layoutStack<T>(items: T[], start: (t: T) => number, end: (t: T) => number, sideBySide: number): Stacked<T>[] {
  type Row = { parent: Node | null; members: Node[] };
  type Node = { item: T; s: number; e: number; row: Row; steps: number; left: number; leftPx: number; width: number; widthPx: number };
  const sorted = [...items].sort((a, b) => start(a) - start(b) || end(b) - end(a));
  const nodes: Node[] = [];
  const rows: Row[] = [];

  const place = (row: Row) => {
    const p = row.parent;
    const step = p && p.steps < STACK_MAX_STEPS ? 1 : 0;
    // The row runs from just inside its parent's left edge to the parent's right edge.
    const from = p ? p.left : 0;
    const fromPx = p ? p.leftPx + step * STACK_STEP_PX : 0;
    const right = p ? p.left + p.width : 1;
    const rightPx = p ? p.leftPx + p.widthPx : 0;
    const n = row.members.length;
    const w = (right - from) / n;
    const wPx = (rightPx - fromPx) / n;
    row.members.forEach((m, i) => {
      m.steps = (p?.steps ?? 0) + step;
      m.left = from + i * w;
      m.leftPx = fromPx + i * wPx;
      m.width = w;
      m.widthPx = wPx;
    });
  };

  for (const item of sorted) {
    const s = start(item);
    const e = Math.max(end(item), s + 1);
    const overlapping = nodes.filter((n) => n.s < e && s < n.e);
    // Starting about when one it overlaps did: beside it.
    const sibling = overlapping.findLast((n) => s - n.s < sideBySide);
    let row: Row;
    if (sibling) row = sibling.row;
    else {
      // Otherwise on top of the topmost one it overlaps (the one furthest in), or on its own.
      const inset = (n: Node) => n.left * 1000 + n.leftPx;
      const parent = overlapping.reduce<Node | null>((top, n) => (!top || inset(n) >= inset(top) ? n : top), null);
      row = { parent, members: [] };
      rows.push(row);
    }
    const node: Node = { item, s, e, row, steps: 0, left: 0, leftPx: 0, width: 1, widthPx: 0 };
    row.members.push(node);
    nodes.push(node);
    place(row);
  }
  // Settle every row again in order, now that each has all its members.
  rows.forEach(place);
  return nodes.map((n, i) => ({ item: n.item, left: n.left, leftPx: n.leftPx, width: n.width, widthPx: n.widthPx, z: i + 1 }));
}
