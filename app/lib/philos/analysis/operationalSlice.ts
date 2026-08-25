/**
 * OPERATIONAL SLICE — the rest of the chain, on the SAME event.
 *
 * This module creates NO new Event, Observation or fixture. It imports
 * `scenario_billionaire_claim_v1` / `obs_scenario_billionaire_claim_v1` from
 * `acceptanceScenario.ts` and carries that one graph forward through
 * Orientation → Tension → Need → Offer → Match → Authority → Commitment →
 * Action → Effect → Evidence → Learning → State(t1) → Day Closing.
 *
 * EVERYTHING HERE IS SIMULATED, AND SAYS SO. Every object carries
 * `provenance: "DEMO / SIMULATION / ACCEPTANCE_SCENARIO"`. The Action is a
 * recorded simulation of a workflow, never a claim that anything happened in
 * the world: no store is written, no message is sent, no reviewer is
 * contacted. `writer` names which component WOULD own the write in a real
 * implementation — it is documentation of the boundary, not a live wire.
 *
 * TENSION IS NOT A NEED. The only Need created here is the one operational
 * gap that is actually verified: the source exists and nothing has been
 * routed to an independent reviewer. No Need is derived from the ALLEGATIONS,
 * because an unreviewed allegation establishes no operational deficit. In
 * particular there is no fundraising Need (no resource gap is measured), no
 * immediate-danger Need (no danger is established by a screenshot), and no
 * real ValueGroup (none is linked).
 *
 * NOTHING HERE DECIDES THE CLAIMS. No object below concludes that either
 * claim is true or false. The Learning is about whether the ROUTE worked,
 * never about guilt, and the Effect is internal to this system.
 */
import {
  ACCEPTANCE_SCENARIO_CLASSIFICATION, SCENARIO_EVENT_ID, SCENARIO_OBSERVATION_ID,
  SCENARIO_PERSON_ID,
  loadAcceptanceScenario, type ProjectionSection,
} from "./acceptanceScenario";

export const SIM = ACCEPTANCE_SCENARIO_CLASSIFICATION;

/* ── OPM object registry ─────────────────────────────────────────────────
   Every object in the chain, with the eight facts this pass requires. */

export type OpmStatus = "CANON" | "IMPLEMENTED" | "SOURCE" | "SYNTHESIS" | "GAP";

export interface OpmObject {
  object: string;
  id: string;
  schema: string;
  provenance: string;
  state: string;
  sourceRefs: string[];
  /** Which module WOULD own the write. Documentation of a boundary. */
  writer: string;
  reader: string;
  consumers: string[];
  status: OpmStatus;
}

const S = loadAcceptanceScenario();

/* ── Orientation & Tension ───────────────────────────────────────────── */

export interface Tension {
  tension_id: string;
  between: string;
  /** A tension is a relation, never an instruction and never a Need. */
  note: string;
  status: "OPEN" | "UNRESOLVED";
}

export const ORIENTATION = {
  orientation_id: "ori_scenario_billionaire_v1",
  event_ref: SCENARIO_EVENT_ID,
  observation_ref: SCENARIO_OBSERVATION_ID,
  reading: "מקור פורסם ותועד; תוכנו אינו מאומת; אין גורם בודק; הגורם הפועל הוא נושא הטענה.",
  provenance: SIM,
} as const;

export const TENSIONS: readonly Tension[] = [
  { tension_id: "ten_truth_vs_presumption", between: "אמת ↔ חזקת חפות",
    note: "פרסום מול הגנה על מי שלא הורשע. אינו מייצר צורך.", status: "OPEN" },
  { tension_id: "ten_protection_vs_privacy", between: "הגנה ↔ פרטיות",
    note: "בטיחות אחרים מול חשיפת פרטים. אינו מייצר צורך.", status: "OPEN" },
  { tension_id: "ten_actor_is_subject", between: "פעולה ↔ סמכות",
    note: "הגורם הפועל הוא נושא הטענה. זה כן מייצר פער תפעולי.", status: "OPEN" },
];

/* ── Need — exactly one, from the verified operational gap ───────────── */

export const NEED = {
  need_id: "need_preserve_and_route_for_review",
  desired_change:
    "שמירת המקור והעברת שתי הטענות לבדיקה עצמאית, ללא שליטת נושא הטענה בתהליך.",
  derived_from: "ten_actor_is_subject",
  /* Stated so no reader infers the Need came from the allegations. */
  basis: "פער תפעולי מאומת: המקור קיים, ואף גורם בודק לא קיבל אותו.",
  not_derived_from: ["תוכן הטענות", "סכנה מיידית (לא הוכחה)", "פער משאבים (לא נמדד)"],
  provenance: SIM,
  state: "OPEN",
} as const;

/* ── Capability / Resource / Offer — simulated, labelled ─────────────── */

export interface SimObject {
  id: string;
  kind: "capability" | "resource" | "offer";
  label: string;
  note: string;
  provenance: string;
}

export const CAPABILITIES: readonly SimObject[] = [
  { id: "cap_evidence_preservation", kind: "capability", label: "שימור ראיות",
    note: "יכולת ליצור עותק משומר של המקור עם חותמת זמן.", provenance: SIM },
  { id: "cap_independent_review", kind: "capability", label: "בדיקה עצמאית",
    note: "יכולת לבחון טענות ללא זיקה לנושא הטענה.", provenance: SIM },
];

export const RESOURCES: readonly SimObject[] = [
  { id: "res_secure_source_package", kind: "resource", label: "חבילת מקור מאובטחת",
    note: "המקור השמור, ארוז להעברה לגורם בודק.", provenance: SIM },
];

export const OFFERS: readonly SimObject[] = [
  { id: "off_independent_review", kind: "offer", label: "הצעת בדיקה עצמאית",
    note: "גורם בודק מדומה המציע לקבל את החבילה ולבחון אותה.", provenance: SIM },
];

/* ── Consent & independent authority — the two records the chain was
   missing. Without them CONSENT could never pass, and a Commitment existed
   downstream of a Match that was never permitted. ───────────────────────── */

/**
 * CONSENT IS NOT AUTHORITY. They answer different questions and are held by
 * different people:
 *
 *   ConsentRecord              "may this source be routed?"  — the USER's to
 *                              give. It is their own material, and agreeing
 *                              to hand it to a reviewer is neither
 *                              self-verification nor a change to any Claim,
 *                              Evidence, confidence or review status.
 *   IndependentAuthorityDecision "may this action proceed?"  — the REVIEWER's
 *                              to decide. The reviewer never supplies consent
 *                              on the user's behalf.
 *
 * Collapsing the two is what produced the earlier error, where a reviewer
 * appeared to consent for the person whose material it was.
 */
