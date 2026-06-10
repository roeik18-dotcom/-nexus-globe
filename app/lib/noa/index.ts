// PHILOS NEXUS · Noa Chain MVP 0.5 — public surface
//
// The full deterministic chain, ported from the local proof project:
//   Space → Base Oppositions → 6 Departments → 18 Cells → Collapse Map
//   → Root Resource Matrix → Energy Leakage → Harmonic Flow → Load Distribution
//   → Energy Recovery → Orientation Score → Action → Impact → Collective Impact
//
// Pure, deterministic. No DOM, no storage, no AI, no backend. The model is
// identical to the local chain — only the node-identity source is local.

export * from './deptLabel';
export * from './nodes';
export * from './baseTensionField';
export * from './cellMatrix';
export * from './collapseMap';
export * from './resourceMatrix';
export * from './energyLeakage';
export * from './harmonicFlow';
export * from './loadModel';
export * from './orientationScore';
export * from './actionImpact';

import { deptLabel } from './deptLabel';
import { NOA_NODES } from './nodes';
import { summarizeBaseTensionField, type BaseTensionSummary } from './baseTensionField';
import { getCellMatrix, computeAttention, type CellAttention } from './cellMatrix';
import { getCollapseMap, type CollapseMap } from './collapseMap';
import { summarizeResourceState, type ResourceState } from './resourceMatrix';
import { calculateEnergyLeakage, type EnergyLeakage } from './energyLeakage';
import { computeHarmonicFlow, type HarmonicFlow } from './harmonicFlow';
import { computeLoadDistribution, type LoadDistribution, type CollapseRisk } from './loadModel';
import { calculateOrientationScore, type OrientationScore } from './orientationScore';
import { calculateActionImpact, type ActionImpact } from './actionImpact';

export interface NoaChain {
  tension: BaseTensionSummary | null;
  attention: CellAttention;
  collapse: CollapseMap | null;
  resource: ResourceState | null;
  leakage: EnergyLeakage | null;
  load: LoadDistribution | null;
  flow: HarmonicFlow | null;
  orientation: OrientationScore | null;
  action: ActionImpact | null;
}

/** Compute the full chain for a case node (Noa = id 0). Pure & deterministic. */
export function computeNoaChain(nodeId = 0): NoaChain {
  const collapse = getCollapseMap(nodeId);
  const node = NOA_NODES.find(n => n.id === nodeId);
  const load = node ? computeLoadDistribution(node, NOA_NODES) : null;
  return {
    tension: summarizeBaseTensionField(nodeId),
    attention: computeAttention(),
    collapse,
    resource: collapse ? summarizeResourceState(collapse) : null,
    leakage: calculateEnergyLeakage(nodeId),
    load,
    flow: collapse && load ? computeHarmonicFlow(collapse, load) : null,
    orientation: calculateOrientationScore(nodeId),
    action: calculateActionImpact(nodeId),
  };
}

const RISK_HE: Record<CollapseRisk, string> = {
  low: 'נמוך', medium: 'בינוני', high: 'גבוה', critical: 'קריטי',
};
export function riskHe(r: CollapseRisk): string {
  return RISK_HE[r];
}

