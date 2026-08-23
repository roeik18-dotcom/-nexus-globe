/**
 * The ONE shared semantic projection of a resolved `SystemContextRef`
 * (semantic-unity slice). Previously Dynamics, Globe, and Marketplace each
 * ran their own resolver against their own partial data, so the SAME ctx
 * could answer differently depending which screen asked — Planet's
 * `resolvePlanetContext` had no `subject`/`timestamp`/`priorState`/
 * `relationships`, Marketplace's `resolveSelectedContext` had no
 * `relationships` either. This file is now the one place that answers.
 *
 * `resolveCoreContext` is PURE and moved verbatim from the prior
 * `app/dynamics/page.tsx::resolveContext` — identity, relationships, and
 * state+time, computed only from data the caller already loaded (a
 * `CanonDynamicsGraph` and a `DynamicsViewModel`). No new store, no new id:
 * every field is copied straight off the matching canon Observation or
 * legacy event.
 *
 * `resolveSharedContext` is the async wrapper every route calls: it runs
 * `resolveCoreContext`, then — only for a `"found"` result — attaches a REAL
 * Need-store read (`findKnownNeeds`) and a derived `actionSpace` summary.
 * Nothing here mints a Need, an Offer, or a relationship; a `"not_found"`/
 * `"unknown"`/`"none"` result passes through unchanged, with no Need lookup
 * performed (there is no subject to look up).
 *
 * **ORIENTATION → ACTION → EFFECT → LEARNING (integration pass, additive):**
 * for a `system: "canon"` found result, `resolveSharedContext` also calls
 * `orientationActionBridge.ts::resolveOrientationActionContext` against the
 * SAME `canon_event_id` this resolution already matched — no new id space,
 * no second lookup key. `actionLifecycle`/`relatedActions` are attached only
 * for canon; `legacy` results leave both `undefined` (no Action/Effect/
 * Learning store keys off a legacy `event_id` — genuinely not computed, not
 * hidden). A read failure here degrades to leaving both fields `undefined`
 * rather than failing the whole context resolution — same "one honest
 * layer's failure must not hide another" posture `loadCanonGraphSafely`/
 * `loadLegacyViewSafely` already apply below.
 */
import { projectCanonDynamics, type CanonDynamicsGraph } from "@/app/lib/philos/canon/projectCanonDynamics";
import { findNeedsForSubject } from "@/app/lib/philos/canon/needStoreAccessor";
import { buildDynamicsView, type DynamicsViewModel } from "@/app/lib/philos/dynamicsView";
import { projectDynamics } from "@/app/lib/philos/projectDynamics";
import { loadPhilosEvents } from "@/app/lib/philos-event-store";
import { canonEventStore } from "@/app/lib/philos/canon/canonEventStoreAccessor";
import { resolveOrientationActionContext } from "@/app/lib/philos/canon/orientationActionBridge";
import { loadActions } from "@/app/lib/philos/canon/actionStoreAccessor";
import { loadEffects, findEffectsForAction } from "@/app/lib/philos/canon/effectStoreAccessor";
import { isEffectVerified } from "@/app/lib/philos/canon/effect";
import type { NeedRecord } from "@/app/lib/philos/canon/needStore";
import type { ActionLifecycleSummary } from "@/app/lib/philos/canon/actionLifecycle";
import type {
  ActionSpaceSummary,
  KnownNeedResult,
  RelationshipSummary,
  SelectedContext,
  SystemContextRef,
} from "@/app/lib/systemContext";

const CANON_DOMAIN_WORD: Record<string, string> = { G: "physical", E: "emotional", C: "cognitive" };
const CANON_FRAME_WORD: Record<string, string> = { I: "individual", R: "relational", S: "systemic" };

/**
 * Resolves a parsed `SystemContextRef` against data the caller already has —
 * no I/O in this function. Every field returned is copied verbatim from the
 * matching mark; `claimed_or_verified: "not_applicable"` for canon is the
 * same value `verticalSlice.ts` itself computes for the observation stage.
 */