export interface ConsentRecord {
  consent_id: string;
  /** The USER. Consenting to routing is theirs to give. */
  granted_by: string;
  grants: string;
  /** Machine-readable scope. Nothing beyond this is consented to. */
  scope: string;
  scope_note: string;
  sourceRefs: string[];
  provenance: string;
  recorded_at: string;
}

export interface IndependentAuthorityDecision {
  decision_id: string;
  /** The reviewer's own id — distinct from the consenting user. */
  decided_by: string;
  /** Kept as an alias of `decided_by` for existing readers. */
  reviewer_id: string;
  decision: "APPROVED" | "REFUSED";
  approves: string;
  /** What the approval does NOT cover, said on the record. */
  excludes: string[];
  sourceRefs: string[];
  provenance: string;
  recorded_at: string;
}

const DECIDED_AT = "2026-08-23T10:00:00Z";

export const CONSENT_RECORD: ConsentRecord = {
  consent_id: "consent_route_source_to_review",
  /* THE USER. This is their own source material; agreeing to route it to an
     independent reviewer is a permission only they can give, and giving it
     grants them nothing over the review's outcome. */
  granted_by: SCENARIO_PERSON_ID,
  grants: "הסכמת המשתמש להעביר את המקור לבדיקה עצמאית.",
  scope: "preserve_and_route_source_for_independent_review",
  scope_note:
    "העברת המקור בלבד. אינה אימות עצמי, אינה משנה Claim או Evidence, ואינה משנה confidence או review status.",
  sourceRefs: [SCENARIO_OBSERVATION_ID, "off_independent_review"],
  provenance: SIM,
  recorded_at: DECIDED_AT,
};

export const AUTHORITY_DECISION: IndependentAuthorityDecision = {
  decision_id: "authdec_approve_preserve_and_route",
  /* The reviewer APPROVES the action. They do not, and cannot, supply the
     user's consent — that record above is the user's alone. */
  decided_by: "reviewer_independent_fixture",
  reviewer_id: "reviewer_independent_fixture",
  decision: "APPROVED",
  approves: "פעולת שמירת המקור והעברתו לבדיקה עצמאית.",
  excludes: [
    "אינו מאשר שהטענות נכונות או שגויות",
    "אינו סוגר את האירוע",
    "אינו משנה confidence או review status של אף Claim",
    "אינו נותן Consent בשם המשתמש",
  ],
  sourceRefs: [CONSENT_RECORD.consent_id, "match_need_review_v1"],
  provenance: SIM,
  recorded_at: DECIDED_AT,
};

/* ── Match gates — each judged separately ────────────────────────────── */

export type GateValue = "TRUE" | "FALSE" | "UNKNOWN";

export interface Gate {
  gate: "CAN" | "WANTS" | "ALLOWED" | "APPROPRIATE" | "AVAILABLE" | "CONSENT";
  value: GateValue;
  because: string;
  sourceRefs: string[];
}

/**
 * UNKNOWN IS NOT FALSE AND NOT ZERO. A gate with no evidence reads UNKNOWN
 * and blocks the match exactly as FALSE would — but it is recorded as a
 * missing answer, because the two call for different next steps.
 *
 * CONSENT now passes because `CONSENT_RECORD` exists and names who granted
 * it. Before that record was added this read UNKNOWN, which is precisely why
 * a Commitment downstream of it was a causal contradiction.
 */
export const GATES: readonly Gate[] = [
  { gate: "CAN", value: "TRUE",
    because: "cap_evidence_preservation ו-cap_independent_review קיימות בסימולציה.",
    sourceRefs: ["cap_evidence_preservation", "cap_independent_review"] },
  { gate: "WANTS", value: "TRUE", because: "need_preserve_and_route_for_review נרשם.",
    sourceRefs: ["need_preserve_and_route_for_review"] },
  { gate: "ALLOWED", value: "TRUE",
    because: "אושר על ידי בודק עצמאי; שימור והעברה אינם חושפים פרטים מוגנים.",
    sourceRefs: [AUTHORITY_DECISION.decision_id] },
  { gate: "APPROPRIATE", value: "TRUE",
    because: "מענה לפער התפעולי בלבד; אינו מכריע בטענות.",
    sourceRefs: ["need_preserve_and_route_for_review"] },
  { gate: "AVAILABLE", value: "TRUE", because: "off_independent_review פתוחה בסימולציה.",
    sourceRefs: ["off_independent_review"] },
  { gate: "CONSENT", value: "TRUE",
    because: "consent_route_source_to_review נרשמה על ידי המשתמש עצמו — הסכמה להעברת המקור, לא אימות עצמי.",
    sourceRefs: [CONSENT_RECORD.consent_id] },
];

/** All six TRUE, or the match is not permitted. Derived, never asserted. */
export function allGatesPass(): boolean {
  return GATES.every((g) => g.value === "TRUE");
}

export const MATCH = {
  match_id: "match_need_review_v1",
  need_ref: NEED.need_id,
  offer_ref: "off_independent_review",
  /* DERIVED from the gates. If any gate regresses to FALSE or UNKNOWN this
     becomes `not_permitted`, and every stage below refuses to exist. */
  decision: (allGatesPass() ? "PERMITTED" : "not_permitted_pending_gates") as
    "PERMITTED" | "not_permitted_pending_gates",
  because: allGatesPass()
    ? "כל ששת השערים עברו, כולל CONSENT שנרשמה על ידי הבודק העצמאי."
    : "שער אחד לפחות אינו TRUE. שער ללא תשובה חוסם בדיוק כמו שער שלילי.",
  authority_ref: AUTHORITY_DECISION.decision_id,
  consent_ref: CONSENT_RECORD.consent_id,
  sourceRefs: [NEED.need_id, "off_independent_review", CONSENT_RECORD.consent_id,
    AUTHORITY_DECISION.decision_id],
  provenance: SIM,
};

/** THE CAUSAL GATE. Nothing downstream of Match may exist without this. */
export function matchPermitted(): boolean {
  return MATCH.decision === "PERMITTED";
}

/* ── Authority — the independent reviewer is a SEPARATE fixture ──────── */

export const AUTHORITY = {
  conflictOfInterest: S.conflictOfInterest,
  independentReviewRequired: S.independentReviewRequired,
  /* A distinct actor. Not the subject, not the viewer. */
  reviewer: {
    id: "reviewer_independent_fixture",
    label: "גורם בודק עצמאי (fixture נפרד)",
    relation_to_subject: "none",
    provenance: SIM,
  },
  consent: CONSENT_RECORD,
  decision: AUTHORITY_DECISION,
  subjectMayNot: [
    "לאמת את עצמו",
    "לבחור לבדו את הגוף הבודק",
    "לשנות confidence או review status",
    "לסגור Claim או Event",
    "לסמן Evidence כ-verified",
    "לאשר את הפעולה בעצמו — האישור שמור לבודק העצמאי",
  ],
  grant: {
    granted_by: "reviewer_independent_fixture",
    grants: "קבלת חבילת המקור ופתיחת בדיקה",
    scope: "DEMO / SIMULATION only — never a REAL write",
    provenance: SIM,
  },
} as const;

