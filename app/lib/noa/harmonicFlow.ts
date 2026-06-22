/**
 * Nexus · Harmonic Flow — the recovery side of the chain (data + pure logic)
 *
 *   Collapse Map → Root Resource Matrix → [Harmonic Flow] → Load Distribution → Energy Recovery
 *
 * Each helper in the value network provides a resource of a certain kind
 * (legal/emotional/visibility/resource/belonging). Harmonic Flow routes those
 * resources INTO the 3 human dimensions (Physical/Emotional/Rational), shows
 * how much of each dimension's deficit they cover, and then maps that recovery
 * BACK to rebalance the 6 departments.
 *
 * Pure, deterministic. No UI, no DOM, no storage, no engine changes, no AI.
 * Consumes the existing collapseMap.ts, resourceMatrix.ts and loadModel.ts.
 */

import type { CollapseMap } from './collapseMap';
import type { LoadDistribution, LoadRole } from './loadModel';
import {
  DIMENSIONS,
  DEPARTMENTS,
  DEPARTMENT_TO_DIMENSION_WEIGHTS,
  calculateDimensionPressure,
  type Dimension,
  type DepartmentName,
} from './resourceMatrix';

const round = (n: number): number => Math.round(n);

// How each helper's resource flows into the 3 dimensions (each row sums to 1).
export const HELPER_DIMENSION_WEIGHTS: Partial<Record<LoadRole, Record<Dimension, number>>> = {
  lawyer:        { Physical: 0.20, Emotional: 0.10, Rational: 0.70 }, // legal → order/clarity
  therapist:     { Physical: 0.05, Emotional: 0.85, Rational: 0.10 }, // emotional support
  journalist:    { Physical: 0.10, Emotional: 0.50, Rational: 0.40 }, // visibility → being heard + information
  donor:         { Physical: 0.80, Emotional: 0.10, Rational: 0.10 }, // resources → stability/safety
  peer_survivor: { Physical: 0.10, Emotional: 0.80, Rational: 0.10 }, // belonging
  // generic helper roles (covered for robustness; not used in the Noa case)
  coordinator:   { Physical: 0.20, Emotional: 0.40, Rational: 0.40 },
  volunteer:     { Physical: 0.60, Emotional: 0.20, Rational: 0.20 },
  expert:        { Physical: 0.10, Emotional: 0.10, Rational: 0.80 },
  activist:      { Physical: 0.20, Emotional: 0.45, Rational: 0.35 },
};

export interface FlowContributor {
  role: LoadRole;
  name: string;
  amount: number;
}

// Why a dimension remains under-resourced.
export type FailureType =
  | 'capacity_shortage'   // not enough helpers available to cover the pressure
  | 'flow_disconnection'  // capacity exists but is not being mobilized
  | 'mobilization_gap'    // mostly covered — small residual gap remains
  | 'resolved';           // deficit ≤ 0

export interface DimensionFlow {
  dimension: Dimension;
  dimensionPressure: number;   // gross load before any support
  dimensionCapacity: number;   // max support helpers COULD provide (theoretical ceiling)
  dimensionInflow: number;     // support that actually reached this dimension
  dimensionDeficit: number;    // net remaining: max(0, pressure − inflow)
  mobilizationGap: number;     // capacity not mobilized: max(0, capacity − inflow)
  coveragePct: number;         // dimensionInflow / dimensionPressure × 100
  failureType: FailureType;
  contributors: FlowContributor[];
}

export interface DepartmentRebalance {
  department: DepartmentName;
  dominanceBefore: number;
  recovery: number;        // mapped back from dimension inflow
  dominanceAfter: number;
}

export interface HarmonicFlow {
  dimensions: DimensionFlow[];
  departments: DepartmentRebalance[];
  totalInflow: number;
  strongestInflowDimension: Dimension;
  mostRebalancedDepartment: DepartmentName;
}

