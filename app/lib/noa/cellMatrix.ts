/**
 * Nexus · Expression Cell Matrix — the 18-cell foundation (data + pure logic)
 *
 * Principles 3–7 of the Philos mathematical foundation:
 *   - 6 departments × 3 expression channels (Body / Emotion / Mind) = 18 cells
 *   - each cell holds positive / negative / dominance and an energy level (0–100)
 *   - attention is drawn by deficit: attentionWeight = cellDeficit / Σ deficits
 *   - a department's collapse = the AVERAGE of its 3 cells' dominance
 *
 * This is the layer that sits UNDER the Collapse Map. The per-department
 * dominance values are derived here as cell averages and are backward
 * compatible with collapseMap.ts (Physical 70 … Emotional 90 … SUPEREGO 60).
 *
 * Pure, deterministic. No UI, no DOM, no storage, no engine changes, no AI.
 */

import { DEPARTMENTS, type DepartmentName } from './resourceMatrix';

export type Channel = 'Body' | 'Emotion' | 'Mind';
export const CHANNELS: Channel[] = ['Body', 'Emotion', 'Mind'];

// Per-cell dominance (0–100). Each department's 3 values average to its
// collapse value, keeping collapseMap.ts numbers intact.
const CELL_DOMINANCE: Record<DepartmentName, Record<Channel, number>> = {
  Physical: { Body: 75, Emotion: 65, Mind: 70 }, // avg 70
  Emotional: { Body: 88, Emotion: 95, Mind: 87 }, // avg 90
  Rational: { Body: 78, Emotion: 82, Mind: 80 }, // avg 80
  ID: { Body: 90, Emotion: 88, Mind: 77 }, // avg 85
  EGO: { Body: 72, Emotion: 78, Mind: 75 }, // avg 75
  SUPEREGO: { Body: 55, Emotion: 62, Mind: 63 }, // avg 60
};

export interface Cell {
  department: DepartmentName;
  channel: Channel;
  positive: number;  // balanced share (0–100)
  negative: number;  // overpowering share (0–100)
  dominance: number; // = negative when positive+negative = 100
  energy: number;    // 0 = collapse, 100 = balance (= 100 − dominance)
}

export interface AttentionCell extends Cell {
  attention: number;    // 0..1 share of total system deficit
  attentionPct: number; // rounded percentage
}

export interface CellAttention {
  cells: AttentionCell[];
  totalDeficit: number;
  strongest: AttentionCell;
}

const round = (n: number): number => Math.round(n);

/** Build a single cell from its dominance. */
function makeCell(department: DepartmentName, channel: Channel): Cell {
  const dominance = CELL_DOMINANCE[department][channel];
  const positive = 100 - dominance;
  return { department, channel, positive, negative: dominance, dominance, energy: 100 - dominance };
}

/** The full 18-cell matrix (6 departments × 3 channels). */
export function getCellMatrix(): Cell[] {
  const cells: Cell[] = [];
  for (const dept of DEPARTMENTS) {
    for (const ch of CHANNELS) cells.push(makeCell(dept, ch));
  }
  return cells;
}

/** A single cell. */
export function getCell(department: DepartmentName, channel: Channel): Cell {
  return makeCell(department, channel);
}

/** The 3 cells of a department. */
export function getDepartmentCells(department: DepartmentName): Cell[] {
  return CHANNELS.map(ch => makeCell(department, ch));
}

/**
 * Department collapse = average of its 3 cells' dominance (principle 7).
 * Backward compatible with collapseMap.ts negativeDominance values.
 */
export function deriveDepartmentCollapse(department: DepartmentName): number {
  const cells = getDepartmentCells(department);
  return round(cells.reduce((s, c) => s + c.dominance, 0) / cells.length);
}

/** All 6 departments' derived collapse values. */
export function deriveAllDepartmentCollapse(): Record<DepartmentName, number> {
  const out = {} as Record<DepartmentName, number>;
  for (const dept of DEPARTMENTS) out[dept] = deriveDepartmentCollapse(dept);
  return out;
}

/**
 * Attention follows deficit: each cell's attention weight is its dominance
 * (deficit) over the sum of all cell deficits (principle 5).
 */
export function computeAttention(): CellAttention {
  const base = getCellMatrix();
  const totalDeficit = base.reduce((s, c) => s + c.dominance, 0);
  const cells: AttentionCell[] = base.map(c => {
    const attention = totalDeficit ? c.dominance / totalDeficit : 0;
    return { ...c, attention, attentionPct: round(attention * 100) };
  });
  const strongest = cells.reduce((b, c) => (c.attention > b.attention ? c : b), cells[0]);
  return { cells, totalDeficit, strongest };
}
