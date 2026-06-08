// PHILOS NEXUS · Noa chain — minimal node identities
//
// Self-contained replacement for the local project's seed graph. The chain
// only needs each node's id + name; load profiles are keyed by id in
// loadModel.ts. Deterministic — node 0 is Noa, ids 1–9 are her value network.

export interface NoaNode {
  id: number;
  name: string;
}

export const NOA_NODES: NoaNode[] = [
  { id: 0, name: 'נועה' },              // affected individual
  { id: 1, name: 'עדן (מתאמת קהילה)' }, // coordinator
  { id: 2, name: 'דנה (עו״ד)' },        // lawyer
  { id: 3, name: 'מאיה (עיתונאית)' },   // journalist
  { id: 4, name: 'איתי (מטפל)' },       // therapist
  { id: 5, name: 'יואב (מתנדב)' },      // volunteer
  { id: 6, name: 'רונה (תורמת)' },      // donor
  { id: 7, name: 'גיא (מומחה)' },       // expert
  { id: 8, name: 'נועם (ניצולה)' },     // peer survivor
  { id: 9, name: 'שיר (פעילה)' },       // activist
];