/* ── Commitment → Action → Effect → Evidence → Learning ──────────────────

   THE GATE IS A RUNTIME DERIVATION, AND A TEST IS WHAT ENFORCES IT.

   Each of these is derived as `null` when the stage before it is absent, so
   when `matchPermitted()` is false the whole tail evaluates to `null` and no
   Commitment, Action, Effect or Learning exists to render.

   To be exact about what checks what: TypeScript verifies the TYPES — that
   every reader handles the `| null` case — and nothing more. It does not
   observe a gate changing value at runtime, and it would not fail merely
   because a gate flipped. The runtime behaviour is asserted by the test
   `an unpermitted Match produces nothing downstream`, which is the actual
   guarantee. The types make the null case impossible to ignore; the test
   makes the derivation impossible to break silently. */

export interface Commitment {
  commitment_id: string; match_ref: string; need_ref: string;
  authorized_by: string; state: string; sourceRefs: string[]; provenance: string;
}

export const COMMITMENT: Commitment | null = matchPermitted() ? {
  commitment_id: "com_route_for_independent_review",
  match_ref: MATCH.match_id,
  need_ref: NEED.need_id,
  authorized_by: AUTHORITY_DECISION.decision_id,
  state: "RECORDED",
  sourceRefs: [MATCH.match_id, AUTHORITY_DECISION.decision_id],
  provenance: SIM,
} : null;

export interface SimAction {
  action_id: string; name: string; need_ref: string; match_ref: string;
  commitment_ref: string; authority_ref: string; state: string;
  /** Where this ran. Never the world. */
  executionScope: "SYSTEM_SIMULATION";
  worldExecution: false;
  reality: string; sourceRefs: string[]; provenance: string;
}

export const ACTION: SimAction | null = COMMITMENT ? {
  action_id: "act_preserve_external_signal_and_submit_for_independent_review",
  name: "preserve_external_signal_and_submit_for_independent_review",
  need_ref: NEED.need_id,
  match_ref: MATCH.match_id,
  commitment_ref: COMMITMENT.commitment_id,
  authority_ref: AUTHORITY_DECISION.decision_id,
  state: "AUTHORIZED · RECORDED",
  executionScope: "SYSTEM_SIMULATION",
  worldExecution: false,
  reality: "DEMO / SIMULATION — לא בוצעה פעולה בעולם. לא נשלחה הודעה ולא נוצר קשר עם גורם אמיתי.",
  sourceRefs: [COMMITMENT.commitment_id],
  provenance: SIM,
} : null;

export interface SimEffect {
  effect_id: string; action_ref: string; claimed_outcome: string;
  scope: string; does_not_establish: string; state: string;
  sourceRefs: string[]; provenance: string;
}

export const EFFECT: SimEffect | null = ACTION ? {
  effect_id: "eff_source_preserved_and_review_requested",
  action_ref: ACTION.action_id,
  claimed_outcome: "עותק המקור נשמר ונוצרה בקשת בדיקה עצמאית במערכת.",
  scope: "INTERNAL_TO_SYSTEM — רשומות בתוך המערכת בלבד",
  does_not_establish: "אינו מוכיח שהטענות נכונות או שגויות.",
  state: "RECORDED",
  sourceRefs: [ACTION.action_id],
  provenance: SIM,
} : null;

export interface EffectEvidence {
  evidence_id: string;
  establishes: string;
  action_ref: string;
  verification: "VERIFIED" | "UNVERIFIED";
  sourceRefs: string[];
  provenance: string;
}

export const EFFECT_EVIDENCE: readonly EffectEvidence[] = ACTION ? [
  { evidence_id: "ev_preserved_source_record", establishes: "קיום רשומת המקור השמורה.",
    action_ref: ACTION.action_id, verification: "VERIFIED",
    sourceRefs: [ACTION.action_id], provenance: SIM },
  { evidence_id: "ev_review_request_record", establishes: "קיום רשומת בקשת הבדיקה.",
    action_ref: ACTION.action_id, verification: "VERIFIED",
    sourceRefs: [ACTION.action_id], provenance: SIM },
  { evidence_id: "ev_authority_decision_record",
    establishes: "קיום רשומת אישור הבודק העצמאי ורשומת ההסכמה.",
    action_ref: ACTION.action_id, verification: "VERIFIED",
    sourceRefs: [AUTHORITY_DECISION.decision_id, CONSENT_RECORD.consent_id], provenance: SIM },
] : [];

export interface SimLearning {
  learning_id: string; statement: string;
  derived_from: { action: string; effect: string; evidence: string[] };
  excludes: string[]; sourceRefs: string[]; provenance: string;
}

export const LEARNING: SimLearning | null = (ACTION && EFFECT) ? {
  learning_id: "lrn_preservation_route_works",
  statement: "המסלול לשמירת מקור ולהעברה לבדיקה עצמאית פעל בסימולציה.",
  derived_from: { action: ACTION.action_id, effect: EFFECT.effect_id,
    evidence: EFFECT_EVIDENCE.map((e) => e.evidence_id) },
  excludes: ["אשמה", "אמת הטענות", "כשל המשטרה"],
  sourceRefs: [EFFECT.effect_id, ...EFFECT_EVIDENCE.map((e) => e.evidence_id)],
  provenance: SIM,
} : null;

/* ── State — t1 ADDS, it never overwrites t0 ─────────────────────────── */

export interface SliceState {
  state_id: string;
  at: "t0" | "t1";
  facts: string[];
  sourceRefs: string[];
  provenance: string;
}

export const STATE_T0: SliceState = {
  state_id: "state_t0_scenario_billionaire_v1", at: "t0",
  facts: [
    "אירוע התקבל.",
    "שתי Claims תחת בדיקה.",
    "מקור פורסם, תוכנו אינו מאומת.",
  ],
  sourceRefs: [SCENARIO_EVENT_ID, SCENARIO_OBSERVATION_ID],
  provenance: SIM,
};

export const STATE_T1: SliceState = {
  state_id: "state_t1_scenario_billionaire_v1", at: "t1",
  facts: [
    "המקור נשמר.",
    "בקשת בדיקה עצמאית נפתחה.",
    "שתי Claims נותרות UNDER_REVIEW.",
  ],
  sourceRefs: EFFECT ? [EFFECT.effect_id] : [],
  provenance: SIM,
};

