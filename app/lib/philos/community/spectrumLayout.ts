/**
 * SPECTRUM LAYOUT — the geometry of the value landscape, as a pure function.
 *
 * Kept out of the component so the map can be tested at 0, 1, 3, 50 and 500
 * groups without a browser, and so the visual encoding is stated once, in
 * words, rather than implied by scattered style props:
 *
 *   FAMILY RECTANGLE AREA   ∝ number of sub-values in the family
 *       The taxonomy's own shape. F01 (28 leaves) genuinely is a larger part
 *       of the described landscape than F24 (1). A family with ZERO leaves
 *       still gets a minimum rectangle — four of them exist, and hiding them
 *       would misreport the taxonomy as complete.
 *
 *   SUB-VALUE CELL AREA     ∝ source_count (how many traditions cite it)
 *       Provenance depth, not importance. "צדק" cited by 6 sources is a
 *       denser piece of evidence than one cited by 1, and that is a fact
 *       about the corpus worth seeing.
 *
 *   CELL FILL               = group population: 0 / 1 / many
 *       The second, orthogonal dimension. Area says "how well described",
 *       fill says "who actually organised around it". The whole product
 *       point is that these two do not currently match.
 *
 * Nothing here is decorative. There is no colour in this module at all —
 * it returns geometry and counts, and the component maps those to the
 * palette so the encoding stays auditable.
 */
import type { ValueGroupUniverse, FamilyNode, SubvalueNode } from "./valueGroupUniverse";

export interface Rect { x: number; y: number; w: number; h: number }

export interface CellLayout extends Rect {
  subvalue_id: string;
  name_he: string;
  family_id: string;
  source_count: number;
  group_count: number;
  group_ids: string[];
}

export interface FamilyLayout extends Rect {
  family_id: string;
  name_he: string;
  content_he: string;
  subvalue_count: number;
  group_count: number;
  cells: CellLayout[];
}

export interface SpectrumLayout {
  width: number;
  height: number;
  families: FamilyLayout[];
  /** Sub-values whose family is null — a real cross-family review bucket. */
  unfamilied: SubvalueNode[];
}

/** Squarified treemap over one rectangle. Deterministic: no randomness, so
 *  the server and the client draw byte-identical geometry. */
function squarify(items: { id: string; weight: number }[], rect: Rect): (Rect & { id: string })[] {
  const out: (Rect & { id: string })[] = [];
  const total = items.reduce((a, i) => a + i.weight, 0);
  if (total <= 0 || items.length === 0) return out;
  let { x, y, w, h } = rect;
  let remaining = [...items].sort((a, b) => b.weight - a.weight);
  let remainingWeight = total;

  while (remaining.length) {
    const horizontal = w >= h;
    const side = horizontal ? h : w;
    // Grow a row while the worst aspect ratio improves.
    const row: typeof remaining = [];
    let rowWeight = 0;
    const worst = (rw: number, extra?: number) => {
      const candidates = extra !== undefined ? [...row.map((r) => r.weight), extra] : row.map((r) => r.weight);
      if (!candidates.length) return Infinity;
      const area = ((extra !== undefined ? rw + extra : rw) / remainingWeight) * (w * h);
      const thickness = area / side;
      if (thickness <= 0) return Infinity;
      const scale = area / (extra !== undefined ? rw + extra : rw);
      return Math.max(...candidates.map((c) => {
        const len = (c * scale) / thickness;
        return Math.max(thickness / len, len / thickness);
      }));
    };
    while (remaining.length) {
      const next = remaining[0];
      if (row.length && worst(rowWeight, next.weight) > worst(rowWeight)) break;
      row.push(next);
      rowWeight += next.weight;
      remaining = remaining.slice(1);
    }
    const area = (rowWeight / remainingWeight) * (w * h);
    const thickness = Math.max(1, area / side);
    let cursor = horizontal ? y : x;
    for (const r of row) {
      const len = Math.max(1, (r.weight / rowWeight) * side);
      out.push(horizontal
        ? { id: r.id, x, y: cursor, w: thickness, h: len }
        : { id: r.id, x: cursor, y, w: len, h: thickness });
      cursor += len;
    }
    if (horizontal) { x += thickness; w -= thickness; } else { y += thickness; h -= thickness; }
    remainingWeight -= rowWeight;
    if (w <= 1 || h <= 1) break;
  }
  return out;
}

