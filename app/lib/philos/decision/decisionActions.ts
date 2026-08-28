"use server";

/**
 * Philos — the two writers of the decision journal.
 *
 * ## Identity is never taken from the form
 *
 * `subject` on a Decision and `reviewer` on a Review both come from the
 * authenticated session, never from a field. This is the same rule
 * `verifyEffectAction.ts` enforces and for the same reason: a person who can
 * name themselves as somebody else can manufacture independence.
 *
 * `record_origin: "REAL"` is likewise set here and only here. Per the
 * record-origin contract, only an authenticated first-party writer confers
 * REAL; nothing that arrives over the wire may claim it.
 *
 * ## What the review writer refuses, and what it merely records
 *
 * REFUSES: reviewing a decision that does not exist; reviewing one that
 * belongs to someone else at a tier the reviewer is not entitled to;
 * reviewing the same decision twice.
 *
 * RECORDS RATHER THAN REFUSES: an over-strong causal claim, and an early
 * review. Both are demoted or flagged, not rejected — refusing would throw
 * away the person's account of what happened, which is the one thing here
 * that cannot be reconstructed later. The demotion is computed by
 * `checkCausalClaim` and the STORED `causal_support` is what was earned, not
 * what was asked for.
 *
 * ## Self-review is allowed, and marked
 *
 * A person reviewing their own low-stakes decision is the normal case and is
 * stored at `self_attested`. What they cannot do is claim `independent` for
 * it: that tier requires a reviewer who is not the decider, checked here.
 * This is the tiering the uniform "every Effect needs a second person" rule
 * lacked — the strict path is intact for `significant` and `public`, and the
 * daily case is no longer blocked behind a second human being.
 */
import { revalidatePath } from "next/cache";

import { createIdGenerator, systemClock } from "../eventStore";
import { resolveViewerContext } from "../identity/viewerContext";
import {
  DAY_MS,
  DEFAULT_HORIZON_DAYS,
  type Decision,
  isStakes,
  requiredTierFor,
  type Stakes,
  tierAtLeast,
  validateDecision,
  type VerificationTier,
  VERIFICATION_TIERS,
} from "./decision";
import {
  CAUSAL_SUPPORT,
  type CausalSupport,
  checkCausalClaim,
  DEFAULT_CAUSAL_SUPPORT,
  type DecisionReview,
  EXPECTATION_OUTCOMES,
  type ExpectationOutcome,
  validateDecisionReview,
} from "./decisionReview";
import { parseOffsetInstant } from "../canon/observation";
import {
  decisionReviewStore,
  decisionStore,
  loadDecisionReviews,
  loadDecisions,
} from "./decisionStore";

const TOUCHED = ["/decisions", "/hub"] as const;

function revalidateAll(): void {
  for (const p of TOUCHED) revalidatePath(p);
}

// ── RECORDING A DECISION ──────────────────────────────────────────────────

export type DecisionRefusal =
  | "fields_incomplete"
  | "horizon_not_in_future"
  | "invalid_decision"
  | "subject_missing";

export type DecisionFormState = {
  ok?: true;
  decision_id?: string;
  error?: string;
  reason?: DecisionRefusal;
};

const DECISION_TEXT: Record<DecisionRefusal, string> = {
  fields_incomplete: "חסרים שדות",
  horizon_not_in_future: "מועד הבדיקה חייב להיות אחרי מועד ההחלטה",
  invalid_decision: "הרשומה אינה תקינה",
  subject_missing: "לא ניתן לזהות מי מחליט — נדרשת כניסה",
};

const DECISION_FIELDS: ReadonlyArray<{ name: string; label: string }> = [
  { name: "statement", label: "מה החלטת" },
  { name: "because", label: "למה" },
  { name: "expected_outcome", label: "מה אתה מצפה שיקרה" },
];



/**
 * `alternatives_considered` arrives as one textarea, one alternative per
 * line — the least ceremonious input that still produces a real list. Blank
 * lines are dropped; nothing is invented to fill an empty box, because an
 * empty box is a real answer that legitimately caps the causal ladder later.
 */
function parseAlternatives(raw: string): string[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");
}

/**
 * The whole write, with no cache invalidation. Split out so tests can drive
 * the real writer against injected stores — `revalidatePath` needs a request
 * scope that a unit test has no business standing up. Same split, and same
 * reason, as `verifyEffectCore` / `verifyEffect`.
 */
