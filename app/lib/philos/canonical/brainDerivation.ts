/**
 * PHILOS Canonical layer — BrainDerivation (Phase 5).
 *
 * Pure projection over data that is ALREADY real and ALREADY persisted —
 * no new store, no Brain-only state (Phase 5 rule "no duplicate Brain-only
 * state store"). Two already-real inputs, kept as two separate sections
 * rather than force-joined into one invented cross-reference (`DomainState`
 * carries no `action_ref`/`effect_ref` field, and this pass does not add
 * one — "do not change the working Hub + Dynamics shared-state contract"):
 *
 *   - `ActionLifecycleSummary` (`canon/actionLifecycle.ts`, reused verbatim)
 *     — the real Action→Effect→Learning chain. This IS the literal
 *     "change → evidence → learning → next action" roundtrip Phase 5 asks
 *     to be visible: an `ActionLifecycleEntry` is the change, its
 *     `EffectWithLearning[]` carries the Evidence
 *     (`claimed_outcome`/`verified_outcome`), and each `LearningRecord`
 *     whose `result.kind === "state_prime"` is the Learning.
 *   - `CanonicalInstance` (`PersonInstance`/`ValueDomainInstance`,
 *     `personInstance.ts`, reused verbatim) — the real `current_state`/
 *     `history`/`evidence`/`changed` Phase 4 already exposes to Hub/
 *     Dynamics. Read here, never re-derived.
 *
 * **Hypotheses are structurally separate from evidence.** `hypotheses[]` is
 * a distinct field on `BrainDerivation`, populated ONLY from real, already-
 * recorded uncertainty markers on a resolved `CanonicalRef` (a Source
 * Lock's own `MAPPING_BASIS` containing `"INFERRED"`, or a `conflict_status`
 * of `"OPEN"` — e.g. the real White/COLOR_ID=0 conflict) — never copied
 * into `evidence`, and never asserted as fact. No function here invents a
 * hypothesis from correlation or pattern-matching; every one is traceable
 * to a real field on a real frozen record.
 *
 * **No fake certainty.** `unknown[]` states real gaps in the input data
 * plainly (`no_effect_recorded` counts, empty `current_state`) rather than
 * omitting them or letting the UI read as "nothing missing."
 *
 * **The Learning/State(t+1) boundary is one of those gaps, and is named.**
 * A `state_prime` `LearningRecord` is the Learning; a VERIFIED Effect is
 * NOT. `unknown[]` therefore states plainly when real verified evidence
 * exists while no Learning transition does — the one place a reader is most
 * likely to infer a closed loop from adjacency. Nothing here ever derives a
 * Learning, a Level, a Stability or a State(t+1) from a verified Effect: no
 * canonical persistence/update contract for State' exists, and the five
 * unresolved questions behind that are recorded, unsolved, in
 * `app/lib/philos/canon/STATE-TRANSITION-BOUNDARY.md`.
 */
import type { ActionLifecycleSummary } from "../canon/actionLifecycle";
import { resolveCanonicalRef, parseCanonicalRef } from "./canonicalRef";
import type { PersonInstance, ValueDomainInstance } from "./personInstance";
import type { SourceKind } from "./sourceKind";

/**
 * One real EVIDENCE citation, kept STRUCTURED instead of flattened into a
 * display string.
 *
 * Every field is copied verbatim off the single `OutcomeVerification` this
 * entry cites (`effect.verified_outcome` when the Effect is verified, else
 * `effect.claimed_outcome`) — nothing is defaulted, inferred or merged
 * across records. It exists because the string form (`evidence: string[]`,
 * still produced below for its existing consumers) drops `verifier_type`,
 * `confidence`, `method` and `time`, which forced every surface rendering
 * it to print "VERIFIER UNKNOWN · conf UNKNOWN" over records that carry
 * real values on disk. Showing UNKNOWN where a real value exists is the
 * same failure as showing a value where none exists, just in the other
 * direction.
 */
