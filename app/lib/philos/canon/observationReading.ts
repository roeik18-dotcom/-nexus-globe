/**
 * PHILOS Canon — ObservationReading (7-terminal propagation pass).
 *
 * ONE deterministic, pure derivation over a persisted Observation's OWN
 * text, shared by every terminal that renders the observation — so all 7
 * screens read the SAME structure from the SAME record instead of seven
 * hand-written restatements of it. Nothing here is a second store: the
 * input is the real `CanonObservationMark` the projection already carries,
 * and the output is recomputed on every render.
 *
 * EVIDENCE vs INTERPRETATION — the line this module exists to draw:
 *
 *   EVIDENCE        the persisted record itself: canon_event_id, subject,
 *                   the REAL (domain, frame) cell it was recorded in,
 *                   provenance, confidence, time, and the verbatim
 *                   context. Nothing in this module adds to it.
 *
 *   INTERPRETATION  everything below is a deterministic TOKEN MATCH over
 *                   that text — which dimensions the text NAMES, whether
 *                   it names an internal/external contradiction, which
 *                   general value it CLAIMS, and which Value Universe
 *                   entry that claim token-matches. Deterministic ≠
 *                   evidence: a reader wrote words, this module only
 *                   detects them. Every output is therefore labeled
 *                   STATIC (rule over a real record), never CANON, and
 *                   every detection carries the matched token so the
 *                   basis is inspectable.
 *
 * THE 6-CELL MODEL — 3 dimensions × 2 orientations, all kept distinct:
 *   PHYSICAL / EMOTIONAL / COGNITIVE  ×  INTERNAL / EXTERNAL
 * This TEXT-derived grid is deliberately separate from canon's own
 * (domain, frame) cell identity (G/E/C × I/R/S): the record's real cell
 * says where the measurement was FILED; the grid says which dimensions
 * the text TALKS ABOUT. Neither replaces the other, and the grid never
 * produces a level — a named dimension is a mention, not a measurement.
 *
 * GENERAL VALUE ≠ VALUE GROUP: a matched Value Universe subvalue (e.g.
 * "קבלה, שונות ופלורליזם") is a general value; whether any actual Value
 * GROUP relates to it is a separate join against real group
 * central_values, and when that join finds nothing the answer is
 * UNRESOLVED — stated, never invented.
 *
 * THE GENERAL PRINCIPLE (represented separately, NOT as a prohibition):
 * when the text names aversion/difference AND a contradiction, the
 * reading attaches the canonical principle "difference, ugliness or
 * aversion alone do not establish lesser systemic value" — explicitly
 * qualified: competing harm/safety evidence may create a legitimate
 * value conflict. It is guidance derived from the observation's own
 * claim, not an absolute rule, and it is labeled interpretation.
 */
import type { CanonObservationMark } from "./projectCanonDynamics";

export type ReadingDimension = "PHYSICAL" | "EMOTIONAL" | "COGNITIVE";
export type ReadingOrientation = "INTERNAL" | "EXTERNAL";

export interface DimensionDetection {
  dimension: ReadingDimension;
  /** The literal token that matched, `null` = not mentioned in the text. */
  matched_token: string | null;
}

export interface OrientationDetection {
  orientation: ReadingOrientation;
  matched_token: string | null;
}

export interface GeneralValueMatch {
  /** The value phrase the TEXT itself claims (e.g. "קבלת השונה"). */
  claimed_phrase: string;
  /** Best-matching Value FAMILY (universe tier 1) — kept separate from
   *  subvalues; a family is a grouping, not a runtime value. */
  matched_family: { family_id: string; name_he: string; stems: string[] } | null;
  /** Best-matching SUBVALUE (universe tier 2) — the runtime-value tier. */
  matched_subvalue: { subvalue_id: string; name_he: string; stems: string[] } | null;
}

export interface ObservationReading {
  /** EVIDENCE — the real record this reading is OF. */
  canon_event_id: string;
  subject: string;
  /** Canon's own real cell (where it was filed) — NOT the text grid. */
  recorded_cell: { domain: string; frame: string };
  observed_at: string;
  provenance: string;
  confidence?: number;
  context: string;
  /** INTERPRETATION — all deterministic token detections below. */
  dimensions: DimensionDetection[];
  orientations: OrientationDetection[];
  /** Text names a contradiction/opposition. */
  contradiction: { detected: boolean; matched_token: string | null };
  /** The text's own explicit value claim, joined to the real universe. */
  general_value: GeneralValueMatch | null;
  /** Attached only when aversion/difference + contradiction are named. */
  principle: { text: string; qualifier: string } | null;
}