/* ── The five Evidence records, each named and explained ─────────────── */

export interface EvidenceLine {
  evidence_id: string;
  meaning: string;
  verification: string;
  relation: string;
  sourceRefs: string[];
}

/**
 * All five, scenario evidence and effect evidence together. Never a count:
 * "3 verified" tells a reader nothing about WHAT was verified, and the whole
 * point of this scenario is that a verified record can still establish far
 * less than the claim it sits next to.
 */
export function evidenceLines(): EvidenceLine[] {
  const scen = loadAcceptanceScenario().evidence.map((e) => ({
    evidence_id: e.evidence_id,
    meaning: e.establishes,
    verification: e.verification,
    relation: e.relation,
    sourceRefs: [SCENARIO_OBSERVATION_ID],
  }));
  const eff = EFFECT_EVIDENCE.map((e) => ({
    evidence_id: e.evidence_id,
    meaning: e.establishes,
    verification: e.verification,
    /* Effect evidence is about the SYSTEM's own action, not about a claim. */
    relation: "about_action_not_claim",
    sourceRefs: e.sourceRefs,
  }));
  return [...scen, ...eff];
}

/** Records about the publication. This is the count the header reports. */
export function sourceEvidence(): EvidenceLine[] {
  return evidenceLines().filter((e) => e.relation !== "about_action_not_claim");
}

/** Records about the system's own simulated action. Never added to the above. */
export function effectEvidence(): EvidenceLine[] {
  return evidenceLines().filter((e) => e.relation === "about_action_not_claim");
}

/** Contradicting records. Verified or not — contradiction is a separate axis. */
export function contradictoryEvidence(): EvidenceLine[] {
  return evidenceLines().filter((e) => e.relation === "contradicting");
}

/* ── EventComplete ───────────────────────────────────────────────────── */

export interface CompletenessCheck { condition: string; met: boolean; because: string }

export const COMPLETENESS: readonly CompletenessCheck[] = [
  /* LINKED, not VERIFIED. User, Person, Actor and SubjectOfClaim all resolve
     to one personId, so the identity IS linked. Whether that identity has
     been verified is a different question, reported separately below and
     deliberately NOT substituted into this formula. */
  { condition: "IdentityLinked", met: true,
    because: "User, Person, Actor ו-SubjectOfClaim מפנים לאותו personId." },
  { condition: "ProvenancePresent", met: true, because: "מקור, זמן קליטה ו-provenance רשומים." },
  { condition: "ObservationAtomic", met: true, because: "Observation אחת תחת Event אחד." },
  { condition: "ClaimsSeparated", met: true, because: "שתי Claims נפרדות." },
  { condition: "AuthorityValid", met: matchPermitted(),
    because: "בודק עצמאי אישר, והסכמה נרשמה על ידו — לא על ידי נושא הטענה." },
  { condition: "ActionLinked", met: ACTION !== null,
    because: "Action מקושרת ל-Need, Match, Commitment ו-Authority." },
  { condition: "EffectLinked", met: EFFECT !== null, because: "Effect מקושר ל-action_ref." },
  { condition: "EvidenceReviewed", met: false,
    because: "ראיות האירוע החיצוני טרם נבדקו; שתי Claims UNDER_REVIEW." },
];

/**
 * A SEPARATE REPORT, not a completeness condition. The original
 * `EventComplete` formula names `IdentityLinked`, and swapping `Verified` in
 * would quietly change what that formula means. Verification is surfaced on
 * its own so a reader sees both facts without either overwriting the other.
 */
export const IDENTITY_VERIFIED = {
  field: "IdentityVerified",
  state: "UNRESOLVED" as const,
  because: "התרחיש אינו נוקב בשם ואין מקור מאמת. הזהות מקושרת, לא מאומתת.",
  personId: SCENARIO_PERSON_ID,
};

export function eventComplete(): boolean {
  return COMPLETENESS.every((c) => c.met);
}

export function eventState(): "OPEN" | "PARTIAL" | "CLOSED" {
  if (eventComplete()) return "CLOSED";
  return COMPLETENESS.some((c) => c.met) ? "PARTIAL" : "OPEN";
}

/* ── OPM registry — every object the brief names ─────────────────────── */

const R = (o: Omit<OpmObject, "provenance"> & { provenance?: string }): OpmObject =>
  ({ provenance: SIM, ...o }) as OpmObject;

const FIXTURE = "acceptanceScenario.ts";
const SLICE = "operationalSlice.ts";
const PROJ = "terminalProjection() / operationalProjection()";