export async function recordDecisionCore(formData: FormData): Promise<DecisionFormState> {
  const missing = DECISION_FIELDS.filter(
    (f) => String(formData.get(f.name) ?? "").trim() === "",
  );
  if (missing.length > 0) {
    return {
      reason: "fields_incomplete",
      error: `חסר למילוי: ${missing.map((f) => f.label).join(" · ")}`,
    };
  }

  const viewer = await resolveViewerContext();
  if (!viewer.subject_id) {
    return { reason: "subject_missing", error: DECISION_TEXT.subject_missing };
  }

  const rawStakes = String(formData.get("stakes") ?? "").trim();
  const stakes: Stakes = isStakes(rawStakes) ? rawStakes : "low";

  const rawConfidence = Number(String(formData.get("confidence") ?? "").trim());
  const confidence =
    Number.isFinite(rawConfidence) && rawConfidence >= 0 && rawConfidence <= 1
      ? rawConfidence
      : 0.5;

  const decided_at = systemClock.now();
  const decidedMs = parseOffsetInstant(decided_at);
  if (decidedMs === null) {
    return { reason: "horizon_not_in_future", error: DECISION_TEXT.horizon_not_in_future };
  }

  /* An explicit `review_due` wins when one is supplied (the review screen and
     the tests both pass one); otherwise the horizon is days from now. */
  const explicitDue = String(formData.get("review_due") ?? "").trim();
  const rawDays = Number(String(formData.get("horizon_days") ?? "").trim());
  const days =
    Number.isFinite(rawDays) && rawDays > 0 ? Math.floor(rawDays) : DEFAULT_HORIZON_DAYS;
  const review_due = explicitDue || new Date(decidedMs + days * DAY_MS).toISOString();

  const dueMs = parseOffsetInstant(review_due);
  if (dueMs === null || dueMs <= decidedMs) {
    return { reason: "horizon_not_in_future", error: DECISION_TEXT.horizon_not_in_future };
  }

  const decision: Decision = {
    decision_id: createIdGenerator().next("decision"),
    // SERVER-DERIVED. No form field reaches this.
    subject: viewer.subject_id,
    statement: String(formData.get("statement") ?? "").trim(),
    because: String(formData.get("because") ?? "").trim(),
    expected_outcome: String(formData.get("expected_outcome") ?? "").trim(),
    alternatives_considered: parseAlternatives(String(formData.get("alternatives") ?? "")),
    confidence,
    stakes,
    decided_at,
    review_due,
    // Only this writer, behind this session, confers REAL.
    record_origin: "REAL",
  };

  const validation = validateDecision(decision);
  if (!validation.valid) {
    return { reason: "invalid_decision", error: DECISION_TEXT.invalid_decision };
  }

  await decisionStore().append([{ decision, recorded_at: systemClock.now() }]);
  return { ok: true, decision_id: decision.decision_id };
}

export async function recordDecisionFormAction(
  _prev: DecisionFormState,
  formData: FormData,
): Promise<DecisionFormState> {
  const r = await recordDecisionCore(formData);
  if (r.ok) revalidateAll();
  return r;
}

// ── REVIEWING ONE ─────────────────────────────────────────────────────────

export type ReviewRefusal =
  | "fields_incomplete"
  | "decision_not_found"
  | "already_reviewed"
  | "reviewer_missing"
  | "independent_tier_requires_another_person"
  | "invalid_review";

export type ReviewFormState = {
  ok?: true;
  review_id?: string;
  /** The rung actually earned, so the screen can say what was recorded. */
  causal_support?: CausalSupport;
  /** True when the claim was demoted. The screen must say so plainly. */
  capped?: boolean;
  error?: string;
  reason?: ReviewRefusal;
};

const REVIEW_TEXT: Record<ReviewRefusal, string> = {
  fields_incomplete: "חסרים שדות",
  decision_not_found: "ההחלטה שנבחרה אינה קיימת",
  already_reviewed: "ההחלטה הזו כבר נסקרה — סקירה נרשמת פעם אחת",
  reviewer_missing: "לא ניתן לזהות מי סוקר — נדרשת כניסה",
  independent_tier_requires_another_person:
    "אימות עצמאי מחייב אדם אחר — אי אפשר לאמת בעצמך החלטה שלך",
  invalid_review: "רשומת הסקירה אינה תקינה",
};

const REVIEW_FIELDS: ReadonlyArray<{ name: string; label: string }> = [
  { name: "decision_ref", label: "מזהה ההחלטה" },
  { name: "what_happened", label: "מה קרה בפועל" },
  { name: "expectation_met", label: "האם הציפייה התממשה" },
];

function asOutcome(v: string): ExpectationOutcome {
  return (EXPECTATION_OUTCOMES as readonly string[]).includes(v)
    ? (v as ExpectationOutcome)
    : "cannot_tell";
}

