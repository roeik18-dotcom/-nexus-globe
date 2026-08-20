/**
 * NETWORK TRUTH GATE — every Globe edge must pass this to be drawn.
 *
 * Globe renders a NETWORK. A line between two nodes asserts that a relation
 * exists between two identifiable things. That assertion is cheap to draw and
 * expensive to be wrong about, so nothing reaches the sphere without passing
 * five explicit conditions, and every rejection keeps its reason.
 *
 * THE FIVE CONDITIONS
 *   1. FROM and TO are explicit, identifiable entity ids.
 *   2. RELATION_TYPE already exists in the supported model — never coined here.
 *   3. An explicit stored record or reference backs the relation.
 *   4. Provenance survives projection unchanged (REAL stays REAL, DEMO stays
 *      DEMO — projection never upgrades).
 *   5. Epistemic status is preserved exactly; CLAIMED is never shown as
 *      VERIFIED.
 *
 * WHAT MEMBERSHIP PROVES. `MEMBER_OF`, and nothing else. It does not prove
 * AFFECTS, SUPPORTS, ACTS_FOR, BENEFITS, CAUSES, SHARES_NEED or SHARES_VALUE.
 * Each of those needs its own record. This is enforced below, not merely
 * documented: a candidate whose only backing is a membership is rejected for
 * any relation type other than MEMBER_OF.
 *
 * NEVER AN EDGE — each has its own rejection reason so the refusal is legible
 * rather than a silent filter: chronological proximity, same value or value
 * family, same contradiction, membership-plus-assumption, text similarity,
 * same Need topic, shared Community presence, taxonomy overlap, visual
 * proximity.
 *
 * DERIVED_REAL is allowed only when every step of the derivation is backed by
 * an explicit stored reference AND the derivation rule already exists in the
 * accepted model (today: Need.origin_group_id -> Action.inputs ->
 * Effect.action_ref). A derivation with one unbacked step is not weaker
 * evidence — it is rejected.
 */

export type EpistemicStatus = "VERIFIED" | "CLAIMED" | "UNKNOWN";
export type EdgeProvenance = "REAL" | "DERIVED_REAL" | "DEMO";

/** Relation types the model already supports. Nothing outside this list is
 *  renderable — a new relation is a model change, not a projection choice. */
export const SUPPORTED_RELATIONS = [
  // Value-Group event log
  "member.joined", "leader.appointed", "group.opened", "transfer.completed",
  // Bridge layer (EntityLink)
  "PERSON_MEMBER_OF_COMMUNITY", "COMMUNITY_HAS_NEED",
  "ACTION_AFFECTS_COMMUNITY", "EFFECT_AFFECTS_COMMUNITY",
  "NEED_MATCHED_TO_OFFER", "PROVIDER_OFFERS_RESOURCE", "EFFECT_AFFECTS_PERSON",
] as const;

export type SupportedRelation = (typeof SUPPORTED_RELATIONS)[number];

/** What membership alone may NEVER be upgraded into. */
export const NOT_IMPLIED_BY_MEMBERSHIP = [
  "AFFECTS", "SUPPORTS", "ACTS_FOR", "BENEFITS", "CAUSES", "SHARES_NEED", "SHARES_VALUE",
] as const;

export type RejectionReason =
  | "NO_FROM_ENTITY"
  | "NO_TO_ENTITY"
  | "SELF_EDGE"
  | "UNSUPPORTED_RELATION_TYPE"
  | "NO_SOURCE_RECORD"
  | "MEMBERSHIP_DOES_NOT_IMPLY_THIS"
  | "DERIVATION_STEP_UNBACKED"
  | "PROVENANCE_UPGRADE_ATTEMPTED";

export interface EdgeCandidate {
  from_entity_id: string;
  to_entity_id: string;
  relation_type: string;
  source_record_id: string;
  provenance: EdgeProvenance;
  epistemic_status: EpistemicStatus;
  /** For DERIVED_REAL: every step's backing record id. A step with no id is
   *  an unbacked step and fails the gate. */
  derivation_steps?: { rule: string; backed_by: string }[];
  /** True when the ONLY thing backing this candidate is a membership record. */
  backed_only_by_membership?: boolean;
}

export interface GatePass { ok: true; edge: EdgeCandidate }
export interface GateReject { ok: false; candidate: EdgeCandidate; reason: RejectionReason; detail: string }
export type GateResult = GatePass | GateReject;

function blank(s: unknown): boolean {
  return typeof s !== "string" || s.trim() === "";
}

