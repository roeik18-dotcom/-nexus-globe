/**
 * Nexus · Root Resource Matrix — calculation foundation (data + pure logic)
 *
 * Maps the 6 departments (each rooted in 6 resource roots) down into the 3
 * fixed human dimensions — Physical, Emotional, Rational. Everything in the
 * system must eventually reduce into these three.
 *
 *   6 departments → root resources → 3 fixed dimensions → measurable deficits
 *
 * Pure, deterministic. No UI, no DOM, no storage, no engine changes, no AI.
 * Input is the existing CollapseMap (each department's negativeDominance is
 * treated directly as that department's deficit).
 */

import type { CollapseMap } from './collapseMap';

// ─── Dimensions & departments ────────────────────────────────────────────

export type Dimension = 'Physical' | 'Emotional' | 'Rational';
export const DIMENSIONS: Dimension[] = ['Physical', 'Emotional', 'Rational'];

export type DepartmentName =
  | 'Physical' | 'Emotional' | 'Rational' | 'ID' | 'EGO' | 'SUPEREGO';
export const DEPARTMENTS: DepartmentName[] = [
  'Physical', 'Emotional', 'Rational', 'ID', 'EGO', 'SUPEREGO',
];

// ─── Root resources per department ───────────────────────────────────────

export const RESOURCE_ROOTS: Record<DepartmentName, string[]> = {
  Physical: ['energy', 'sleep', 'safety', 'health', 'movement', 'basic stability'],
  Emotional: ['trust', 'belonging', 'empathy', 'hope', 'emotional support', 'calm'],
  Rational: ['clarity', 'knowledge', 'strategy', 'information', 'order', 'decision ability'],
  ID: ['survival', 'protection', 'rest', 'relief', 'pleasure', 'energy preservation'],
  EGO: ['choice', 'boundaries', 'control', 'identity', 'navigation', 'adaptation'],
  SUPEREGO: ['truth', 'justice', 'responsibility', 'meaning', 'dignity', 'repair'],
};

// ─── Department → 3-dimension weights (each row sums to 1.0) ──────────────

export const DEPARTMENT_TO_DIMENSION_WEIGHTS: Record<DepartmentName, Record<Dimension, number>> = {
  Physical: { Physical: 0.70, Emotional: 0.15, Rational: 0.15 },
  Emotional: { Physical: 0.10, Emotional: 0.75, Rational: 0.15 },
  Rational: { Physical: 0.10, Emotional: 0.15, Rational: 0.75 },
  ID: { Physical: 0.60, Emotional: 0.30, Rational: 0.10 },
  EGO: { Physical: 0.20, Emotional: 0.25, Rational: 0.55 },
  SUPEREGO: { Physical: 0.10, Emotional: 0.30, Rational: 0.60 },
};

// ─── Types ───────────────────────────────────────────────────────────────

export type DeficitLevel = 'minimal' | 'low' | 'medium' | 'high' | 'very high';

export interface DimensionDeficits {
  Physical: number;
  Emotional: number;
  Rational: number;
}

export interface RootResourceDeficit {
  department: DepartmentName;
  deficit: number;     // = department negativeDominance
  roots: string[];     // the depleted root resources
}

export interface ResourceState {
  dimensionDeficits: DimensionDeficits;
  dimensionLevels: Record<Dimension, DeficitLevel>;
  strongestRoot: Dimension;             // dimension with the highest deficit
  mostAffectedDepartments: string[];    // top departments by deficit
  rootDeficits: RootResourceDeficit[];  // per-department root depletion
}

// ─── Helpers ─────────────────────────────────────────────────────────────

const round = (n: number): number => Math.round(n);

export function deficitLevel(v: number): DeficitLevel {
  if (v >= 80) return 'very high';
  if (v >= 65) return 'high';
  if (v >= 45) return 'medium';
  if (v >= 25) return 'low';
  return 'minimal';
}

/** Root resources for a department. */
export function getDepartmentResources(department: DepartmentName): string[] {
  return RESOURCE_ROOTS[department] ?? [];
}

/** Distribute a department's value across the 3 dimensions by its weights. */
export function mapDepartmentToDimensions(
  department: DepartmentName,
  value: number,
): DimensionDeficits {
  const w = DEPARTMENT_TO_DIMENSION_WEIGHTS[department];
  return {
    Physical: value * w.Physical,
    Emotional: value * w.Emotional,
    Rational: value * w.Rational,
  };
}

/**
 * Reduce a collapse map into the 3 dimension deficits. Each department's
 * negativeDominance is its deficit; deficits are mapped to dimensions by the
 * weight matrix and combined as a WEIGHTED AVERAGE (normalized by each
 * dimension's column-weight sum) so dimensions stay on a comparable 0–100
 * scale regardless of how much total weight each receives.
 */
export function calculateDimensionDeficits(collapseMap: CollapseMap): DimensionDeficits {
  const num: Record<Dimension, number> = { Physical: 0, Emotional: 0, Rational: 0 };
  const den: Record<Dimension, number> = { Physical: 0, Emotional: 0, Rational: 0 };

  for (const dept of collapseMap.departments) {
    const name = dept.name as DepartmentName;
    const w = DEPARTMENT_TO_DIMENSION_WEIGHTS[name];
    if (!w) continue;
    const deficit = dept.negativeDominance;
    for (const dim of DIMENSIONS) {
      num[dim] += deficit * w[dim];
      den[dim] += w[dim];
    }
  }

  return {
    Physical: den.Physical ? round(num.Physical / den.Physical) : 0,
    Emotional: den.Emotional ? round(num.Emotional / den.Emotional) : 0,
    Rational: den.Rational ? round(num.Rational / den.Rational) : 0,
  };
}

/**
 * Per-department root-resource depletion (deficit = negativeDominance),
 * sorted strongest first.
 */
export function calculateRootResourceDeficits(collapseMap: CollapseMap): RootResourceDeficit[] {
  return collapseMap.departments
    .map(dept => ({
      department: dept.name as DepartmentName,
      deficit: dept.negativeDominance,
      roots: getDepartmentResources(dept.name as DepartmentName),
    }))
    .sort((a, b) => b.deficit - a.deficit);
}

/** Full resource-state summary used by the UI + snapshot. */
export function summarizeResourceState(collapseMap: CollapseMap): ResourceState {
  const dimensionDeficits = calculateDimensionDeficits(collapseMap);

  const dimensionLevels: Record<Dimension, DeficitLevel> = {
    Physical: deficitLevel(dimensionDeficits.Physical),
    Emotional: deficitLevel(dimensionDeficits.Emotional),
    Rational: deficitLevel(dimensionDeficits.Rational),
  };

  // Strongest depleted root = dimension with the highest deficit.
  const strongestRoot = DIMENSIONS.reduce<Dimension>(
    (best, d) => (dimensionDeficits[d] > dimensionDeficits[best] ? d : best),
    DIMENSIONS[0],
  );

  const rootDeficits = calculateRootResourceDeficits(collapseMap);
  const mostAffectedDepartments = rootDeficits.slice(0, 3).map(r => r.department);

  return {
    dimensionDeficits,
    dimensionLevels,
    strongestRoot,
    mostAffectedDepartments,
    rootDeficits,
  };
}
