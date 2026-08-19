/**
 * OBSERVATION COMPARISON — the temporal infrastructure, built without
 * fabricating a second observation.
 *
 * ── What it does ───────────────────────────────────────────────────────
 *
 * Extracts a comparable FEATURE SET from each real Observation, then — only
 * when two genuinely comparable observations exist — compares them
 * like-with-like:
 *
 *   runtime class  <-> the SAME runtime class
 *   source pole    <-> the SAME source pole
 *   source pair    <-> the SAME source pair
 *   measured cell  <-> the SAME measured cell
 *
 * Nothing is ever compared across kinds. A runtime class and a source pole
 * describe different things (proven: the one real observation names all the
 * runtime dimensions and none of the 24 source poles), so comparing them
 * would be meaningless even before it was dishonest.
 *
 * ── The three refusals ─────────────────────────────────────────────────
 *
 *   NO t1                    -> OPEN_LOOP
 *   no Effect/Evidence       -> NO_ATTRIBUTION_TO_ACTION
 *   feature absent on a side -> NOT_COMPARABLE
 *
 * A change is never described as improved / worsened / resolved. Those are
 * evaluations; this module reports only PRESENT -> ABSENT, ABSENT ->
 * PRESENT, or SAME, and only for a feature that exists on both sides.
 *
 * **Attribution is the hard line.** Even with two observations and a real
 * change between them, the change is attributed to an Action ONLY when a
 * verified Effect links them. An Action existing near the change in time
 * proves nothing — CHRONOLOGY != CAUSALITY, enforced here as everywhere.
 */
import { detectBaseOppositions, type BaseOppositionDetection } from "./valueSystem/baseOppositionDetector";

export interface ObservationFeatureSet {
  canon_event_id: string;
  subject: string;
  /** The Observation's own time — never "now". */
  observed_at: string;
  /** The measured cell this reading is OF, and its values. */
  measured_cell: { domain: string; frame: string; level: number; stability: number };
  /** Runtime-5 classification refs present in this observation's text. */
  runtime_classes: string[];
  /** Source-24 pole/pair MENTIONS — never "detected contradictions". */
  source_mentions: BaseOppositionDetection[];
  /** Explicit value claims the text makes. */
  value_claims: string[];
  /** Real Action ids this observation is explicitly referenced BY
   *  (via `Action.inputs`). `[]` = none reference it. */
  referenced_by_actions: string[];
}

export type ComparisonVerdict =
  | "SAME"
  | "PRESENT_TO_ABSENT"
  | "ABSENT_TO_PRESENT"
  | "NOT_COMPARABLE";

export interface FeatureComparison {
  feature_kind: "RUNTIME_CLASS" | "SOURCE_POLE" | "SOURCE_PAIR" | "MEASURED_CELL";
  feature_id: string;
  verdict: ComparisonVerdict;
  /** Only for MEASURED_CELL, and only when both sides carry the same cell.
   *  Plain arithmetic between two real numbers — never a significance or
   *  causal claim. */
  level_delta?: number;
  basis: string;
}

export type AttributionStatus =
  | "ATTRIBUTED_VIA_VERIFIED_EFFECT"
  | "NO_ATTRIBUTION_TO_ACTION"
  | "OPEN_LOOP";

export interface ObservationComparison {
  status: "COMPARED" | "OPEN_LOOP" | "NO_PRIOR";
  t0: ObservationFeatureSet | null;
  t1: ObservationFeatureSet | null;
  comparisons: FeatureComparison[];
  attribution: AttributionStatus;
  /** Every reason this comparison is limited, stated. */
  blocked_because: string[];
}

/** Build the feature set for ONE real Observation. Pure. */
export function buildObservationFeatures(params: {
  canon_event_id: string;
  subject: string;
  observed_at: string;
  domain: string;
  frame: string;
  level: number;
  stability: number;
  text: string;
  runtimeClassRefs?: readonly string[];
  valueClaims?: readonly string[];
  referencedByActions?: readonly string[];
}): ObservationFeatureSet {
  return {
    canon_event_id: params.canon_event_id,
    subject: params.subject,
    observed_at: params.observed_at,
    measured_cell: { domain: params.domain, frame: params.frame, level: params.level, stability: params.stability },
    runtime_classes: [...(params.runtimeClassRefs ?? [])],
    source_mentions: detectBaseOppositions(params.text),
    value_claims: [...(params.valueClaims ?? [])],
    referenced_by_actions: [...(params.referencedByActions ?? [])],
  };
}

