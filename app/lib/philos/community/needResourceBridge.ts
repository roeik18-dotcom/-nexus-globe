/**
 * NEED ↔ RESOURCE — candidate matches, derived and labelled as derived.
 *
 * THREE STATES, NEVER COLLAPSED:
 *   CANDIDATE  this pair is compatible on a recorded field
 *   ACCEPTED   a person recorded MATCH_ACCEPTED — a decision, not a computation
 *   ACTION     an ACTION event references the match — doing, not agreeing
 * A candidate is an offer to a human to look; it is not an agreement, and an
 * agreement is not work performed. Collapsing any two of them would let the
 * system report activity it inferred as activity that happened.
 *
 * COMPATIBILITY IS A RECORDED FIELD, NEVER A SIMILARITY. A candidate is
 * emitted only when need and resource share a canonical `subvalue_id`, or the
 * same `unit`, or the same `geography` string — each a value someone wrote
 * down. Text resemblance between descriptions produces nothing: that is the
 * SIMILARITY ≠ RELATION rule, and it is why this module has no fuzzy matcher.
 *
 * Candidates carry `provenance: "DERIVED"` and no actor. They are never
 * written to the event store by this module — deriving is reading.
 */
import type { NeedState, ResourceState, MatchState } from "./groupOperationalState";

export type MatchBasis = "SHARED_SUBVALUE" | "SHARED_UNIT" | "SHARED_GEOGRAPHY";

export interface CandidateMatch {
  match_id: string;
  need_ref: string;
  resource_ref: string;
  need_group_id: string;
  resource_group_id: string;
  /** Every recorded field the pair agrees on. More bases = stronger, still
   *  never an acceptance. */
  bases: MatchBasis[];
  basis: string;
  provenance: "DERIVED";
  source: string;
  /** True when need and resource belong to different groups — the only kind
   *  that can produce a cross-group relation. */
  cross_group: boolean;
}

const OPEN_NEED = (n: NeedState) => n.status === "OPEN" || n.status === "MATCHED";
const LIVE_RESOURCE = (r: ResourceState) => r.status === "AVAILABLE" || r.status === "MATCHED";

export function deriveCandidateMatches(
  needs: readonly NeedState[],
  resources: readonly ResourceState[],
): CandidateMatch[] {
  const out: CandidateMatch[] = [];
  for (const n of needs) {
    if (!OPEN_NEED(n)) continue;
    for (const r of resources) {
      if (!LIVE_RESOURCE(r)) continue;
      const bases: MatchBasis[] = [];
      if (n.subvalue_id && r.subvalue_id && n.subvalue_id === r.subvalue_id) bases.push("SHARED_SUBVALUE");
      if (n.unit && r.unit && n.unit === r.unit) bases.push("SHARED_UNIT");
      if (n.geography && r.geography && n.geography === r.geography) bases.push("SHARED_GEOGRAPHY");
      if (bases.length === 0) continue;
      out.push({
        match_id: `cand_${n.need_id}__${r.resource_id}`,
        need_ref: n.need_id, resource_ref: r.resource_id,
        need_group_id: n.group_id, resource_group_id: r.group_id,
        bases,
        basis: bases.map((b) => ({
          SHARED_SUBVALUE: `שניהם ממופים ל-${n.subvalue_id}`,
          SHARED_UNIT: `אותה יחידה (${n.unit})`,
          SHARED_GEOGRAPHY: `אותו אזור (${n.geography})`,
        })[b]).join(" · "),
        provenance: "DERIVED",
        source: "נגזר משדות מתועדים של הצורך והמשאב — לא מדמיון טקסטואלי",
        cross_group: n.group_id !== r.group_id,
      });
    }
  }
  return out;
}

/** Candidates a person has NOT already ruled on. A recorded ACCEPTED or
 *  REJECTED is the answer; re-offering it as a candidate would ask again. */
export function pendingCandidates(
  candidates: readonly CandidateMatch[],
  recorded: readonly MatchState[],
): CandidateMatch[] {
  const decided = new Set(recorded.filter((m) => m.status !== "CANDIDATE").map((m) => `${m.need_ref}__${m.resource_ref}`));
  return candidates.filter((c) => !decided.has(`${c.need_ref}__${c.resource_ref}`));
}
