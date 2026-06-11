// PHILOS NEXUS · Burden-Concentration narrative renderer.
//
// A NARRATIVE LAYER ABOVE THE DIAGNOSTICS — not a new engine. It reads the
// outputs computeNoaChain already produces and verbalizes them as a causal story:
//
//   Human → Event → Burden → Consequence → Capacity → Redistribution
//
// Case Zero proves a LAW, not a tragedy: "available carrying capacity is lower
// than the burden being created." Noa is the window; burden concentration is the
// subject. Swap the person and the same structure holds.
//
// Chain → narrative mapping (numbers stay behind "See Analysis"):
//   Burden concentration       ← loadModel (beforePct / personalLoad)
//   Energy leakage             ← energyLeakage (totalLeakage)
//   Orientation stability      ← orientationScore (level)
//   Available carrying capacity← load.helpers / distributedLoad
//   Redistribution opportunity ← action recommendation + after-state
//
// Diagnostics are unchanged; this only renders language on top of them.

import { computeNoaChain, type NoaChain } from "./noa";

export interface BurdenNarrative {
  title: string;              // "NOA · CASE ZERO"
  person: string;             // human window, one line
  event: string;              // what happened
  concentrationLines: string[];   // burden concentrated (← loadModel)
  consequenceLead: string;        // "As the burden concentrated,"
  consequenceItems: string[];     // what deteriorated (← leakage + orientation)
  lawIntro: string;           // "The problem is not the number of people."
  law: string;                // capacity < burden (← helpers vs load)
  identifies: string[];       // what Nexus identifies (← action / redistribution)
  stabilization: string;      // outcome when redistributed
}

/**
 * Render the burden-concentration narrative from a chain (Noa = default case).
 * Pure & deterministic; safe on the server. Reads existing chain outputs only.
 */
