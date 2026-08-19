/**
 * Person ↔ Community-Member canonical identity link.
 *
 * Two real identity systems exist in this codebase today, built at
 * different times for different purposes, and never bridged:
 *   - `person_roei` (`subjectRegistry.ts::REAL_CURRENT_SUBJECT`) — the
 *     canon-side subject used by Human Config, Brain, Dynamics, Mission.
 *   - `p_you` (`viewer.ts::CURRENT_VIEWER`, display_name "את/ה") — the
 *     Value-Group event-log's own viewer identity, used by Hub's Value
 *     Group panel, `/hub/community`, and everywhere `resolveViewer()` is
 *     read.
 * Nothing in the codebase has ever asserted these are the same human.
 * This module is the ONLY place that assertion may be made — explicitly,
 * never inferred.
 *
 * ── Hard rules (all enforced structurally, by absence, not by a runtime
 *    check that could be bypassed) ──────────────────────────────────────
 * - NO DISPLAY-NAME MATCHING: no function in this file reads a
 *   `display_name` at all. A link is asserted by id pair, never guessed
 *   from "את/ה" looking like anyone in particular.
 * - NO HEURISTIC LINKING: there is no `inferLink`/`suggestLink`/
 *   `matchByX` function anywhere in this file. The only way a
 *   `PersonCommunityLink` record comes to exist is `declareSamePerson`/
 *   `confirmSamePerson` below, each producing exactly one explicit,
 *   attributable record.
 * - NO SILENT MERGE: linking never mutates `Person`/`Need`/`Viewer`/
 *   canon Observation data, and never merges two ids into one. It is a
 *   side-table FACT about a relationship between two ids that keep their
 *   own separate identities — same "Relations own cross-references, Nodes
 *   don't" discipline PUDM already states (`docs/philos-universal-data-
 *   model-v0.md` §2.2).
 * - NO DUPLICATE PERSON CREATION: this module never mints a `person_id`
 *   or `community_member_id` — both must already exist (checked by the
 *   caller against `subjectRegistry.ts`/`resolveViewer()`, which this
 *   module does not import, to keep it usable for ANY future person/
 *   community pair, not only today's one real instance).
 *
 * ── Honesty about "VERIFIED" in a single-viewer system ──────────────────
 * `viewer.ts`'s own header states Philos has no sessions and no second
 * participant yet. So there is no independent second party available to
 * verify a link the way `events.ts`'s `community_verified`/
 * `external_verified` require. `VERIFIED_SAME_PERSON` here means the
 * single local viewer explicitly re-confirmed their own declaration
 * through a deliberate SECOND, separate step (`confirmSamePerson`,
 * requiring an existing `DECLARED_SAME_PERSON` record to point back at)
 * — the strongest tier a single-viewer system can honestly support. It is
 * still, structurally, self-report — same ladder `viewerIdentity.ts`
 * already grades every identity claim on (§10) — not a claim of
 * independent/external verification.
 */

export type LinkStatus =
  | "VERIFIED_SAME_PERSON"
  | "DECLARED_SAME_PERSON"
  | "UNVERIFIED"
  | "CONFLICT"
  | "NOT_LINKED";

/** The 4 states an actual written record can carry. `NOT_LINKED` is never
 *  written — it is the honest answer when no record exists at all (see
 *  `resolvePersonCommunityLink`), mirroring how this codebase already
 *  treats other absences (`current_level: null`, not a fabricated 0). */
export type PersistedLinkStatus = Exclude<LinkStatus, "NOT_LINKED" | "CONFLICT">;

/**
 * Who asserted the link. `self` = the person named by `person_id` is the
 * one declaring it (the only real, exercised path today — there is one
 * viewer). `third_party`/`system_import` are real, distinct provenances
 * this type supports for a future multi-participant system, but produce
 * `UNVERIFIED` only — never `DECLARED_SAME_PERSON`/`VERIFIED_SAME_PERSON`,
 * which are reserved for the named person's own explicit act.
 */
export type DeclarationSource = "self" | "third_party" | "system_import";

export interface PersonCommunityLink {
  link_id: string;
  person_id: string;
  community_member_id: string;
  community_id: string;
  link_status: PersistedLinkStatus;
  evidence: string;
  provenance: "REAL" | "DEMO";
  declaration_source: DeclarationSource;
  created_at: string;
  verified_at?: string;
  /** Append-only: a confirmation is a NEW record pointing back at the
   *  declaration it confirms — never an edit of that record. */
  supersedes_link_id?: string;
}

export type LinkError =
  | { field: "link_id"; reason: "empty" }
  | { field: "person_id"; reason: "empty" }
  | { field: "community_member_id"; reason: "empty" }
  | { field: "community_id"; reason: "empty" }
  | { field: "evidence"; reason: "empty" }
  | { field: "declaration_source"; reason: "invalid" }
  | { field: "link_status"; reason: "invalid" }
  | { field: "link_status"; reason: "requires_self_declaration" }
  | { field: "created_at"; reason: "empty" }
  | { field: "verified_at"; reason: "only_valid_when_verified" };

export interface ValidationResult {
  valid: boolean;
  errors: LinkError[];
}

const DECLARATION_SOURCES: DeclarationSource[] = ["self", "third_party", "system_import"];
const PERSISTED_STATUSES: PersistedLinkStatus[] = ["VERIFIED_SAME_PERSON", "DECLARED_SAME_PERSON", "UNVERIFIED"];

function nonEmpty(s: unknown): s is string {
  return typeof s === "string" && s.trim() !== "";
}

