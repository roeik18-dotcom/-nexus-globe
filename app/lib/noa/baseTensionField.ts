/**
 * Nexus · Base Tension Field — the origin layer (principles 0–1)
 *
 *   Space → Base Oppositions → 6 Departments → 18 Expression Cells → Collapse …
 *
 * Space is the origin. Inside it live six base oppositions — fundamental
 * tension fields, not emotions or values. Each maps to one human department.
 * For a case, every opposition carries a tension intensity; those intensities
 * are the source the department collapse aligns to.
 *
 * Pure, deterministic. No UI, no DOM, no storage, no engine changes, no AI.
 * Independent of the downstream chain (it is the source, not a consumer).
 */

import type { DepartmentName } from './resourceMatrix';

export interface BaseOpposition {
  positive: string;
  negative: string;
  name: string; // `${positive} ↔ ${negative}`
  department: DepartmentName;
}

export const BASE_OPPOSITIONS: BaseOpposition[] = [
  { positive: 'Existence', negative: 'Decay', name: 'Existence ↔ Decay', department: 'Physical' },
  { positive: 'Connection', negative: 'Disconnection', name: 'Connection ↔ Disconnection', department: 'Emotional' },
  { positive: 'Clarity', negative: 'Confusion', name: 'Clarity ↔ Confusion', department: 'Rational' },
  { positive: 'Security', negative: 'Threat', name: 'Security ↔ Threat', department: 'ID' },
  { positive: 'Navigation', negative: 'Lostness', name: 'Navigation ↔ Lostness', department: 'EGO' },
  { positive: 'Truth/Justice', negative: 'Falsehood/Injustice', name: 'Truth/Justice ↔ Falsehood/Injustice', department: 'SUPEREGO' },
];

// Per-case tension intensity (0–100) for each department. These align exactly
// with the Collapse Map department values — the tension field is their source.
const TENSION_INTENSITY: Record<number, Record<DepartmentName, number>> = {
  0: { Physical: 70, Emotional: 90, Rational: 80, ID: 85, EGO: 75, SUPEREGO: 60 }, // Noa Wexner
};

export interface TensionField extends BaseOpposition {
  intensity: number;
}

export interface BaseTensionSummary {
  origin: string;
  fields: TensionField[];
  strongest: TensionField;
  totalTension: number;
  averageTension: number;
  summary: string;
}

const round = (n: number): number => Math.round(n);

/** The six tension fields for a case node, or null if the node is not a case. */
export function getBaseTensionField(nodeId: number): TensionField[] | null {
  const intensities = TENSION_INTENSITY[nodeId];
  if (!intensities) return null;
  return BASE_OPPOSITIONS.map(op => ({ ...op, intensity: intensities[op.department] }));
}

/** Department collapse derived from the tension field (one opposition → one department). */
export function deriveCollapseFromTensionField(nodeId: number): Record<DepartmentName, number> | null {
  const fields = getBaseTensionField(nodeId);
  if (!fields) return null;
  const out = {} as Record<DepartmentName, number>;
  for (const f of fields) out[f.department] = f.intensity;
  return out;
}

/** Full summary of the base tension field for a case node. */
export function summarizeBaseTensionField(nodeId: number): BaseTensionSummary | null {
  const fields = getBaseTensionField(nodeId);
  if (!fields) return null;

  const strongest = fields.reduce((b, f) => (f.intensity > b.intensity ? f : b), fields[0]);
  const totalTension = fields.reduce((s, f) => s + f.intensity, 0);
  const averageTension = round(totalTension / fields.length);

  const summary =
    `From Space, six base oppositions generate tension across the six departments. ` +
    `For this case, ${strongest.name} (${strongest.department}) is the strongest field at ` +
    `${strongest.intensity} — the origin of the collapse that cascades down the chain.`;

  return { origin: 'Space', fields, strongest, totalTension, averageTension, summary };
}