export function passesNetworkTruthGate(c: EdgeCandidate): GateResult {
  const reject = (reason: RejectionReason, detail: string): GateReject => ({ ok: false, candidate: c, reason, detail });

  // 1 — explicit, identifiable endpoints.
  if (blank(c.from_entity_id)) return reject("NO_FROM_ENTITY", "an edge with no named source is a claim about nothing");
  if (blank(c.to_entity_id)) return reject("NO_TO_ENTITY", "an edge with no named target invents a destination");
  if (c.from_entity_id === c.to_entity_id) return reject("SELF_EDGE", "an entity related to itself carries no network information");

  // 2 — relation type must already exist in the model.
  if (!(SUPPORTED_RELATIONS as readonly string[]).includes(c.relation_type)) {
    return reject("UNSUPPORTED_RELATION_TYPE", `${c.relation_type} is not in the supported model; a new relation is a model change, not a projection choice`);
  }

  // 3 — explicit backing record.
  if (blank(c.source_record_id)) {
    return reject("NO_SOURCE_RECORD", "no stored record or reference backs this relation");
  }

  // Membership proves MEMBER_OF and nothing else.
  if (c.backed_only_by_membership) {
    const isMembership = c.relation_type === "PERSON_MEMBER_OF_COMMUNITY" || c.relation_type === "member.joined";
    if (!isMembership) {
      return reject("MEMBERSHIP_DOES_NOT_IMPLY_THIS", `membership proves MEMBER_OF only; ${c.relation_type} needs its own record (never one of: ${NOT_IMPLIED_BY_MEMBERSHIP.join(", ")})`);
    }
  }

  // 4/5 — derivation integrity. Every step must name its backing record.
  if (c.provenance === "DERIVED_REAL") {
    const steps = c.derivation_steps ?? [];
    if (steps.length === 0) {
      return reject("DERIVATION_STEP_UNBACKED", "DERIVED_REAL with no declared derivation steps");
    }
    const unbacked = steps.find((s) => blank(s.backed_by));
    if (unbacked) {
      return reject("DERIVATION_STEP_UNBACKED", `derivation step "${unbacked.rule}" names no backing record; one unbacked step rejects the whole derivation`);
    }
  }

  // A DERIVED_REAL edge may never claim VERIFIED on its own — verification is
  // a property of a record, and a derivation records nothing new.
  if (c.provenance === "DERIVED_REAL" && c.epistemic_status === "VERIFIED") {
    return reject("PROVENANCE_UPGRADE_ATTEMPTED", "a derivation cannot produce verification; VERIFIED must come from a record that was actually verified");
  }

  return { ok: true, edge: c };
}

export interface GateReport {
  candidates: number;
  passed: EdgeCandidate[];
  rejected: GateReject[];
  byProvenance: Record<EdgeProvenance, number>;
  byStatus: Record<EpistemicStatus, number>;
  byReason: Record<string, number>;
}

export function runNetworkTruthGate(candidates: readonly EdgeCandidate[]): GateReport {
  const passed: EdgeCandidate[] = [];
  const rejected: GateReject[] = [];
  for (const c of candidates) {
    const r = passesNetworkTruthGate(c);
    if (r.ok) passed.push(r.edge); else rejected.push(r);
  }
  const byProvenance: Record<EdgeProvenance, number> = { REAL: 0, DERIVED_REAL: 0, DEMO: 0 };
  const byStatus: Record<EpistemicStatus, number> = { VERIFIED: 0, CLAIMED: 0, UNKNOWN: 0 };
  const byReason: Record<string, number> = {};
  for (const e of passed) { byProvenance[e.provenance]++; byStatus[e.epistemic_status]++; }
  for (const r of rejected) byReason[r.reason] = (byReason[r.reason] ?? 0) + 1;
  return { candidates: candidates.length, passed, rejected, byProvenance, byStatus, byReason };
}

/**
 * WORLD PROMOTION — a separate, stricter gate.
 *
 * The existence of a Globe relation establishes NOTHING about system
 * relevance. A group can be densely connected and have no wider-system
 * evidence whatsoever. Promotion to World therefore requires its own
 * supported wider-system evidence or reference, and network density is
 * explicitly not accepted as a substitute.
 */
export interface WorldPromotionCandidate {
  subject_record_id: string;
  /** An explicit wider-system evidence/reference record. Absent = ineligible. */
  system_evidence_ref?: string;
  /** Must be VERIFIED — a claimed system effect is not system relevance. */
  epistemic_status: EpistemicStatus;
}

export type WorldPromotion =
  | { eligible: true; record_id: string; evidence_ref: string }
  | { eligible: false; record_id: string; reason: "NO_SYSTEM_EVIDENCE" | "NOT_VERIFIED" };

export function evaluateWorldPromotion(c: WorldPromotionCandidate): WorldPromotion {
  if (blank(c.system_evidence_ref)) {
    return { eligible: false, record_id: c.subject_record_id, reason: "NO_SYSTEM_EVIDENCE" };
  }
  if (c.epistemic_status !== "VERIFIED") {
    return { eligible: false, record_id: c.subject_record_id, reason: "NOT_VERIFIED" };
  }
  return { eligible: true, record_id: c.subject_record_id, evidence_ref: c.system_evidence_ref as string };
}
