/**
 * THE SOCIAL FLOW — ten stages, and the honest joints between them.
 *
 * The value spine and the canon pipeline were shown as two separate rows of
 * chips, which hid the one thing a reader most needs: they are not the same
 * kind of thing, and the step between them is not a derivation.
 *
 * THREE CONNECTOR KINDS, because three different relations exist here and
 * drawing them identically would assert something false:
 *
 *   CONCEPTUAL        product organisation inside the value model. Reading
 *                     order, not derivation. Nothing computes VALUE-EMERGENCE
 *                     from CONTRADICTIONS. Drawn dashed, WITHOUT an arrowhead,
 *                     because an arrowhead is a claim about direction of
 *                     production.
 *
 *   MODEL_BOUNDARY    where the value model meets the canon pipeline. A Need
 *                     is NOT produced by a membership; they are separate
 *                     models that meet at a group. This is the joint most
 *                     likely to be misread as causal, so it is drawn as a
 *                     visible seam rather than a connector at all.
 *
 *   RECORDED_REFERENCE a real field on a real record points at the previous
 *                     stage — `Action.inputs` names the Need,
 *                     `Effect.action_ref` names the Action, evidence is the
 *                     Effect's own verified outcome. This is the ONLY kind
 *                     drawn as a solid arrow, because it is the only kind
 *                     where one record actually points at another.
 *
 * STATUS is per stage and never averaged: SOURCE inventory is not REAL
 * entities, DERIVED_REAL is composed rather than recorded, DEMO is
 * illustrative, and UNKNOWN is not zero.
 */

export type StageStatus = "SOURCE" | "REAL" | "DERIVED_REAL" | "DEMO" | "UNKNOWN";
export type ConnectorKind = "CONCEPTUAL" | "MODEL_BOUNDARY" | "RECORDED_REFERENCE";

export interface FlowStage {
  key: string;
  label: string;
  label_he: string;
  /** null renders as UNKNOWN — never as 0. */
  count: number | null;
  status: StageStatus;
  /** What the number counts, in the reader's terms. */
  basis: string;
  /** How this stage connects to the one BEFORE it. Absent on the first. */
  connector?: ConnectorKind;
}

export const STATUS_META: Record<StageStatus, { label: string; note: string }> = {
  SOURCE: { label: "SOURCE", note: "מלאי מקור — לא ישויות ממומשות" },
  REAL: { label: "REAL", note: "רשומות אמיתיות" },
  DERIVED_REAL: { label: "DERIVED", note: "מורכב מהפניות מתועדות, לא נרשם בפני עצמו" },
  DEMO: { label: "DEMO", note: "להמחשה בלבד" },
  UNKNOWN: { label: "UNKNOWN", note: "לא נבדק / לא מומש — אינו אפס" },
};

export const CONNECTOR_META: Record<ConnectorKind, { note: string }> = {
  CONCEPTUAL: { note: "סדר קריאה בתוך מודל הערך — לא גזירה ולא סיבתיות" },
  MODEL_BOUNDARY: { note: "תפר בין שני מודלים — Need אינו נובע מחברות" },
  RECORDED_REFERENCE: { note: "שדה אמיתי ברשומה מצביע על הקודמת" },
};

export interface FlowInput {
  contradictions: number;
  emergentValues: number;
  personalValues: number | null;
  groupValues: number | null;
  valueGroups: number | null;
  memberships: number | null;
  needs: number | null;
  actions: number | null;
  effects: number | null;
  evidence: number | null;
}

export function buildSocialFlow(i: FlowInput): FlowStage[] {
  const real = (n: number | null): StageStatus => (n === null ? "UNKNOWN" : n > 0 ? "REAL" : "UNKNOWN");

  return [
    { key: "contradiction", label: "CONTRADICTIONS", label_he: "ניגודי בסיס",
      count: i.contradictions, status: "SOURCE", basis: "זהויות ניגוד במלאי המקור" },

    { key: "emergent_value", label: "VALUE EMERGENCE", label_he: "צמיחת ערך",
      count: i.emergentValues, status: "SOURCE", basis: "יחסים נתמכי-מקור", connector: "CONCEPTUAL" },

    { key: "personal_value", label: "PERSONAL VALUE", label_he: "ערך הפרט",
      count: i.personalValues, status: i.personalValues === null ? "UNKNOWN" : "SOURCE",
      basis: "לא מומש כישות", connector: "CONCEPTUAL" },

    { key: "group_value", label: "GROUP VALUE", label_he: "ערך קבוצה",
      count: i.groupValues, status: i.groupValues === null ? "UNKNOWN" : "SOURCE",
      basis: "לא מומש כישות", connector: "CONCEPTUAL" },

    { key: "value_group", label: "VALUE GROUP", label_he: "קבוצת ערך",
      count: i.valueGroups, status: real(i.valueGroups), basis: "קבוצות אמיתיות בלוג", connector: "CONCEPTUAL" },

    { key: "membership", label: "MEMBERSHIP", label_he: "חברות",
      count: i.memberships, status: real(i.memberships), basis: "חברות מתועדת", connector: "CONCEPTUAL" },

    // The seam. Everything left of here is the value model; everything right
    // is the canon pipeline. A Need is not produced by a membership.
    { key: "need", label: "NEED", label_he: "צורך",
      count: i.needs, status: real(i.needs), basis: "Need קנוני", connector: "MODEL_BOUNDARY" },

    { key: "action", label: "ACTION", label_he: "פעולה",
      count: i.actions, status: real(i.actions), basis: "Action שה-inputs שלו נושאים את ה-Need",
      connector: "RECORDED_REFERENCE" },

    { key: "effect", label: "EFFECT", label_he: "אפקט",
      count: i.effects, status: real(i.effects), basis: "Effect שה-action_ref שלו נושא את ה-Action",
      connector: "RECORDED_REFERENCE" },

    { key: "evidence", label: "EVIDENCE", label_he: "ראיה",
      count: i.evidence, status: real(i.evidence), basis: "verified_outcome על ה-Effect עצמו",
      connector: "RECORDED_REFERENCE" },
  ];
}