const DIMENSION_TOKENS: Record<ReadingDimension, RegExp> = {
  PHYSICAL: /גופני|גופנית|גוף|פיזי|פיזית/,
  EMOTIONAL: /רגשי|רגשית|רגש/,
  COGNITIVE: /שכלי|שכלית|שכל|קוגניטיבי/,
};

const ORIENTATION_TOKENS: Record<ReadingOrientation, RegExp> = {
  INTERNAL: /פנימי|פנימית|פנים/,
  EXTERNAL: /חיצוני|חיצונית|חוץ/,
};

const CONTRADICTION_TOKENS = /ניגוד|סתירה|קונפליקט|מתח בין/;
const AVERSION_TOKENS = /רתיעה|מכוער|דחייה|גועל|שונה/;

/** "X היא ערך" / "X הוא ערך" — the text's own explicit value claim. */
const VALUE_CLAIM = /([֐-׿"׳״\s]{2,40}?)\s+(?:היא|הוא)\s+ערך/;

/** ≥3-char Hebrew stems of a phrase, definite-article stripped — the
 *  smallest deterministic unit the universe join matches on. */
function stems(phrase: string): string[] {
  return phrase
    .split(/[\s,·-]+/)
    .map((w) => w.replace(/^[הו]/, "").replace(/[^֐-׿]/g, ""))
    .filter((w) => w.length >= 3)
    .map((w) => w.slice(0, 3));
}

function detect(re: RegExp, text: string): string | null {
  const m = re.exec(text);
  return m ? m[0] : null;
}

/**
 * The one shared derivation. `universe` = the real 251 runtime subvalue
 * names (caller passes `SUBVALUES`' own name/id pairs — this module takes
 * data, not a store dependency, so it stays pure and testable).
 */
export function deriveObservationReading(
  mark: Pick<CanonObservationMark, "canon_event_id" | "subject" | "domain" | "frame" | "observed_at" | "provenance" | "confidence" | "context">,
  universe: {
    subvalues: readonly { subvalue_id: string; name_he: string }[];
    families: readonly { id: string; name_he: string }[];
  },
): ObservationReading {
  const text = mark.context;

  const dimensions: DimensionDetection[] = (Object.keys(DIMENSION_TOKENS) as ReadingDimension[]).map((d) => ({
    dimension: d,
    matched_token: detect(DIMENSION_TOKENS[d], text),
  }));
  const orientations: OrientationDetection[] = (Object.keys(ORIENTATION_TOKENS) as ReadingOrientation[]).map((o) => ({
    orientation: o,
    matched_token: detect(ORIENTATION_TOKENS[o], text),
  }));
  const contradictionToken = detect(CONTRADICTION_TOKENS, text);

  // The text's own value claim, joined against the REAL universe by stem
  // overlap (≥2 shared stems), at BOTH tiers separately — family and
  // subvalue are different kinds of thing and are never conflated. A tier
  // with no ≥2-stem match is an honest null, never a nearest-guess.
  let general_value: GeneralValueMatch | null = null;
  const claim = VALUE_CLAIM.exec(text);
  if (claim) {
    const phrase = claim[1].trim();
    const claimStems = stems(phrase);
    const bestOf = <T,>(rows: readonly T[], name: (r: T) => string): { row: T; shared: string[] } | null => {
      let best: { row: T; shared: string[] } | null = null;
      for (const r of rows) {
        const shared = claimStems.filter((s) => name(r).includes(s));
        if (shared.length >= 2 && (best === null || shared.length > best.shared.length)) best = { row: r, shared };
      }
      return best;
    };
    const fam = bestOf(universe.families, (f) => f.name_he);
    const sv = bestOf(universe.subvalues, (s) => s.name_he);
    general_value = {
      claimed_phrase: phrase,
      matched_family: fam ? { family_id: fam.row.id, name_he: fam.row.name_he, stems: fam.shared } : null,
      matched_subvalue: sv ? { subvalue_id: sv.row.subvalue_id, name_he: sv.row.name_he, stems: sv.shared } : null,
    };
  }

  const aversion = detect(AVERSION_TOKENS, text);
  const principle = aversion && contradictionToken
    ? {
        text: "שוני, כיעור או רתיעה לבדם אינם מבססים ערך מערכתי נמוך יותר.",
        qualifier: "לא איסור מוחלט: ראיות נזק/בטיחות מתחרות עשויות ליצור קונפליקט ערכים לגיטימי.",
      }
    : null;

  return {
    canon_event_id: mark.canon_event_id,
    subject: mark.subject,
    recorded_cell: { domain: mark.domain, frame: mark.frame },
    observed_at: mark.observed_at,
    provenance: mark.provenance,
    confidence: mark.confidence,
    context: text,
    dimensions,
    orientations,
    contradiction: { detected: contradictionToken !== null, matched_token: contradictionToken },
    general_value,
    principle,
  };
}