export function buildBurdenNarrative(chain: NoaChain = computeNoaChain(0)): BurdenNarrative {
  const load = chain.load;
  const leak = chain.leakage;
  const orient = chain.orientation;

  // ── qualitative signals derived from the chain (no numbers surfaced here) ──
  const burdenCreated = load?.beforePct ?? 100;             // burden being created (loadModel)
  const concentrated = burdenCreated >= 80;                 // it gathered in one place
  const leaks = (leak?.totalLeakage ?? 0) >= 40;            // energy leaked (energyLeakage)
  const level = orient?.level ?? "low";
  const unstable = level === "low" || level === "medium";   // orientation unstable (orientationScore)
  const availableCapacity = load?.distributedLoad ?? 0;     // carrying capacity (helpers/support)
  const capacityShort = availableCapacity < burdenCreated;  // capacity < burden

  // Consequence is built from what ACTUALLY deteriorated in the chain.
  const consequenceItems: string[] = [];
  if (leaks) consequenceItems.push("energy leaked");
  consequenceItems.push("capacity decreased");
  if (unstable) consequenceItems.push("orientation became unstable");

  return {
    title: "NOA · CASE ZERO",
    person: "Noa, 28.",
    event: "A single event created a burden that should have been distributed.",
    concentrationLines: concentrated
      ? ["The burden was not distributed.", "It began to concentrate in one place."]
      : ["The burden was only partly distributed.", "Pressure still gathered in one place."],
    consequenceLead: "As the burden concentrated,",
    consequenceItems,
    lawIntro: "The problem is not the number of people.",
    law: capacityShort
      ? "The problem is that available carrying capacity is lower than the burden being created."
      : "The problem is where the carrying capacity sits relative to the burden.",
    identifies: [
      "where burden concentration formed",
      "where carrying capacity exists",
      "how burden can be redistributed",
    ],
    stabilization: "When burden is redistributed, orientation stabilizes again.",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// BURDEN FLOW — the bridge between the Event Zero law and the diagnostic beats.
//
// Four read-only maps over existing chain outputs (loadModel + actionImpact) that
// PROVE the law ("available carrying capacity < burden being created") before any
// score is shown. Renderer only — no new engine, no new data model, no scores
// changed. "Who should carry" = who shares relevant values with the case (the
// value-network), never blame or named missing people.
//
//   Responsibility ← helpers · ROLE_VALUE
//   Capacity       ← loadModel.beforeIndividualLoad / distributedLoad
//   Distribution   ← loadModel.beforePct / afterPct / communityPct
//   Action         ← chain.action (actionImpact)

const ROLE_VALUE: Record<string, string> = {
  lawyer: "Justice", therapist: "Protection", journalist: "Truth",
  donor: "Responsibility", peer_survivor: "Dignity",
};

function cap(s: string): string { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

export interface BurdenFlowRow { label: string; value?: string; accent?: boolean; }
export interface BurdenFlowMap {
  key: "responsibility" | "capacity" | "distribution" | "action";
  title: string;
  question: string;
  rows: BurdenFlowRow[];
  statement: string;
}
export interface BurdenFlow { maps: BurdenFlowMap[]; }

/** Render the four Burden-Flow maps from a chain. Pure; reads existing outputs only. */
export function buildBurdenFlow(chain: NoaChain = computeNoaChain(0)): BurdenFlow {
  const load = chain.load;
  const action = chain.action;
  const helpers = load?.helpers ?? [];
  const name = "Noa"; // English case label (chain's individualName is Hebrew; keep the narrative consistent)

  // 1 · Responsibility — who shares the burden through shared values (not blame).
  const values: string[] = [];
  for (const h of helpers) { const v = ROLE_VALUE[h.role]; if (v && !values.includes(v)) values.push(v); }
  const responsibility: BurdenFlowMap = {
    key: "responsibility",
    title: "Responsibility",
    question: "Who is connected to the burden through shared values?",
    rows: (values.length ? values : ["—"]).map(v => ({ label: v })),
    statement: "These are the values that can carry part of the burden.",
  };

  // 2 · Capacity — burden created vs available carrying capacity (proves the law).
  const burdenCreated = load?.beforeIndividualLoad ?? 100;
  const carryingCapacity = load?.distributedLoad ?? 0;
  const capacityGap = Math.max(0, burdenCreated - carryingCapacity);
  const capacity: BurdenFlowMap = {
    key: "capacity",
    title: "Capacity",
    question: "Is there enough carrying capacity for the burden?",
    rows: [
      { label: "Burden created", value: `${burdenCreated}` },
      { label: "Available carrying capacity", value: `${carryingCapacity}` },
      { label: "Capacity gap", value: `${capacityGap}`, accent: true },
    ],
    statement: carryingCapacity < burdenCreated
      ? "Available carrying capacity is lower than the burden being created."
      : "Available carrying capacity now meets the burden being created.",
  };

  // 3 · Distribution — before vs after redistribution.
  const beforePct = load?.beforePct ?? 100;
  const afterPct = load?.afterPct ?? 100;
  const communityPct = load?.communityPct ?? 0;
  const distribution: BurdenFlowMap = {
    key: "distribution",
    title: "Distribution",
    question: "What changes when the burden is redistributed?",
    rows: [
      { label: "Before", value: `${beforePct}% on ${name}` },
      { label: "After", value: `${afterPct}% on ${name} · ${communityPct}% shared`, accent: true },
    ],
    statement: `Before, the burden concentrates on ${name}. After, part of the load is redistributed.`,
  };

  // 4 · Action — the first redistribution move (not generic advice).
  const actionMap: BurdenFlowMap = {
    key: "action",
    title: "Action",
    question: "What is the next move?",
    rows: [
      { label: `${cap(action?.recommendedAction ?? "stabilize")} → ${action?.targetDimension ?? "Physical"}`, accent: true },
    ],
    statement: "This is not generic advice — it is the first redistribution move.",
  };

  return { maps: [responsibility, capacity, distribution, actionMap] };
}
