/**
 * VALUE MAPPING — group's declared value  →  canonical taxonomy, honestly.
 *
 * THE RULE (ruling §"Canonical vocabulary"): string equality is not ontology,
 * and a fuzzy match is not evidence. `vg_ahrayut_kehilatit` declares the label
 * "אחריות". The 223 canonical sub-values contain FOUR strings that share that
 * prefix — אחריות קהילתית, אחריות כלכלית, אחריות למעשה, אחריות משפחתית — and
 * ZERO that equal it. Choosing one of the four would assert a value identity
 * nobody has ruled on, permanently, in a store. So this module chooses none:
 * it reports the candidates and returns `UNRESOLVED_REVIEW_REQUIRED`.
 *
 * The four layers stay four layers, per the ruling:
 *   28 FAMILIES → 223 SUB-VALUES   canonical Community discovery taxonomy
 *   65 BASE VALUES                 separate canonical semantic layer
 *   12 PUDM values                 existing model/dimension layer
 * Mappings BETWEEN layers exist only where evidence supports them. Today the
 * measured overlap between the PUDM 12 and the 223 sub-values is 0 (the PUDM
 * set is English, the sub-value set is Hebrew), so no cross-layer mapping is
 * asserted here — an empty mapping set is the truthful state, not a gap to
 * paper over with translation guesses.
 *
 * HOW A MAPPING BECOMES RESOLVED. Not by code change: by a record in
 * `value-group-mappings.jsonl` carrying `decided_by` + `evidence`. That store
 * is append-only like every other canon store, and this module reads it. A
 * ruling is data.
 */
import { SUBVALUES, RAW_FAMILIES } from "./valueUniverse328";
import type { ValueMappingStatus } from "./canonicalValueGroup";

export interface SubvalueCandidate {
  subvalue_id: string;
  name_he: string;
  family_id: string | null;
  /** Why this string is a candidate. Never an assertion that it is the match. */
  because: "EXACT_STRING" | "SHARED_PREFIX" | "CONTAINS";
}

/** A recorded human/board ruling. The ONLY thing that resolves a mapping. */
export interface ValueMappingRecord {
  group_id: string;
  primary_subvalue_id: string;
  secondary_subvalue_ids?: string[];
  decided_by: string;
  evidence: string;
  recorded_at: string;
}

export interface MappingOutcome {
  status: ValueMappingStatus;
  primary?: string;
  secondary?: readonly string[];
  family?: string;
  /** Listed for the screen and for whoever will rule. Never auto-applied. */
  candidates: readonly SubvalueCandidate[];
  because: string;
  provenance: "RECORDED_RULING" | "NO_RULING" | "NO_LABEL";
}

const FAMILY_IDS = new Set(RAW_FAMILIES.map((f) => f.id));

/** Strings in the 223 that relate to this label. A CANDIDATE LIST — the
 *  function deliberately has no "best match" concept and no threshold. */
export function candidatesFor(label: string): SubvalueCandidate[] {
  const l = label.trim();
  if (!l) return [];
  const out: SubvalueCandidate[] = [];
  for (const s of SUBVALUES) {
    const n = s.name_he;
    if (n === l) out.push({ subvalue_id: s.subvalue_id, name_he: n, family_id: s.family_id, because: "EXACT_STRING" });
    else if (n.startsWith(l + " ")) out.push({ subvalue_id: s.subvalue_id, name_he: n, family_id: s.family_id, because: "SHARED_PREFIX" });
    else if (n.includes(l) || l.includes(n)) out.push({ subvalue_id: s.subvalue_id, name_he: n, family_id: s.family_id, because: "CONTAINS" });
  }
  return out;
}

/**
 * Resolve one group's value mapping.
 *
 * An EXACT_STRING candidate is still not auto-applied when several exist, and
 * a single exact match IS applied — because at that point the taxonomy itself,
 * not a similarity heuristic, has supplied the identity. Everything else waits
 * for a ruling.
 */
export function resolveValueMapping(
  group_id: string,
  label: string | undefined,
  rulings: readonly ValueMappingRecord[],
): MappingOutcome {
  const ruled = rulings.find((r) => r.group_id === group_id);
  if (ruled) {
    const sv = SUBVALUES.find((s) => s.subvalue_id === ruled.primary_subvalue_id);
    return {
      status: "RESOLVED",
      primary: ruled.primary_subvalue_id,
      secondary: ruled.secondary_subvalue_ids,
      family: sv?.family_id ?? undefined,
      candidates: [],
      because: `הוכרע ע"י ${ruled.decided_by}: ${ruled.evidence}`,
      provenance: "RECORDED_RULING",
    };
  }

  if (!label || !label.trim()) {
    return { status: "NO_VALUE_DECLARED", candidates: [], because: "הקבוצה לא הצהירה ערך מרכזי", provenance: "NO_LABEL" };
  }

  const cands = candidatesFor(label);
  const exact = cands.filter((c) => c.because === "EXACT_STRING");

  if (exact.length === 1) {
    const c = exact[0];
    return {
      status: "RESOLVED",
      primary: c.subvalue_id,
      family: c.family_id && FAMILY_IDS.has(c.family_id) ? c.family_id : undefined,
      candidates: [],
      because: `הערך המוצהר "${label}" זהה בדיוק ל-${c.subvalue_id} בטקסונומיה הקנונית`,
      provenance: "NO_RULING",
    };
  }

  if (cands.length === 0) {
    return {
      status: "NO_CANDIDATE",
      candidates: [],
      because: `"${label}" אינו מופיע ב-223 תת-הערכים, גם לא חלקית — נדרשת הכרעה או הרחבת הטקסונומיה`,
      provenance: "NO_RULING",
    };
  }

  return {
    status: "UNRESOLVED_REVIEW_REQUIRED",
    candidates: cands,
    because:
      exact.length > 1
        ? `"${label}" מתאים בדיוק ל-${exact.length} תת-ערכים — נדרשת הכרעה`
        : `"${label}" אינו זהה לאף תת-ערך; ${cands.length} מועמדים חלקיים — התאמה מטושטשת אינה ראיה`,
    provenance: "NO_RULING",
  };
}
