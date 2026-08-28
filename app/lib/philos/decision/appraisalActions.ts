"use server";

/**
 * Philos — writers for the appraisal layer.
 *
 * This is where values stop being content and start being a mechanism. Three
 * gates fire here, and each REFUSES rather than scores:
 *
 *   `recordAppraisalCore`  — cannot call a gap a shortage/threat/opportunity
 *                            without citing a value the appraiser holds.
 *   `recordTradeoffCore`   — cannot decide while ignoring a recorded
 *                            non-latent conflict, and cannot record a
 *                            "tradeoff" that gives nothing up.
 *   `recordValueImpactCore`— cannot claim a value moved without evidence.
 *
 * Values are read from the EXISTING `ValueDeclaration` store. Nothing here
 * creates a value, copies a value, or maintains a second value catalogue.
 */
import { revalidatePath } from "next/cache";

import { loadValueDeclarations } from "../community/valueDeclarationStoreAccessor";
import { createIdGenerator, systemClock } from "../eventStore";
import { resolveViewerContext } from "../identity/viewerContext";
import {
  appraisalStore,
  gapStore,
  loadValueConflicts,
  loadValueTradeoffs,
  valueConflictStore,
  valueImpactStore,
  valueTradeoffStore,
} from "./appraisalStore";
import { attachToCase } from "./decisionActions";
import { loadCases } from "./decisionStore";
import {
  type Appraisal,
  type AppraisalKind,
  APPRAISALS,
  appraise,
  type Gap,
  REQUIREMENT_SOURCES,
  type RequirementSource,
  validateAppraisal,
  validateGap,
} from "./gap";
import {
  checkTradeoff,
  checkValueImpact,
  IMPACT_DIRECTIONS,
  type ImpactDirection,
  TENSION_LEVELS,
  type TensionLevel,
  type ValueConflict,
  type ValueImpact,
  type ValueTradeoff,
  validateValueConflict,
  validateValueImpact,
  validateValueTradeoff,
} from "./valueMechanism";

const ids = createIdGenerator();

function f(v: FormData, k: string): string {
  return String(v.get(k) ?? "").trim();
}
function lines(raw: string): string[] {
  return raw.split("\n").map((l) => l.trim()).filter((l) => l !== "");
}
function revalidateAll(): void {
  for (const p of ["/decisions", "/hub"]) revalidatePath(p);
}

export type LayerState = { ok?: true; id?: string; error?: string; reason?: string };

// ── GAP ───────────────────────────────────────────────────────────────────

export async function recordGapCore(formData: FormData): Promise<LayerState> {
  const case_id = f(formData, "case_id");
  const current_state = f(formData, "current_state");
  const desired_state = f(formData, "desired_state");
  if (!case_id || !current_state || !desired_state) {
    return { reason: "fields_incomplete", error: "חסר למילוי: המקרה · המצב הקיים · המצב הרצוי" };
  }

  const viewer = await resolveViewerContext();
  const rawSource = f(formData, "requirement_source");
  const requirement_source: RequirementSource =
    (REQUIREMENT_SOURCES as readonly string[]).includes(rawSource)
      ? (rawSource as RequirementSource)
      : "personal_expectation";

  const gap: Gap = {
    gap_id: ids.next("gap"),
    case_id,
    subject: viewer.subject_id,
    current_state,
    desired_state,
    requirement_source,
    observation_refs: lines(f(formData, "observation_refs")),
    observed_at: systemClock.now(),
    record_origin: "REAL",
  };
  if (!validateGap(gap).valid) {
    return { reason: "invalid_gap", error: "רשומת הפער אינה תקינה" };
  }

  await gapStore().append([{ gap, recorded_at: systemClock.now() }]);
  const attached = await attachToCase(case_id, "gap_refs", gap.gap_id, "deliberating");
  if (!attached.ok) return { reason: "case_unresolved", error: attached.error };
  return { ok: true, id: gap.gap_id };
}

// ── APPRAISAL — the first gate ────────────────────────────────────────────

