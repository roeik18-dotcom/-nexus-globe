/**
 * PHILOS Canonical layer — the State(t0) → Action → Effect → Evidence →
 * Learning → State(t1) loop (Phase 4 §5).
 *
 * Invents no new persistence. Every stage below reuses an already-real,
 * already-tested function verbatim (Phase 4 §4 — "reuse existing canon
 * stores... do not create duplicate stores unless technically unavoidable"):
 *   - Action        → `canon/actionLifecycle.ts::recordAction` (→ `actionStore`)
 *   - Effect/Evidence → `canon/actionLifecycle.ts::recordEffect` (→ `effectStore`),
 *                       `effect.claimed_outcome`/`verified_outcome`
 *                       (`OutcomeVerification`) ARE the Evidence — no
 *                       separate Evidence store exists or is needed.
 *   - Learning/State(t1) → `valueDomain/valueDomainConfig.ts::deriveDomainStateUpdate`
 *                       (the DomainState-scoped analogue of canon's
 *                       CellState-scoped `learning.ts::deriveLearning` — see
 *                       `domainStateQuery.ts`'s own header for why these stay
 *                       two separate schemas), then persisted via
 *                       `canon/domainStateStore.ts` (`domainStateStoreAccessor.ts`).
 *
 * **State(t0) is read, never assumed.** `findLatestDomainState`
 * (`domainStateQuery.ts`, reused) looks up the real, already-persisted prior
 * reading for this exact `(subject, domain_id, parameter_id)`. A caller
 * advancing a parameter with no prior reading at all must seed one first —
 * this module has no "assume level 0" fallback, matching `deriveLearning`'s
 * own "never fabricate a starting point" discipline.
 *
 * **State(t1) only exists when the gate opens.** `deriveDomainStateUpdate`
 * returns `null` when the Effect's outcome is unaccepted, unobserved, or
 * cites no evidence — this module does NOT persist a DomainState in that
 * case. The Action and Effect are still real and still persisted (a
 * rejected/unverified attempt is still a real attempt), matching canon's own
 * "claimed != verified, but the Effect record itself is still real" rule.
 *
 * **Canonical refs are validated before they're persisted.** Every ref in
 * `sourceRefs` is checked with `canonicalRef.ts::resolveCanonicalRef` — a ref
 * that does not resolve against a real frozen Source Lock record is rejected
 * (`StateLoopUnresolvedRefError`), never silently stored as an opaque
 * string that later resolves to nothing.
 */
import { randomUUID } from "node:crypto";

import type { Action } from "../canon/action";
import type { Effect } from "../canon/effect";
import { isEffectVerified } from "../canon/effect";
import { recordAction, recordEffect } from "../canon/actionLifecycle";
import type { ActionRecord } from "../canon/actionStore";
import type { EffectRecord } from "../canon/effectStore";
import { findLatestDomainState } from "../canon/domainStateQuery";
import type { DomainStateRecord } from "../canon/domainStateStore";
import { domainStateStore } from "../canon/domainStateStoreAccessor";
import type { DomainActionResult, DomainState } from "../valueDomain/valueDomainConfig";
import { deriveDomainStateUpdate } from "../valueDomain/valueDomainConfig";
import { formatCanonicalRef, resolveCanonicalRef, type CanonicalRef } from "./canonicalRef";

export class StateLoopNoPriorStateError extends Error {
  constructor(subject: string, domain_id: string, parameter_id: string) {
    super(`no real prior DomainState for (subject=${subject}, domain_id=${domain_id}, parameter_id=${parameter_id}) — seed one via domainStateStore().append(...) before advancing it`);
    this.name = "StateLoopNoPriorStateError";
  }
}

export class StateLoopUnresolvedRefError extends Error {
  readonly raw: string;
  constructor(raw: string) {
    super(`canonical ref "${raw}" does not resolve against any real frozen Source Lock record — refusing to persist an unresolved ref`);
    this.name = "StateLoopUnresolvedRefError";
    this.raw = raw;
  }
}

