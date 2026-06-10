/**
 * Nexus · Energy Leakage — the causal bridge (data + pure logic)
 *
 *   negative dominance → attention drain → private energy leakage
 *   → collapse risk → need for load distribution
 *
 * Computes how much private energy is leaking from the person into the
 * external mission/problem. Leakage is driven by high cell dominance, low
 * cell energy, high attention weight, high personal load, and external
 * mission pressure.
 *
 * Pure, deterministic. No UI, no DOM, no storage, no engine changes, no AI.
 * Reuses cellMatrix.ts, collapseMap.ts and loadModel.ts.
 */

import { getCollapseMap } from './collapseMap';
import { getLoadProfile } from './loadModel';
import { computeAttention, type Channel } from './cellMatrix';
import type { DepartmentName } from './resourceMatrix';

export type LeakageLevel = 'low' | 'medium' | 'high' | 'critical';

export interface LeakingCell {
  department: DepartmentName;
  channel: Channel;
  dominance: number;
  leakage: number;
}

export interface EnergyLeakage {
  totalLeakage: number;        // 0–100
  leakageLevel: LeakageLevel;
  strongestLeakingCell: LeakingCell;
  strongestLeakingDepartment: DepartmentName;
  personalLoadFactor: number;  // personalLoad / 100
  attentionDrain: number;      // attention-weighted dominance (load-independent)
  missionPressure: number;     // superegoCollapse / 100
  summary: string;
}

const round = (n: number): number => Math.round(n);
const clamp = (n: number, lo = 0, hi = 100): number => Math.max(lo, Math.min(hi, n));

function leakageLevelOf(v: number): LeakageLevel {
  if (v >= 85) return 'critical';
  if (v >= 70) return 'high';
  if (v >= 45) return 'medium';
  return 'low';
}

/**
 * Calculate energy leakage for a case node, or null if the node has no
 * collapse map / load profile. Deterministic and pure.
 *
 *   cellLeakage = dominance × attention × personalLoadFactor
 *   totalLeakage = clamp(Σ cellLeakage, 0..100)
 */
export function calculateEnergyLeakage(nodeId: number): EnergyLeakage | null {
  const collapseMap = getCollapseMap(nodeId);
  if (!collapseMap) return null;
  const profile = getLoadProfile(nodeId);
  if (!profile) return null;

  const att = computeAttention(); // 18 cells with dominance + attention (0..1)
  const personalLoadFactor = profile.personalLoad / 100;

  const cellLeaks = att.cells.map(c => ({
    department: c.department,
    channel: c.channel,
    dominance: c.dominance,
    leak: c.dominance * c.attention * personalLoadFactor,
  }));

  const totalRaw = cellLeaks.reduce((s, c) => s + c.leak, 0);
  const totalLeakage = clamp(round(totalRaw));

  // Attention drain = attention-weighted dominance (independent of load).
  const attentionDrain = round(att.cells.reduce((s, c) => s + c.dominance * c.attention, 0));

  // External mission pressure rises with the superego's (obsessive-mission) dominance.
  const superego = collapseMap.departments.find(d => d.name === 'SUPEREGO')?.negativeDominance ?? 0;
  const missionPressure = round(superego) / 100;

  // Strongest leaking cell.
  const sc = cellLeaks.reduce((b, c) => (c.leak > b.leak ? c : b), cellLeaks[0]);
  const strongestLeakingCell: LeakingCell = {
    department: sc.department, channel: sc.channel, dominance: sc.dominance, leakage: round(sc.leak),
  };

  // Strongest leaking department (sum of its cells' leakage).
  const deptTotals = new Map<DepartmentName, number>();
  for (const c of cellLeaks) deptTotals.set(c.department, (deptTotals.get(c.department) ?? 0) + c.leak);
  let strongestLeakingDepartment = cellLeaks[0].department;
  let best = -Infinity;
  for (const [dept, v] of deptTotals) if (v > best) { best = v; strongestLeakingDepartment = dept; }

  const leakageLevel = leakageLevelOf(totalLeakage);
  const summary =
    `Private energy is leaking into the external justice/truth mission — ` +
    `total leakage ${totalLeakage}/100 (${leakageLevel}). ${strongestLeakingDepartment} drains hardest ` +
    `(cell ${strongestLeakingCell.department}·${strongestLeakingCell.channel}). ` +
    `Personal load ×${personalLoadFactor.toFixed(2)}, mission pressure ${round(missionPressure * 100)}%.`;

  return {
    totalLeakage,
    leakageLevel,
    strongestLeakingCell,
    strongestLeakingDepartment,
    personalLoadFactor,
    attentionDrain,
    missionPressure,
    summary,
  };
}
