/**
 * ACCEPTANCE SCENARIO — one fixture, one Event, one Observation, two Claims.
 *
 * CLASSIFICATION: DEMO / SIMULATION / ACCEPTANCE_SCENARIO. This is a test
 * fixture for the seven-terminal projection. It is NEVER real data: nothing
 * here is written to `philos-events.jsonl`, to the group event log, or to any
 * store, and `classification` is carried on the object itself so every
 * surface that renders it can say so on screen. A reader must never be able
 * to mistake this for a real case.
 *
 * NO REAL PERSON IS NAMED, AND NONE MAY BE ADDED. The subject is described
 * only by structural role — a person in a wealth/power context — because the
 * scenario's purpose is to exercise the claim/evidence/authority machinery,
 * and that purpose is served exactly as well by an unnamed subject. Putting a
 * real identifiable name behind an unverified allegation would make this
 * fixture a defamation vector regardless of the DEMO label on it.
 *
 * WHAT THE SOURCE ACTUALLY PROVES. The scenario's origin is a screenshot of a
 * publication. A screenshot is evidence that a publication APPEARED and of
 * what its visible text SAID. It is not evidence that the allegation is true.
 * That distinction is modelled literally: `ev_publication_capture` is
 * `VERIFIED` on the verification axis and `neutral_unresolved` on the
 * relation-to-claim axis, because those are two independent questions and
 * collapsing them is the exact error this file exists to prevent.
 *
 * CLAIMS ARE REPORTED AND UNDER REVIEW. Never VERIFIED, never GUILTY. There
 * is no code path here that can set either.
 */
import {
  type AnalysisUnitId, type AnalysisUnitReading, ANALYSIS_UNITS, MODEL_STATUS,
} from "./analysisUnit";

export const SCENARIO_PERSON_ID = "scenario_person_sim_user" as const;

export const ACCEPTANCE_SCENARIO_CLASSIFICATION = "DEMO / SIMULATION / ACCEPTANCE_SCENARIO" as const;

/** Fixed ids — the proof that all seven terminals read ONE object. */
export const SCENARIO_EVENT_ID = "scenario_billionaire_claim_v1" as const;
export const SCENARIO_OBSERVATION_ID = "obs_scenario_billionaire_claim_v1" as const;

/* ── Identity roles — six, never merged ─────────────────────────────────── */

/**
 * The six context roles. They are deliberately SEPARATE fields rather than
 * one "role" enum on a person: the same human can hold several at once, and
 * the governance questions ("may they decide?", "is this a conflict?") are
 * answered by comparing roles, which is impossible once they are collapsed.
 */
export type ContextRole =
  | "User" | "Person" | "WealthContext" | "SubjectOfClaim" | "Actor" | "CommunityMember";

export interface RoleHolder {
  role: ContextRole;
  /** Stable id within the scenario. Not a real person id. */
  ref: string;
  label: string;
  note: string;
}

/* ── Claims ─────────────────────────────────────────────────────────────── */

/** A claim's lifecycle state. `VERIFIED` and `GUILTY` are absent by design. */
export type ClaimReviewStatus = "REPORTED" | "UNDER_REVIEW";

export interface ScenarioClaim {
  claim_id: string;
  /** Who or what the claim is ABOUT. */
  subject_ref: string;
  subject_kind: "person" | "institution";
  statement: string;
  reported: "REPORTED";
  review: "UNDER_REVIEW";
}

/* ── Evidence — two independent axes ────────────────────────────────────── */

export type EvidenceVerification = "VERIFIED" | "UNVERIFIED" | "DISPUTED";
/**
 * Relation to a claim. `contradicting` is NOT a verification verdict: a
 * contradicting record can be perfectly well verified, and marking it
 * `rejected` merely because it opposes a claim would be the system taking
 * the claim's side.
 */
export type EvidenceRelation = "supporting" | "contradicting" | "neutral_unresolved";

export interface ScenarioEvidence {
  evidence_id: string;
  description: string;
  /** What this record IS verified to establish — often much less than the claim. */
  establishes: string;
  verification: EvidenceVerification;
  relation: EvidenceRelation;
  claim_refs: string[];
}

/* ── Observation — exactly one, atomic ──────────────────────────────────── */

export interface ScenarioObservation {
  observation_id: string;
  event_id: string;
  original_text: string;
  source: string;
  provenance: string;
  captured_at: string;
  /** `null` — no method exists to compute one for a screenshot. Not 0. */
  confidence: number | null;
  review_status: "UNDER_REVIEW";
}

