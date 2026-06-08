/**
 * Nexus · Collapse Map — Philos diagnosis layer (data + pure logic)
 *
 * After the event, in each of the six "departments" the NEGATIVE pole of the
 * basic opposition overpowers the positive pole. This module holds that
 * diagnostic picture for the demo case and derives a read-only summary.
 *
 * Not part of the dynamics engine. No DOM, no storage, no clock, no mutation,
 * no graphic detail — pure, deterministic data + functions only.
 */

export interface CollapseDepartment {
  name: string;
  positive: string[];
  negative: string[];
  /** 0–100: how much the negative pole overpowers the positive. */
  negativeDominance: number;
}

export interface CollapseMap {
  caseName: string;
  departments: CollapseDepartment[];
  totalNegativeDominance: number;
  strongestCollapseDepartment: string;
  weakestPositiveDepartment: string;
  summary: string;
}

// ─── Noa's six departments ───────────────────────────────────────────────

const NOA_DEPARTMENTS: CollapseDepartment[] = [
  {
    name: 'Physical',
    positive: ['safety', 'sleep', 'health', 'stability', 'motion', 'strength'],
    negative: ['fear', 'exhaustion', 'sleeplessness', 'burnout', 'pain', 'freeze'],
    negativeDominance: 70,
  },
  {
    name: 'Emotional',
    positive: ['trust', 'belonging', 'hope', 'empathy', 'connection', 'calm'],
    negative: ['loneliness', 'shame', 'fear', 'anger', 'anxiety', 'despair'],
    negativeDominance: 90,
  },
  {
    name: 'Rational',
    positive: ['clarity', 'knowledge', 'order', 'strategy', 'understanding', 'decision'],
    negative: ['confusion', 'uncertainty', 'bureaucracy', 'overload', 'chaos', 'rumination'],
    negativeDominance: 80,
  },
  {
    name: 'ID',
    positive: ['life energy', 'rest', 'pleasure', 'safety', 'protection', 'preservation'],
    negative: ['survival mode', 'panic', 'escape', 'depletion', 'insecurity', 'energy hunger'],
    negativeDominance: 85,
  },
  {
    name: 'EGO',
    positive: ['choice', 'balance', 'boundaries', 'navigation', 'identity', 'control'],
    negative: ['helplessness', 'conflict', 'guilt', 'identity fracture', 'loss of control', 'functional exhaustion'],
    negativeDominance: 75,
  },
  {
    name: 'SUPEREGO',
    positive: ['truth', 'justice', 'responsibility', 'meaning', 'dignity', 'repair'],
    negative: ['obsessive mission', 'moral self-pressure', 'inability to release', 'self-sacrifice', 'endless war', 'guilt'],
    negativeDominance: 60,
  },
];

interface CollapseProfile {
  caseName: string;
  departments: CollapseDepartment[];
}

// Keyed by node id (0 = Noa), mirroring the load-model profile convention.
const COLLAPSE_PROFILES: Record<number, CollapseProfile> = {
  0: { caseName: 'Noa', departments: NOA_DEPARTMENTS },
};

/**
 * Build the collapse map for a case node, or null if the node has no profile.
 * Deterministic and pure.
 */
export function getCollapseMap(nodeId: number): CollapseMap | null {
  const profile = COLLAPSE_PROFILES[nodeId];
  if (!profile) return null;

  const deps = profile.departments;
  const totalNegativeDominance = Math.round(
    deps.reduce((s, d) => s + d.negativeDominance, 0) / deps.length,
  );

  // Highest negative dominance = strongest collapse = weakest positive pole.
  const byDominance = [...deps].sort((a, b) => b.negativeDominance - a.negativeDominance);
  const strongestCollapseDepartment = byDominance[0].name;
  const weakestPositiveDepartment = byDominance[0].name;
  const top2 = byDominance.slice(0, 2).map(d => d.name).join(' and ');

  const summary =
    `Across the ${deps.length} departments, ${profile.caseName}'s negative forces dominate at ` +
    `${totalNegativeDominance}%. ${top2} pressure are strongest. This explains why private ` +
    `energy leaks into the external justice mission.`;

  return {
    caseName: profile.caseName,
    departments: deps,
    totalNegativeDominance,
    strongestCollapseDepartment,
    weakestPositiveDepartment,
    summary,
  };
}
