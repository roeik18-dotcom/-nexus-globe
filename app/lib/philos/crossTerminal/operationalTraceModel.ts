/**
 * THE TRACE'S SHAPE, with no store attached.
 *
 * Split out because the builder imports the canon store accessors, which reach
 * `node:fs` — and a client component that needs only the vocabulary would drag
 * the filesystem into the browser bundle. Types and words live here; the
 * builder lives in `operationalTrace.ts` and re-exports these so server callers
 * still have one import.
 */
/**
 * `STRUCTURAL_GAP` is RED, and that is a deliberate reclassification.
 *
 * It was amber, on the reasoning that a design gap is neither truth nor
 * absence. But the four operational colours are the product's whole visual
 * vocabulary, and a fifth invented for one case teaches the reader that the
 * vocabulary is negotiable. Red already means "recorded tension or unresolved
 * operational risk"; a relationship the system CANNOT represent is exactly an
 * unresolved operational risk, and the strongest one on this screen. White
 * would be wrong in the other direction — it would say "nothing here", when
 * the truth is "nothing CAN be here until a model exists".
 *
 * The red describes the MISSING RELATIONSHIP, never the record. An offer whose
 * own record is REAL stays REAL; what is red is the join that does not exist.
 */
export type HopState =
  | "CONNECTED" | "AVAILABLE_UPSTREAM" | "NO_CANONICAL_LINK"
  | "STRUCTURAL_GAP" | "NO_EVENT" | "NO_RECORD";

export const HOP_WORD: Record<HopState, string> = {
  CONNECTED: "מחובר",
  AVAILABLE_UPSTREAM: "זמין במעלה",
  NO_CANONICAL_LINK: "אין קישור קנוני",
  STRUCTURAL_GAP: "פער מבני",
  NO_EVENT: "ערוץ ריק",
  NO_RECORD: "לא נרשם",
};

export interface TraceHop {
  key: string;
  label_he: string;
  /** The record ids actually at this position. Empty = nothing here. */
  ids: readonly string[];
  state: HopState;
  /** WHICH field on WHICH record carries the id that made this hop. */
  mechanism: string;
  because: string;
  /** Present when this hop is DERIVED rather than recorded — the rule, and
   *  the exact ids it read. A derived hop is never presented as canonical. */
  derivation?: {
    rule: string;
    from: Readonly<Record<string, string>>;
    store: string;
  };
  /** Present on STRUCTURAL_GAP: the machine-readable reason for the gap. */
  gap_reason?: string;
}

export interface OperationalTrace {
  group_id: string;
  hops: readonly TraceHop[];
  /** Join mechanisms the schema is missing, named so they can be designed. */
  missing_join_models: readonly { join: string; because: string; would_need: string }[];
}