const PAD = 2;
const LABEL_H = 17;

/** The cross-family bucket, drawn as a real region rather than dropped.
 *  Four sub-values carry `family_id: null` — the source document's own
 *  needs-review cases. Laying out only the 219 assigned ones would put 4 real
 *  values off the map entirely, which is exactly the kind of quiet omission
 *  the sparse-data rule forbids. It is visibly NOT one of the 28. */
export const CROSS_FAMILY_ID = "F--";

export function layoutSpectrum(
  universe: ValueGroupUniverse,
  width = 1180,
  height = 620,
): SpectrumLayout {
  // A family with no sub-values still occupies the map. Weight 0.6 rather than
  // 0 keeps it visible and visibly smaller than a family with one leaf.
  const items = universe.families.map((f: FamilyNode) => ({
    id: f.family_id,
    weight: f.subvalue_count > 0 ? f.subvalue_count : 0.6,
  }));
  if (universe.unfamilied.length > 0) {
    items.push({ id: CROSS_FAMILY_ID, weight: universe.unfamilied.length });
  }
  const boxes = squarify(items, { x: 0, y: 0, w: width, h: height });
  const byId = new Map(boxes.map((b) => [b.id, b]));

  const crossFamily: FamilyNode | null = universe.unfamilied.length > 0 ? {
    family_id: CROSS_FAMILY_ID,
    name_he: "בין-משפחתי — נדרשת סקירה",
    content_he: "תת-ערכים שהתאמת המשפחה שלהם לא הוכרעה במקור",
    subvalues: universe.unfamilied,
    subvalue_count: universe.unfamilied.length,
    group_count: universe.unfamilied.reduce((a, s) => a + s.group_count, 0),
  } : null;

  const families: FamilyLayout[] = [...universe.families, ...(crossFamily ? [crossFamily] : [])].map((f) => {
    const b = byId.get(f.family_id) ?? { x: 0, y: 0, w: 0, h: 0 };
    const inner: Rect = {
      x: b.x + PAD,
      y: b.y + PAD + LABEL_H,
      w: Math.max(0, b.w - PAD * 2),
      h: Math.max(0, b.h - PAD * 2 - LABEL_H),
    };
    const cellBoxes = squarify(
      f.subvalues.map((s: SubvalueNode) => ({ id: s.subvalue_id, weight: Math.max(1, s.source_count) })),
      inner,
    );
    const cellById = new Map(cellBoxes.map((c) => [c.id, c]));
    return {
      x: b.x, y: b.y, w: b.w, h: b.h,
      family_id: f.family_id, name_he: f.name_he, content_he: f.content_he,
      subvalue_count: f.subvalue_count, group_count: f.group_count,
      cells: f.subvalues.map((s) => {
        const c = cellById.get(s.subvalue_id) ?? { x: inner.x, y: inner.y, w: 0, h: 0 };
        return {
          x: c.x, y: c.y, w: c.w, h: c.h,
          subvalue_id: s.subvalue_id, name_he: s.name_he, family_id: f.family_id,
          source_count: s.source_count, group_count: s.group_count,
          group_ids: s.groups.map((g) => g.group.group_id),
        };
      }),
    };
  });

  return { width, height, families, unfamilied: [...universe.unfamilied] };
}

/** The three population states the map must distinguish (§11). */
export type Population = "NONE" | "ONE" | "MANY";
export const populationOf = (n: number): Population => (n === 0 ? "NONE" : n === 1 ? "ONE" : "MANY");