function asTier(v: string): VerificationTier {
  return (VERIFICATION_TIERS as readonly string[]).includes(v)
    ? (v as VerificationTier)
    : "self_attested";
}

function asSupport(v: string): CausalSupport {
  return (CAUSAL_SUPPORT as readonly string[]).includes(v)
    ? (v as CausalSupport)
    : DEFAULT_CAUSAL_SUPPORT;
}

/** See `recordDecisionCore` for why the revalidation is not in here. */
export async function recordReviewCore(formData: FormData): Promise<ReviewFormState> {
  const missing = REVIEW_FIELDS.filter((f) => String(formData.get(f.name) ?? "").trim() === "");
  if (missing.length > 0) {
    return {
      reason: "fields_incomplete",
      error: `חסר למילוי: ${missing.map((f) => f.label).join(" · ")}`,
    };
  }

  const viewer = await resolveViewerContext();
  if (!viewer.subject_id) {
    return { reason: "reviewer_missing", error: REVIEW_TEXT.reviewer_missing };
  }

  const decision_ref = String(formData.get("decision_ref") ?? "").trim();
  const [decisions, reviews] = await Promise.all([loadDecisions(), loadDecisionReviews()]);

  const stored = decisions.find((r) => r.decision.decision_id === decision_ref);
  if (!stored) return { reason: "decision_not_found", error: REVIEW_TEXT.decision_not_found };
  if (reviews.some((r) => r.review.decision_ref === decision_ref)) {
    return { reason: "already_reviewed", error: REVIEW_TEXT.already_reviewed };
  }

  const verification_tier = asTier(String(formData.get("verification_tier") ?? "").trim());
  const reviewer = viewer.subject_id;

  /* THE ONE HARD REFUSAL ON TIER. A person may self-attest anything at
     `self_attested` or `measured`; they may not call their own review
     independent. This is `independentEvidence.ts`'s rule applied at the
     journal's own boundary, not a softer copy of it. */
  if (verification_tier === "independent" && reviewer === stored.decision.subject) {
    return {
      reason: "independent_tier_requires_another_person",
      error: REVIEW_TEXT.independent_tier_requires_another_person,
    };
  }

  const expectation_met = asOutcome(String(formData.get("expectation_met") ?? "").trim());
  const comparison_basis = String(formData.get("comparison_basis") ?? "").trim();
  const surprise = String(formData.get("surprise") ?? "").trim();
  const reviewed_at = systemClock.now();

  /* The claim is checked, never trusted. What gets stored is what the
     evidence earns — see `checkCausalClaim`. */
  const claim = checkCausalClaim({
    claimed: asSupport(String(formData.get("causal_support") ?? "").trim()),
    decision: stored.decision,
    expectation_met,
    verification_tier,
    comparison_basis: comparison_basis || undefined,
  });

  const dueMs = parseOffsetInstant(stored.decision.review_due);
  const nowMs = parseOffsetInstant(reviewed_at);

  const review: DecisionReview = {
    review_id: createIdGenerator().next("review"),
    decision_ref,
    reviewer,
    what_happened: String(formData.get("what_happened") ?? "").trim(),
    expectation_met,
    ...(surprise ? { surprise } : {}),
    verification_tier,
    ...(comparison_basis ? { comparison_basis } : {}),
    causal_support: claim.entitled,
    reviewed_at,
    reviewed_early: dueMs !== null && nowMs !== null && nowMs < dueMs,
    record_origin: "REAL",
  };

  const validation = validateDecisionReview(review);
  if (!validation.valid) {
    return { reason: "invalid_review", error: REVIEW_TEXT.invalid_review };
  }

  await decisionReviewStore().append([{ review, recorded_at: systemClock.now() }]);
  return {
    ok: true,
    review_id: review.review_id,
    causal_support: claim.entitled,
    capped: claim.capped,
  };
}

export async function recordReviewFormAction(
  _prev: ReviewFormState,
  formData: FormData,
): Promise<ReviewFormState> {
  const r = await recordReviewCore(formData);
  if (r.ok) revalidateAll();
  return r;
}

/** Exposed for the screen so it can show the floor before anything is typed. */
export async function requiredTierForStakes(stakes: Stakes): Promise<VerificationTier> {
  return requiredTierFor(stakes);
}

/** Exposed for tests and for the screen's "why is this greyed out" copy. */
export async function tierSatisfies(
  actual: VerificationTier,
  stakes: Stakes,
): Promise<boolean> {
  return tierAtLeast(actual, requiredTierFor(stakes));
}