export interface ScenarioEvent {
  event_id: string;
  title: string;
  captured_at: string;
  /** OPEN until every completeness condition holds. Never CLOSED here. */
  state: "OPEN" | "PARTIAL" | "UNRESOLVED" | "CLOSED";
}

/** The WHITE band — reference/evidence status. NOT the person's state. */
export interface WhiteReferenceBand {
  primary_source: string;
  provenance: string;
  confidence: number | null;
  review_status: string;
  evidence_verified: number;
  evidence_unverified: number;
  known: string[];
  missing: string[];
  contradictory: string[];
}

export interface AcceptanceScenario {
  classification: typeof ACCEPTANCE_SCENARIO_CLASSIFICATION;
  model_status: typeof MODEL_STATUS;
  event: ScenarioEvent;
  observation: ScenarioObservation;
  claims: readonly ScenarioClaim[];
  evidence: readonly ScenarioEvidence[];
  roles: readonly RoleHolder[];
  conflictOfInterest: boolean;
  independentReviewRequired: boolean;
  readings: readonly AnalysisUnitReading[];
  white: WhiteReferenceBand;
  openLoops: readonly string[];
}

/* ── The one fixture ────────────────────────────────────────────────────── */

/**
 * ONE PERSON, FOUR ROLES. In this scenario the simulation user IS the subject
 * of the claim: User, Person, Actor and SubjectOfClaim all resolve to this
 * same id. The role NAMES stay separate — merging them is what destroys the
 * ability to ask "is this a conflict?" — but they point at one human, and
 * that identity is precisely what makes the conflict real rather than
 * hypothetical. WealthContext and CommunityMember are separate entities.
 */
const SIM_PERSON_ID = "scenario_person_sim_user";
const SUBJECT_REF = SIM_PERSON_ID;
const CAPTURED_AT = "2026-08-23T09:00:00Z";

const CLAIMS: readonly ScenarioClaim[] = [
  {
    claim_id: "claim_a_person",
    subject_ref: SUBJECT_REF,
    subject_kind: "person",
    statement:
      "טענה ציבורית לפיה אדם בעל הון וכוח ארגוני היה מעורב בכליאה, בהפעלת כוח או בפגיעה באדם אחר.",
    reported: "REPORTED",
    review: "UNDER_REVIEW",
  },
  {
    claim_id: "claim_b_institutions",
    subject_ref: "scenario_institutions",
    subject_kind: "institution",
    statement:
      "טענה נפרדת לפיה גורמי משטרה, אכיפה או פיקוח ממשלתי ידעו, פעלו באיחור, לא פעלו, או לא סיפקו הגנה מספקת.",
    reported: "REPORTED",
    review: "UNDER_REVIEW",
  },
];

const EVIDENCE: readonly ScenarioEvidence[] = [
  {
    evidence_id: "ev_publication_capture",
    description: "צילום מסך של הפרסום שממנו נקלט האירוע.",
    /* THE WHOLE POINT, stated in the data: what it establishes is far
       narrower than what the claims assert. */
    establishes: "שהפרסום הופיע, ומה היה נוסחו הנראה. אינו מוכיח את תוכן הטענות.",
    verification: "VERIFIED",
    relation: "neutral_unresolved",
    claim_refs: ["claim_a_person", "claim_b_institutions"],
  },
  {
    evidence_id: "ev_public_denial",
    description: "הכחשה פומבית המיוחסת לצד שכנגד.",
    establishes: "שקיימת גרסה נגדית מוצהרת. תוכנה לא נבדק.",
    verification: "UNVERIFIED",
    /* Contradicting AND unverified are independent facts. Neither implies
       the other, and neither is a verdict. */
    relation: "contradicting",
    claim_refs: ["claim_a_person"],
  },
];

/**
 * ROLES. `Actor` is deliberately the SAME ref as `SubjectOfClaim` in this
 * scenario — that is the governance case worth exercising, and the conflict
 * flags below are DERIVED from that equality rather than hard-coded, so the
 * derivation itself is what the test checks.
 */