/**
 * Pure, deterministic validator — same discipline as `validateNeed`/
 * `validateOffer`. `DECLARED_SAME_PERSON`/`VERIFIED_SAME_PERSON` require
 * `declaration_source === "self"` (structural enforcement of "only the
 * named person's own act reaches these tiers" — see module header).
 */
export function validateLink(link: PersonCommunityLink): ValidationResult {
  const errors: LinkError[] = [];

  if (!nonEmpty(link.link_id)) errors.push({ field: "link_id", reason: "empty" });
  if (!nonEmpty(link.person_id)) errors.push({ field: "person_id", reason: "empty" });
  if (!nonEmpty(link.community_member_id)) errors.push({ field: "community_member_id", reason: "empty" });
  if (!nonEmpty(link.community_id)) errors.push({ field: "community_id", reason: "empty" });
  if (!nonEmpty(link.evidence)) errors.push({ field: "evidence", reason: "empty" });
  if (!nonEmpty(link.created_at)) errors.push({ field: "created_at", reason: "empty" });

  if (!DECLARATION_SOURCES.includes(link.declaration_source)) {
    errors.push({ field: "declaration_source", reason: "invalid" });
  }
  if (!PERSISTED_STATUSES.includes(link.link_status)) {
    errors.push({ field: "link_status", reason: "invalid" });
  } else if (
    (link.link_status === "DECLARED_SAME_PERSON" || link.link_status === "VERIFIED_SAME_PERSON") &&
    link.declaration_source !== "self"
  ) {
    errors.push({ field: "link_status", reason: "requires_self_declaration" });
  }

  if (link.verified_at !== undefined && link.link_status !== "VERIFIED_SAME_PERSON") {
    errors.push({ field: "verified_at", reason: "only_valid_when_verified" });
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Step 1 of the real confirmation UI flow: the named person explicitly
 * states "this community member is me." One new record, `DECLARED_SAME_
 * PERSON` — not yet the strongest tier; `confirmSamePerson` below is the
 * required second, separate act.
 */
export function declareSamePerson(params: {
  link_id: string;
  person_id: string;
  community_member_id: string;
  community_id: string;
  evidence: string;
  provenance: "REAL" | "DEMO";
  now: string;
}): PersonCommunityLink {
  return {
    link_id: params.link_id,
    person_id: params.person_id,
    community_member_id: params.community_member_id,
    community_id: params.community_id,
    link_status: "DECLARED_SAME_PERSON",
    evidence: params.evidence,
    provenance: params.provenance,
    declaration_source: "self",
    created_at: params.now,
  };
}

/**
 * Step 2: the named person explicitly re-confirms their own prior
 * declaration. Requires a real, already-persisted `DECLARED_SAME_PERSON`
 * record (`declaration`) to point back at via `supersedes_link_id` — a
 * confirmation cannot be fabricated without the thing it confirms.
 */
export function confirmSamePerson(params: {
  link_id: string;
  declaration: PersonCommunityLink;
  evidence: string;
  now: string;
}): PersonCommunityLink {
  return {
    link_id: params.link_id,
    person_id: params.declaration.person_id,
    community_member_id: params.declaration.community_member_id,
    community_id: params.declaration.community_id,
    link_status: "VERIFIED_SAME_PERSON",
    evidence: params.evidence,
    provenance: params.declaration.provenance,
    declaration_source: "self",
    created_at: params.now,
    verified_at: params.now,
    supersedes_link_id: params.declaration.link_id,
  };
}

export interface ResolvedLink {
  link_status: LinkStatus;
  /** The record backing this status — absent only when `link_status` is
   *  `NOT_LINKED` or `CONFLICT` (a conflict has no single backing record
   *  by definition; see `conflicting` below). */
  latest?: PersonCommunityLink;
  /** Present only when `link_status === "CONFLICT"` — every real record
   *  that disagrees, shown in full rather than silently resolved one way. */
  conflicting?: PersonCommunityLink[];
}

/**
 * The ONLY function that answers "what is the link status between this
 * person and this community member" — a pure, checked lookup over
 * already-written records, never a guess. `NOT_LINKED` is the honest
 * default when no record exists for this exact triple (see module
 * header): it is never written to disk, only returned here.
 *
 * A real, structural CONFLICT check (no silent merge): if any OTHER
 * record claims the same `community_member_id`+`community_id` for a
 * DIFFERENT `person_id`, or the same `person_id`+`community_id` for a
 * DIFFERENT `community_member_id`, the answer is `CONFLICT` — surfaced
 * with every disagreeing record, never resolved by picking one silently.
 */
export function resolvePersonCommunityLink(
  records: readonly PersonCommunityLink[],
  person_id: string,
  community_member_id: string,
  community_id: string,
): ResolvedLink {
  const forThisTriple = records.filter(
    (r) => r.person_id === person_id && r.community_member_id === community_member_id && r.community_id === community_id,
  );
  const conflictingOtherPerson = records.filter(
    (r) => r.community_member_id === community_member_id && r.community_id === community_id && r.person_id !== person_id,
  );
  const conflictingOtherMember = records.filter(
    (r) => r.person_id === person_id && r.community_id === community_id && r.community_member_id !== community_member_id,
  );

  if (conflictingOtherPerson.length > 0 || conflictingOtherMember.length > 0) {
    return { link_status: "CONFLICT", conflicting: [...forThisTriple, ...conflictingOtherPerson, ...conflictingOtherMember] };
  }
  if (forThisTriple.length === 0) return { link_status: "NOT_LINKED" };

  const latest = [...forThisTriple].sort((a, b) => a.created_at.localeCompare(b.created_at)).at(-1)!;
  return { link_status: latest.link_status, latest };
}