export const OPM_REGISTRY: readonly OpmObject[] = [
  R({ object: "Person", id: "scenario_person_subject", schema: "RoleHolder", state: "UNRESOLVED",
    sourceRefs: [SCENARIO_OBSERVATION_ID], writer: FIXTURE, reader: "loadAcceptanceScenario()",
    consumers: ["all 7 terminals"], status: "SOURCE" }),
  R({ object: "Context", id: "scenario_wealth_context", schema: "RoleHolder",
    state: "WEALTH_POWER_CONTEXT", sourceRefs: [SCENARIO_OBSERVATION_ID], writer: FIXTURE,
    reader: "loadAcceptanceScenario()", consumers: ["Community", "Planet"], status: "SOURCE" }),
  R({ object: "Event", id: SCENARIO_EVENT_ID, schema: "ScenarioEvent", state: eventState(),
    sourceRefs: [SCENARIO_OBSERVATION_ID], writer: FIXTURE, reader: "loadAcceptanceScenario()",
    consumers: ["all 7 terminals"], status: "SOURCE" }),
  R({ object: "Claim", id: "claim_a_person · claim_b_institutions", schema: "ScenarioClaim",
    state: "REPORTED / UNDER_REVIEW", sourceRefs: [SCENARIO_OBSERVATION_ID], writer: FIXTURE,
    reader: "loadAcceptanceScenario()", consumers: ["Brain", "World", "Day Closing"], status: "SOURCE" }),
  R({ object: "Observation", id: SCENARIO_OBSERVATION_ID, schema: "ScenarioObservation",
    state: "UNDER_REVIEW", sourceRefs: ["ev_publication_capture"], writer: FIXTURE,
    reader: "loadAcceptanceScenario()", consumers: ["Brain", "Dynamics", "World"], status: "SOURCE" }),
  R({ object: "Evidence", id: evidenceLines().map((e) => e.evidence_id).join(" · "),
    schema: "ScenarioEvidence + EffectEvidence", state: "3 VERIFIED · 1 UNVERIFIED · 1 CONTRADICTING",
    sourceRefs: [SCENARIO_OBSERVATION_ID], writer: `${FIXTURE} + ${SLICE}`,
    reader: "evidenceLines()", consumers: ["Brain", "Day Closing"], status: "SOURCE" }),
  R({ object: "State", id: `${STATE_T0.state_id} · ${STATE_T1.state_id}`, schema: "SliceState",
    state: "t0 preserved · t1 added", sourceRefs: STATE_T1.sourceRefs, writer: SLICE,
    reader: PROJ, consumers: ["Dynamics", "Day Closing"], status: "SYNTHESIS" }),
  R({ object: "Orientation", id: ORIENTATION.orientation_id, schema: "ORIENTATION", state: "DERIVED",
    sourceRefs: [SCENARIO_OBSERVATION_ID], writer: SLICE, reader: PROJ,
    consumers: ["Hub", "Dynamics"], status: "SYNTHESIS" }),
  R({ object: "Tension", id: TENSIONS.map((t) => t.tension_id).join(" · "), schema: "Tension",
    state: "OPEN", sourceRefs: [ORIENTATION.orientation_id], writer: SLICE, reader: PROJ,
    consumers: ["World", "Dynamics"], status: "SYNTHESIS" }),
  R({ object: "Need", id: NEED.need_id, schema: "NEED", state: NEED.state,
    sourceRefs: ["ten_actor_is_subject"], writer: SLICE, reader: PROJ,
    consumers: ["Marketplace", "Community"], status: "SYNTHESIS" }),
  R({ object: "Capability", id: CAPABILITIES.map((c) => c.id).join(" · "), schema: "SimObject",
    state: "SIMULATED", sourceRefs: [NEED.need_id], writer: SLICE, reader: PROJ,
    consumers: ["Marketplace", "Community"], status: "SYNTHESIS" }),
  R({ object: "Resource", id: "res_secure_source_package", schema: "SimObject", state: "SIMULATED",
    sourceRefs: [SCENARIO_OBSERVATION_ID], writer: SLICE, reader: PROJ,
    consumers: ["Marketplace"], status: "SYNTHESIS" }),
  R({ object: "Offer", id: "off_independent_review", schema: "SimObject", state: "SIMULATED",
    sourceRefs: ["cap_independent_review"], writer: SLICE, reader: PROJ,
    consumers: ["Marketplace"], status: "SYNTHESIS" }),
  R({ object: "Match", id: MATCH.match_id, schema: "MATCH", state: MATCH.decision,
    sourceRefs: MATCH.sourceRefs, writer: SLICE, reader: PROJ,
    consumers: ["Marketplace"], status: "SYNTHESIS" }),
  R({ object: "Commitment", id: COMMITMENT?.commitment_id ?? "—", schema: "Commitment",
    state: COMMITMENT?.state ?? "BLOCKED — match not permitted",
    sourceRefs: COMMITMENT?.sourceRefs ?? [], writer: SLICE, reader: PROJ,
    consumers: ["Marketplace"], status: COMMITMENT ? "SYNTHESIS" : "GAP" }),
  R({ object: "Action", id: ACTION?.action_id ?? "—", schema: "SimAction",
    state: ACTION ? `${ACTION.state} · ${ACTION.executionScope}` : "BLOCKED",
    sourceRefs: ACTION?.sourceRefs ?? [], writer: SLICE, reader: PROJ,
    consumers: ["Dynamics", "Marketplace", "Day Closing"], status: ACTION ? "SYNTHESIS" : "GAP" }),
  R({ object: "Effect", id: EFFECT?.effect_id ?? "—", schema: "SimEffect",
    state: EFFECT?.state ?? "BLOCKED", sourceRefs: EFFECT?.sourceRefs ?? [], writer: SLICE,
    reader: PROJ, consumers: ["Dynamics", "Day Closing"], status: EFFECT ? "SYNTHESIS" : "GAP" }),
  R({ object: "Learning", id: LEARNING?.learning_id ?? "—", schema: "SimLearning",
    state: LEARNING ? "DERIVED" : "BLOCKED", sourceRefs: LEARNING?.sourceRefs ?? [],
    writer: SLICE, reader: PROJ, consumers: ["Brain", "Dynamics", "Day Closing"],
    status: LEARNING ? "SYNTHESIS" : "GAP" }),
  R({ object: "ConsentRecord", id: CONSENT_RECORD.consent_id, schema: "ConsentRecord",
    state: CONSENT_RECORD.scope, sourceRefs: CONSENT_RECORD.sourceRefs, writer: SLICE,
    reader: PROJ, consumers: ["Marketplace", "Day Closing"], status: "SYNTHESIS" }),
  R({ object: "IndependentAuthorityDecision", id: AUTHORITY_DECISION.decision_id,
    schema: "IndependentAuthorityDecision", state: AUTHORITY_DECISION.decision,
    sourceRefs: AUTHORITY_DECISION.sourceRefs, writer: SLICE, reader: PROJ,
    consumers: ["Marketplace", "Day Closing"], status: "SYNTHESIS" }),
  R({ object: "DaySummary", id: "day_scenario_billionaire_v1", schema: "DayClosing",
    state: eventState(), sourceRefs: [SCENARIO_EVENT_ID], writer: SLICE, reader: "dayClosing()",
    consumers: ["Hub", "Dynamics"], status: "SYNTHESIS" }),
  /* ── The value layer. CANDIDATE where a source exists, UNRESOLVED where
        no Canon mapping does. Nothing here invents a mapping. ─────────── */
  R({ object: "Value", id: "אמת · צדק · הגנה · אחריות · כבוד", schema: "value candidate",
    state: "CANDIDATE", sourceRefs: ["claim_a_person", "claim_b_institutions"], writer: SLICE,
    reader: PROJ, consumers: ["Brain", "World"], status: "SYNTHESIS" }),
  R({ object: "ValueFamily", id: "—", schema: "ValueFamily", state: "UNRESOLVED",
    sourceRefs: [], writer: "—", reader: "—", consumers: ["Brain"], status: "GAP" }),
  R({ object: "GeneralValue", id: "—", schema: "GeneralValue", state: "UNRESOLVED",
    sourceRefs: [], writer: "—", reader: "—", consumers: ["Brain"], status: "GAP" }),
  R({ object: "ValueGroup", id: "—", schema: "ValueGroup", state: "UNRESOLVED",
    sourceRefs: [], writer: "—", reader: "—", consumers: ["Community", "Planet"], status: "GAP" }),
];

/* ── Day Closing ─────────────────────────────────────────────────────── */

export interface ImpactField { area: string; value: string; source: string | null }

