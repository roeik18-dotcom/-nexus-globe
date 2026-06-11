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
