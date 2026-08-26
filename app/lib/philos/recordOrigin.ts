/**
 * RECORD ORIGIN — where a stored record CAME FROM, as a fact the record
 * itself carries.
 *
 * WHY THIS MODULE EXISTS AT ALL. Until now nothing in the canon envelope
 * could answer "is this record real?". The system had a dozen
 * origin/provenance unions, but every one of them lived in a layer that
 * DECIDES the answer at render time from context — which loader ran, which
 * store was read, which directory was configured. That is inference from
 * location, and it is exactly the thing a provenance claim must not be: a
 * record found in the real directory is not thereby a real record, and a
 * demo fixture loaded by a real loader does not become real.
 *
 * So origin becomes a FIELD, written once by a writer that actually knows,
 * and read verbatim by everyone else.
 *
 * WHY A NEW MODULE AND NOT A REUSED ONE. Two existing unions already have
 * exactly these four non-UNKNOWN values and exactly the right semantics —
 * `community/groupEvent.ts::GroupEventProvenance` and
 * `day/daySession.ts::DayProvenance`, the latter documented as "Same four
 * values as GroupEventProvenance; never inferred from location." Neither can
 * be reused: canon must not depend on `community/`, and `day/daySession.ts`
 * imports `../canon/actionLifecycle`, so importing it back would close a
 * cycle. Every other candidate lives in `shell/`, `analysis/`, `social/`,
 * `world/` or `crossTerminal/` — all downstream of canon — and none has the
 * right value set.
 *
 * This file therefore follows the precedent already set by
 * `analysisUnitIds.ts`: the shared thing is the SMALLEST thing. Zero imports,
 * no behaviour, no colour, no label, no store. Canon imports it; it imports
 * nothing.
 *
 * WHAT IS DELIBERATELY NOT HERE.
 *
 *   REFERENCE — a real and load-bearing value elsewhere (`world/
 *     systemEvidenceProjection.ts` rejects DEMO and REFERENCE separately,
 *     with distinct reasons), but it classifies how a record may be USED at
 *     the eligibility layer, not where it came from. No writer creates a
 *     stored canon record whose origin is "reference". Adding an unreachable
 *     value to a closed vocabulary only invites a later reader to ask a
 *     question nothing can answer. If such records ever exist, extending
 *     this union is a model change, not a projection choice.
 *
 *   DERIVED_REAL — used by `social/networkTruthGate.ts` and three other
 *     projections to mean a derivation whose every step is backed by an
 *     explicit stored reference. That is a VERDICT the gate computes about a
 *     derivation, not a fact the record carries. Origin says DERIVED; how
 *     well-backed that derivation is stays the gate's judgement.
 */

/** The closed vocabulary. Canonical order: strongest claim to weakest. */
export const RECORD_ORIGINS = [
  /** A person recorded it, through an authenticated first-party writer. */
  "REAL",
  /** The system inferred it from other records, and can say from what. */
  "DERIVED",
  /** A declared demonstration. Never becomes REAL by being read. */
  "DEMO",
  /** Bulk- or machine-ingested across a named external boundary. */
  "IMPORTED",
  /** The record does not say. NOT a default, and never a stand-in for REAL. */
  "UNKNOWN",
] as const;

export type RecordOrigin = (typeof RECORD_ORIGINS)[number];

const ORIGIN_SET: ReadonlySet<string> = new Set(RECORD_ORIGINS);

/** Total, never throws. Anything that is not one of the five is not an origin. */
export function isRecordOrigin(value: unknown): value is RecordOrigin {
  return typeof value === "string" && ORIGIN_SET.has(value);
}