function poleKey(d: BaseOppositionDetection): string[] {
  return d.mentioned_poles.map((p) => `${d.contradiction_id}#${p.pole_index}`);
}

/**
 * Compare two feature sets, or explain honestly why it cannot be done.
 *
 * `verifiedEffectLinksThem` must be resolved by the caller from REAL
 * records: a verified Effect whose Action explicitly references t0 AND
 * whose outcome was recorded in t1. This module never infers it — and
 * today no field exists that can express the t1 half of that link (see
 * `PHILOS-SOURCE-AUTHORITY-CONTRACT`-style gap noted in the audit), so
 * callers pass `false` and the result honestly says so.
 */
export function compareObservations(params: {
  t0: ObservationFeatureSet | null;
  t1: ObservationFeatureSet | null;
  verifiedEffectLinksThem?: boolean;
}): ObservationComparison {
  const { t0, t1, verifiedEffectLinksThem = false } = params;
  const blocked: string[] = [];

  if (!t0 && !t1) {
    return { status: "NO_PRIOR", t0: null, t1: null, comparisons: [], attribution: "OPEN_LOOP",
      blocked_because: ["אין תצפית אמיתית כלל"] };
  }
  if (!t1 || !t0) {
    blocked.push(!t1
      ? "אין תצפית שנייה בת-השוואה (t1) — הלולאה פתוחה"
      : "אין תצפית קודמת (t0) — אין בסיס להשוואה");
    return { status: "OPEN_LOOP", t0, t1, comparisons: [], attribution: "OPEN_LOOP", blocked_because: blocked };
  }

  const comparisons: FeatureComparison[] = [];

  const cmpSet = (kind: FeatureComparison["feature_kind"], a: string[], b: string[]) => {
    for (const id of [...new Set([...a, ...b])]) {
      const inA = a.includes(id), inB = b.includes(id);
      comparisons.push({
        feature_kind: kind,
        feature_id: id,
        verdict: inA && inB ? "SAME" : inA ? "PRESENT_TO_ABSENT" : "ABSENT_TO_PRESENT",
        basis: inA && inB ? "קיים בשתי התצפיות" : inA ? "היה ב-t0, אינו ב-t1" : "לא היה ב-t0, קיים ב-t1",
      });
    }
  };

  cmpSet("RUNTIME_CLASS", t0.runtime_classes, t1.runtime_classes);
  cmpSet("SOURCE_POLE", t0.source_mentions.flatMap(poleKey), t1.source_mentions.flatMap(poleKey));
  cmpSet("SOURCE_PAIR",
    t0.source_mentions.filter((d) => d.epistemic_status === "SOURCE_PAIR_MENTION").map((d) => d.contradiction_id),
    t1.source_mentions.filter((d) => d.epistemic_status === "SOURCE_PAIR_MENTION").map((d) => d.contradiction_id));

  // MEASURED CELL — only the SAME cell may be compared.
  const sameCell = t0.measured_cell.domain === t1.measured_cell.domain
    && t0.measured_cell.frame === t1.measured_cell.frame;
  comparisons.push(sameCell
    ? {
        feature_kind: "MEASURED_CELL",
        feature_id: `${t0.measured_cell.domain}/${t0.measured_cell.frame}`,
        verdict: t0.measured_cell.level === t1.measured_cell.level ? "SAME" : "PRESENT_TO_ABSENT",
        level_delta: t1.measured_cell.level - t0.measured_cell.level,
        basis: "אותו תא נמדד בשתי התצפיות — הפרש אריתמטי בין שני מספרים אמיתיים",
      }
    : {
        feature_kind: "MEASURED_CELL",
        feature_id: `${t0.measured_cell.domain}/${t0.measured_cell.frame} vs ${t1.measured_cell.domain}/${t1.measured_cell.frame}`,
        verdict: "NOT_COMPARABLE",
        basis: "שתי התצפיות מודדות תאים שונים — אין השוואה כמו-מול-כמו",
      });

  if (!verifiedEffectLinksThem) {
    blocked.push("אין Effect מאומת שמקשר בין t0 ל-t1 — שינוי אינו מיוחס לפעולה (קרונולוגיה אינה סיבתיות)");
  }

  return {
    status: "COMPARED",
    t0, t1, comparisons,
    attribution: verifiedEffectLinksThem ? "ATTRIBUTED_VIA_VERIFIED_EFFECT" : "NO_ATTRIBUTION_TO_ACTION",
    blocked_because: blocked,
  };
}