export function resolveCoreContext(
  ref: SystemContextRef | null,
  canon: CanonDynamicsGraph,
  view: DynamicsViewModel,
): SelectedContext {
  if (ref === null) return { status: "none" };
  if (ref.kind === "unknown") return { status: "unknown", raw: ref.raw };

  // LOOP 0054 — Action/Effect resolution requires a real store read
  // (`actionStore`/`effectStore`), so it cannot happen in this pure,
  // synchronous function (same reason canon/legacy resolution here only
  // ever reads the already-loaded `canon`/`view` arguments). The async
  // `resolveSharedContext` wrapper below intercepts these two kinds BEFORE
  // calling this function. Reaching here with one of them means no async
  // resolution ran (e.g. a direct test call against this pure function) —
  // report `not_found` honestly rather than falling through into the
  // legacy_event branch below, which would otherwise read `ref.event_id`
  // off a ref that doesn't have one.
  if (ref.kind === "action" || ref.kind === "effect") {
    return { status: "not_found", ref };
  }

  if (ref.kind === "canon_observation") {
    const mark = canon.nodes.find((n) => n.canon_event_id === ref.canon_event_id);
    if (!mark) return { status: "not_found", ref };

    // STATE + TIME: the most recent PRIOR Observation for the SAME subject,
    // chronological only — never a causal claim.
    const priorCandidates = canon.nodes
      .filter((n) => n.subject === mark.subject && n.canon_event_id !== mark.canon_event_id && n.observed_at < mark.observed_at)
      .sort((a, b) => b.observed_at.localeCompare(a.observed_at));
    const prior = priorCandidates[0];

    return {
      status: "found",
      ref,
      system: "canon",
      matched_id: mark.canon_event_id,
      label: mark.label,
      domain: `${mark.domain} (${CANON_DOMAIN_WORD[mark.domain]})`,
      frame: `${mark.frame} (${CANON_FRAME_WORD[mark.frame]})`,
      provenance: mark.provenance,
      persisted_or_derived: mark.persisted_or_derived,
      claimed_or_verified: "not_applicable",
      subject: mark.subject,
      related: null, // canon has no edges at all today — never fabricated here
      timestamp: mark.observed_at,
      priorState: prior
        ? { matched_id: prior.canon_event_id, label: prior.label, observed_at: prior.observed_at, level: prior.level, stability: prior.stability }
        : null,
      delta: prior ? { level: mark.level - prior.level, stability: mark.stability - prior.stability } : null,
      relationships: [], // canon has no edges at all — checked, genuinely none; UNRESOLVED, not omitted
      currentState: { level: mark.level, stability: mark.stability, deficitType: mark.deficitType, confidence: mark.confidence },
    };
  }

  // legacy_event — the SAME event-keyed DynamicsViewModel every surface now
  // resolves against, not a surface-specific matcher.
  const node = view.nodes.find((n) => n.event_id === ref.event_id);
  if (!node) return { status: "not_found", ref };

  const relationships: RelationshipSummary[] = [];
  for (const e of view.edges) {
    if (e.source_event_id === ref.event_id) {
      const other = view.nodes.find((n) => n.event_id === e.target_event_id);
      relationships.push({
        direction: "outgoing",
        other_id: e.target_event_id,
        other_label: other?.label ?? e.target_event_id,
        relation_label: e.origin === "explicit" ? "leads to (declared)" : "leads to (inferred)",
        origin: e.origin,
        evidence_level: e.evidence_word,
      });
    }
    if (e.target_event_id === ref.event_id) {
      const other = view.nodes.find((n) => n.event_id === e.source_event_id);
      relationships.push({
        direction: "incoming",
        other_id: e.source_event_id,
        other_label: other?.label ?? e.source_event_id,
        relation_label: e.origin === "explicit" ? "caused by (declared)" : "caused by (inferred)",
        origin: e.origin,
        evidence_level: e.evidence_word,
      });
    }
  }
  const firstIncoming = relationships.find((r) => r.direction === "incoming");

  return {
    status: "found",
    ref,
    system: "legacy",
    matched_id: node.event_id,
    label: node.label,
    domain: node.domain,
    provenance: "legacy Value-Group event log",
    persisted_or_derived: "persisted",
    claimed_or_verified: "not tracked at node level — see relationships below",
    subject: node.actor_id,
    related: firstIncoming
      ? { description: `${firstIncoming.other_id} → ${node.event_id} (${firstIncoming.relation_label})`, event_id: firstIncoming.other_id }
      : null,
    timestamp: node.timestamp,
    // priorState/delta stay undefined for legacy: an event is a discrete
    // fact, not a repeated state measurement of one entity.
    relationships,
  };
}

/**
 * A REAL read against the real Need store — never skipped, never assumed
 * empty. Read-only: never calls `ingestNeed`. A store read failure degrades
 * to an honest "could not check" rather than silently reporting "no Needs".
 */
export async function findKnownNeeds(subject: string | undefined): Promise<KnownNeedResult> {
  try {
    const needs = await findNeedsForSubject(subject);
    return { needs, checked: true };
  } catch {
    return { needs: [], checked: false, reason: "Need store read failed" };
  }
}