export interface BrainEvidenceRecord {
  /** `OutcomeVerification.statement`, verbatim. */
  statement: string;
  /** VERIFIED = read off `verified_outcome` AND the Effect passes
   *  `isEffectVerified`; CLAIMED = read off `claimed_outcome`. Never
   *  inferred from anything else. */
  stance: "VERIFIED" | "CLAIMED";
  /** `OutcomeVerification.verifier_type`, verbatim. */
  verifier_type: string;
  /** `OutcomeVerification.confidence`, verbatim — the record's own number. */
  confidence: number;
  /** `OutcomeVerification.method`, verbatim. */
  method: string;
  /** `OutcomeVerification.time`, verbatim — when the verification is OF. */
  time: string;
  /** Real ids, for citation — never a display label. */
  effect_id: string;
  action_id: string;
}

export interface BrainChangeEntry {
  action_id: string;
  action_type: string;
  effect_id: string | null;
  verification_state: "no_effect_recorded" | "effect_claimed_only" | "effect_verified";
  /** Real fact: an Action was recorded. Never a guess about intent.
   *  Keeps the id and ISO timestamp inline for existing string consumers. */
  what_changed: string;
  /** The SAME fact, split for display so a raw id and a raw ISO timestamp
   *  stop being the PRIMARY thing a reader sees on Hub/Brain. `label` is
   *  the readable statement; the id and `recorded_at` are the citation and
   *  belong at secondary weight — demoted, never hidden (the record's
   *  existence and its real timestamp both stay on screen). */
  what_changed_label: string;
  recorded_at: string;
  /** The real `verified_outcome.statement` when one exists — `null` when
   *  the Effect is claimed-only or absent (never backfilled from
   *  `claimed_outcome`, which would blur claimed vs. verified). */
  why_it_changed: string | null;
  /** Real citation — `verified_outcome` labeled VERIFIED, else
   *  `claimed_outcome` labeled CLAIMED, else `null` when no Effect exists
   *  at all. */
  evidence: string | null;
  /** The SAME citation as `evidence`, structured — `null` when no Effect
   *  exists at all. See `BrainEvidenceRecord`. */
  evidence_record: BrainEvidenceRecord | null;
  learnings: { learning_id: string; kind: "state_prime" | "no_update" }[];
}

export interface BrainDerivation {
  subject_id: string;
  source_kind: SourceKind;
  /** One entry per real Action this subject owns. */
  changes: BrainChangeEntry[];
  why_it_changed: string[];
  evidence: string[];
  /** The Effect-derived subset of `evidence`, structured and in the same
   *  order — see `BrainEvidenceRecord`. DomainState-instance evidence stays
   *  string-only (it carries no verifier/confidence of its own) and is NOT
   *  padded into this list with invented fields. */
  evidence_records: BrainEvidenceRecord[];
  unknown: string[];
  /** Never evidence — see module header. */
  /** RUNTIME hypotheses only — statements about the subject's CURRENT
   *  situation derived from real evidence/state. Config-provenance markers
   *  (INFERRED_REVIEW mapping bases, OPEN conflicts on activated refs) are
   *  NOT hypotheses about the person — they live in `config_review` below.
   *  No runtime hypothesis source exists in this codebase yet, so this is
   *  honestly [] today. */
  hypotheses: string[];
  /** Review/audit metadata about the ACTIVATED CONFIG refs themselves:
   *  refs whose Source-Lock `mapping_basis` is INFERRED_* or whose
   *  `conflict_status` is OPEN. Provenance bookkeeping, not claims about
   *  the subject's current state — rendered under CONFIG REVIEW / AUDIT,
   *  never under HYPOTHESES. */
  config_review: string[];
  next_action: { label: string; reason: string } | null;
}

function describeVerification(v: { statement: string; method: string } | undefined, label: "VERIFIED" | "CLAIMED"): string {
  return `[${label}] ${v!.statement} (${v!.method})`;
}

/** Config-review markers — traced to a real `CanonicalRef` resolution's
 *  own `mapping_basis`/`conflict_status`. These describe the CONFIG's
 *  provenance quality, not the subject's current situation — semantic-
 *  integrity repair moved them out of `hypotheses` into `config_review`. */