const ROLES: readonly RoleHolder[] = [
  { role: "User", ref: SIM_PERSON_ID, label: "המשתמש הצופה",
    note: "אותו אדם כמו נושא הטענה. רשאי למסור גרסה, להוסיף מקור ולהגיש ראיה — לא לאמת, לא לסגור, לא לשנות סטטוס." },
  { role: "Person", ref: SUBJECT_REF, label: "אדם — נושא הטענה",
    note: "מתואר לפי תפקיד מבני בלבד. לא מזוהה בשם." },
  { role: "WealthContext", ref: "scenario_wealth_context", label: "הקשר הון/כוח",
    note: "קבוצת הקשר, לא קבוצת ערך. חברות בה אינה טענה ואינה ערך." },
  { role: "SubjectOfClaim", ref: SUBJECT_REF, label: "נושא הטענה",
    note: "טענה נגדו במצב REPORTED / UNDER_REVIEW בלבד." },
  { role: "Actor", ref: SUBJECT_REF, label: "הגורם הפועל",
    note: "בתרחיש זה זהה לנושא הטענה — ומכאן ניגוד העניינים." },
  { role: "CommunityMember", ref: SIM_PERSON_ID, label: "חבר/ת קהילה",
    note: "אותו אדם, בתפקיד קהילתי. התפקיד נפרד גם כשהישות זהה." },
];

/** Conflict is DERIVED, never asserted. */
function deriveConflict(roles: readonly RoleHolder[]): boolean {
  const actor = roles.find((r) => r.role === "Actor")?.ref;
  const subject = roles.find((r) => r.role === "SubjectOfClaim")?.ref;
  return actor !== undefined && subject !== undefined && actor === subject;
}

/**
 * THE TEN READINGS.
 *
 * Seven are `unknown` and carry three nulls, because a screenshot of an
 * allegation supports no reading of them. `unknown` here means "not known",
 * not "zero" and not "low". NOT ONE reading carries a numeric `intensity` or
 * `confidence`, because no source in this scenario supplies a measurement or
 * a stated method — and a number without one would be invented.
 */
const READINGS: readonly AnalysisUnitReading[] = [
  { unitId: "time", status: "observed", direction: null, intensity: null, confidence: null,
    sourceRefs: [SCENARIO_OBSERVATION_ID],
    explanation: "זמן הקליטה מתועד. משך האירוע הנטען אינו ידוע." },
  { unitId: "matter", status: "unknown", direction: null, intensity: null, confidence: null,
    sourceRefs: [], explanation: null },
  { unitId: "space_gap", status: "unknown", direction: null, intensity: null, confidence: null,
    sourceRefs: [], explanation: null },
  { unitId: "energy", status: "unknown", direction: null, intensity: null, confidence: null,
    sourceRefs: [], explanation: null },
  { unitId: "emotional", status: "unknown", direction: null, intensity: null, confidence: null,
    sourceRefs: [], explanation: null },
  { unitId: "cognitive", status: "unknown", direction: null, intensity: null, confidence: null,
    sourceRefs: [], explanation: null },
  { unitId: "physical", status: "unknown", direction: null, intensity: null, confidence: null,
    sourceRefs: [], explanation: null },
  /* Two sources give opposing accounts of the same conduct. That is a
     CONTRADICTION between records — not a finding about the person. */
  { unitId: "personal", status: "contradictory", direction: null, intensity: null, confidence: null,
    sourceRefs: ["claim_a_person", "ev_public_denial"],
    explanation: "הטענה וההכחשה מתארות את אותה התנהלות באופן מנוגד. שתיהן לא נבדקו." },
  { unitId: "social", status: "observed", direction: null, intensity: null, confidence: null,
    sourceRefs: [SCENARIO_OBSERVATION_ID],
    explanation: "הפרסום מופץ בזירה ציבורית. היקפו לא נמדד." },
  { unitId: "systemic", status: "observed", direction: null, intensity: null, confidence: null,
    sourceRefs: [SCENARIO_OBSERVATION_ID, "claim_b_institutions"],
    explanation: "גופים מוסדיים נזכרים בטענה ב'. תגובתם טרם נקלטה." },
];

