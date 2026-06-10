// PHILOS NEXUS · Person Chain adapter (V1 — approximate / experimental)
//
// Turns a stored L1 Person (app/lib/personStore) into a chain of the SAME shape
// as computeNoaChain (NoaChain), so the existing Diagnostic / Personal Map /
// Globe surfaces can read a real user instead of only hardcoded Noa.
//
// IMPORTANT — this is a projection, NOT a new engine:
//   • It does NOT modify computeNoaChain or any Noa output (those stay locked).
//   • It starts from the validated Noa chain as scaffolding, then REFRAMES three
//     headline signals by the person's own stored attributes (selection only):
//       1. Orientation score  ← the person's Physical/Emotional/Rational scores
//       2. Strongest tension  ← the department the person named in intake
//       3. Value network      ← helpers whose value the person holds
//   • Everything else (collapse, resource, leakage, flow, attention, action) is
//     inherited Noa scaffolding and is therefore APPROXIMATE for this person.
//
// This is the deliberate V1 bridge from "diagnostic of Noa" to "diagnostic of a
// real user". A later milestone replaces the inherited scaffolding with values
// computed from the person's own raw data (L2 events / L3 relationships).

import { computeNoaChain, type NoaChain, type OrientationLevel } from "./noa";
import type { Person } from "./personStore";

// Helper role → core value (the value-network mapping used across the UI).
const ROLE_VALUE: Record<string, string> = {
  lawyer: "Justice", therapist: "Protection", journalist: "Truth",
  donor: "Responsibility", peer_survivor: "Dignity",
};

/** Orientation band label, mirroring the engine's 0–25 / 26–50 / 51–75 / 76–100 split. */
function levelOf(score: number): OrientationLevel {
  if (score <= 25) return "low";
  if (score <= 50) return "medium";
  if (score <= 75) return "high";
  return "strong";
}

/**
 * Project a stored Person into a NoaChain-shaped chain (V1 / approximate).
 * Pure & deterministic. Safe to call on the server (no storage access here).
 */
export function computePersonChain(person: Person): NoaChain {
  const base = computeNoaChain(0); // locked Noa scaffolding (the validated default)

  // 1 · Orientation headline = the person's own dimension scores (approx).
  const score = Math.round((person.physical + person.emotional + person.rational) / 3);
  const orientation = base.orientation
    ? { ...base.orientation, score, level: levelOf(score) }
    : base.orientation;

  // 2 · Strongest tension = the field the person named in intake (else Noa's).
  let tension = base.tension;
  const dept = person.intake?.tensionDept;
  if (tension && dept) {
    const field = tension.fields.find(f => f.department === dept);
    if (field) tension = { ...tension, strongest: field };
  }

  // 3 · Value network = helpers whose value the person holds (else keep all).
  let load = base.load;
  if (load && person.values.length) {
    const matched = load.helpers.filter(h => person.values.includes(ROLE_VALUE[h.role] ?? ""));
    if (matched.length) {
      const distributedLoad = matched.reduce((s, h) => s + h.allocated, 0);
      load = { ...load, helpers: matched, distributedLoad };
    }
  }

  return { ...base, orientation, tension, load };
}
