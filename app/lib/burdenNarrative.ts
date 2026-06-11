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

// ── CASE ZERO — NOA ──────────────────────────────────────────────────────────
// LOCKED CASE FACT: Noa experienced sexual violence. The event itself is NOT the
// focus of the product and is never described — no graphic detail, no
// sensationalizing, no victim archetype. On screen the event reads "a severe
// violation". The focus is what happened to the BURDEN after the event.
//   Sexual violence    = the event
//   Burden concentration = the phenomenon
//   Redistribution      = the intervention
// Noa is Case Zero: a concrete window onto the burden-concentration law.

export interface BurdenNarrative {
  title: string;               // "NOA · CASE ZERO"
  person: string;              // human window, one line
  event: string;               // the event — named, never described
  burdenAccumulation: string;  // the burdens that accumulated after the event
  concentrationLines: string[];// should have been shared → concentrated on one
  consequenceLead: string;     // "As the burden concentrated:"
  consequenceItems: string[];  // what deteriorated
  principleIntro: string;      // "The problem is not Noa."
  principle: string;           // "The problem is burden concentration."
  analyzesIntro: string;       // "Nexus analyzes:"
  analyzes: string[];          // what Nexus analyzes around the case
  stabilization: string;       // redistribution → stabilizes
}

/**
 * Render the burden-concentration narrative for Case Zero (Noa).
 * Pure & deterministic; reads existing chain outputs only (the chain confirms the
 * phenomenon — concentration — without surfacing any number in the story).
 */
export function buildBurdenNarrative(chain: NoaChain = computeNoaChain(0)): BurdenNarrative {
  const concentrated = (chain.load?.beforePct ?? 100) >= 80;

  return {
    title: "NOA · CASE ZERO",
    person: "Noa, 28.",
    event: "Noa experienced a severe violation.",
    burdenAccumulation:
      "After the event, emotional, social, practical and informational burdens began to accumulate around her.",
    concentrationLines: concentrated
      ? ["Many of these burdens should have been shared.", "Instead, they concentrated on a single person."]
      : ["Many of these burdens should have been shared.", "Some were shared — but pressure still gathered on one person."],
    consequenceLead: "As the burden concentrated:",
    consequenceItems: ["energy leaked", "decision-making became harder", "trust weakened", "capacity decreased"],
    principleIntro: "The problem is not Noa.",
    principle: "The problem is burden concentration.",
    analyzesIntro: "Nexus analyzes:",
    analyzes: [
      "where burden accumulated",
      "what capacity exists around the case",
      "what support is connected",
      "what support is missing",
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