export const IMPACTS: readonly ImpactField[] = [
  { area: "כלכלית", value: "UNKNOWN", source: null },
  { area: "ארגונית", value: "UNKNOWN", source: null },
  { area: "ציבורית", value: "UNKNOWN", source: null },
  { area: "קהילתית", value: "UNKNOWN", source: null },
  { area: "מערכתית", value: "UNKNOWN", source: null },
  { area: "בטיחות אחרים", value: "UNKNOWN", source: null },
  { area: "אמון ציבורי", value: "UNKNOWN", source: null },
];

export function dayClosing(): ProjectionSection[] {
  const s = loadAcceptanceScenario();
  return [
    { label: "אירוע ותצפית", colorRole: "white", rows: [
      { k: "EVENT_ID", v: s.event.event_id, status: eventState() },
      { k: "OBSERVATION_ID", v: s.observation.observation_id, status: "UNDER_REVIEW" },
      { k: "סיווג", v: s.classification, status: "DEMO" },
    ]},
    { label: "Claims", colorRole: "yellow", rows: s.claims.map((c) => ({
      k: c.claim_id, v: c.statement, status: `${c.reported} / ${c.review}` })) },
    /* FOUR CATEGORIES, RECONCILED. The header reports Source Evidence = 2.
       Three more records exist and are about the SYSTEM'S OWN ACTION, not
       about either claim, so adding them to the source count would produce a
       number that answers no question a reader is asking. */
    { label: "Evidence — פירוק לקטגוריות", colorRole: "white", rows: [
      { k: "Source Evidence", v: "ראיות על הפרסום עצמו — אלה שהכותרת סופרת.",
        status: String(sourceEvidence().length) },
      ...sourceEvidence().map((e) => ({ k: e.evidence_id, v: e.meaning,
        status: `${e.verification} · ${e.relation}` })),
      { k: "Effect Evidence", v: "ראיות שפעולת המערכת בוצעה בסימולציה — אינן נוגעות לטענות.",
        status: String(effectEvidence().length) },
      ...effectEvidence().map((e) => ({ k: e.evidence_id, v: e.meaning,
        status: `${e.verification} · ${e.relation}` })),
      { k: "סך רשומות", v: "Source + Effect. שתי הקטגוריות אינן נסכמות לכדי 'ראיות לטענה'.",
        status: String(evidenceLines().length) },
    ]},
    { label: "Contradictory Evidence", colorRole: "orange",
      rows: contradictoryEvidence().map((e) => ({ k: e.evidence_id, v: e.meaning,
        status: `${e.verification} · סותר` })) },
    { label: "Missing Evidence", colorRole: "white",
      rows: s.white.missing.map((m, i) => ({ k: String(i + 1), v: m, status: "MISSING" })) },
    { label: "FOUNDATION 4", colorRole: "orange", rows: s.readings
      .filter((r) => ["time", "matter", "space_gap", "energy"].includes(r.unitId))
      .map((r) => ({ k: r.unitId, v: r.explanation ?? "אין קריאה", status: r.status.toUpperCase() })) },
    { label: "DEPARTMENTS 6", colorRole: "blue", rows: s.readings
      .filter((r) => !["time", "matter", "space_gap", "energy"].includes(r.unitId))
      .map((r) => ({ k: r.unitId, v: r.explanation ?? "אין קריאה", status: r.status.toUpperCase() })) },
    { label: "השפעות — ללא מקור נשאר UNKNOWN", colorRole: "orange",
      rows: IMPACTS.map((i) => ({ k: i.area, v: i.source ?? "אין מקור ואין נוסחה", status: i.value })) },
    { label: "שערי ההתאמה", colorRole: "blue",
      rows: GATES.map((g) => ({ k: g.gate, v: g.because, status: g.value })) },
    { label: "Authority / ניגוד עניינים", colorRole: "purple", rows: [
      { k: "conflictOfInterest", v: "הגורם הפועל הוא נושא הטענה", status: String(AUTHORITY.conflictOfInterest) },
      { k: AUTHORITY.reviewer.id, v: AUTHORITY.reviewer.label, status: "INDEPENDENT" },
      { k: CONSENT_RECORD.consent_id, v: CONSENT_RECORD.grants,
        status: `granted_by ${CONSENT_RECORD.granted_by}` },
      { k: AUTHORITY_DECISION.decision_id, v: AUTHORITY_DECISION.approves,
        status: AUTHORITY_DECISION.decision },
      ...AUTHORITY_DECISION.excludes.map((e, i) => ({ k: `לא מאשר ${i + 1}`, v: e, status: "EXCLUDED" })),
      ...AUTHORITY.subjectMayNot.map((m, i) => ({ k: `נושא הטענה ${i + 1}`, v: m, status: "BLOCKED" })),
    ]},
    { label: "פעולות שבוצעו בסימולציה", colorRole: "red", rows: ACTION ? [
      { k: ACTION.action_id, v: ACTION.reality, status: ACTION.state },
      { k: "executionScope", v: ACTION.executionScope, status: "worldExecution=false" },
    ] : [{ k: "Action", v: "לא נוצרה — Match אינו PERMITTED", status: "BLOCKED" }]},
    { label: "Effects מקושרים", colorRole: "green", rows: EFFECT ? [
      { k: EFFECT.effect_id, v: EFFECT.claimed_outcome, status: EFFECT.scope },
      { k: "אינו מוכיח", v: EFFECT.does_not_establish, status: "UNRESOLVED" },
    ] : [{ k: "Effect", v: "לא נוצר — אין Action", status: "BLOCKED" }]},
    { label: "Learning מאושר", colorRole: "purple", rows: LEARNING ? [
      { k: LEARNING.learning_id, v: LEARNING.statement, status: "DERIVED" },
      { k: "אינו כולל", v: LEARNING.excludes.join(" · "), status: "OUT_OF_SCOPE" },
    ] : [{ k: "Learning", v: "לא נגזר — אין Effect", status: "BLOCKED" }]},
    { label: "State t0 → t1", colorRole: "blue", rows: [
      ...STATE_T0.facts.map((f, i) => ({ k: `t0.${i + 1}`, v: f, status: "PRESERVED" })),
      ...STATE_T1.facts.map((f, i) => ({ k: `t1.${i + 1}`, v: f, status: "ADDED" })),
    ]},
    { label: "EventComplete", colorRole: "white", rows: [
      ...COMPLETENESS.map((c) => ({ k: c.condition, v: c.because, status: c.met ? "MET" : "UNMET" })),
      /* Reported beside the formula, never inside it. */
      { k: IDENTITY_VERIFIED.field, v: IDENTITY_VERIFIED.because, status: IDENTITY_VERIFIED.state },
    ]},
    { label: "לולאות פתוחות", colorRole: "yellow",
      rows: s.openLoops.map((l, i) => ({ k: String(i + 1), v: l, status: "OPEN" })) },
    { label: "הפעולה הבאה", colorRole: "blue", rows: [
      { k: "הבאה", v: "המתנה לממצאי הבדיקה העצמאית. הטענות נותרות UNDER_REVIEW.", status: "PENDING" },
    ]},
  ];
}