export interface AdvanceDomainStateParams {
  subject: string;
  domain_id: string;
  parameter_id: string;
  /** Explicit "now" — same "no clock of its own" discipline as every other
   *  canon derivation in this codebase. */
  asOf: string;
  /** The real proposed Action — `owner`/`time` are forced to `subject`/`asOf`
   *  below so a caller cannot record an Action for someone else or backdate
   *  it; every other field is the caller's. */
  action: Omit<Action, "owner" | "time">;
  /** The real Effect — `action_ref`/`subject`/`time` are wired to this
   *  loop's own Action/subject/asOf, never re-accepted as separate params
   *  (same discipline `verticalSlice.ts`'s Learning wiring uses). */
  effect: Omit<Effect, "action_ref" | "subject" | "time">;
  /** Canonical refs this transition cites — validated, never stored
   *  unresolved. May be empty. */
  sourceRefs: readonly CanonicalRef[];
}

export type LearningOutcome =
  | { attempted: true; kind: "state_prime"; state: DomainStateRecord }
  | { attempted: true; kind: "no_update"; reason: "gate_closed" }
  | { attempted: false };

export interface StateLoopResult {
  priorState: DomainState;
  action: ActionRecord;
  effect: EffectRecord;
  evidence: { claimed: boolean; verified: boolean };
  learning: LearningOutcome;
}

/**
 * The one orchestrator. Reads State(t0), records a real Action, records a
 * real Effect referencing it (its `claimed_outcome`/`verified_outcome` ARE
 * the Evidence), derives Learning via the existing DomainState gate, and —
 * only when that gate opens — persists State(t1) with real, checked
 * canonical refs attached. Every write here goes through an already-real
 * store; this function itself persists nothing new of its own.
 */
export async function advanceDomainState(params: AdvanceDomainStateParams): Promise<StateLoopResult> {
  const { subject, domain_id, parameter_id, asOf, sourceRefs } = params;

  // ── State(t0) — read, never assumed. ───────────────────────────────────
  const domainStateRecords = await domainStateStore().load();
  const priorState = findLatestDomainState(domainStateRecords, subject, domain_id, parameter_id, asOf);
  if (!priorState) throw new StateLoopNoPriorStateError(subject, domain_id, parameter_id);

  // ── Canonical refs, validated before anything is persisted. ───────────
  for (const ref of sourceRefs) {
    const resolution = resolveCanonicalRef(formatCanonicalRef(ref));
    if (resolution.status !== "resolved") throw new StateLoopUnresolvedRefError(formatCanonicalRef(ref));
  }

  // ── Action — real, persisted, never executed. ──────────────────────────
  const action: Action = { ...params.action, owner: subject, time: asOf };
  const actionRecord = await recordAction(action, asOf);

  // ── Effect / Evidence — real, persisted, references the Action above. ─
  const effect: Effect = { ...params.effect, action_ref: action.action_id, subject, time: asOf };
  const effectRecord = await recordEffect(effect, asOf);
  const verified = isEffectVerified(effect);

  // ── Learning / State(t1) — the existing DomainState gate, reused. ─────
  const result: DomainActionResult = {
    result_id: `res_${effect.effect_id}`,
    parameter_id,
    action_id: action.action_id,
    expected_result: effect.claimed_outcome.statement,
    observed_result: effect.verified_outcome?.statement,
    accepted: verified,
    evidence: effect.verified_outcome ? `${effect.verified_outcome.method} — ${effect.verified_outcome.statement}` : undefined,
    time: asOf,
    provenance: priorState.provenance,
  };

  const candidate = deriveDomainStateUpdate(priorState, result);
  let learning: LearningOutcome;
  if (!candidate) {
    learning = { attempted: true, kind: "no_update", reason: "gate_closed" };
  } else {
    const nextState: DomainState = {
      ...candidate,
      source_refs: sourceRefs.length > 0 ? sourceRefs.map(formatCanonicalRef) : undefined,
    };
    const [stateRecord] = await domainStateStore().append([{ state_id: randomUUID(), state: nextState, recorded_at: asOf }]);
    learning = { attempted: true, kind: "state_prime", state: stateRecord };
  }

  return {
    priorState,
    action: actionRecord,
    effect: effectRecord,
    evidence: { claimed: true, verified },
    learning,
  };
}