export async function recordAppraisalCore(formData: FormData): Promise<LayerState> {
  const case_id = f(formData, "case_id");
  const gap_ref = f(formData, "gap_ref");
  const because = f(formData, "because");
  if (!case_id || !gap_ref || !because) {
    return { reason: "fields_incomplete", error: "חסר למילוי: המקרה · הפער · הנימוק" };
  }

  const viewer = await resolveViewerContext();
  const rawKind = f(formData, "kind");
  const kind: AppraisalKind = (APPRAISALS as readonly string[]).includes(rawKind)
    ? (rawKind as AppraisalKind)
    : "not_relevant";
  const value_refs = lines(f(formData, "value_refs"));

  /* THE GATE. The values the appraiser actually declared come from the
     EXISTING declaration store — never invented, never copied here. */
  const declarations = await loadValueDeclarations();
  const held = declarations
    .filter((d) => d.holder_id === viewer.subject_id || d.holder_id === viewer.person_id)
    .map((d) => d.value_id);

  const check = appraise({ kind, value_refs, heldValueIds: held });
  if (!check.ok) return { reason: check.refusal, error: check.message };

  const appraisal: Appraisal = {
    appraisal_id: ids.next("appraisal"),
    case_id,
    gap_ref,
    appraiser: viewer.subject_id,
    kind,
    value_refs: check.basis,
    because,
    salience: (["low", "medium", "high"] as const).includes(f(formData, "salience") as never)
      ? (f(formData, "salience") as "low" | "medium" | "high")
      : "medium",
    appraised_at: systemClock.now(),
    context: f(formData, "context") || "לא צוין הקשר",
    record_origin: "REAL",
  };
  if (!validateAppraisal(appraisal).valid) {
    return { reason: "invalid_appraisal", error: "רשומת ההערכה אינה תקינה" };
  }

  await appraisalStore().append([{ appraisal, recorded_at: systemClock.now() }]);
  const attached = await attachToCase(case_id, "appraisal_refs", appraisal.appraisal_id);
  if (!attached.ok) return { reason: "case_unresolved", error: attached.error };
  return { ok: true, id: appraisal.appraisal_id };
}

// ── VALUE CONFLICT ────────────────────────────────────────────────────────

export async function recordValueConflictCore(formData: FormData): Promise<LayerState> {
  const case_id = f(formData, "case_id");
  const value_a_ref = f(formData, "value_a_ref");
  const value_b_ref = f(formData, "value_b_ref");
  if (!case_id || !value_a_ref || !value_b_ref) {
    return { reason: "fields_incomplete", error: "חסר למילוי: המקרה · שני הערכים" };
  }

  const viewer = await resolveViewerContext();
  const rawTension = f(formData, "tension_level");
  const tension_level: TensionLevel = (TENSION_LEVELS as readonly string[]).includes(rawTension)
    ? (rawTension as TensionLevel)
    : "latent";

  const conflict: ValueConflict = {
    conflict_id: ids.next("vconflict"),
    case_id,
    value_a_ref,
    value_b_ref,
    subject: viewer.subject_id,
    context: f(formData, "context") || "לא צוין הקשר",
    tension_level,
    ...(f(formData, "contradiction_ref")
      ? { contradiction_ref: f(formData, "contradiction_ref") }
      : {}),
    evidence_refs: lines(f(formData, "evidence_refs")),
    recognised_at: systemClock.now(),
    record_origin: "REAL",
  };
  const v = validateValueConflict(conflict);
  if (!v.valid) {
    return {
      reason: "invalid_conflict",
      error: `רשומת הקונפליקט אינה תקינה: ${v.errors.map((e) => `${e.field}/${e.reason}`).join(", ")}`,
    };
  }

  await valueConflictStore().append([{ conflict, recorded_at: systemClock.now() }]);
  const attached = await attachToCase(case_id, "value_conflict_refs", conflict.conflict_id);
  if (!attached.ok) return { reason: "case_unresolved", error: attached.error };
  return { ok: true, id: conflict.conflict_id };
}

// ── TRADEOFF — the second gate ────────────────────────────────────────────

export async function recordTradeoffCore(formData: FormData): Promise<LayerState> {
  const case_id = f(formData, "case_id");
  const decision_ref = f(formData, "decision_ref");
  const rationale = f(formData, "rationale");
  if (!case_id || !decision_ref || !rationale) {
    return { reason: "fields_incomplete", error: "חסר למילוי: המקרה · ההחלטה · הנימוק" };
  }

  const cases = await loadCases();
  const theCase = cases.find((c) => c.case_id === case_id);
  if (!theCase) return { reason: "case_not_found", error: "המקרה אינו קיים" };

  const allConflicts = await loadValueConflicts();
  const caseConflicts = allConflicts
    .map((r) => r.conflict)
    .filter((c) => theCase.value_conflict_refs.includes(c.conflict_id));

  const tradeoff: ValueTradeoff = {
    tradeoff_id: ids.next("tradeoff"),
    case_id,
    decision_ref,
    conflict_refs: lines(f(formData, "conflict_refs")),
    prioritized_value_refs: lines(f(formData, "prioritized_value_refs")),
    deprioritized_value_refs: lines(f(formData, "deprioritized_value_refs")),
    rationale,
    ...(f(formData, "authorized_by_ref")
      ? { authorized_by_ref: f(formData, "authorized_by_ref") }
      : {}),
    decided_at: systemClock.now(),
    record_origin: "REAL",
  };

  /* THE GATE. A decision may not walk past a conflict it has already
     recognised, and a tradeoff that costs nothing is not a tradeoff. */
  const check = checkTradeoff({ tradeoff, caseConflicts });
  if (!check.ok) return { reason: check.refusal, error: check.message };

  if (!validateValueTradeoff(tradeoff).valid) {
    return { reason: "invalid_tradeoff", error: "רשומת הפשרה אינה תקינה" };
  }

  const existing = await loadValueTradeoffs();
  if (existing.some((r) => r.tradeoff.decision_ref === decision_ref)) {
    return { reason: "already_recorded", error: "כבר נרשמה פשרה להחלטה הזו" };
  }

  await valueTradeoffStore().append([{ tradeoff, recorded_at: systemClock.now() }]);

  /* `value_tradeoff_ref` is a single ref, so it is set directly rather than
     through `attachToCase`, which appends to lists. */
  const { reviseCaseWithTradeoff } = await import("./decisionActions");
  const attached = await reviseCaseWithTradeoff(case_id, tradeoff.tradeoff_id);
  if (!attached.ok) return { reason: "case_unresolved", error: attached.error };

  return { ok: true, id: tradeoff.tradeoff_id };
}

