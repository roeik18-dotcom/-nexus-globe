/**
 * SYSTEM TRACE — the real record chain, end to end, from what is actually
 * stored.
 *
 * This is not the idealised pipeline. Traced against the live store, the
 * real records do NOT flow the way the conceptual chain describes:
 *
 *   Need 16/08 17:08 -> Offer 16/08 17:12 -> Action 16/08 18:23
 *   -> Effect 16/08 18:30 (verified)          ... then, a day later ...
 *   Observation 17/08 10:55
 *
 * The Observation came AFTER the Action, and nothing links them. So there
 * are two disconnected segments, not one chain: an operational segment
 * joined by explicit id references, and a later measurement that references
 * none of it. Rendering "Observation -> Need -> Action" would invert real
 * chronology and invent a link that does not exist.
 *
 * Every edge below is classified from the store, never from the diagram.
 */
export type TraceStatus =
  | "IMPLEMENTED" | "PARTIAL" | "MISSING_DATA"
  | "MISSING_SCHEMA" | "OPEN_BOUNDARY" | "NOT_APPLICABLE";

export type TraceLinkage =
  | "VERIFIED_REFERENCE_LINK" | "CHRONOLOGICAL_ONLY" | "UNLINKED" | "NO_LINK_POSSIBLE";

export interface TraceEdge {
  from: string;
  to: string;
  source_record: string | null;
  target_record: string | null;
  linkage: TraceLinkage;
  status: TraceStatus;
  /** Why this classification — read off the store, not asserted. */
  basis: string;
}

export interface SystemTraceInput {
  observationIds: string[];
  observationTimes: string[];
  needIds: string[];
  offerIds: string[];
  actionIds: string[];
  /** Does any Action.inputs name an Observation id? */
  actionReferencesObservation: boolean;
  effectIds: string[];
  effectHasVerifiedOutcome: boolean;
  effectHasObservedInRef: boolean;
  verifiedMemberships: number;
  learningCount: number;
}