function configReviewFromRefs(refs: readonly string[]): string[] {
  const out: string[] = [];
  for (const raw of refs) {
    const parsed = parseCanonicalRef(raw);
    if (!parsed) continue;
    const resolved = resolveCanonicalRef(raw);
    if (resolved.status !== "resolved") continue;
    if (resolved.mapping_basis?.includes("INFERRED")) {
      out.push(`[CONFIG_REVIEW] ${raw}: mapping_basis=${resolved.mapping_basis} — inferred mapping in the Source Lock, not a claim about the subject`);
    }
    if (resolved.conflict_status === "OPEN") {
      out.push(`[CONFIG_REVIEW] ${raw}: conflict_status=OPEN — unresolved in the Source Lock, do not treat as settled`);
    }
  }
  return [...new Set(out)];
}

function buildNextAction(
  summary: ActionLifecycleSummary,
  instances: readonly (PersonInstance | ValueDomainInstance)[],
  pendingNeeds: readonly { need_id: string; desired_change: string }[],
  hasRealObservation: boolean,
): BrainDerivation["next_action"] {
  // NEXT-ACTION TRUTH (runtime reconciliation, 2026-08-17): derived at
  // request time from the CURRENT backlog, in the same priority order the
  // Hub CTA already uses — pending Need first. The old rule ignored
  // pending Needs entirely and, worse, kept prescribing "רשום תצפית
  // ראשונה" from the DomainState-only view even after a real canon
  // Observation existed (live incident: observation c47fbabb-… was
  // persisted, yet every surface still spoke the stale first-observation
  // action). The first-observation prompt is now gated on there being NO
  // real observation at all.
  if (pendingNeeds.length > 0) {
    return { label: `טפל בצורך: ${pendingNeeds[0].desired_change}`, reason: "Need פתוח ללא Action מקושר — העדיפות הראשונה בתור" };
  }
  if (summary.counts.no_effect_recorded > 0) {
    const entry = summary.actions.find((a) => a.verification_state === "no_effect_recorded");
    return entry
      ? { label: `רשום Effect ל-Action: ${entry.action.action.action_id}`, reason: "action recorded with no Effect yet — the loop is open" }
      : null;
  }
  if (summary.counts.effect_claimed_only > 0) {
    const entry = summary.actions.find((a) => a.verification_state === "effect_claimed_only");
    return entry
      ? { label: `אמת Effect: ${entry.effects[0]?.effect.effect.effect_id ?? entry.action.action.action_id}`, reason: "Effect exists but is claimed-only, never verified" }
      : null;
  }
  const emptyInstance = instances.find((i) => i.current_state.length === 0);
  if (emptyInstance && !hasRealObservation) {
    return { label: `רשום תצפית ראשונה עבור domain: ${emptyInstance.domain_id}`, reason: "no real Observation exists for this subject at all" };
  }
  if (summary.actions.length === 0) {
    return { label: "בצע Action ראשון", reason: "no real Action recorded for this subject yet" };
  }
  // Nothing justified — UNKNOWN is the honest answer, never a recycled
  // prompt for a step that already happened.
  return null;
}

/**
 * The one Brain-facing derivation. Pure — no I/O, no clock. Every input is
 * already-real, already-computed data the caller passes in (same "read,
 * never re-derive" discipline as `personInstance.ts`).
 */
