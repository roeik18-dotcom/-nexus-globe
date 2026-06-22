/**
 * Nexus · Orientation Score — the closing summary metric (data + pure logic)
 *
 *   Collapse → Resource Matrix → Energy Leakage → Harmonic Flow
 *   → Load Distribution → Energy Recovery → [Orientation Score]
 *
 * A single deterministic 0–100 number that says how much Nexus improved the
 * person's orientation, combining four components:
 *
 *   balanceGain            (0.30) — recovery vs. root deficits (harmonic flow)
 *   energyRecovery         (0.25) — energy restored (load distribution)
 *   collectiveDistribution (0.25) — share of burden moved to the network
 *   leakageRelief          (0.20) — reduction in energy-leakage pressure
 *
 * Pure, deterministic. No UI, no DOM, no storage, no engine changes, no AI.
 * Reuses collapseMap / loadModel / harmonicFlow / energyLeakage / seed graph.
 */

import { NOA_NODES } from './nodes';
import { getCollapseMap } from './collapseMap';
import { computeLoadDistribution } from './loadModel';
import { computeHarmonicFlow } from './harmonicFlow';
import { calculateEnergyLeakage } from './energyLeakage';
import type { Dimension } from './resourceMatrix';

export type OrientationLevel = 'low' | 'medium' | 'high' | 'strong';

export const ORIENTATION_WEIGHTS = {
  balanceGain: 0.30,
  energyRecovery: 0.25,
  collectiveDistribution: 0.25,
  leakageRelief: 0.20,
} as const;

export interface OrientationScore {
  score: number; // 0–100
  level: OrientationLevel;
  balanceGain: number;
  energyRecovery: number;
  collectiveDistribution: number;
  leakageRelief: number;
  strongestRemainingDeficit: { dimension: Dimension; deficit: number };
  summary: string;
}

const round = (n: number): number => Math.round(n);
const clamp = (n: number, lo = 0, hi = 100): number => Math.max(lo, Math.min(hi, n));

function levelOf(v: number): OrientationLevel {
  if (v >= 75) return 'strong';
  if (v >= 55) return 'high';
  if (v >= 35) return 'medium';
  return 'low';
}

/**
 * Calculate the orientation score for a case node, or null if the node has no
 * collapse map / load profile. Deterministic and pure.
 */
export function calculateOrientationScore(nodeId: number): OrientationScore | null {
  const node = NOA_NODES.find(n => n.id === nodeId);
  const collapseMap = getCollapseMap(nodeId);
  if (!node || !collapseMap) return null;

  const ld = computeLoadDistribution(node, NOA_NODES);
  if (!ld) return null;
  const hf = computeHarmonicFlow(collapseMap, ld);
  const el = calculateEnergyLeakage(nodeId);
  if (!el) return null;

  // 1. Balance gain — recovery vs. root (dimension) deficits.
  const totalDeficit = hf.dimensions.reduce((s, d) => s + d.dimensionPressure, 0);
  const totalInflow = hf.dimensions.reduce((s, d) => s + d.dimensionInflow, 0);
  const balanceGain = totalDeficit ? round((totalInflow / totalDeficit) * 100) : 0;

  // 2. Energy recovery — straight from the load distribution.
  const energyRecovery = ld.energyRecovered;

  // 3. Collective distribution — share of burden moved to the network.
  const collectiveDistribution = ld.beforeIndividualLoad
    ? round((ld.distributedLoad / ld.beforeIndividualLoad) * 100)
    : 0;

  // 4. Leakage relief — leakage scales with personal load; after distribution
  //    the load drops, so recompute leakage at the reduced load.
  const afterLoadFactor = ld.afterIndividualLoad / 100;
  const leakageAfter = round(el.attentionDrain * afterLoadFactor);
  const leakageRelief = el.totalLeakage
    ? round(((el.totalLeakage - leakageAfter) / el.totalLeakage) * 100)
    : 0;

  // Weighted average → score.
  const score = clamp(round(
    balanceGain * ORIENTATION_WEIGHTS.balanceGain +
    energyRecovery * ORIENTATION_WEIGHTS.energyRecovery +
    collectiveDistribution * ORIENTATION_WEIGHTS.collectiveDistribution +
    leakageRelief * ORIENTATION_WEIGHTS.leakageRelief,
  ));
  const level = levelOf(score);

  // What's still least covered after the network's help.
  const remaining = hf.dimensions.reduce(
    (b, d) => (d.dimensionDeficit > b.dimensionDeficit ? d : b), hf.dimensions[0],
  );
  const strongestRemainingDeficit = { dimension: remaining.dimension, deficit: remaining.dimensionDeficit };

  const summary =
    `Nexus improves orientation by distributing collective burden, restoring energy, ` +
    `and reducing collapse pressure — score ${score}/100 (${level}). ` +
    `${collectiveDistribution}% of the burden shifts to the network, energy recovers +${energyRecovery}, ` +
    `leakage eases ${leakageRelief}%. ${remaining.dimension} remains the least-covered dimension.`;

  return {
    score,
    level,
    balanceGain,
    energyRecovery,
    collectiveDistribution,
    leakageRelief,
    strongestRemainingDeficit,
    summary,
  };
}