/** Plain-text snapshot covering the whole chain. */
export function buildNoaSnapshot(nodeId = 0): string {
  const c = computeNoaChain(nodeId);
  const L: string[] = [];
  L.push('=== PHILOS · NOA CHAIN SNAPSHOT (mvp-0.5) ===');
  L.push('');

  if (c.tension) {
    L.push('[1] BASE TENSION FIELD');
    L.push(`origin: ${c.tension.origin} → base oppositions → 6 departments`);
    for (const f of c.tension.fields) L.push(`- ${f.name} → ${deptLabel(f.department)}: ${f.intensity}`);
    L.push(`strongest tension: ${c.tension.strongest.name} → ${deptLabel(c.tension.strongest.department)} (${c.tension.strongest.intensity})`);
    L.push(`average tension: ${c.tension.averageTension}`);
    L.push('');
  }
  if (c.collapse) {
    L.push('[2] EXPRESSION MATRIX (18 cells)');
    for (const dept of [...new Set(c.attention.cells.map(x => x.department))]) {
      const row = c.attention.cells.filter(x => x.department === dept).map(x => `${x.channel} ${x.dominance}`).join(' · ');
      L.push(`- ${deptLabel(dept)}: ${row}`);
    }
    L.push(`strongest attention cell: ${deptLabel(c.attention.strongest.department)} · ${c.attention.strongest.channel} (${c.attention.strongest.dominance}%)`);
    L.push('');
    L.push('[3] COLLAPSE MAP');
    L.push(`total negative dominance: ${c.collapse.totalNegativeDominance}%`);
    for (const d of c.collapse.departments) L.push(`- ${deptLabel(d.name)}: ${d.negativeDominance}%`);
    L.push('');
  }
  if (c.resource) {
    L.push('[4] ROOT RESOURCE MATRIX');
    L.push(`Physical ${c.resource.dimensionDeficits.Physical} (${c.resource.dimensionLevels.Physical}) · Emotional ${c.resource.dimensionDeficits.Emotional} (${c.resource.dimensionLevels.Emotional}) · Rational ${c.resource.dimensionDeficits.Rational} (${c.resource.dimensionLevels.Rational})`);
    L.push(`strongest depleted root: ${c.resource.strongestRoot}`);
    L.push('');
  }
  if (c.leakage) {
    L.push('[5] ENERGY LEAKAGE');
    L.push(`total leakage: ${c.leakage.totalLeakage}/100 (${c.leakage.leakageLevel})`);
    L.push(`strongest leaking: ${deptLabel(c.leakage.strongestLeakingDepartment)} · cell ${deptLabel(c.leakage.strongestLeakingCell.department)}·${c.leakage.strongestLeakingCell.channel}`);
    L.push('');
  }
  if (c.load) {
    const RV: Record<string, string> = {
      lawyer: 'Justice', therapist: 'Protection', journalist: 'Truth', donor: 'Responsibility', peer_survivor: 'Dignity',
    };
    L.push('VALUE NETWORK');
    L.push('shared values: Truth · Justice · Protection · Responsibility · Dignity');
    for (const h of c.load.helpers) L.push(`- ${h.name}: value ${RV[h.role] ?? '—'} · load ${h.allocated}`);
    L.push(`total network capacity: ${c.load.distributedLoad}`);
    L.push('note: connects people through common values — private burden → shared responsibility');
    L.push('');
  }
  if (c.flow) {
    L.push('[6] HARMONIC FLOW');
    for (const d of c.flow.dimensions) L.push(`- ${d.dimension}: deficit ${d.deficitBefore} -> ${d.deficitAfter} (inflow +${d.inflow})`);
    L.push(`strongest inflow: ${c.flow.strongestInflowDimension} · most rebalanced: ${deptLabel(c.flow.mostRebalancedDepartment)}`);
    L.push('');
  }
  if (c.load) {
    L.push('[7] LOAD DISTRIBUTION + ENERGY RECOVERY');
    L.push(`before: ${c.load.beforePct}% (energy ${c.load.beforeEnergy}, risk ${RISK_HE[c.load.collapseRiskBefore]})`);
    L.push(`after: ${c.load.afterPct}% · community ${c.load.communityPct}% (energy +${c.load.energyRecovered} -> ${c.load.afterEnergy}, risk ${RISK_HE[c.load.collapseRiskAfter]})`);
    for (const h of c.load.helpers) L.push(`- ${h.name}: ${h.loadType} ${h.allocated}`);
    L.push('');
  }
  if (c.orientation) {
    L.push('[8] ORIENTATION SCORE');
    L.push(`score: ${c.orientation.score}/100 (${c.orientation.level})`);
    L.push(`balance ${c.orientation.balanceGain} · energy ${c.orientation.energyRecovery} · distribution ${c.orientation.collectiveDistribution} · leakage relief ${c.orientation.leakageRelief}`);
    L.push(`strongest remaining deficit: ${c.orientation.strongestRemainingDeficit.dimension} (${c.orientation.strongestRemainingDeficit.deficit})`);
    const s = c.orientation.score;
    const bandLabel = s <= 25 ? 'Collapse / no orientation' : s <= 50 ? 'First stabilization' : s <= 75 ? 'Active recovery' : 'Strong orientation';
    L.push(`interpretation: ${s} = ${bandLabel}`);
    L.push('scale: 0-25 collapse · 26-50 first stabilization · 51-75 active recovery · 76-100 strong orientation');
    L.push('note: not full recovery — first successful intervention (collapse interrupted, load redistributed, energy recovered; more work still needed)');
    L.push('');
  }
  if (c.action) {
    L.push('[9] ACTION → IMPACT');
    L.push(`recommended action: ${c.action.recommendedAction} → ${c.action.targetDimension} / ${deptLabel(c.action.targetDepartment)}`);
    L.push(`energy +${c.action.expectedEnergyGain} · load -${c.action.expectedLoadReduction} · orientation +${c.action.expectedOrientationGain} · collective ${c.action.collectiveImpact}`);
  }

  return L.join('\n');
}
