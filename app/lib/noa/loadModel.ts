/**
 * Nexus · Load Model — Philos core mechanic (data + pure logic layer)
 *
 * Models the central Philos insight: the failure is not lack of values, it is
 * the CONCENTRATION OF BURDEN. One individual carries the whole load alone,
 * leaking private energy into a collective mission. This layer computes how
 * that load can be distributed across the value network so energy is restored.
 *
 * This is NOT part of the dynamics engine (propagation/pulse/flow). It is a
 * separate, deterministic data+logic layer keyed by node id. No DOM, no
 * storage, no clock, no mutation — pure functions only.
 */

import type { NoaNode } from './nodes';

export type LoadRole =
  | 'affected_individual'
  | 'lawyer'
  | 'journalist'
  | 'therapist'
  | 'donor'
  | 'volunteer'
  | 'activist'
  | 'peer_survivor'
  | 'coordinator'
  | 'expert';

export type CollapseRisk = 'low' | 'medium' | 'high' | 'critical';

export interface NodeLoadProfile {
  energy: number;                 // 0–100 vitality
  personalLoad: number;           // burden the node currently carries
  collectiveLoadAccepted: number; // burden absorbed FROM others
  supportCapacity: number;        // how much load this node can absorb
  role: LoadRole;
}

export interface HelperAllocation {
  id: number;
  name: string;
  role: LoadRole;
  loadType: string;   // Hebrew category label
  allocated: number;  // load units absorbed
}

export interface LoadDistribution {
  individualName: string;
  beforeIndividualLoad: number;
  afterIndividualLoad: number;
  distributedLoad: number;
  helpers: HelperAllocation[];
  energyRecovered: number;
  beforeEnergy: number;
  afterEnergy: number;
  collapseRiskBefore: CollapseRisk;
  collapseRiskAfter: CollapseRisk;
  beforePct: number;
  afterPct: number;
  communityPct: number;
}

// ─── Seed profiles (keyed by node id, aligned to the Noa cast) ───────────
// Node 0 = Noa (the affected individual). The rest are value-network helpers.

export const seedLoadProfiles: Record<number, NodeLoadProfile> = {
  0: { role: 'affected_individual', energy: 25, personalLoad: 100, collectiveLoadAccepted: 0, supportCapacity: 10 },
  1: { role: 'coordinator',         energy: 80, personalLoad: 20,  collectiveLoadAccepted: 0, supportCapacity: 35 },
  2: { role: 'lawyer',              energy: 75, personalLoad: 25,  collectiveLoadAccepted: 0, supportCapacity: 30 },
  3: { role: 'journalist',          energy: 70, personalLoad: 20,  collectiveLoadAccepted: 0, supportCapacity: 20 },
  4: { role: 'therapist',           energy: 85, personalLoad: 15,  collectiveLoadAccepted: 0, supportCapacity: 30 },
  5: { role: 'volunteer',           energy: 65, personalLoad: 15,  collectiveLoadAccepted: 0, supportCapacity: 20 },
  6: { role: 'donor',               energy: 90, personalLoad: 10,  collectiveLoadAccepted: 0, supportCapacity: 25 },
  7: { role: 'expert',              energy: 78, personalLoad: 25,  collectiveLoadAccepted: 0, supportCapacity: 25 },
  8: { role: 'peer_survivor',       energy: 60, personalLoad: 30,  collectiveLoadAccepted: 0, supportCapacity: 18 },
  9: { role: 'activist',            energy: 72, personalLoad: 20,  collectiveLoadAccepted: 0, supportCapacity: 22 },
};

