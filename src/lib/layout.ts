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

/** Where an item goes across its day's column, as fractions of the column's width. */
export interface Stacked<T> {
  item: T;
  left: number;
  width: number;
  /** Drawing order: higher draws on top. */
  z: number;
}

/** How far an item that starts inside another sits in from that one's left edge, as a share of the column. */
const STACK_INDENT = 0.15;
/** However deep the stack, the item on top keeps at least this share of the column. */
const STACK_MAX_LEFT = 0.45;

/**
 * Overlapping items the way Google Calendar draws them. Items that start at
 * about the same time (closer than `sideBySide` ms, so the first one's title
 * would be hidden) sit side by side. An item that starts later, inside others,
 * goes on top of them: set in a little from the left edge of the topmost one and
 * running to the column's right edge, so it keeps most of the width while the
 * ones underneath still show their titles above it and a strip down their left.
 * Later items draw over earlier ones.
 */
export function layoutStack<T>(items: T[], start: (t: T) => number, end: (t: T) => number, sideBySide: number): Stacked<T>[] {
  type Row = { parent: Node | null; members: Node[] };
  type Node = { item: T; s: number; e: number; row: Row; left: number; width: number };
  const sorted = [...items].sort((a, b) => start(a) - start(b) || end(b) - end(a));
  const nodes: Node[] = [];
  const rows: Row[] = [];

  const place = (row: Row) => {
    const p = row.parent;
    const from = p ? Math.min(STACK_MAX_LEFT, p.left + STACK_INDENT) : 0;
    const w = (1 - from) / row.members.length;
    row.members.forEach((n, i) => {
      n.left = from + i * w;
      n.width = w;
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
      const parent = overlapping.reduce<Node | null>((top, n) => (!top || n.left >= top.left ? n : top), null);
      row = { parent, members: [] };
      rows.push(row);
    }
    const node: Node = { item, s, e, row, left: 0, width: 1 };
    row.members.push(node);
    nodes.push(node);
    place(row);
  }
  // Settle every row again in order, now that each has all its members.
  rows.forEach(place);
  return nodes.map((n, i) => ({ item: n.item, left: n.left, width: n.width, z: i + 1 }));
}
