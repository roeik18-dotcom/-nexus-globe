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

/**
 * HOW STRONG THE CLAIM ACTUALLY IS — an interpretation, never a stored value.
 *
 * The persisted vocabulary (`DECLARED_SAME_PERSON`, `VERIFIED_SAME_PERSON`)
 * stays exactly as written on disk; nothing is migrated and no record changes.
 * What changes is that a reader can now ask a second, sharper question than
 * "is it verified": verified BY WHOM, and on whose word.
 *
 * The word "VERIFIED" in the stored status has always overclaimed. In a
 * single-viewer system the same person declares and then confirms their own
 * declaration — `identityLinkActions.ts` resolves the actor identically for
 * both steps, and the confirmation's own evidence string says "by the same
 * local viewer". That is a deliberate two-step self-report, which is the
 * strongest thing this system can honestly support today, and it is NOT
 * independent verification. Naming the tier is how the difference stops
 * depending on someone reading the writer's source.
 */
export type AssuranceTier =
  /** No admissible record, or one that cannot substantiate any tier. */
  | "NONE"
  /** The named person said it. One act, their own word. */
  | "SELF_DECLARED_SAME_PERSON"
  /** The named person said it, then deliberately re-confirmed it. Still
   *  their own word — two acts by one actor, not two actors. */
  | "SELF_ATTESTED_SAME_PERSON"
  /**
   * Attested by an actor who is independent of the subject AND authorized to
   * attest. RESERVED, AND CURRENTLY UNREACHABLE — deliberately.
   *
   * No record can express it: `PersonCommunityLink` has no `actor_id`, so a
   * record cannot even name who attested, and no capability gate exists to
   * decide whether that actor was authorized. `declaration_source:
   * "third_party"` is NOT sufficient evidence — it records a claimed origin,
   * not a proven authorization, and `validateLink` rejects it on a VERIFIED
   * record anyway.
   *
   * Reaching this tier requires an authority model that does not exist yet.
   * Until it does, nothing returns this value, and `assuranceOf` is exhaustive
   * proof of that rather than a promise in a comment.
   */
  | "INDEPENDENTLY_VERIFIED_SAME_PERSON";

/**
 * The tier a single authoritative record substantiates.
 *
 * Reads only what the record carries. A status it cannot substantiate — a
 * VERIFIED record whose `declaration_source` is not `self`, which names no
 * attesting actor and proves no authorization — is `NONE`, not a weaker
 * positive tier: the honest answer to "who vouched for this" is "nothing here
 * can say", and that is not a smaller version of "the person did".
 */
export function assuranceOf(link: PersonCommunityLink | undefined): AssuranceTier {
  if (!link || link.provenance !== "REAL") return "NONE";
  if (link.declaration_source !== "self") return "NONE";
  if (link.link_status === "VERIFIED_SAME_PERSON") return "SELF_ATTESTED_SAME_PERSON";
  if (link.link_status === "DECLARED_SAME_PERSON") return "SELF_DECLARED_SAME_PERSON";
  return "NONE";
}

export interface ResolvedLink {
  link_status: LinkStatus;
  /**
   * What the resolved status is actually WORTH. Derived here, stored nowhere.
   * `link_status` keeps answering the question it always answered, so every
   * existing caller — including the Day gate — is unaffected.
   */
  assurance: AssuranceTier;
  /** The record backing this status — absent only when `link_status` is
   *  `NOT_LINKED` or `CONFLICT` (a conflict has no single backing record
   *  by definition; see `conflicting` below). */
  latest?: PersonCommunityLink;
  /** Present only when `link_status === "CONFLICT"` — every real record
   *  that disagrees, shown in full rather than silently resolved one way. */
  conflicting?: PersonCommunityLink[];
  /**
   * Why the status is what it is, when records exist for this triple but do
   * not confer the authority they appear to claim. Absent when the answer
   * needs no explanation (a REAL record resolved, or nothing exists at all).
   */
  reason?: string;
  /**
   * Records for this exact triple that were SEEN but carry no authority,
   * because their provenance is not REAL. Diagnostic only — surfaced so a
   * demo record is visible rather than silently dropped, and never counted.
   */
  nonAuthoritative?: PersonCommunityLink[];
}