export function buildBrainDerivation(params: {
  subject_id: string;
  lifecycle: ActionLifecycleSummary;
  instances: readonly (PersonInstance | ValueDomainInstance)[];
  /** Current pending Needs (no linked Action) — first in the next-action
   *  priority order. [] = none. */
  pendingNeeds?: readonly { need_id: string; desired_change: string }[];
  /** True when ANY real canon Observation exists for this subject — gates
   *  the "רשום תצפית ראשונה" prompt so it can never go stale. */
  hasRealObservation?: boolean;
}): BrainDerivation {
  const { subject_id, lifecycle, instances, pendingNeeds = [], hasRealObservation = false } = params;

  const changes: BrainChangeEntry[] = lifecycle.actions.map((entry) => {
    const primaryEffect = entry.effects[0];
    const why_it_changed = primaryEffect?.effect.effect.verified_outcome
      ? primaryEffect.effect.effect.verified_outcome.statement
      : null;
    const evidence = primaryEffect
      ? primaryEffect.verified
        ? describeVerification(primaryEffect.effect.effect.verified_outcome, "VERIFIED")
        : describeVerification(primaryEffect.effect.effect.claimed_outcome, "CLAIMED")
      : null;
    // Same citation, structured — the one `OutcomeVerification` above, with
    // its own fields kept rather than dropped into a display string.
    const citedVerification = primaryEffect
      ? primaryEffect.verified
        ? primaryEffect.effect.effect.verified_outcome!
        : primaryEffect.effect.effect.claimed_outcome
      : null;
    const evidence_record: BrainEvidenceRecord | null = primaryEffect && citedVerification
      ? {
          statement: citedVerification.statement,
          stance: primaryEffect.verified ? "VERIFIED" : "CLAIMED",
          verifier_type: citedVerification.verifier_type,
          confidence: citedVerification.confidence,
          method: citedVerification.method,
          time: citedVerification.time,
          effect_id: primaryEffect.effect.effect.effect_id,
          action_id: entry.action.action.action_id,
        }
      : null;
    const learnings = entry.effects.flatMap((e) => e.learnings.map((l) => ({ learning_id: l.learning.learning_id, kind: l.learning.result.kind })));
    return {
      action_id: entry.action.action.action_id,
      action_type: entry.action.action.type,
      effect_id: primaryEffect?.effect.effect.effect_id ?? null,
      verification_state: entry.verification_state,
      what_changed: `Action ${entry.action.action.action_id} (${entry.action.action.type}) recorded ${entry.action.recorded_at}`,
      what_changed_label: `נרשמה פעולה · ${entry.action.action.type}`,
      recorded_at: entry.action.recorded_at,
      why_it_changed,
      evidence,
      evidence_record,
      learnings,
    };
  });

  const why_it_changed = [...new Set(changes.map((c) => c.why_it_changed).filter((v): v is string => !!v))];
  const evidenceFromChanges = changes.map((c) => c.evidence).filter((v): v is string => !!v);
  const evidenceFromInstances = instances.flatMap((i) => i.evidence);
  const evidence = [...new Set([...evidenceFromChanges, ...evidenceFromInstances])];
  const evidence_records = changes
    .map((c) => c.evidence_record)
    .filter((r): r is BrainEvidenceRecord => r !== null);

  const unknown: string[] = [];
  if (lifecycle.counts.no_effect_recorded > 0) unknown.push(`${lifecycle.counts.no_effect_recorded} Action(s) with no Effect recorded yet`);
  if (lifecycle.counts.effect_claimed_only > 0) unknown.push(`${lifecycle.counts.effect_claimed_only} Effect(s) claimed but not verified`);
  for (const i of instances) {
    if (i.current_state.length === 0) unknown.push(`no real DomainState reading yet for domain "${i.domain_id}"`);
  }
  // OPEN BOUNDARY — Learning → State(t+1). A VERIFIED Effect proves an
  // Effect outcome according to its own verification record, and nothing
  // beyond it: not Learning, not a changed Level/Stability, not State(t+1).
  // Without this line Brain's UNKNOWN list stays silent exactly where the
  // system is most likely to be over-read — real verified evidence sitting
  // next to an empty Learning count reads as "the loop closed" unless the
  // gap is named. See `app/lib/philos/canon/STATE-TRANSITION-BOUNDARY.md`.
  if (lifecycle.counts.effect_verified > 0 && lifecycle.counts.learnings_with_state_prime === 0) {
    unknown.push(
      `${lifecycle.counts.effect_verified} verified Effect(s) with real evidence, but no Learning transition is established — a verified Effect does not prove Learning or State(t+1), and no canonical persistence/update contract for State' exists`,
    );
  }

  const allRefs = instances.flatMap((i) => i.source_refs);
  const config_review = configReviewFromRefs(allRefs);
  // Runtime hypotheses: no mechanism in this codebase derives one from
  // current evidence/state yet — honestly empty, never padded from config.
  const hypotheses: string[] = [];

  return {
    subject_id,
    source_kind: "CANON",
    changes,
    why_it_changed,
    evidence,
    evidence_records,
    unknown,
    hypotheses,
    config_review,
    next_action: buildNextAction(lifecycle, instances, pendingNeeds, hasRealObservation),
  };
}