const SCENARIO: AcceptanceScenario = {
  classification: ACCEPTANCE_SCENARIO_CLASSIFICATION,
  model_status: MODEL_STATUS,
  event: {
    event_id: SCENARIO_EVENT_ID,
    title: "טענה ציבורית נגד בעל הון, וטענה נפרדת נגד מנגנוני אכיפה",
    captured_at: CAPTURED_AT,
    /* OPEN, not CLOSED: identity is not linked to a real person, no
       authority has reviewed, no action or effect exists. */
    state: "OPEN",
  },
  observation: {
    observation_id: SCENARIO_OBSERVATION_ID,
    event_id: SCENARIO_EVENT_ID,
    original_text:
      "פרסום ציבורי המייחס לאדם בעל הון וכוח ארגוני מעורבות בכליאה או בפגיעה, ולצידו טענה כי גורמי אכיפה ופיקוח לא פעלו כנדרש.",
    source: "צילום מסך של פרסום ציבורי",
    provenance: ACCEPTANCE_SCENARIO_CLASSIFICATION,
    captured_at: CAPTURED_AT,
    /* No method exists to compute a confidence for a screenshot. null, not 0. */
    confidence: null,
    review_status: "UNDER_REVIEW",
  },
  claims: CLAIMS,
  evidence: EVIDENCE,
  roles: ROLES,
  conflictOfInterest: deriveConflict(ROLES),
  independentReviewRequired: deriveConflict(ROLES),
  readings: READINGS,
  white: {
    primary_source: "צילום מסך של פרסום ציבורי",
    provenance: ACCEPTANCE_SCENARIO_CLASSIFICATION,
    confidence: null,
    review_status: "UNDER_REVIEW",
    evidence_verified: EVIDENCE.filter((e) => e.verification === "VERIFIED").length,
    evidence_unverified: EVIDENCE.filter((e) => e.verification !== "VERIFIED").length,
    known: [
      "הפרסום הופיע, ונוסחו הנראה תועד.",
      "שתי טענות נפרדות נרשמו תחת אירוע אחד.",
      "קיימת גרסה נגדית מוצהרת.",
    ],
    missing: [
      "זהות מאומתת של נושא הטענה.",
      "תגובה רשמית מגופי האכיפה והפיקוח.",
      "בדיקה עצמאית של גוף מוסמך.",
      "ראיה ראשונית כלשהי לתוכן הטענות.",
    ],
    contradictory: [
      "ev_public_denial סותר את claim_a_person. הסתירה רשומה; אף צד לא נבדק.",
    ],
  },
  openLoops: [
    "לא נקבע גוף בודק עצמאי.",
    "טענה א' ללא ראיה תומכת מאומתת.",
    "טענה ב' ללא תגובה מוסדית.",
    "ניגוד עניינים פתוח — הגורם הפועל הוא נושא הטענה.",
  ],
};

/**
 * THE ONE SELECTOR. Every terminal calls this and nothing else; no page
 * builds, copies, or re-states scenario data of its own. Returns the same
 * frozen object each call, so a shared-identity assertion across terminals
 * is an identity check, not a deep comparison.
 */
export function loadAcceptanceScenario(): AcceptanceScenario {
  return SCENARIO;
}

/** Readings in the module's defined display order, filling any absent unit. */
export function scenarioReadingsInOrder(): AnalysisUnitReading[] {
  const by = new Map(SCENARIO.readings.map((r) => [r.unitId, r]));
  return ANALYSIS_UNITS.map((u) => by.get(u.id) ?? {
    unitId: u.id, status: "unknown" as const, direction: null,
    intensity: null, confidence: null, sourceRefs: [], explanation: null,
  });
}

/* ── TERMINAL PROJECTIONS ────────────────────────────────────────────────
   Each terminal's own reading of THIS SAME object. These live here, beside
   the fixture, for one reason: a page that writes its own event prose has
   forked the source, and the next edit makes the seven terminals disagree.
   Every string below is derived from, or lives with, the single scenario —
   no page file states event content of its own.

   COLOR IS RECORD ROLE, NEVER GUILT. A section's colorRole says what KIND of
   record it holds — white for source/evidence, purple for person/identity,
   blue for structure, green for relation, yellow for time/transition, orange
   for pressure, red for matter/body/action. A Claim is NEVER red: colouring
   an allegation as an action would render it as something that happened. */

export type SectionColor =
  "white" | "purple" | "blue" | "green" | "yellow" | "orange" | "red";

export interface ProjectionRow {
  k: string;
  v: string;
  /** Rendered as a status pill when present. UNRESOLVED/UNKNOWN stay literal. */
  status?: string;
}

export interface ProjectionSection {
  label: string;
  colorRole: SectionColor;
  rows: ProjectionRow[];
}

export type TerminalName =
  "hub" | "brain" | "dynamics" | "community" | "marketplace" | "planet" | "world";

const S = SCENARIO;
const CLAIM_A = S.claims[0]!;
const CLAIM_B = S.claims[1]!;
const CAPTURE = S.evidence[0]!;
const DENIAL = S.evidence[1]!;

