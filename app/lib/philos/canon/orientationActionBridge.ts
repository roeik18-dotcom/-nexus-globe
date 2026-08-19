/**
 * Philos Canon — OrientationActionBridge: the explicit integration boundary
 * between `verticalSlice.ts` (Observation → CellState → orientation stages)
 * and `actionLifecycle.ts` (Action → Effect → Learning, persisted). Approved
 * integration architecture:
 *
 *   Observation → State/Orientation → Action Proposal → Action Execution →
 *   Expected Effect → Observed Effect → Evidence → Learning → Updated State ↺
 *
 * **Why a separate file, not a merge of the two orchestrators.** The
 * instruction wiring this pass is explicit: `verticalSlice.ts` must not own
 * Action/Effect/Learning persistence, and `actionLifecycle.ts` must not gain
 * orientation-derivation logic. Each file keeps its own single
 * responsibility (`verticalSlice.ts`: derive orientation from one persisted
 * Observation, zero writes; `actionLifecycle.ts`: persist/read Action/
 * Effect/Learning, zero orientation derivation). This module READS the
 * output of both — via their own existing, unmodified public functions
 * (`runPhilosVerticalSlice`, `buildActionLifecycleSummary`, `loadActions`) —
 * and composes one honest, evidentiary view. It adds no new gate, no new
 * validation, no new persistence of its own.
 *
 * **No parallel ID system.** The link between an orientation (keyed by
 * `canon_event_id`) and an Action is the real `subject` field two ways:
 *   1. `Observation.subject === Action.owner` — the same real-world actor
 *      the Observation is about is who this bridge treats as "whose
 *      lifecycle to show" (same convention `actionLifecycle.ts`'s own
 *      `buildActionLifecycleSummary(subject)` already establishes).
 *   2. A STRICTER, explicit link: `Action.inputs` (canon §13 — "reference
 *      ids of what fed this Action") MAY contain the literal
 *      `canon_event_id` this Observation was recorded under. `relatedActions`
 *      below is filtered on that exact string match — never on chronology,
 *      never on subject alone — so a caller can distinguish "this actor's
 *      Actions in general" (`lifecycle`, subject-wide) from "Actions that
 *      explicitly cite THIS Observation as an input" (`relatedActions`,
 *      reference-checked). Both are real, checked queries; neither invents
 *      a link the stored records don't already carry.
 *
 * **CHRONOLOGY != CAUSALITY, held here too.** `relatedActions` is an
 * explicit-reference filter, not a "what came after" filter. `lifecycle`
 * itself already carries this discipline from `actionLifecycle.ts`
 * unchanged (Effect linked to Action only by `action_ref`, Learning to
 * Effect only by `effect_ref`).
 *
 * **Zero new writes.** This module's only I/O is the read calls already
 * proven side-effect-free by `verticalSlice.ts`/`actionLifecycle.ts`'s own
 * test suites (`store.load()`, `actionStore().load()` via `loadActions()`,
 * `effectStore()`/`learningStore()` reads inside `buildActionLifecycleSummary`).
 * No `.append()` call exists anywhere in this file.
 */
import type { CanonEventStore } from "./canonEventStore";
import {
  runPhilosVerticalSlice,
  type PhilosVerticalSliceResult,
} from "./verticalSlice";
import { buildActionLifecycleSummary, type ActionLifecycleSummary } from "./actionLifecycle";
import { loadActions } from "./actionStoreAccessor";
import type { ActionRecord } from "./actionStore";

export interface OrientationActionContext {
  canon_event_id: string;
  /** Verbatim from `runPhilosVerticalSlice` — this bridge derives nothing
   *  of its own about the Observation or its CellState. */
  observation: PhilosVerticalSliceResult["observation"];
  cellState: PhilosVerticalSliceResult["cellState"];
  /** `Observation.subject`, or `null` when no Observation was found for
   *  `canon_event_id` — genuinely checked, never guessed. */
  subject: string | null;
  /** Real, stored Actions whose `inputs` explicitly names this
   *  `canon_event_id` — the reference-checked link (see module header).
   *  Empty means genuinely checked, none found — not "not computed". */
  relatedActions: ActionRecord[];
  /** The full per-subject Action/Effect/Learning lifecycle
   *  (`actionLifecycle.ts::buildActionLifecycleSummary`, unmodified) for
   *  `subject`. An honest empty summary when `subject` is `null` or has
   *  recorded nothing yet. */
  lifecycle: ActionLifecycleSummary;
}

/**
 * The one function this bridge exposes. Runs the orientation orchestrator
 * for `canon_event_id`/`asOf` (unmodified `runPhilosVerticalSlice`, called
 * with no Need/Target/Offer/etc. — this bridge answers "orientation +
 * action lifecycle for the underlying subject," not the full §24 chain),
 * then composes the real Action/Effect/Learning read for the subject that
 * Observation names. Never throws by construction — every callee here is
 * itself total (`runPhilosVerticalSlice` never throws; `buildActionLifecycleSummary`
 * never throws; `loadActions` propagates only a genuine store failure, which
 * this function does not catch — matching `verticalSlice.ts`'s own "a read
 * failure is the caller's to handle, not silently swallowed" posture).
 */
export async function resolveOrientationActionContext(input: {
  store: CanonEventStore;
  canon_event_id: string;
  asOf: string;
}): Promise<OrientationActionContext> {
  const slice = await runPhilosVerticalSlice({
    store: input.store,
    canon_event_id: input.canon_event_id,
    asOf: input.asOf,
  });

  const subject =
    slice.observation.attempted && slice.observation.output !== null
      ? slice.observation.output.payload.subject
      : null;

  const allActions = await loadActions();
  const relatedActions = allActions.filter((r) => r.action.inputs.includes(input.canon_event_id));

  const lifecycle = await buildActionLifecycleSummary(subject ?? undefined);

  return {
    canon_event_id: input.canon_event_id,
    observation: slice.observation,
    cellState: slice.cellState,
    subject,
    relatedActions,
    lifecycle,
  };
}