/**
 * ONLY A REAL RECORD CONFERS AUTHORITY.
 *
 * `provenance` was carried on every link record from the beginning and read by
 * nobody: `resolvePersonCommunityLink` matched on the id triple alone, so a
 * DEMO record claiming `VERIFIED_SAME_PERSON` for the right pair resolved as
 * verified and satisfied the Day's `IdentityLinked` gate. A demonstration
 * fixture could therefore assert that two real identities are the same human
 * — the one assertion this module exists to make deliberate.
 *
 * The test is on the RECORD, not on where it was found: a DEMO record living
 * in the real store is still DEMO, and a REAL record in a scratch directory is
 * still REAL. Provenance is a fact the record carries.
 */
function isAuthoritative(link: PersonCommunityLink): boolean {
  return link?.provenance === "REAL";
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
  /* AUTHORITY IS DECIDED OVER REAL RECORDS ONLY, and that decision is made
     FIRST — before latest-wins, and before the conflict scan.

     Latest-wins over the raw log was the defect: a DEMO record written after a
     REAL one would have become "the latest", so a demonstration could both
     grant authority the person never claimed and revoke authority they did.
     Filtering first makes a non-REAL record incapable of either.

     The conflict scan is deliberately REAL-only for the same reason. A DEMO
     record naming a different person for this member is a fixture, not a
     contradiction, and letting it force CONFLICT would be a demo downgrading
     real authority — the same defect wearing the opposite sign. */
  const sameTriple = (r: PersonCommunityLink) =>
    r.person_id === person_id && r.community_member_id === community_member_id && r.community_id === community_id;

  const admissible = records.filter(isAuthoritative);

  const forThisTriple = admissible.filter(sameTriple);
  const conflictingOtherPerson = admissible.filter(
    (r) => r.community_member_id === community_member_id && r.community_id === community_id && r.person_id !== person_id,
  );
  const conflictingOtherMember = admissible.filter(
    (r) => r.person_id === person_id && r.community_id === community_id && r.community_member_id !== community_member_id,
  );

  /* Seen, kept visible, and never counted. */
  const nonAuthoritative = records.filter((r) => sameTriple(r) && !isAuthoritative(r));

  if (conflictingOtherPerson.length > 0 || conflictingOtherMember.length > 0) {
    return {
      link_status: "CONFLICT",
      /* Disagreeing records substantiate nothing between them. */
      assurance: "NONE",
      conflicting: [...forThisTriple, ...conflictingOtherPerson, ...conflictingOtherMember],
      ...(nonAuthoritative.length > 0 ? { nonAuthoritative } : {}),
    };
  }

  if (forThisTriple.length === 0) {
    /* Nothing at all is NOT_LINKED — the honest absence. Records that exist
       but cannot vouch are a different answer, and they get a different one:
       UNVERIFIED, with the reason stated rather than reported as absence. */
    if (nonAuthoritative.length === 0) return { link_status: "NOT_LINKED", assurance: "NONE" };
    const sources = [...new Set(nonAuthoritative.map((r) => r.provenance))].join(", ");
    return {
      link_status: "UNVERIFIED",
      assurance: "NONE",
      reason:
        `${nonAuthoritative.length} link record(s) exist for this pair but carry provenance ${sources}, not REAL — ` +
        `a demonstration record cannot assert that two identities are the same human`,
      nonAuthoritative,
    };
  }

  const latest = [...forThisTriple].sort((a, b) => a.created_at.localeCompare(b.created_at)).at(-1)!;
  return {
    link_status: latest.link_status,
    /* The tier the AUTHORITATIVE record substantiates — the same record
       `link_status` came from, so the two can never describe different rows. */
    assurance: assuranceOf(latest),
    latest,
    ...(nonAuthoritative.length > 0 ? { nonAuthoritative } : {}),
  };
}
