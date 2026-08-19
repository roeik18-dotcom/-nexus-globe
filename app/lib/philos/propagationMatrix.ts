/**
 * PROPAGATION MATRIX — which surfaces genuinely change when one real record
 * is written, and why.
 *
 * The question this answers is deliberately narrow: **if a user records one
 * thing, what actually moves?** Not "which surface mentions the concept" —
 * that would score the shared PersonFrame as propagation on all seven, which
 * is exactly the illusion this matrix exists to dispel. The frame is shared
 * context, not propagation, and it is excluded by construction.
 *
 * Cells are classified from the real wiring in this repository, not from
 * intent:
 *
 *   DIRECT     the surface reads the record itself and its content changes
 *   DERIVED    the surface reads something computed FROM the record
 *   REFERENCE  the surface shows the concept as source/reference material,
 *              and a new record of this kind would NOT change it
 *   UNRESOLVED the link is conceptually meaningful but nothing consumes it
 *   N/A        the concept is not this surface's question
 *
 * `UNRESOLVED` is the useful column. Each one is a real, nameable gap, and
 * `linkGapClass` below says which KIND of gap it is — because a gap caused
 * by missing data is a very different thing from one caused by a projection
 * nobody wrote.
 */

export type PropagationKind = "DIRECT" | "DERIVED" | "REFERENCE" | "UNRESOLVED" | "NOT_APPLICABLE";
export type SurfaceKey = "hub" | "brain" | "dynamics" | "marketplace" | "community" | "globe" | "world";

/** Why a link is missing. Only B and C are safe to repair automatically. */
export type LinkGapClass =
  | "A_DATA_ABSENT"              // the record type exists; none has been written
  | "B_PROJECTION_MISSING"       // data exists, no projection renders it
  | "C_RELATION_NOT_CONSUMED"    // a real relation exists and is simply unread
  | "D_SCHEMA_LINKAGE_MISSING"   // no field can express the link
  | "E_CANON_FORBIDS";           // canon explicitly refuses the derivation

export interface MatrixCell {
  kind: PropagationKind;
  /** What the surface reads. */
  via?: string;
  /** Set only when kind === "UNRESOLVED". */
  gap?: LinkGapClass;
  note?: string;
}

export interface MatrixRow {
  concept: string;
  cells: Record<SurfaceKey, MatrixCell>;
}

const D = (via: string): MatrixCell => ({ kind: "DIRECT", via });
const V = (via: string): MatrixCell => ({ kind: "DERIVED", via });
const R = (note: string): MatrixCell => ({ kind: "REFERENCE", note });
const U = (gap: LinkGapClass, note: string): MatrixCell => ({ kind: "UNRESOLVED", gap, note });
const N: MatrixCell = { kind: "NOT_APPLICABLE" };