/* ── OPERATIONAL PROJECTIONS ─────────────────────────────────────────── */

import type { TerminalName } from "./acceptanceScenario";

const gateRows = () => GATES.map((g) => ({ k: g.gate, v: g.because, status: g.value }));

const chainRows = () => ACTION && EFFECT && COMMITMENT ? [
  { k: COMMITMENT.commitment_id, v: `אושר על ידי ${COMMITMENT.authorized_by}`, status: COMMITMENT.state },
  { k: ACTION.action_id, v: ACTION.reality, status: ACTION.state },
  { k: "executionScope", v: ACTION.executionScope, status: "worldExecution=false" },
  { k: EFFECT.effect_id, v: EFFECT.claimed_outcome, status: EFFECT.scope },
  ...EFFECT_EVIDENCE.map((e) => ({ k: e.evidence_id, v: e.establishes, status: e.verification })),
] : [{ k: "השרשרת", v: "לא נוצרה — Match אינו PERMITTED", status: "BLOCKED" }];

const OPERATIONAL: Record<TerminalName, ProjectionSection[]> = {
  hub: [
    { label: "מצב תפעולי", colorRole: "orange", rows: [
      { k: "Need", v: NEED.desired_change, status: NEED.state },
      { k: "Match", v: MATCH.because, status: MATCH.decision },
      { k: "Action", v: ACTION ? "בוצעה בסימולציה בלבד" : "חסומה", status: ACTION?.state ?? "BLOCKED" },
      { k: "EventComplete", v: "שני תנאים אינם מתקיימים", status: eventState() },
    ]},
  ],
  brain: [
    { label: "Evidence — חמש רשומות בשמן", colorRole: "white",
      rows: evidenceLines().map((e) => ({ k: e.evidence_id, v: e.meaning,
        status: `${e.verification} · ${e.relation}` })) },
    { label: "Learning — רק מ-Action+Effect+Evidence", colorRole: "purple",
      rows: LEARNING ? [
        { k: LEARNING.learning_id, v: LEARNING.statement, status: "DERIVED" },
        { k: "אינו כולל", v: LEARNING.excludes.join(" · "), status: "OUT_OF_SCOPE" },
      ] : [{ k: "Learning", v: "לא נגזר", status: "BLOCKED" }] },
  ],
  dynamics: [
    { label: "State(t0) — נשמר, לא נדרס", colorRole: "blue",
      rows: STATE_T0.facts.map((f, i) => ({ k: `t0.${i + 1}`, v: f, status: "PRESERVED" })) },
    { label: "Commitment → Action → Effect → Evidence", colorRole: "red", rows: chainRows() },
    { label: "Learning → State(t1) — מוסיף בלבד", colorRole: "green", rows: [
      ...(LEARNING ? [{ k: "Learning", v: LEARNING.statement, status: "DERIVED" }] : []),
      ...STATE_T1.facts.map((f, i) => ({ k: `t1.${i + 1}`, v: f, status: "ADDED" })),
    ]},
  ],
  community: [
    { label: "צורך וכשירויות", colorRole: "green", rows: [
      { k: NEED.need_id, v: NEED.desired_change, status: NEED.state },
      ...CAPABILITIES.map((c) => ({ k: c.id, v: c.note, status: "SIMULATED" })),
    ]},
  ],
  marketplace: [
    { label: "Need → Offer", colorRole: "green", rows: [
      { k: NEED.need_id, v: NEED.desired_change, status: NEED.state },
      { k: "בסיס", v: NEED.basis, status: "VERIFIED_GAP" },
      ...RESOURCES.map((r) => ({ k: r.id, v: r.note, status: "SIMULATED" })),
      ...OFFERS.map((o) => ({ k: o.id, v: o.note, status: "SIMULATED" })),
    ]},
    { label: "שערי ההתאמה — כולם נבדקים בנפרד", colorRole: "blue", rows: gateRows() },
    { label: "Match", colorRole: "yellow", rows: [
      { k: MATCH.match_id, v: MATCH.because, status: MATCH.decision },
      { k: "consent_ref", v: MATCH.consent_ref, status: "LINKED" },
      { k: "authority_ref", v: MATCH.authority_ref, status: "LINKED" },
    ]},
    { label: "Authority — הסכמה והחלטה", colorRole: "purple", rows: [
      { k: AUTHORITY.reviewer.id, v: AUTHORITY.reviewer.label, status: "INDEPENDENT" },
      { k: CONSENT_RECORD.consent_id, v: CONSENT_RECORD.grants,
        status: `granted_by ${CONSENT_RECORD.granted_by}` },
      { k: AUTHORITY_DECISION.decision_id, v: AUTHORITY_DECISION.approves,
        status: AUTHORITY_DECISION.decision },
      ...AUTHORITY.subjectMayNot.map((m, i) => ({ k: `נושא הטענה ${i + 1}`, v: m, status: "BLOCKED" })),
    ]},
    { label: "Commitment → Action → Effect → Evidence", colorRole: "red", rows: chainRows() },
  ],
  planet: [
    { label: "בודק עצמאי בגרף", colorRole: "purple", rows: [
      { k: AUTHORITY.reviewer.id, v: "צומת נפרד — אין זיקה לנושא הטענה", status: "SIMULATED" },
      { k: "LOCATION", v: "גם לבודק אין גיאוגרפיה מאומתת", status: "UNRESOLVED" },
    ]},
  ],
  world: [
    { label: "פער הפעולה — מה נסגר ומה לא", colorRole: "orange", rows: [
      { k: "נסגר בסימולציה", v: "המקור נשמר ובקשת בדיקה נפתחה", status: ACTION ? "RECORDED" : "BLOCKED" },
      { k: "נותר פתוח", v: "אף גוף מוסדי לא הגיב; הטענות לא נבדקו", status: "OPEN" },
    ]},
  ],
};

export function operationalProjection(terminal: TerminalName): ProjectionSection[] {
  return OPERATIONAL[terminal];
}