const PROJECTIONS: Record<TerminalName, ProjectionSection[]> = {
  /* HUB — what is true now, what needs attention, the gap, the next direction. */
  hub: [
    { label: "מצב עכשיו", colorRole: "purple", rows: [
      { k: "אירוע", v: S.event.title, status: S.event.state },
      { k: "אדם", v: "נושא הטענה — לא מזוהה בשם", status: "UNRESOLVED" },
      { k: "סיווג", v: S.classification, status: "DEMO" },
    ]},
    { label: "מה דורש תשומת לב", colorRole: "orange", rows: [
      { k: "ניגוד עניינים", v: "הגורם הפועל הוא נושא הטענה", status: "OPEN" },
      { k: "בדיקה עצמאית", v: "נדרשת, טרם נקבע גוף בודק", status: "REQUIRED" },
      { k: "סתירה", v: "טענה מול הכחשה, אף צד לא נבדק", status: "UNRESOLVED" },
    ]},
    { label: "הפער המרכזי", colorRole: "white", rows: [
      { k: "מה יש", v: "פרסום שתועד, ונוסחו הנראה" },
      { k: "מה חסר", v: "כל ראיה ראשונית לתוכן הטענות", status: "MISSING" },
      { k: "המרחק", v: "בין 'נטען' ל'נבדק' — טרם נחצה", status: "UNRESOLVED" },
    ]},
    { label: "הכיוון הבא", colorRole: "blue", rows: [
      { k: "1", v: "שימור הראיות והמקור" },
      { k: "2", v: "פנייה לגוף בודק עצמאי" },
      { k: "3", v: "המתנה לתגובה מוסדית" },
      { k: "לא עכשיו", v: "גיוס כספים — אין פער משאבים מוגדר", status: "NOT_APPLICABLE" },
    ]},
    { label: "לולאות פתוחות", colorRole: "yellow",
      rows: S.openLoops.map((l, i) => ({ k: String(i + 1), v: l, status: "OPEN" })) },
  ],

  /* BRAIN — observation, claims, classification, evidence, contradictions. */
  brain: [
    { label: "Observation — אטומית, אחת", colorRole: "white", rows: [
      { k: "OBSERVATION_ID", v: S.observation.observation_id },
      { k: "טקסט מקורי", v: S.observation.original_text },
      { k: "מקור", v: S.observation.source },
      { k: "provenance", v: S.observation.provenance, status: "DEMO" },
      { k: "confidence", v: "אין שיטת חישוב למסך", status: "UNKNOWN" },
      { k: "review", v: S.observation.review_status, status: "UNDER_REVIEW" },
    ]},
    { label: "Claims — שתיים, נפרדות", colorRole: "yellow", rows: [
      { k: CLAIM_A.claim_id, v: CLAIM_A.statement, status: `${CLAIM_A.reported} / ${CLAIM_A.review}` },
      { k: CLAIM_B.claim_id, v: CLAIM_B.statement, status: `${CLAIM_B.reported} / ${CLAIM_B.review}` },
    ]},
    { label: "Classification", colorRole: "blue", rows: [
      { k: "טענה א׳", v: "כלפי אדם — subject_kind: person" },
      { k: "טענה ב׳", v: "כלפי מוסד — subject_kind: institution" },
      { k: "מודל 3×2 הקיים", v: "PHYSICAL/EMOTIONAL/COGNITIVE × INTERNAL/EXTERNAL — מסווג פרשנות נפרד, לא הוחלף" },
      { k: "10 יחידות ניתוח", v: "4 משתני יסוד + 6 מחלקות ניגוד", status: "SYNTHESIS" },
    ]},
    { label: "Evidence — שני צירים בלתי תלויים", colorRole: "white", rows: [
      { k: CAPTURE.evidence_id, v: CAPTURE.establishes, status: `${CAPTURE.verification} · ${CAPTURE.relation}` },
      { k: DENIAL.evidence_id, v: DENIAL.establishes, status: `${DENIAL.verification} · ${DENIAL.relation}` },
      { k: "הכלל", v: "ראיה סותרת יכולה להיות מאומתת. סתירה אינה פסילה." },
    ]},
    { label: "Contradictions", colorRole: "orange",
      rows: S.white.contradictory.map((c, i) => ({ k: String(i + 1), v: c, status: "UNRESOLVED" })) },
    { label: "Unknown", colorRole: "white",
      rows: S.white.missing.map((m, i) => ({ k: String(i + 1), v: m, status: "MISSING" })) },
    { label: "ערכים מועמדים — לא נקבעו", colorRole: "purple", rows: [
      { k: "מועמדים", v: "אמת · צדק · הגנה · אחריות · כבוד — נגזרו מנוסח הטענות בלבד", status: "CANDIDATE" },
      { k: "Value Family", v: "טרם נבדק", status: "UNRESOLVED" },
      { k: "Value Group", v: "אין קבוצת ערך אמיתית מקושרת", status: "UNRESOLVED" },
    ]},
  ],

  /* DYNAMICS — t0, event, observation, an UNDECIDED before/after. */
  dynamics: [
    { label: "State(t0)", colorRole: "blue", rows: [
      { k: "לפני האירוע", v: "אין מצב מתועד — לא נקלטה תצפית קודמת", status: "UNKNOWN" },
      { k: "בסיס", v: "אין קו בסיס למדידה מולו" },
    ]},
    { label: "Event → Observation", colorRole: "yellow", rows: [
      { k: "EVENT_ID", v: S.event.event_id },
      { k: "נקלט", v: S.observation.captured_at },
      { k: "OBSERVATION_ID", v: S.observation.observation_id },
      { k: "מצב", v: S.event.state, status: "OPEN" },
    ]},
    { label: "לפני / אחרי", colorRole: "orange", rows: [
      { k: "אחרי", v: "לא מוכרע — לא נקלטה תצפית שנייה", status: "UNRESOLVED" },
      { k: "דלתא", v: "לא ניתן לחשב ללא t0 ו-t1", status: "UNKNOWN" },
    ]},
    { label: "מסלולים אפשריים — קו מקווקו בלבד", colorRole: "white", rows: [
      { k: "מסלול א׳", v: "בדיקה עצמאית → ממצא → תגובה מוסדית", status: "HYPOTHESIS" },
      { k: "מסלול ב׳", v: "אין בדיקה → הטענה נותרת פתוחה", status: "HYPOTHESIS" },
      { k: "מסלול מאומת", v: "אין. אף מסלול אינו נתמך בראיות", status: "NONE" },
    ]},
    /* NOT INVENTED. The absence is the finding, and it is stated. */
    { label: "Action / Effect / Learning", colorRole: "red", rows: [
      { k: "Action", v: "לא קיים. פאזה זו אינה כותבת פעולות", status: "OUT_OF_SCOPE" },
      { k: "Effect", v: "אין פעולה, ולכן אין אפקט", status: "NONE" },
      { k: "Learning", v: "נגזר רק מ-Effect + ראיה שנבדקה", status: "NONE" },
    ]},
  ],

  /* COMMUNITY — people, relations, and what is only a candidate. */
  community: [
    { label: "אנשים וקשרים", colorRole: "green", rows: [
      { k: "נושא הטענה", v: "אדם בהקשר הון/כוח — לא מזוהה", status: "UNRESOLVED" },
      { k: "הנפגע/ת הנטען/ת", v: "לא מתואר/ת בפרסום", status: "UNKNOWN" },
      { k: "קשר מאומת", v: "אין קשר מאומת בין הצדדים", status: "UNRESOLVED" },
    ]},
    { label: "קבוצות ערך", colorRole: "purple", rows: [
      { k: "קבוצה אמיתית", v: "אין קבוצת ערך אמיתית מקושרת לאירוע", status: "UNRESOLVED" },
      /* The distinction the whole scenario turns on. */
      { k: "\"מיליארדרים\"", v: "קבוצת הקשר הון/כוח — אינה קבוצת ערך ואינה חברות", status: "CONTEXT_GROUP" },
    ]},
    { label: "גורמי זכויות ופיקוח", colorRole: "blue", rows: [
      { k: "ארגון זכויות", v: "רלוונטי לכאורה — לא נוצר קשר, לא אושר", status: "CANDIDATE" },
      { k: "גוף פיקוח", v: "רלוונטי לכאורה — לא נוצר קשר, לא אושר", status: "CANDIDATE" },
      { k: "הכלל", v: "CANDIDATE אינו חברות מוכחת ואינו הסכמה" },
    ]},
    { label: "פעולות קהילה — סדר קדימות", colorRole: "orange", rows: [
      { k: "1", v: "הגנה מיידית אם קיימת סכנה", status: "PROPOSED" },
      { k: "2", v: "שימור ראיות ומקורות", status: "PROPOSED" },
      { k: "3", v: "בדיקה עצמאית", status: "PROPOSED" },
      { k: "9", v: "כסף — רק בפער משאבים מוגדר", status: "NOT_APPLICABLE" },
    ]},
  ],

  /* MARKETPLACE — the six gates, all unresolved. Nothing matched. */
  marketplace: [
    { label: "Need תפעולי", colorRole: "green", rows: [
      { k: "Need", v: "האירוע טרם יצר צורך תפעולי מאושר", status: "NONE" },
      { k: "הסיבה", v: "צורך נגזר מחסר תפעולי — לא מטענה שלא נבדקה" },
    ]},
    { label: "שערי ההתאמה — כולם לא מוכרעים", colorRole: "blue", rows: [
      { k: "CAN", v: "לא ידוע מי יכול", status: "UNRESOLVED" },
      { k: "WANTS", v: "לא נרשמה בקשה", status: "UNRESOLVED" },
      { k: "ALLOWED", v: "לא נבדקה הרשאה", status: "UNRESOLVED" },
      { k: "APPROPRIATE", v: "לא נבדקה התאמה", status: "UNRESOLVED" },
      { k: "AVAILABLE", v: "לא נרשם משאב", status: "UNRESOLVED" },
      { k: "CONSENT", v: "לא ניתנה הסכמה", status: "UNRESOLVED" },
    ]},
    { label: "Match / Commitment / Action", colorRole: "red", rows: [
      { k: "Match", v: "אין. שער אחד לפחות אינו מוכרע", status: "NONE" },
      { k: "Commitment", v: "אין התחייבות רשומה", status: "NONE" },
      { k: "Action", v: "אין. אישור אינו תחילת עבודה", status: "NONE" },
    ]},
  ],

  /* PLANET / GLOBE — relations only. No invented point on a map. */
  planet: [
    { label: "ישויות בגרף", colorRole: "purple", rows: [
      { k: "Person", v: "נושא הטענה — צומת אחד, לא מזוהה", status: "UNRESOLVED" },
      { k: "Institution", v: "משטרה/אכיפה · פיקוח ממשלתי — שני צמתים", status: "NAMED_IN_CLAIM" },
      { k: "Community", v: "אין קהילה מקושרת", status: "UNRESOLVED" },
      { k: "Value Group", v: "אין קבוצת ערך מקושרת", status: "UNRESOLVED" },
    ]},
    { label: "קשרים", colorRole: "green", rows: [
      { k: "Person → Claim A", v: "נושא הטענה", status: "REPORTED" },
      { k: "Institution → Claim B", v: "נושא הטענה", status: "REPORTED" },
      { k: "Person ↔ Institution", v: "אין קשר מאומת בין השניים", status: "UNRESOLVED" },
    ]},
    /* The rule that keeps a globe honest. */
    { label: "מיקום", colorRole: "white", rows: [
      { k: "LOCATION", v: "אין גיאוגרפיה מאומתת בפרסום", status: "UNRESOLVED" },
      { k: "הכלל", v: "ללא מיקום מאומת — לא מצוירת נקודה על הגלובוס" },
    ]},
  ],

  /* WORLD — the external signal and the systemic reading. */
  world: [
    { label: "External Signal", colorRole: "white", rows: [
      { k: "אות חיצוני", v: S.observation.source },
      { k: "מה הוא מוכיח", v: CAPTURE.establishes, status: "VERIFIED" },
      { k: "מה אינו מוכיח", v: "את תוכן הטענות", status: "UNRESOLVED" },
    ]},
    { label: "האירוע", colorRole: "yellow", rows: [
      { k: "EVENT_ID", v: S.event.event_id },
      { k: "כותרת", v: S.event.title, status: S.event.state },
    ]},
    { label: "גופים מוסדיים", colorRole: "blue", rows: [
      { k: "משטרה / אכיפה", v: "נזכר בטענה ב׳", status: "UNDER_REVIEW" },
      { k: "פיקוח ממשלתי", v: "נזכר בטענה ב׳", status: "UNDER_REVIEW" },
    ]},
    { label: "חשיבות מערכתית", colorRole: "orange", rows: [
      { k: "השאלה", v: "האם מנגנוני הגנה פעלו כשנדרשו" },
      { k: "היקף", v: "לא נמדד — אין נתון ואין נוסחה", status: "UNKNOWN" },
    ]},
    { label: "תגובה מוסדית", colorRole: "red", rows: [
      { k: "תגובה", v: "לא נקלטה תגובה מאף גוף", status: "MISSING" },
      { k: "פער פעולה", v: "בין הטענה לבין כל בדיקה רשמית", status: "OPEN" },
    ]},
    { label: "ערכים מתחרים", colorRole: "purple", rows: [
      { k: "אמת ↔ חזקת חפות", v: "פרסום מול הגנה על מי שלא הורשע", status: "TENSION" },
      { k: "הגנה ↔ פרטיות", v: "בטיחות אחרים מול חשיפת פרטים", status: "TENSION" },
      { k: "הכרעה", v: "אין. המערכת אינה מדרגת ערכים זה מול זה", status: "NONE" },
    ]},
  ],
};