export const ADMISSIBILITY_PREDICATE =
  "TransferAllowed ⇔ Benefit(receiver) > Cost ∧ DonorPostState(consumed_resource) ≥ ResourceSpecificFloor ∧ SystemicExternality ≤ AcceptedRisk";
export const ADMISSIBILITY_GATE_FUNCTION = "app/lib/philos/canon/matching.ts :: evaluateMatch(attempt, need, offer)";

/**
 * A real, checked blocker list — never a computed score. Offer persistence
 * doesn't exist anywhere in this codebase, so `"Offer"` is always a blocker
 * today; `"Need"` is a blocker only when the real read genuinely found none.
 * `admissible` cannot be true until both are gone.
 */
export function buildActionSpaceSummary(knownNeeds: KnownNeedResult): ActionSpaceSummary {
  const blockers: string[] = [];
  if (!(knownNeeds.checked && knownNeeds.needs.length > 0)) blockers.push("Need");
  blockers.push("Offer"); // no Offer persistence exists yet — always missing today
  return { admissible: blockers.length === 0, blockers };
}

/**
 * The real, checked "needs attention" query: every stored Need for this
 * subject that no stored Action's `inputs` references by id — an explicit
 * string-containment check against real records, never inferred from
 * proximity or subject alone. THE one implementation (`app/hub/
 * ActionOutcomes.tsx` and `app/hub/HubCommandCenter.tsx` both call this
 * rather than each recomputing it — same discipline as `buildActionSpaceSummary`
 * being the one blocker computation every caller shares). An unchecked
 * `knownNeeds` read (store failure) yields an empty result here — the
 * caller is responsible for rendering ITS OWN "could not check" state from
 * `knownNeeds.checked` directly, this function does not conflate the two.
 */
export function needsRequiringAction(knownNeeds: KnownNeedResult, lifecycle: ActionLifecycleSummary): NeedRecord[] {
  if (!knownNeeds.checked) return [];
  const referencedIds = new Set(lifecycle.actions.flatMap((a) => a.action.action.inputs));
  return knownNeeds.needs.filter((n) => !referencedIds.has(n.need.need_id));
}

/**
 * LOOP 0054 — resolves a real, already-persisted canon Action by its own
 * `action_id`. Its Effect(s), if any, are found via `findEffectsForAction`
 * (existing, reused verbatim) — real, checked, never inferred from
 * proximity. `owner_or_subject`/`knownNeeds`/`actionSpace` reuse the exact
 * same real Need-store lookup every other resolved context already uses.
 */
async function resolveActionEntityContext(ref: { kind: "action"; action_id: string }): Promise<SelectedContext> {
  const actions = await loadActions().catch(() => []);
  const found = actions.find((a) => a.action.action_id === ref.action_id);
  if (!found) return { status: "not_found", ref };

  const effectRecords = await findEffectsForAction(ref.action_id).catch(() => []);
  const relationships: RelationshipSummary[] = effectRecords.map((e) => ({
    direction: "outgoing",
    other_id: e.effect.effect_id,
    other_label: e.effect.claimed_outcome.statement,
    relation_label: isEffectVerified(e.effect) ? "has effect (verified)" : "has effect (claimed)",
    origin: "explicit",
  }));

  const knownNeeds = await findKnownNeeds(found.action.owner);
  const actionSpace = buildActionSpaceSummary(knownNeeds);

  // LOOP 06A — the one real next step: no Effect yet → record one; a
  // claimed-only Effect → nothing further genuinely justified for THIS
  // Action (verification is the Effect's own next step, not the Action's);
  // any verified Effect → nothing further, stated as null rather than
  // invented.
  const nextAction = effectRecords.length === 0
    ? { label: "Record an Effect for this Action", href: "/marketplace" }
    : null;

  return {
    status: "found_entity",
    ref,
    entity_kind: "action",
    matched_id: found.action.action_id,
    label: `${found.action.type} · ${found.action.mechanism_scope}`,
    owner_or_subject: found.action.owner,
    provenance: found.action.provenance,
    claimed_or_verified: "not_applicable",
    timestamp: found.action.time,
    relationships,
    knownNeeds,
    actionSpace,
    nextAction,
  };
}

/**
 * LOOP 0054 — resolves a real, already-persisted canon Effect by its own
 * `effect_id`. Its causal Action, if the reference still resolves, is
 * found via a real, checked `action_ref` lookup (never assumed valid —
 * `recordEffect`'s own referential-integrity check already guarantees it
 * existed at write time, but this is a fresh read, not a cached
 * assumption). `claimed_or_verified` is computed via `isEffectVerified`,
 * the SAME real gate `/marketplace` and the canon activity sections use.
 */
