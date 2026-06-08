/**
 * Nexus · Action Impact — the closing tail of the chain (data + pure logic)
 *
 *   … Orientation Score → [Action → Impact → Collective Impact]
 *
 * An action is not random: it is derived from the current strongest remaining
 * deficit and the available helper flows. The recommended action targets the
 * dimension still least covered after the value network has helped, and the
 * model projects its expected energy / load / orientation / collective impact.
 *
 * Pure, deterministic. No UI, no DOM, no storage, no engine changes, no AI.
 * Reuses orientationScore (which already aggregates collapse → harmonic flow →
 * load distribution → energy leakage) and loadModel.
 */

import { NOA_NODES } from './nodes';
import { calculateOrientationScore } from './orientationScore';
import { computeLoadDistribution } from './loadModel';
import {
  DEPARTMENTS,
  DEPARTMENT_TO_DIMENSION_WEIGHTS,
  type Dimension,
  type DepartmentName,
} from './resourceMatrix';

export type ActionId = 'stabilize' | 'support' | 'clarify' | 'distribute' | 'amplify';

interface ActionDef {
  id: ActionId;
  label: string;
  targetDimension: Dimension | null; // distribute/amplify are cross-cutting
  description: string;
  energyWeight: number;
  loadWeight: number;
  orientationWeight: number;
  collectiveWeight: number;
}

export const ACTIONS: Record<ActionId, ActionDef> = {
  stabilize: {
    id: 'stabilize', label: 'Stabilize', targetDimension: 'Physical',
    description: 'physical stability, basic resources, safety / time / operational support',
    energyWeight: 0.25, loadWeight: 0.30, orientationWeight: 0.15, collectiveWeight: 1.0,
  },
  support: {
    id: 'support', label: 'Support', targetDimension: 'Emotional',
    description: 'emotional support, belonging, presence',
    energyWeight: 0.30, loadWeight: 0.20, orientationWeight: 0.18, collectiveWeight: 1.2,
  },
  clarify: {
    id: 'clarify', label: 'Clarify', targetDimension: 'Rational',
    description: 'clarity, knowledge, strategy, order',
    energyWeight: 0.20, loadWeight: 0.25, orientationWeight: 0.15, collectiveWeight: 1.0,
  },
  distribute: {
    id: 'distribute', label: 'Distribute', targetDimension: null,
    description: 'spread remaining burden further across the value network',
    energyWeight: 0.15, loadWeight: 0.45, orientationWeight: 0.20, collectiveWeight: 1.6,
  },
  amplify: {
    id: 'amplify', label: 'Amplify', targetDimension: null,
    description: 'extend reach and visibility of the collective response',
    energyWeight: 0.10, loadWeight: 0.20, orientationWeight: 0.12, collectiveWeight: 2.0,
  },
};

// Which dimension-targeting action addresses each dimension.
const DIMENSION_ACTION: Record<Dimension, ActionId> = {
  Physical: 'stabilize',
  Emotional: 'support',
  Rational: 'clarify',
};

export interface ActionImpact {
  recommendedAction: ActionId;
  targetDimension: Dimension;
  targetDepartment: DepartmentName;
  expectedEnergyGain: number;
  expectedLoadReduction: number;
  expectedOrientationGain: number;
  collectiveImpact: number;
  actionReason: string;
  summary: string;
}

const round = (n: number): number => Math.round(n);
const clamp = (n: number, lo = 0, hi = 100): number => Math.max(lo, Math.min(hi, n));

/** Department whose collapse most drives a given dimension (highest weight). */
function leadDepartment(dimension: Dimension): DepartmentName {
  let dept = DEPARTMENTS[0];
  let best = -1;
  for (const d of DEPARTMENTS) {
    const w = DEPARTMENT_TO_DIMENSION_WEIGHTS[d][dimension];
    if (w > best) { best = w; dept = d; }
  }
  return dept;
}

/**
 * Derive the recommended next action and project its impact. Deterministic and
 * pure — never mutates its inputs.
 */
export function calculateActionImpact(nodeId: number): ActionImpact | null {
  const node = NOA_NODES.find(n => n.id === nodeId);
  const os = calculateOrientationScore(nodeId);
  if (!node || !os) return null;

  const ld = computeLoadDistribution(node, NOA_NODES);
  if (!ld) return null;

  const targetDimension = os.strongestRemainingDeficit.dimension;
  const targetDeficit = os.strongestRemainingDeficit.deficit;
  const recommendedAction = DIMENSION_ACTION[targetDimension];
  const action = ACTIONS[recommendedAction];
  const targetDepartment = leadDepartment(targetDimension);

  const expectedEnergyGain = clamp(round(targetDeficit * action.energyWeight));
  const expectedLoadReduction = clamp(round(ld.afterIndividualLoad * action.loadWeight), 0, ld.afterIndividualLoad);
  const expectedOrientationGain = clamp(round(targetDeficit * action.orientationWeight));
  const collectiveImpact = clamp(round((expectedEnergyGain + expectedLoadReduction) * action.collectiveWeight));

  const actionReason =
    `Strongest remaining deficit is ${targetDimension} (${targetDeficit}). ` +
    `Recommended action '${recommendedAction}' targets ${action.description}.`;

  const summary =
    `Action → Impact: '${recommendedAction}' targeting ${targetDimension} / ${targetDepartment}. ` +
    `Expected +${expectedEnergyGain} energy, −${expectedLoadReduction} load, +${expectedOrientationGain} orientation. ` +
    `Collective impact ${collectiveImpact} — private burden converts into collective responsibility.`;

  return {
    recommendedAction,
    targetDimension,
    targetDepartment,
    expectedEnergyGain,
    expectedLoadReduction,
    expectedOrientationGain,
    collectiveImpact,
    actionReason,
    summary,
  };
}
