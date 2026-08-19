/**
 * DEMO operational value path — proves `OperationalValuePath` end-to-end
 * using §22's already-built DEMO Music ValueDomainConfig instance. All
 * DEMO; never attached to a real subject. Music remains one replaceable
 * example, not a universal value.
 */
import type { MissionDimension, OperationalValuePath } from "./missionOrientation";
import {
  DEMO_MUSIC_CAPABILITIES,
  DEMO_MUSIC_DOMAIN,
  DEMO_MUSIC_GAPS,
  DEMO_MUSIC_HUMAN_VALUE_RELATION,
  buildTodaysMusicResults,
} from "../valueDomain/demoMusicDomain";
import { TEMPERAMENT_DIMENSIONS } from "../humanConfig/temperamentDimensions";
import type { HumanValueRelation } from "../valueDomain/valueDomainConfig";

function demo<T>(value: T, evidence?: string, source?: string): MissionDimension<T> {
  return { value, status: "demo", evidence, source: source ?? "demoMusicDomain.ts" };
}

export function buildDemoOperationalValuePath(today: string): OperationalValuePath {
  const result = buildTodaysMusicResults(today)[0];
  const capability = DEMO_MUSIC_CAPABILITIES[0];
  const gap = DEMO_MUSIC_GAPS[0];
  return {
    value_id: DEMO_MUSIC_DOMAIN.domain_id,
    label: DEMO_MUSIC_DOMAIN.label,
    why_it_matters: demo("[DEMO] יצירה מוזיקלית כערוץ ביטוי וקשר"),
    current_expression: demo(capability.label, `capability status: ${capability.status}`),
    opposing_condition: demo(gap.label, gap.description),
    need: demo("[DEMO] רוצה להרחיב רפרטואר מעבר לסגנון אחד"),
    available_capability: demo(capability.label),
    missing_capability: demo(gap.label),
    possible_recipient: demo("[DEMO] קהילת האזנה/שיתוף מקומית — לא ידוע קהילה אמיתית"),
    possible_contribution: demo("[DEMO] הופעה/הקלטה משותפת ברגע שהרפרטואר יתרחב"),
    action: demo(result.expected_result, undefined, "demo_action_music_practice_1"),
    expected_effect: demo(result.expected_result),
    observed_effect: result.observed_result ? demo(result.observed_result) : { value: null, status: "unknown" },
    value_created: result.accepted ? demo("[DEMO] יכולת הרמונית התקדמה — Δ level +1") : { value: null, status: "unknown" },
    evidence: demo(result.evidence ?? ""),
    next_action: demo("[DEMO] תרגול נוסף ממוקד ברפרטואר חדש"),
  };
}

/** The Human×Value relation §8/§22 both require — real temperament
 *  dimension, real Value-Domain parameter, but the RELATION ITSELF is
 *  explicitly `hypothesis` status: no real subject has both a real
 *  temperament Observation and real Value-Domain state to check a
 *  relation against. Never asserted as `fact`/`observed`. */
export function buildHypothesisHumanValueRelation(): HumanValueRelation & { human_parameter_label: string } {
  const activity = TEMPERAMENT_DIMENSIONS[0]; // ACTIVITY LEVEL
  return {
    ...DEMO_MUSIC_HUMAN_VALUE_RELATION,
    relation_id: "hypothesis_activity_practice",
    type: "enables",
    human_domain: "E",
    human_parameter_label: activity.label,
    parameter_id: "demo_param_harmony_practice",
    statement: `[HYPOTHESIS] ${activity.label} עשוי לתאם עקביות תרגול — לא נבדק לאף subject אמיתי`,
    evidence: "אין Observation אמיתי הקושר את שני הצדדים לאף subject — מבנה בלבד, סטטוס hypothesis",
    provenance: "DEMO",
  };
}