async function resolveEffectEntityContext(ref: { kind: "effect"; effect_id: string }): Promise<SelectedContext> {
  const effects = await loadEffects().catch(() => []);
  const found = effects.find((e) => e.effect.effect_id === ref.effect_id);
  if (!found) return { status: "not_found", ref };

  const actions = await loadActions().catch(() => []);
  const causal = actions.find((a) => a.action.action_id === found.effect.action_ref);
  const relationships: RelationshipSummary[] = causal
    ? [{
        direction: "incoming",
        other_id: causal.action.action_id,
        other_label: `${causal.action.type} · ${causal.action.mechanism_scope}`,
        relation_label: "caused by (declared)",
        origin: "explicit",
      }]
    : [];

  const knownNeeds = await findKnownNeeds(found.effect.subject);
  const actionSpace = buildActionSpaceSummary(knownNeeds);

  // LOOP 06A — not verified yet → the real next step is verification/
  // evidence (canon §17: self is always sufficient — the same real path
  // `CreateEffectForm.tsx`'s `self_verified` checkbox already offers).
  // Already verified → nothing further genuinely justified.
  const nextAction = isEffectVerified(found.effect)
    ? null
    : { label: "Verify this Effect (add evidence)", href: "/marketplace" };

  return {
    status: "found_entity",
    ref,
    entity_kind: "effect",
    matched_id: found.effect.effect_id,
    label: found.effect.claimed_outcome.statement,
    owner_or_subject: found.effect.subject,
    provenance: found.effect.provenance,
    claimed_or_verified: isEffectVerified(found.effect) ? "verified" : "claimed",
    timestamp: found.effect.time,
    relationships,
    knownNeeds,
    actionSpace,
    nextAction,
  };
}

async function loadCanonGraphSafely(viewerId?: string): Promise<CanonDynamicsGraph> {
  try {
    /* SCOPE. This resolver already knows who is asking — passing it through is
       strictly better than letting the projection re-resolve a session, and it
       is what keeps a context lookup from returning another person's
       observation to whoever happened to hold its id. */
    return await projectCanonDynamics(undefined, viewerId ? { subject_id: viewerId, person_id: viewerId } : undefined);
  } catch {
    return { source: "canon", nodes: [], summary: { node_count: 0, persisted_count: 0, domains: { G: 0, E: 0, C: 0 } } };
  }
}

async function loadLegacyViewSafely(viewerId?: string): Promise<DynamicsViewModel> {
  try {
    return buildDynamicsView(projectDynamics({ events: await loadPhilosEvents(), viewer: viewerId }));
  } catch {
    return { nodes: [], edges: [], domain_ripples: [], withheld: { count: 0, text: "" }, unresolved: [], hud: { nodes: 0, edges: 0, explicit_edges: 0, inferred_edges: 0, withheld: 0, unresolved: 0 } };
  }
}

/**
 * The ONE entry point every route calls: `resolveCoreContext` plus the real
 * Need read and derived action-space summary, for a `"found"` result only.
 * Self-contained I/O (loads canon + the legacy view itself) so all three
 * surfaces consume identically — Dynamics/Planet/Marketplace each already
 * separately load canon/events for their own primary view; this is a second,
 * independent read of the same small JSONL sources, not a new store.
 */
export async function resolveSharedContext(
  ref: SystemContextRef | null,
  options?: { viewerId?: string },
): Promise<SelectedContext> {
  // LOOP 0054 — Action/Effect refs resolve entirely differently (their own
  // stores, no canon Observation/legacy event graph involved at all), so
  // they are intercepted here before any of the canon/legacy loading below
  // runs — same "don't do unrelated I/O for a ref this resolver can't use"
  // discipline as the rest of this function.
  if (ref?.kind === "action") return resolveActionEntityContext(ref);
  if (ref?.kind === "effect") return resolveEffectEntityContext(ref);

  const canon = await loadCanonGraphSafely(options?.viewerId);
  const view = await loadLegacyViewSafely(options?.viewerId);
  const core = resolveCoreContext(ref, canon, view);
  if (core.status !== "found") return core;

  const knownNeeds = await findKnownNeeds(core.subject);
  const actionSpace = buildActionSpaceSummary(knownNeeds);

  if (core.system !== "canon") return { ...core, knownNeeds, actionSpace };

  try {
    const bridge = await resolveOrientationActionContext({
      store: canonEventStore(),
      canon_event_id: core.matched_id,
      asOf: new Date().toISOString(),
    });
    return { ...core, knownNeeds, actionSpace, actionLifecycle: bridge.lifecycle, relatedActions: bridge.relatedActions };
  } catch {
    // A store-read failure here must not hide the (unrelated) core context.
    return { ...core, knownNeeds, actionSpace };
  }
}
