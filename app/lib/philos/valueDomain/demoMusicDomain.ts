/**
 * DEMO Value-Domain instance — Music, used ONLY as a reference
 * implementation of the generic `ValueDomainConfigInstance` contract
 * (`valueDomainConfig.ts`). Every object here is DEMO: never written to
 * any real store, never presented as a real person's actual musical
 * ability. Music is not privileged by the contract — nothing here could
 * not be replaced by an unrelated domain (woodworking, language learning,
 * negotiation skill) without touching `valueDomainConfig.ts`,
 * `dayClosingFusion.ts`, or `DayCycle.tsx`.
 *
 * `MusicActionResult` extends the generic `DomainActionResult` with one
 * domain-specific field (`practice_note`) — proving the "skills/tools/
 * workflows are optional domain-specific extensions, not core contract
 * fields" rule the generic engine states: the extension lives entirely in
 * this file, not in `valueDomainConfig.ts`.
 */
import type {
  AcceptanceCriterion,
  Capability,
  DomainActionResult,
  DomainConstraint,
  DomainNeed,
  DomainParameter,
  DomainState,
  Gap,
  HumanValueRelation,
  ValueDomain,
  ValueDomainConfigInstance,
} from "./valueDomainConfig";

export const DEMO_MUSIC_SUBJECT = "demo_music_subject";

export const DEMO_MUSIC_DOMAIN: ValueDomain = {
  domain_id: "demo_domain_music",
  label: "[DEMO] מוזיקה",
  provenance: "DEMO",
};

export const DEMO_MUSIC_PARAMETERS: DomainParameter[] = [
  { parameter_id: "demo_param_harmony_practice", domain_id: DEMO_MUSIC_DOMAIN.domain_id, label: "עקביות תרגול הרמוניה", definition: "[DEMO] תדירות ועומק תרגול הרמוניה שבועי", provenance: "DEMO" },
  { parameter_id: "demo_param_repertoire_breadth", domain_id: DEMO_MUSIC_DOMAIN.domain_id, label: "רוחב רפרטואר", definition: "[DEMO] מספר יצירות/סגנונות שונים שהאדם שולט בהם", provenance: "DEMO" },
];

/** Prior state — "yesterday's" reading, before today's cycle runs. */
export const DEMO_MUSIC_PRIOR_STATES: DomainState[] = [
  { domain_id: DEMO_MUSIC_DOMAIN.domain_id, parameter_id: "demo_param_harmony_practice", subject: DEMO_MUSIC_SUBJECT, level: 1, confidence: 0.8, observed_at: "2026-08-14T18:00:00+03:00", evidence: "[DEMO] יומן תרגול שבועי", provenance: "DEMO" },
  { domain_id: DEMO_MUSIC_DOMAIN.domain_id, parameter_id: "demo_param_repertoire_breadth", subject: DEMO_MUSIC_SUBJECT, level: 0, confidence: 0.9, observed_at: "2026-08-10T18:00:00+03:00", evidence: "[DEMO] רשימת יצירות מוכרות", provenance: "DEMO" },
];

export const DEMO_MUSIC_CAPABILITIES: Capability[] = [
  { capability_id: "demo_cap_harmony_basic", parameter_id: "demo_param_harmony_practice", label: "[DEMO] זיהוי והרכבת קדנצות בסיסיות", status: "developing", provenance: "DEMO" },
];

export const DEMO_MUSIC_GAPS: Gap[] = [
  { gap_id: "demo_gap_repertoire", parameter_id: "demo_param_repertoire_breadth", label: "[DEMO] רפרטואר מוגבל לסגנון אחד", description: "[DEMO] אין יצירות מתועדות מחוץ לסגנון הפתיחה", provenance: "DEMO" },
];

export const DEMO_MUSIC_ACCEPTANCE: AcceptanceCriterion[] = [
  { criterion_id: "demo_accept_harmony", parameter_id: "demo_param_harmony_practice", statement: "[DEMO] תרגול שהניב זיהוי נכון של 3 קדנצות רצופות נחשב כתוצאה מתקבלת", provenance: "DEMO" },
];

