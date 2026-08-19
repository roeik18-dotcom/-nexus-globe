/**
 * Philos Canon — StateDelta: the DELTA step of the real Action lifecycle
 * (ORIENTATION → PROPOSED ACTION → ACTOR → TARGET → RESOURCE → CONSTRAINT →
 * EXECUTION → EXPECTED EFFECT → OBSERVED EFFECT → EVIDENCE → DELTA →
 * LEARNING → UPDATED STATE).
 *
 * canon gives Learning (`learning.ts`) no field list at all (see that file's
 * own header) and, per that file's explicit design decision, `deriveLearning`
 * never COMPUTES a candidate `State'` — it only gates a caller-supplied one.
 * `computeStateDelta` here does not change that: it is a strictly
 * DESCRIPTIVE function over two ALREADY-DETERMINED, same-cell CellStates (a
 * prior one and an accepted `state_prime`) — never a formula that predicts,
 * proposes, or justifies an update. It answers only "how much did the two
 * real numbers already on record differ by", the same arithmetic-only
 * contract `systemContext.ts::StateDelta` already uses for Dynamics/Planet's
 * own prior-vs-current delta.
 *
 * `null` (not zeros, not thrown) when the two states are not the same cell —
 * a delta between different (domain, frame) pairs, or mismatched
 * SystemicChannel on an S-frame cell, is not a number, it is a category
 * error; this function refuses to manufacture one. This mirrors
 * `learning.ts::deriveLearning`'s own `"cell_identity_mismatch"` gate rather
 * than re-deriving it — the two functions are meant to be called together
 * (only on an accepted `state_prime`, i.e. after that gate already passed),
 * but `computeStateDelta` re-checks it independently so it is never trusted
 * blind by a future caller that skips `deriveLearning`.
 */
import type { CellState } from "./cellState";
import type { SystemicChannel } from "./observation";

export interface StateDelta {
  domain: CellState["domain"];
  frame: CellState["frame"];
  level_delta: number;
  stability_delta: number;
}

/**
 * Pure, deterministic, no I/O. Returns `null` when `prior` and `updated`
 * are not the same cell (different domain/frame, or — for an S-frame cell —
 * different SystemicChannel) rather than a fabricated number.
 */
export function computeStateDelta(
  prior: CellState,
  updated: CellState,
  options?: { priorSystemicChannel?: SystemicChannel; updatedSystemicChannel?: SystemicChannel },
): StateDelta | null {
  if (prior.domain !== updated.domain || prior.frame !== updated.frame) return null;
  if (prior.frame === "S") {
    const priorChannel = options?.priorSystemicChannel;
    const updatedChannel = options?.updatedSystemicChannel;
    if (priorChannel === undefined || updatedChannel === undefined || priorChannel !== updatedChannel) {
      return null;
    }
  }
  return {
    domain: updated.domain,
    frame: updated.frame,
    level_delta: updated.level - prior.level,
    stability_delta: updated.stability - prior.stability,
  };
}