// ── VALUE IMPACT — the third gate ─────────────────────────────────────────

export async function recordValueImpactCore(formData: FormData): Promise<LayerState> {
  const case_id = f(formData, "case_id");
  const effect_ref = f(formData, "effect_ref");
  const value_ref = f(formData, "value_ref");
  if (!case_id || !effect_ref || !value_ref) {
    return { reason: "fields_incomplete", error: "חסר למילוי: המקרה · התוצאה · הערך" };
  }

  const asDirection = (k: string): ImpactDirection =>
    (IMPACT_DIRECTIONS as readonly string[]).includes(k) ? (k as ImpactDirection) : "unknown";

  const evidence_refs = lines(f(formData, "evidence_refs"));
  const observed_direction = asDirection(f(formData, "observed_direction"));

  /* THE EXPECTED DIRECTION IS NOT TYPED IN. It is read from the tradeoff the
     decision already recorded: a value it prioritized was expected to
     advance, one it deprioritized was expected to be set back. Letting a
     reviewer state the expectation afterwards would let hindsight rewrite the
     prediction, which is the whole failure this layer guards against. */
  const cases = await loadCases();
  const theCase = cases.find((c) => c.case_id === case_id);
  if (!theCase) return { reason: "case_not_found", error: "המקרה אינו קיים" };

  const tradeoffs = await loadValueTradeoffs();
  const tradeoff = tradeoffs.find((r) => r.tradeoff.tradeoff_id === theCase.value_tradeoff_ref);
  if (!tradeoff) {
    return {
      reason: "no_tradeoff",
      error: "לא נרשמה פשרה להחלטה — אין ציפייה מוקדמת שאפשר להשוות אליה",
    };
  }

  const expected_direction: ImpactDirection =
    tradeoff.tradeoff.prioritized_value_refs.includes(value_ref)
      ? "advanced"
      : tradeoff.tradeoff.deprioritized_value_refs.includes(value_ref)
        ? "set_back"
        : "unknown";

  const weighed = [
    ...tradeoff.tradeoff.prioritized_value_refs,
    ...tradeoff.tradeoff.deprioritized_value_refs,
  ];

  /* THE GATE. */
  const check = checkValueImpact({
    observed_direction,
    evidence_refs,
    value_ref,
    tradeoffValues: weighed,
  });
  if (!check.ok) return { reason: check.refusal, error: check.message };

  const rawConfidence = Number(f(formData, "confidence"));
  const impact: ValueImpact = {
    impact_id: ids.next("vimpact"),
    case_id,
    effect_ref,
    value_ref,
    expected_direction,
    observed_direction,
    ...((["slight", "moderate", "large"] as const).includes(f(formData, "magnitude") as never)
      ? { magnitude: f(formData, "magnitude") as "slight" | "moderate" | "large" }
      : {}),
    evidence_refs,
    ...(Number.isFinite(rawConfidence) && rawConfidence >= 0 && rawConfidence <= 1
      ? { confidence: rawConfidence }
      : {}),
    observed_at: systemClock.now(),
    record_origin: "REAL",
  };
  if (!validateValueImpact(impact).valid) {
    return { reason: "invalid_impact", error: "רשומת ההשפעה אינה תקינה" };
  }

  await valueImpactStore().append([{ impact, recorded_at: systemClock.now() }]);
  const attached = await attachToCase(case_id, "value_impact_refs", impact.impact_id);
  if (!attached.ok) return { reason: "case_unresolved", error: attached.error };
  return { ok: true, id: impact.impact_id };
}

// ── Form bindings ─────────────────────────────────────────────────────────

export async function recordGapFormAction(_p: LayerState, fd: FormData): Promise<LayerState> {
  const r = await recordGapCore(fd);
  if (r.ok) revalidateAll();
  return r;
}
export async function recordAppraisalFormAction(_p: LayerState, fd: FormData): Promise<LayerState> {
  const r = await recordAppraisalCore(fd);
  if (r.ok) revalidateAll();
  return r;
}
export async function recordTradeoffFormAction(_p: LayerState, fd: FormData): Promise<LayerState> {
  const r = await recordTradeoffCore(fd);
  if (r.ok) revalidateAll();
  return r;
}
