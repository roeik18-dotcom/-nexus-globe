/**
 * BASE OPPOSITION DETECTOR — reads the SOURCE's own 24 oppositions directly
 * out of observation text.
 *
 * ── Why this is not a mapping ──────────────────────────────────────────
 *
 * The runtime already classifies 5 DIMENSIONAL contradictions
 * (`classifier.ts`: INTERNAL_VS_EXTERNAL, PHYSICAL_VS_EMOTIONAL, …). The
 * source model separately defines 24 BASE oppositions (`sourceValueModel
 * .ts`: רצון↔פחד, לחץ↔שחרור, …). No source states any relation between
 * those two vocabularies, and inventing one would be fabrication.
 *
 * This module does not join them. It detects the 24 the same way the
 * runtime already detects everything else — by looking for the source's
 * OWN words in the text. Each opposition's `source_wording` is a literal
 * two-pole phrase; splitting it on its own separator yields the two poles,
 * and a pole is reported only when its literal word appears. That is
 * derivation from the source, not a bridge between models.
 *
 * The 5 and the 24 therefore remain two independent detections over the
 * same text, and `mapping_status` says so on every single result.
 *
 * ── MENTIONED != MEASURED ──────────────────────────────────────────────
 *
 * Every result is `INTERPRETED_CONTRADICTION`. A word appearing in an
 * Observation's free text is a MENTION. It does not measure a cell, does
 * not set a level, and does not establish that the person is in that
 * opposition — only that the text named it. There is no magnitude here,
 * because the source supplies none.
 */
import { SOURCE_CONCEPTS } from "../community/sourceValueModel";

/** The source uses `↔` throughout, and `½` in a handful of rows where the
 *  arrow was mangled in extraction. Both are the SAME separator; treating
 *  the mojibake as a second separator recovers those rows instead of
 *  silently dropping them. */
const POLE_SEPARATOR = /↔|½/;

export type OppositionEpistemicStatus =
  | "MEASURED_CONTRADICTION"
  | "DERIVED_CONTRADICTION"
  | "INTERPRETED_CONTRADICTION"
  | "SOURCE_REFERENCE"
  | "UNRESOLVED_CONTRADICTION";

export interface BaseOpposition {
  contradiction_id: string;
  /** Both poles, verbatim from the source wording. */
  poles: [string, string];
  source_wording: string;
  normalized_label: string;
  /** The source model's own domain grouping, when it states one. */
  contradiction_family?: string;
  confidence: string;
  review_status: string;
}

export interface BaseOppositionDetection {
  contradiction_id: string;
  normalized_label: string;
  source_wording: string;
  /** Which pole the text actually named, and the literal token matched. */
  matched_pole: string;
  matched_token: string;
  /** 0 = first pole, 1 = second. Direction ONLY in the sense of which pole
   *  was named — never a magnitude and never a movement. */
  pole_index: 0 | 1;
  contradiction_family?: string;
  epistemic_status: OppositionEpistemicStatus;
  /** Always NO_MAPPING — see the module header. */
  mapping_status: "NO_MAPPING_TO_RUNTIME_CLASSES";
  /** The source states no magnitude for any opposition. */
  magnitude: "UNRESOLVED";
}

/** The 24 oppositions as SOURCE_REFERENCE — every one, detected or not. */
export function listBaseOppositions(): BaseOpposition[] {
  const out: BaseOpposition[] = [];
  for (const c of SOURCE_CONCEPTS) {
    if (c.type !== "CONTINUUM") continue;
    const parts = String(c.source_wording).split(POLE_SEPARATOR).map((p) => p.trim()).filter(Boolean);
    if (parts.length !== 2) continue; // never guess a missing pole
    out.push({
      contradiction_id: c.canonical_id,
      poles: [parts[0], parts[1]],
      source_wording: c.source_wording,
      normalized_label: c.normalized_label,
      contradiction_family: c.domain,
      confidence: c.confidence,
      review_status: c.review_status,
    });
  }
  return out;
}

/** Hebrew prefix tolerance, matching `observationReading.ts`'s own
 *  approach: strip a leading definite article / conjunction before
 *  comparing. Deliberately conservative — no stemming, no fuzzy match. */
function textContainsPole(text: string, pole: string): string | null {
  const needle = pole.replace(/[־-]/g, "").trim();
  if (needle.length < 2) return null;
  const haystack = text.replace(/[־-]/g, "");
  if (haystack.includes(needle)) return pole;
  // the same word carrying a leading ה/ו/ב/ל/מ/ש/כ
  const m = new RegExp(`[הובלמשכ]${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).exec(haystack);
  return m ? m[0] : null;
}

/**
 * Detect which of the 24 the text names. Pure — no I/O, no clock.
 *
 * An opposition is reported ONCE, for the first pole found. If the text
 * names both poles the first is reported; the source gives no rule for
 * ranking poles, so choosing one over the other would be invention.
 */
export function detectBaseOppositions(text: string): BaseOppositionDetection[] {
  const src = String(text ?? "");
  if (!src.trim()) return [];
  const out: BaseOppositionDetection[] = [];
  for (const o of listBaseOppositions()) {
    for (let i = 0 as 0 | 1; i <= 1; i = (i + 1) as 0 | 1) {
      const hit = textContainsPole(src, o.poles[i]);
      if (!hit) continue;
      out.push({
        contradiction_id: o.contradiction_id,
        normalized_label: o.normalized_label,
        source_wording: o.source_wording,
        matched_pole: o.poles[i],
        matched_token: hit,
        pole_index: i,
        contradiction_family: o.contradiction_family,
        epistemic_status: "INTERPRETED_CONTRADICTION",
        mapping_status: "NO_MAPPING_TO_RUNTIME_CLASSES",
        magnitude: "UNRESOLVED",
      });
      break;
    }
  }
  return out;
}