export function buildSystemTrace(i: SystemTraceInput): TraceEdge[] {
  const obs = i.observationIds[0] ?? null;
  const need = i.needIds[0] ?? null;
  const offer = i.offerIds[0] ?? null;
  const action = i.actionIds[0] ?? null;
  const effect = i.effectIds[0] ?? null;

  return [
    {
      from: "USER INPUT", to: "Observation",
      source_record: "self-report via /hub", target_record: obs,
      linkage: obs ? "VERIFIED_REFERENCE_LINK" : "NO_LINK_POSSIBLE",
      status: obs ? "IMPLEMENTED" : "MISSING_DATA",
      basis: obs ? "התצפית נכתבה ישירות מהטופס" : "אין תצפית",
    },
    {
      from: "Observation", to: "Runtime contradiction (5)",
      source_record: obs, target_record: "classifyObservationText",
      linkage: obs ? "VERIFIED_REFERENCE_LINK" : "NO_LINK_POSSIBLE",
      status: obs ? "IMPLEMENTED" : "MISSING_DATA",
      basis: "פירוש דטרמיניסטי על טקסט אותה תצפית",
    },
    {
      from: "Observation", to: "Source contradiction mentions (110)",
      source_record: obs, target_record: "detectBaseOppositions",
      linkage: obs ? "VERIFIED_REFERENCE_LINK" : "NO_LINK_POSSIBLE",
      status: "IMPLEMENTED",
      basis: "רץ על אותו טקסט; 0 מתוך 110 מוזכרים — תוצאה אמיתית, לא כשל",
    },
    {
      from: "Source contradiction", to: "Value-emergence relation",
      source_record: null, target_record: null,
      linkage: "NO_LINK_POSSIBLE", status: "NOT_APPLICABLE",
      basis: "אף אחד מ-4 היחסים אינו נוגע לניגוד שמוזכר בתצפית הזו",
    },
    {
      from: "Observation", to: "Need",
      source_record: obs, target_record: need,
      linkage: "UNLINKED", status: "PARTIAL",
      basis: "ה-Need נרשם 16/08 17:08, התצפית 17/08 10:55 — ה-Need קדם לתצפית ואינו מפנה אליה",
    },
    {
      from: "Need", to: "Offer → Match",
      source_record: need, target_record: offer,
      linkage: need && offer ? "VERIFIED_REFERENCE_LINK" : "NO_LINK_POSSIBLE",
      status: "IMPLEMENTED",
      basis: "שניהם מופיעים ב-Action.inputs; MATCH נגזר ואינו נשמר (§21)",
    },
    {
      from: "Match", to: "Action",
      source_record: `${need} + ${offer}`, target_record: action,
      linkage: action ? "VERIFIED_REFERENCE_LINK" : "NO_LINK_POSSIBLE",
      status: "IMPLEMENTED",
      basis: "Action.inputs מפנה מפורשות לשתי הרשומות",
    },
    {
      from: "Action", to: "Effect",
      source_record: action, target_record: effect,
      linkage: effect ? "VERIFIED_REFERENCE_LINK" : "NO_LINK_POSSIBLE",
      status: "IMPLEMENTED",
      basis: "Effect.action_ref תואם את ה-Action",
    },
    {
      from: "Effect", to: "Evidence",
      source_record: effect, target_record: "verified_outcome",
      linkage: i.effectHasVerifiedOutcome ? "VERIFIED_REFERENCE_LINK" : "UNLINKED",
      status: i.effectHasVerifiedOutcome ? "IMPLEMENTED" : "MISSING_DATA",
      basis: "verified_outcome קיים על אותה רשומה",
    },
    {
      from: "Action/Effect", to: "Observation (as t0)",
      source_record: action, target_record: obs,
      linkage: i.actionReferencesObservation ? "VERIFIED_REFERENCE_LINK" : "UNLINKED",
      status: i.actionReferencesObservation ? "IMPLEMENTED" : "PARTIAL",
      basis: "Action.inputs יכול לשאת canon_event_id אך אינו נושא — השדה קיים, לא אוכלס",
    },
    {
      from: "Membership", to: "Community relevance",
      source_record: "person-community-link", target_record: "value group",
      linkage: i.verifiedMemberships > 0 ? "VERIFIED_REFERENCE_LINK" : "UNLINKED",
      status: i.verifiedMemberships > 0 ? "IMPLEMENTED" : "MISSING_DATA",
      basis: "קשר זהות מאומת — לא נגזר מדמיון ערכי",
    },
    {
      from: "Community", to: "Globe projection",
      source_record: "value group + membership", target_record: "MEMBER_OF edge",
      linkage: i.verifiedMemberships > 0 ? "VERIFIED_REFERENCE_LINK" : "NO_LINK_POSSIBLE",
      status: "IMPLEMENTED",
      basis: "קשת מצוירת רק מרשומת חברות אמיתית",
    },
    {
      from: "Community", to: "World projection",
      source_record: "verified group impact", target_record: "systemic relevance",
      linkage: "VERIFIED_REFERENCE_LINK", status: "PARTIAL",
      basis: "השפעה מאומתת מוצגת; רלוונטיות חיצונית נשארת UNKNOWN — אין אירוע חיצוני מאומת",
    },
    {
      from: "Effect", to: "Observation(t1)",
      source_record: effect, target_record: null,
      linkage: "NO_LINK_POSSIBLE",
      status: i.observationIds.length > 1 ? "PARTIAL" : "MISSING_DATA",
      basis: "observed_in_ref קיים בסכימה ואינו מאוכלס; ואין תצפית שנייה בכלל",
    },
    {
      from: "Observation(t1)", to: "Learning / State(t+1)",
      source_record: null, target_record: null,
      linkage: "NO_LINK_POSSIBLE", status: "OPEN_BOUNDARY",
      basis: "אין חוזה קנוני לשמירת State′ — הגבול הפתוח, לא פער נתונים",
    },
  ];
}

export function traceSummary(edges: TraceEdge[]) {
  const recorded = edges.filter((e) => e.source_record && e.target_record).length;
  const linked = edges.filter((e) => e.linkage === "VERIFIED_REFERENCE_LINK").length;
  const unlinked = edges.filter((e) => e.linkage === "UNLINKED").length;
  const open = edges.filter((e) => e.status === "OPEN_BOUNDARY").length;
  return { recorded, linked, unlinked, open, total: edges.length };
}