/** The one projection selector. Terminals read this; none writes its own. */
export function terminalProjection(terminal: TerminalName): ProjectionSection[] {
  return PROJECTIONS[terminal];
}

/* ── UNIT DATA GAPS ──────────────────────────────────────────────────────
   UNKNOWN alone tells a reader nothing they can act on. For every unit the
   scenario cannot read, this names WHAT is missing and ONE collection action
   that would close it. Nothing here invents a value, a confidence, an
   intensity or a percentage — a gap is described, never filled. */

export interface UnitGap {
  /** Records that bear on this unit today. May legitimately be 0. */
  evidenceCount: number;
  /** Why there is no reading. Never "unknown" restated. */
  missingReason: string;
  /** ONE concrete step that would produce a reading. */
  collectionAction: string;
}

export const UNIT_GAPS: Readonly<Record<AnalysisUnitId, UnitGap>> = {
  time: { evidenceCount: 1,
    missingReason: "זמן הקליטה ידוע, אך משך האירוע הנטען ותאריכיו אינם מופיעים בפרסום.",
    collectionAction: "לבקש מהגורם הבודק ציר זמן מתועד של האירועים הנטענים." },
  matter: { evidenceCount: 0,
    missingReason: "אין תיאור של מקום, חפץ או ראיה פיזית כלשהי.",
    collectionAction: "לאסוף מסמכים או ראיות חומריות מגוף האכיפה, אם קיימים." },
  space_gap: { evidenceCount: 0,
    missingReason: "אין מידע על המרחק בין הצדדים, על מרחב ההתרחשות או על מי נכח.",
    collectionAction: "לברר מול הגורם הבודק היכן התרחש האירוע הנטען ומי היה נוכח." },
  energy: { evidenceCount: 0,
    missingReason: "אין נתון על משאבים, כוח ארגוני שהופעל בפועל או עוצמת המעורבות.",
    collectionAction: "לבקש תיעוד ארגוני על מי פעל, מתי ובאילו אמצעים." },
  emotional: { evidenceCount: 0,
    missingReason: "אף אחד מהצדדים לא מסר גרסה אישית; אין עדות ישירה.",
    collectionAction: "לאפשר לכל צד למסור גרסה בכתב לגורם הבודק." },
  cognitive: { evidenceCount: 0,
    missingReason: "אין מידע על ידיעה, כוונה או הבנה של מי מהצדדים.",
    collectionAction: "לבקש מהגורם הבודק לברר מה היה ידוע לכל צד ומתי." },
  physical: { evidenceCount: 0,
    missingReason: "הטענה מזכירה פגיעה אך אין תיעוד רפואי או ראייתי כלשהו.",
    collectionAction: "לבקש חוות דעת רפואית או תיעוד פציעה מגורם מוסמך, בהסכמת הנפגע." },
  personal: { evidenceCount: 2,
    missingReason: "הטענה וההכחשה סותרות, ואף אחת מהן לא נבדקה.",
    collectionAction: "להעביר את שתי הגרסאות לבדיקה עצמאית ולתעד את הממצא." },
  social: { evidenceCount: 1,
    missingReason: "ידוע שהפרסום מופץ, אך היקף ההפצה והשפעתה לא נמדדו.",
    collectionAction: "למדוד את היקף ההפצה בכלים מתועדים ולשמור את המדידה כראיה." },
  systemic: { evidenceCount: 2,
    missingReason: "גופים מוסדיים נזכרים בטענה ב׳, אך אף תגובה מוסדית לא נקלטה.",
    collectionAction: "לפנות רשמית לגופי האכיפה והפיקוח ולתעד את תגובתם או את היעדרה." },
};

export function unitGap(unitId: AnalysisUnitId): UnitGap {
  return UNIT_GAPS[unitId];
}