export const PROPAGATION_MATRIX: MatrixRow[] = [
  { concept: "Observation", cells: {
    hub: D("buildMeasuredStateSpace → PERSON NOW 3×3"),
    brain: V("observationReading → classification"),
    dynamics: D("CausalChainFlow anchor + BEFORE→AFTER"),
    marketplace: N,
    community: V("latest observation text → source-opposition mentions"),
    globe: R("canon Observation carries no coordinate; never drawn"),
    world: V("WORLD GROUP RELEVANCE reads the same reading"),
  }},
  { concept: "Runtime Contradiction (5)", cells: {
    hub: D("ATTENTION chain link 2"),
    brain: D("classification + provenance"),
    dynamics: V("feature set for comparison"),
    marketplace: N, community: N, globe: N,
    world: V("competing-values line"),
  }},
  { concept: "Source Contradiction Mention (110)", cells: {
    hub: D("SOCIAL-VALUE summary, REAL column"),
    brain: D("provenance panel"),
    dynamics: D("source-opposition mentions rendered under the causal chain (repaired: gap B)"),
    marketplace: N,
    community: D("SOCIAL SOURCE SPINE, detected rows first"),
    globe: R("registry shown as source; never an edge"),
    world: R("shown as source spine"),
  }},
  { concept: "Contradiction→Value Relation (4)", cells: {
    hub: D("SOCIAL-VALUE summary, SOURCE column"),
    brain: D("each relation listed with source wording, status and cardinality (repaired: gap B)"),
    dynamics: N,
    marketplace: N,
    community: D("spine link 2"),
    globe: R("not an edge"), world: R("conceptual only"),
  }},
  { concept: "Personal Value", cells: {
    hub: N, brain: N, dynamics: N, marketplace: N,
    community: R("spine link 3 — conceptual, renders — not a count"),
    globe: N, world: R("conceptual"),
  }},
  { concept: "Group Value", cells: {
    hub: N, brain: N, dynamics: N, marketplace: N,
    community: R("spine link 4 — aggregation operation UNDEFINED"),
    globe: N, world: R("conceptual"),
  }},
  { concept: "Value Group", cells: {
    hub: D("VALUE / GROUP card"),
    brain: V("operational group profile"),
    dynamics: D("GROUP TRAJECTORY"),
    marketplace: D("VALUE GROUP flow stage"),
    community: D("spine link 5 + group boards"),
    globe: D("real group nodes"),
    world: D("WORLD GROUP RELEVANCE"),
  }},
  { concept: "Membership", cells: {
    hub: D("verified membership in frame + chain link 6"),
    brain: V("group reasoning"),
    dynamics: N,
    marketplace: D("PERSON↔GROUP context"),
    community: D("spine link 6"),
    globe: D("MEMBER_OF edges"),
    world: V("group relevance"),
  }},
  { concept: "Need", cells: {
    hub: D("OPEN NEED card"),
    brain: V("next-action priority"),
    dynamics: V("next action"),
    marketplace: D("NEED flow stage"),
    community: D("member needs"),
    globe: D("CanonActivityPanel"),
    world: N,
  }},
  { concept: "Capability", cells: {
    hub: N,
    brain: N, dynamics: N,
    marketplace: D("capability/offer stage"),
    community: U("A_DATA_ABSENT", "capabilities: UNKNOWN — no capability record exists for any group"),
    globe: N, world: R("PUDM capabilities are REFERENCE"),
  }},
  { concept: "Resource / Offer", cells: {
    hub: N, brain: N,
    dynamics: V("community capital timeline"),
    marketplace: D("OFFER stage"),
    community: D("resources / capital"),
    globe: D("transfer arcs"),
    world: N,
  }},
  { concept: "Match", cells: {
    hub: N, brain: N, dynamics: N,
    marketplace: D("MATCH stage, permit not persisted by design"),
    community: N, globe: N, world: N,
  }},
  { concept: "Action", cells: {
    hub: D("WHAT CHANGED"),
    brain: D("BrainDerivation changes"),
    dynamics: D("causal chain ACTION stage"),
    marketplace: D("ACTION stage"),
    community: D("linked actions via bridge"),
    globe: D("RED internal role"),
    world: V("systemic impact"),
  }},
  { concept: "Effect", cells: {
    hub: D("verification state on WHAT CHANGED"),
    brain: D("evidence + why-it-changed"),
    dynamics: D("EFFECT stage"),
    marketplace: D("EFFECT stage"),
    community: D("group effects + RED role"),
    globe: D("effect counts"),
    world: V("verified impact"),
  }},
  { concept: "Evidence", cells: {
    hub: D("RECENT EVIDENCE with real verifier/confidence"),
    brain: D("evidence_records"),
    dynamics: D("EVIDENCE stage"),
    marketplace: D("EVIDENCE stage"),
    community: D("WHITE internal role"),
    globe: D("WHITE internal role"),
    world: D("evidence boundary"),
  }},
];

export const SURFACES: SurfaceKey[] = ["hub", "brain", "dynamics", "marketplace", "community", "globe", "world"];

export function matrixSummary() {
  const counts: Record<PropagationKind, number> = {
    DIRECT: 0, DERIVED: 0, REFERENCE: 0, UNRESOLVED: 0, NOT_APPLICABLE: 0,
  };
  const gaps: { concept: string; surface: SurfaceKey; gap: LinkGapClass; note?: string }[] = [];
  for (const row of PROPAGATION_MATRIX) {
    for (const s of SURFACES) {
      const c = row.cells[s];
      counts[c.kind] += 1;
      if (c.kind === "UNRESOLVED" && c.gap) gaps.push({ concept: row.concept, surface: s, gap: c.gap, note: c.note });
    }
  }
  return { counts, gaps, rows: PROPAGATION_MATRIX.length, surfaces: SURFACES.length };
}