/**
 * NEED, domain-scoped (VALUE_DOMAIN_MASTER audit, this pass) — one DEMO
 * instance, wrapping a full, independently-valid canon `Need`
 * (`validateNeed` would accept `.need` on its own; see `valueDomainConfig.ts`
 * header). Proves the wrapper renders without inventing a second Need
 * schema — never a real subject's actual desired change.
 */
export const DEMO_MUSIC_NEEDS: DomainNeed[] = [
  {
    domain_id: DEMO_MUSIC_DOMAIN.domain_id,
    parameter_id: "demo_param_repertoire_breadth",
    need: {
      need_id: "demo_need_repertoire",
      subject: DEMO_MUSIC_SUBJECT,
      desired_change: "[DEMO] הרחבת הרפרטואר לשני סגנונות נוספים",
      scope: { kind: "domain", domain: "C" },
      provenance: "self_reported",
      context: "[DEMO] תרגול עצמי",
      time: "2026-08-15T09:00:00+03:00",
      expiry: "2026-09-15T09:00:00+03:00",
      consent_scope: "[DEMO] גלוי לעצמי בלבד",
    },
  },
];

/**
 * CONSTRAINT, domain-scoped — structurally identical to
 * `AcceptanceCriterion` (see `valueDomainConfig.ts` header for why no
 * richer object is invented).
 */
export const DEMO_MUSIC_CONSTRAINTS: DomainConstraint[] = [
  { constraint_id: "demo_constraint_time", parameter_id: "demo_param_harmony_practice", statement: "[DEMO] עד 30 דקות תרגול ביום בשבוע עמוס", provenance: "DEMO" },
];

/** Domain-specific extension — see this file's own header. */
export interface MusicActionResult extends DomainActionResult {
  practice_note: string;
}

/**
 * "Today's" action-result — the one real (DEMO) cycle the acceptance test
 * exercises: an Action in the harmony_practice parameter, with a real
 * observed_result + accepted + evidence, so `deriveDomainStateUpdate`
 * actually advances the state (not a fabricated jump).
 */
export function buildTodaysMusicResults(today: string): MusicActionResult[] {
  return [
    {
      result_id: "demo_result_harmony_1",
      parameter_id: "demo_param_harmony_practice",
      action_id: "demo_action_music_practice_1",
      expected_result: "[DEMO] זיהוי 3 קדנצות רצופות בתרגול",
      observed_result: "[DEMO] זוהו 3 קדנצות רצופות בהצלחה",
      accepted: true,
      evidence: "[DEMO] הקלטת תרגול + רישום עצמי",
      time: `${today}T09:00:00+03:00`,
      practice_note: "[DEMO] 25 דקות, פסנתר",
      provenance: "DEMO",
    },
  ];
}

/**
 * A literal, evidence-stated Human×Value relation — never computed from
 * correlation (see `HumanValueRelation`'s own doc comment). This ONE DEMO
 * instance exists to prove the type is renderable, not to claim a general
 * finding about emotional state and musical practice.
 */
export const DEMO_MUSIC_HUMAN_VALUE_RELATION: HumanValueRelation = {
  relation_id: "demo_relation_emotional_practice",
  type: "enables",
  human_domain: "E",
  parameter_id: "demo_param_harmony_practice",
  statement: "[DEMO] מצב רגשי יציב יחסית תואם תרגול עקבי יותר",
  evidence: "[DEMO] יומן תרגול + Observation רגשית מאותו שבוע — קורלציה נצפית, לא סיבתיות מוכחת",
  provenance: "DEMO",
};

export function buildDemoMusicConfig(today: string): ValueDomainConfigInstance {
  return {
    domain: DEMO_MUSIC_DOMAIN,
    parameters: DEMO_MUSIC_PARAMETERS,
    states: DEMO_MUSIC_PRIOR_STATES,
    capabilities: DEMO_MUSIC_CAPABILITIES,
    gaps: DEMO_MUSIC_GAPS,
    acceptanceCriteria: DEMO_MUSIC_ACCEPTANCE,
    actionResults: buildTodaysMusicResults(today),
    needs: DEMO_MUSIC_NEEDS,
    constraints: DEMO_MUSIC_CONSTRAINTS,
  };
}