/**
 * Compute the harmonic flow for a case: route the load-distribution helpers'
 * resources into the 3 dimensions, then rebalance the 6 departments.
 * Pure — never mutates its inputs.
 */
export function computeHarmonicFlow(
  collapseMap: CollapseMap,
  loadDistribution: LoadDistribution,
): HarmonicFlow {
  const dimPressures = calculateDimensionPressure(collapseMap);

  // 1. Route each helper's resource into the dimensions (actual inflow + theoretical capacity).
  const inflowRaw: Record<Dimension, number> = { Physical: 0, Emotional: 0, Rational: 0 };
  const capacityRaw: Record<Dimension, number> = { Physical: 0, Emotional: 0, Rational: 0 };
  const contributors: Record<Dimension, FlowContributor[]> = { Physical: [], Emotional: [], Rational: [] };
  for (const h of loadDistribution.helpers) {
    const w = HELPER_DIMENSION_WEIGHTS[h.role];
    if (!w) continue;
    for (const dim of DIMENSIONS) {
      const amt = h.allocated * w[dim];
      inflowRaw[dim] += amt;
      capacityRaw[dim] += h.capacity * w[dim];
      if (amt > 0) contributors[dim].push({ role: h.role, name: h.name, amount: round(amt) });
    }
  }

  const dimensions: DimensionFlow[] = DIMENSIONS.map(dim => {
    const dimensionPressure = dimPressures[dim];
    const dimensionCapacity = round(capacityRaw[dim]);
    const dimensionInflow = round(inflowRaw[dim]);
    const dimensionDeficit = Math.max(0, dimensionPressure - dimensionInflow);
    const mobilizationGap = Math.max(0, dimensionCapacity - dimensionInflow);
    const coveragePct = dimensionPressure ? round((dimensionInflow / dimensionPressure) * 100) : 0;
    const failureType: FailureType =
      dimensionDeficit <= 0                            ? 'resolved' :
      dimensionCapacity < dimensionPressure * 0.40    ? 'capacity_shortage' :
      dimensionInflow   < dimensionCapacity * 0.40    ? 'flow_disconnection' :
                                                         'mobilization_gap';
    return { dimension: dim, dimensionPressure, dimensionCapacity, dimensionInflow, dimensionDeficit, mobilizationGap, coveragePct, failureType, contributors: contributors[dim] };
  });

  // 2. Rebalance departments: distribute each dimension's inflow back to the
  //    departments in proportion to their share of that dimension's column.
  const colSum: Record<Dimension, number> = { Physical: 0, Emotional: 0, Rational: 0 };
  for (const dept of DEPARTMENTS) {
    for (const dim of DIMENSIONS) colSum[dim] += DEPARTMENT_TO_DIMENSION_WEIGHTS[dept][dim];
  }

  const departments: DepartmentRebalance[] = collapseMap.departments.map(d => {
    const name = d.name as DepartmentName;
    const w = DEPARTMENT_TO_DIMENSION_WEIGHTS[name];
    let recoveryRaw = 0;
    if (w) for (const dim of DIMENSIONS) recoveryRaw += (inflowRaw[dim] * w[dim]) / colSum[dim];
    const recovery = round(recoveryRaw);
    return {
      department: name,
      dominanceBefore: d.negativeDominance,
      recovery,
      dominanceAfter: Math.max(0, d.negativeDominance - recovery),
    };
  });

  const totalInflow = loadDistribution.helpers.reduce((s, h) => s + h.allocated, 0);
  const strongestInflowDimension = dimensions.reduce(
    (best, x) => (x.dimensionInflow > best.dimensionInflow ? x : best), dimensions[0],
  ).dimension;
  const mostRebalancedDepartment = departments.reduce(
    (best, x) => (x.recovery > best.recovery ? x : best), departments[0],
  ).department;

  return { dimensions, departments, totalInflow, strongestInflowDimension, mostRebalancedDepartment };
}