// What each helper role naturally absorbs, and its load category label.
const ROLE_LOAD: Record<LoadRole, { loadType: string; amount: number }> = {
  affected_individual: { loadType: '—', amount: 0 },
  lawyer:        { loadType: 'עומס משפטי', amount: 20 },
  therapist:     { loadType: 'עומס רגשי', amount: 15 },
  journalist:    { loadType: 'עומס חשיפה', amount: 10 },
  donor:         { loadType: 'עומס משאבים', amount: 10 },
  peer_survivor: { loadType: 'עומס שייכות', amount: 10 },
  volunteer:     { loadType: 'עומס תפעולי', amount: 10 },
  coordinator:   { loadType: 'עומס תיאום', amount: 12 },
  activist:      { loadType: 'עומס ציבורי', amount: 8 },
  expert:        { loadType: 'עומס ידע', amount: 8 },
};

// Distribution priority — most load-bearing roles absorb first.
const PRIORITY: LoadRole[] = [
  'lawyer', 'therapist', 'journalist', 'donor', 'peer_survivor',
  'volunteer', 'coordinator', 'activist', 'expert',
];

/** Fraction of the individual's load that can be distributed (rest is irreducibly personal). */
const DISTRIBUTABLE_FRACTION = 0.65;
/** How much energy returns per unit of load shed. */
const ENERGY_RECOVERY_RATE = 0.46;

export function getLoadProfile(id: number): NodeLoadProfile | undefined {
  return seedLoadProfiles[id];
}

/** Collapse risk as a function of carried load vs. available energy. */
export function collapseRisk(load: number, energy: number): CollapseRisk {
  const score = load - energy;
  if (score >= 50) return 'critical';
  if (score >= 20) return 'high';
  if (score >= -30) return 'medium';
  return 'low';
}

/**
 * Compute how the selected node's load would distribute across the value
 * network. Deterministic and pure — never mutates inputs or profiles.
 */
export function computeLoadDistribution(
  selectedNode: NoaNode,
  allNodes: NoaNode[],
): LoadDistribution | null {
  const indiv = seedLoadProfiles[selectedNode.id];
  if (!indiv) return null;

  const beforeIndividualLoad = indiv.personalLoad;
  const distributable = Math.round(beforeIndividualLoad * DISTRIBUTABLE_FRACTION);

  // Index helper nodes by role (one per role in the cast).
  const byRole = new Map<LoadRole, NoaNode>();
  for (const n of allNodes) {
    if (n.id === selectedNode.id) continue;
    const p = seedLoadProfiles[n.id];
    if (p && !byRole.has(p.role)) byRole.set(p.role, n);
  }

  let remaining = distributable;
  const helpers: HelperAllocation[] = [];
  for (const role of PRIORITY) {
    if (remaining <= 0) break;
    const node = byRole.get(role);
    if (!node) continue;
    const prof = seedLoadProfiles[node.id];
    const roleLoad = ROLE_LOAD[role];
    const alloc = Math.min(roleLoad.amount, prof.supportCapacity, remaining);
    if (alloc <= 0) continue;
    remaining -= alloc;
    helpers.push({ id: node.id, name: node.name, role, loadType: roleLoad.loadType, allocated: alloc });
  }

  const distributedLoad = distributable - remaining;
  const afterIndividualLoad = beforeIndividualLoad - distributedLoad;

  const beforeEnergy = indiv.energy;
  const energyRecovered = Math.min(
    Math.round(distributedLoad * ENERGY_RECOVERY_RATE),
    100 - beforeEnergy,
  );
  const afterEnergy = beforeEnergy + energyRecovered;

  const beforePct = beforeIndividualLoad === 0 ? 0 : 100;
  const afterPct = beforeIndividualLoad === 0
    ? 0
    : Math.round((afterIndividualLoad / beforeIndividualLoad) * 100);
  const communityPct = 100 - afterPct;

  return {
    individualName: selectedNode.name,
    beforeIndividualLoad,
    afterIndividualLoad,
    distributedLoad,
    helpers,
    energyRecovered,
    beforeEnergy,
    afterEnergy,
    collapseRiskBefore: collapseRisk(beforeIndividualLoad, beforeEnergy),
    collapseRiskAfter: collapseRisk(afterIndividualLoad, afterEnergy),
    beforePct,
    afterPct,
    communityPct,
  };
}