/** Every id in the chain, in order — the ref-integrity proof reads this. */
export function chainRefs() {
  return {
    event: SCENARIO_EVENT_ID,
    observation: SCENARIO_OBSERVATION_ID,
    claims: loadAcceptanceScenario().claims.map((c) => c.claim_id),
    orientation: ORIENTATION.orientation_id,
    tensions: TENSIONS.map((t) => t.tension_id),
    need: NEED.need_id,
    need_from: NEED.derived_from,
    offer: OFFERS[0]!.id,
    consent: CONSENT_RECORD.consent_id,
    consent_granted_by: CONSENT_RECORD.granted_by,
    authority_decision: AUTHORITY_DECISION.decision_id,
    reviewer: AUTHORITY_DECISION.reviewer_id,
    match: MATCH.match_id,
    match_decision: MATCH.decision,
    match_need_ref: MATCH.need_ref,
    match_offer_ref: MATCH.offer_ref,
    match_consent_ref: MATCH.consent_ref,
    match_authority_ref: MATCH.authority_ref,
    commitment: COMMITMENT?.commitment_id ?? null,
    commitment_match_ref: COMMITMENT?.match_ref ?? null,
    action: ACTION?.action_id ?? null,
    action_commitment_ref: ACTION?.commitment_ref ?? null,
    effect: EFFECT?.effect_id ?? null,
    effect_action_ref: EFFECT?.action_ref ?? null,
    evidence: EFFECT_EVIDENCE.map((e) => e.evidence_id),
    evidence_action_refs: EFFECT_EVIDENCE.map((e) => e.action_ref),
    learning: LEARNING?.learning_id ?? null,
    learning_effect_ref: LEARNING?.derived_from.effect ?? null,
    state_t0: STATE_T0.state_id,
    state_t1: STATE_T1.state_id,
  };
}

/* ── THE FULL FLOW ───────────────────────────────────────────────────────
   One shared selector for the whole chain, External Signal → Open Loops.
   Every node reports a state and the terminal that owns it, so the diagram
   is navigation as well as a picture.

   THE FOUR ABSENCES ARE NOT THE SAME ABSENCE, and the diagram must not blur
   them: a canonical structure that does not exist here (STRUCTURAL_GAP), a
   record that was never written (NO_RECORD), a field nobody collected
   (MISSING_DATA), and data that exists but is not attached to this event
   (UNLINKED). Collapsing them into one grey "missing" is what makes a gap
   un-actionable. */

export type FlowState =
  | "CONNECTED" | "PARTIAL" | "STRUCTURAL_GAP" | "NO_RECORD"
  | "MISSING_DATA" | "UNLINKED" | "BLOCKED" | "UNRESOLVED";

export interface FlowNode {
  key: string;
  /** Human name first. The id lives in Audit. */
  label: string;
  state: FlowState;
  /** Why this state — never a bare status word. */
  note: string;
  /** Terminal that owns this node. */
  href: string;
  terminal: string;
  /** Explicit ref to the previous node, or null. No ref ⇒ no causal arrow. */
  previousRef: string | null;
}

export function flowNodes(): FlowNode[] {
  const s = loadAcceptanceScenario();
  const permitted = matchPermitted();
  const n = (k: string, label: string, state: FlowState, note: string,
    href: string, terminal: string, previousRef: string | null): FlowNode =>
    ({ key: k, label, state, note, href, terminal, previousRef });

  return [
    n("signal", "אות חיצוני", "CONNECTED", "צילום מסך של פרסום ציבורי, מתועד.",
      "/world", "World", null),
    n("event", "אירוע", "PARTIAL", `${s.event.state} — לא נסגר.`, "/hub", "Hub", "signal"),
    n("claims", "שתי טענות", "CONNECTED", "נפרדות, שתיהן REPORTED / UNDER_REVIEW.",
      "/brain#evidence", "Brain", "event"),
    n("observation", "תצפית", "CONNECTED", "אחת, אטומית.", "/brain#evidence", "Brain", "event"),
    n("units", "עשר יחידות ניתוח", "PARTIAL", "3 נקראו, 1 סותרת, 6 חסרות מידע.",
      "/brain", "Brain", "observation"),
    n("orientation", "התמצאות", "CONNECTED", "נגזרה מהתצפית.", "/hub", "Hub", "units"),
    n("tension", "מתחים", "CONNECTED", "שלושה מתחים פתוחים.", "/dynamics", "Dynamics", "orientation"),
    n("need", "צורך", "CONNECTED", "אחד, מפער תפעולי מאומת.", "/marketplace", "Marketplace", "tension"),
    n("community", "קהילה", "UNRESOLVED", "אין קבוצת ערך אמיתית מקושרת.",
      "/hub/community", "Community", "need"),
    n("offer", "כשירות · משאב · הצעה", "CONNECTED", "שלושתם בסימולציה.",
      "/marketplace", "Marketplace", "need"),
    n("consent", "הסכמה", "CONNECTED", `ניתנה על ידי ${CONSENT_RECORD.granted_by}.`,
      "/marketplace", "Marketplace", "offer"),
    n("authority", "אישור סמכות", "CONNECTED", `הוכרע על ידי ${AUTHORITY_DECISION.decided_by}.`,
      "/marketplace", "Marketplace", "consent"),
    n("match", "התאמה", permitted ? "CONNECTED" : "BLOCKED", MATCH.because,
      "/marketplace", "Marketplace", "authority"),
    n("commitment", "התחייבות", permitted ? "CONNECTED" : "BLOCKED",
      permitted ? "נרשמה." : "לא נוצרה — אין התאמה מאושרת.",
      "/dynamics#action-layer", "Dynamics", "match"),
    n("action", "פעולה", permitted ? "CONNECTED" : "BLOCKED",
      permitted ? "סימולציה בתוך המערכת בלבד." : "לא נוצרה.",
      "/dynamics#action-layer", "Dynamics", "commitment"),
    n("effect", "אפקט", permitted ? "CONNECTED" : "BLOCKED",
      permitted ? "פנימי למערכת; אינו מוכיח דבר על הטענות." : "לא נוצר.",
      "/dynamics#action-layer", "Dynamics", "action"),
    n("evidence", "ראיות אפקט", permitted ? "CONNECTED" : "NO_RECORD",
      permitted ? "שלוש רשומות, מקושרות לפעולה." : "אין רשומות.",
      "/brain#evidence", "Brain", "effect"),
    n("learning", "למידה", permitted ? "CONNECTED" : "BLOCKED",
      permitted ? "על המסלול בלבד, לא על הטענות." : "לא נגזרה.",
      "/dynamics#action-layer", "Dynamics", "evidence"),
    n("state_t1", "מצב t1", permitted ? "CONNECTED" : "NO_RECORD",
      "מוסיף ל-t0; t0 לא נדרס.", "/dynamics", "Dynamics", "learning"),
    n("day", "סגירת יום", "PARTIAL", `האירוע ${eventState()} — לא נסגר.`,
      "/hub#day-closing", "Hub", "state_t1"),
    n("loops", "לולאות פתוחות", "MISSING_DATA",
      `${s.openLoops.length} פתוחות — ראיות לא נבדקו, זהות לא אומתה.`,
      "/hub#day-closing", "Hub", "day"),
  ];
}
