/**
 * Value Universe classification — the real STATUS pass over the 328-entry
 * Board review source (`valueUniverse328.ts`). Per the source document's
 * own explicit Board rule ("328 RAW ENTRIES ≠ 328 CANONICAL VALUE
 * GROUPS... only after SOURCE → DEDUP → DEFINITION → BOUNDARY → FAMILY
 * → STATUS → PRODUCT ENTITY") and the mission's own instruction ("The
 * 328 document itself is NOT sufficient to make something
 * CANONICAL_RUNTIME"), status is never assigned because an entry merely
 * appears in the document — only because of a REAL, checkable signal:
 *
 *   CANONICAL_RUNTIME — the subvalue's own name matches a REAL, LIVE
 *     runtime Value (an actual `central_value` of a real or DEMO Value
 *     Group today, from `valueRegistry.ts`) — the only path to this
 *     status, exactly as `valueGroupTaxonomy.ts::classifyValueTaxonomy`
 *     already established for the 28-family pass.
 *   REVIEW_REQUIRED — the subvalue is cited by 3 or more DIFFERENT real
 *     source entries (independent traditions/interpretations converging
 *     on the same concept) AND has a real family match — a real,
 *     mechanical corroboration-strength signal, not an arbitrary cutoff:
 *     3+ is the same "genuinely converged from multiple independent
 *     citations" bar this codebase already uses elsewhere (§49's
 *     `SOURCE_GROUP_FORMATION_RULES` reasoning).
 *   REFERENCE_ONLY — every other subvalue: real source citation exists
 *     (1-2 citations, or no reliable family match), but not yet strong
 *     enough for a promotion review.
 *   UNSUPPORTED — never occurs for a subvalue built FROM this document
 *     (every subvalue has ≥1 real citation by construction) — reserved
 *     for completeness/type-symmetry with `valueGroupTaxonomy.ts`, not
 *     because this module invents a case that can't happen here.
 */
import type { Subvalue } from "./valueUniverse328";

export type SubvalueStatus = "CANONICAL_RUNTIME" | "REVIEW_REQUIRED" | "REFERENCE_ONLY" | "UNSUPPORTED";

export interface ClassifiedSubvalue extends Subvalue {
  status: SubvalueStatus;
  status_reason: string;
  matched_runtime_value_names: string[];
}

/** Whole-word match only — a raw bidirectional substring check (the
 *  earlier version of this function) produces false positives on Hebrew
 *  compounds: e.g. "כנות" (honesty) is a literal substring of "שכנות
 *  טובה" (good neighborliness) despite the two concepts being unrelated.
 *  Splitting on whitespace and requiring one side to be a whole word (or
 *  the whole trimmed string) of the other keeps the real-evidence-only
 *  bar honest for CANONICAL_RUNTIME promotion. */
function nameMatches(a: string, b: string): boolean {
  const trimmedA = a.trim();
  const trimmedB = b.trim();
  if (trimmedA === trimmedB) return true;
  return trimmedA.split(/\s+/).includes(trimmedB) || trimmedB.split(/\s+/).includes(trimmedA);
}

/** Pure, deterministic, no I/O. `runtimeValueNames` is the caller's
 *  already-loaded `valueRegistry.ts::ValueEntry[]` names. */
export function classifySubvalues(subvalues: Subvalue[], runtimeValueNames: string[]): ClassifiedSubvalue[] {
  return subvalues.map((sv) => {
    const matchedRuntime = runtimeValueNames.filter((name) => nameMatches(sv.name_he, name));
    if (matchedRuntime.length > 0) {
      return {
        ...sv,
        status: "CANONICAL_RUNTIME" as const,
        status_reason: `matches ${matchedRuntime.length} real, live runtime Value(s)`,
        matched_runtime_value_names: matchedRuntime,
      };
    }
    if (sv.source_count >= 3 && sv.family_id) {
      return {
        ...sv,
        status: "REVIEW_REQUIRED" as const,
        status_reason: `${sv.source_count} independent source citations converge on this concept, real family match — awaiting board promotion decision`,
        matched_runtime_value_names: [],
      };
    }
    return {
      ...sv,
      status: "REFERENCE_ONLY" as const,
      status_reason: sv.family_id
        ? `${sv.source_count} source citation(s), below the 3-citation review threshold`
        : `${sv.source_count} source citation(s), no reliable family match (cross-family or ambiguous — needs board review)`,
      matched_runtime_value_names: [],
    };
  });
}

export interface ValueUniverseCounts {
  raw_total: number;
  normalized_total: number;
  value_families: number;
  subvalues: number;
  canonical_runtime: number;
  review_required: number;
  reference_only: number;
  unsupported: number;
}

export function countValueUniverse(rawTotal: number, familyCount: number, classified: ClassifiedSubvalue[]): ValueUniverseCounts {
  return {
    raw_total: rawTotal,
    normalized_total: familyCount + classified.length,
    value_families: familyCount,
    subvalues: classified.length,
    canonical_runtime: classified.filter((s) => s.status === "CANONICAL_RUNTIME").length,
    review_required: classified.filter((s) => s.status === "REVIEW_REQUIRED").length,
    reference_only: classified.filter((s) => s.status === "REFERENCE_ONLY").length,
    unsupported: classified.filter((s) => s.status === "UNSUPPORTED").length,
  };
}
