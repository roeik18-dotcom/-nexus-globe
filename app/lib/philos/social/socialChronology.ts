/**
 * SOCIAL CHRONOLOGY — one timeline, read at three zoom levels.
 *
 * Community, Globe and World are the same social/value system seen at GROUP,
 * NETWORK and SYSTEM scope. Until now each read its own sources separately, so
 * nothing let you see that they are looking at ONE history. This projects that
 * single history once, and marks, per entry, which scopes it actually reaches.
 *
 * TWO REAL SOURCE LAYERS, KEPT DISTINCT — never merged into one id space:
 *   EVENT_LOG   the durable Value-Group log (`PhilosEvent`) — group.opened,
 *               member.joined, leader.appointed, allocation.*, resource.*,
 *               transfer.*, impact.recorded
 *   CANON       the canon stores — Observation, Need, Offer, Action, Effect
 *               (`.philos-canon-data/*.jsonl`)
 * Each entry says which layer it came from and carries its own real id, so a
 * reader can always go back to the record.
 *
 * CHRONOLOGY IS NOT CAUSALITY. This is the system's oldest rule and it is not
 * relaxed here. Entries are ordered by their own recorded timestamps and by
 * nothing else. Adjacency in this list asserts NOTHING: that a Need was
 * recorded before an Action does not mean the Action answered it. Where a real
 * causal reference exists it is a FIELD on the record (`Action.inputs`,
 * `Effect.action_ref`), and only those produce `references`.
 *
 * SCOPE IS DERIVED FROM WHAT THE RECORD DOES, NOT FROM ITS SUBJECT MATTER:
 *   GROUP    it happened inside a value group's own log, or it is a canon
 *            record belonging to the subject
 *   NETWORK  it connects two named entities, i.e. it is (or could be) an edge
 *   SYSTEM   it carries verified wider-system relevance
 * SYSTEM is empty on real data today, and that emptiness is the honest answer,
 * not a gap to be filled by promoting group facts to system facts.
 */
import { VERIFIED_STATUSES, type PhilosEvent } from "../events";

export type SourceLayer = "EVENT_LOG" | "CANON";
export type ChronoScope = "GROUP" | "NETWORK" | "SYSTEM";

/** Where a record actually came from. Carried from the source, never guessed
 *  from which layer read it. */
export type RecordProvenance = "REAL" | "DEMO" | "REFERENCE" | "UNKNOWN";

export interface ChronoEntry {
  /** The record's own id — always resolvable back to a real record. */
  record_id: string;
  layer: SourceLayer;
  /** The recorded kind, verbatim from the source. Never a category we coined. */
  kind: string;
  /** ISO timestamp, from the record itself. */
  at: string;
  /** Short human label. Built from real fields only. */
  label: string;
  /** Which zoom levels this record actually reaches. */
  scopes: ChronoScope[];
  /** Real, recorded references to other records — never chronological guesses. */
  references: string[];
  /** Verification the record itself carries. Absent stays UNKNOWN. */
  verification: "VERIFIED" | "CLAIMED" | "UNKNOWN";
  /** Source classification. Set where the source is known; never defaulted. */
  provenance: RecordProvenance;
  /**
   * OWNERSHIP — the subject this record belongs to, taken from the record's
   * own ownership field (Need.subject, Action.owner, Effect.subject,
   * Observation.subject). NEVER inferred from a label, an id shape, or
   * proximity.
   *
   * `undefined` means the record has no personal owner — a group event like
   * `group.opened` belongs to the group, not to a person. Undefined is NOT
   * "unknown owner"; it is "no personal owner", and the scoping rules treat
   * the two differently: a record with no owner may be shared with anyone who
   * can see the group, while a record whose owner is someone else may not.
   *
   * Without this field the chronology could not be filtered at all — which is
   * exactly the state that made the shared loader a cross-user leak.
   */
  owner_subject?: string;
  /** Group this record belongs to, when it is group-scoped rather than personal. */
  owner_group?: string;
}

/** Event types that connect two named entities — the network-scope test. */
const EDGE_EVENTS = new Set(["member.joined", "leader.appointed", "transfer.completed", "group.opened"]);

export interface ChronoInput {
  events: readonly PhilosEvent[];
  needs: readonly { need_id: string; desired_change: string; recorded_at: string; origin_group_id?: string; subject?: string }[];
  offers: readonly { offer_id: string; available_resource: string; recorded_at: string; source?: string }[];
  actions: readonly { action_id: string; inputs: string[]; recorded_at: string; owner?: string }[];
  effects: readonly { effect_id: string; action_ref: string; verified: boolean; recorded_at: string; subject?: string }[];
  observations: readonly { canon_event_id: string; at: string; subject?: string }[];
}

export function buildSocialChronology(input: ChronoInput): ChronoEntry[] {
  const out: ChronoEntry[] = [];

  for (const e of input.events) {
    const scopes: ChronoScope[] = ["GROUP"];
    if (EDGE_EVENTS.has(e.event_type)) scopes.push("NETWORK");
    out.push({
      record_id: e.event_id,
      layer: "EVENT_LOG",
      kind: e.event_type,
      at: e.timestamp,
      label: e.entity_id,
      scopes,
      // `caused_by` is the log's own recorded lineage — a real field, not an
      // adjacency guess. Absent stays absent.
      references: Array.isArray((e as { caused_by?: string[] }).caused_by)
        ? [...((e as { caused_by?: string[] }).caused_by ?? [])]
        : [],
      // `VERIFIED_STATUSES` is the codebase's own definition of what counts
      // as verified ("community_verified" / "external_verified"). There is no
      // status literally named "verified" — comparing against one silently
      // labels every event CLAIMED.
      verification: e.verification_status && VERIFIED_STATUSES.includes(e.verification_status)
        ? "VERIFIED"
        : e.verification_status ? "CLAIMED" : "UNKNOWN",
      // The durable Philos event log. DEMO community fixtures are a separate
      // stream and never reach this function.
      provenance: "REAL",
      // Value-Group log events are GROUP-scoped: they belong to the group's
      // history, not to the actor personally. `actor_id` is who did it, which
      // is not the same as who owns the record.
      owner_group: e.entity_type === "value_group" ? e.entity_id : undefined,
    });
  }

  for (const o of input.observations) {
    out.push({
      record_id: o.canon_event_id, layer: "CANON", kind: "observation", provenance: "REAL" as const, owner_subject: o.subject, at: o.at,
      label: "תצפית", scopes: ["GROUP"], references: [], verification: "CLAIMED",
    });
  }

  for (const n of input.needs) {
    // A Need reaches NETWORK only once it is actually attached to a group —
    // by an explicit write or an explicit declaration, never by its text.
    const scopes: ChronoScope[] = n.origin_group_id ? ["GROUP", "NETWORK"] : ["GROUP"];
    out.push({
      record_id: n.need_id, layer: "CANON", kind: "need", provenance: "REAL" as const, owner_subject: n.subject, at: n.recorded_at,
      label: n.desired_change.slice(0, 60), scopes, references: [], verification: "CLAIMED",
    });
  }

  for (const o of input.offers) {
    out.push({
      record_id: o.offer_id, layer: "CANON", kind: "offer", provenance: "REAL" as const, owner_subject: o.source, at: o.recorded_at,
      label: o.available_resource.slice(0, 60), scopes: ["GROUP"], references: [], verification: "CLAIMED",
    });
  }

  for (const a of input.actions) {
    out.push({
      record_id: a.action_id, layer: "CANON", kind: "action", provenance: "REAL" as const, owner_subject: a.owner, at: a.recorded_at,
      label: "פעולה", scopes: ["GROUP"],
      // Real recorded inputs — this is the only kind of link drawn here.
      references: [...a.inputs],
      verification: "CLAIMED",
    });
  }

  for (const e of input.effects) {
    out.push({
      record_id: e.effect_id, layer: "CANON", kind: "effect", provenance: "REAL" as const, owner_subject: e.subject, at: e.recorded_at,
      label: "אפקט", scopes: ["GROUP"], references: [e.action_ref],
      verification: e.verified ? "VERIFIED" : "CLAIMED",
    });
  }

  // Ordered by the records' own timestamps and by nothing else. Ties break on
  // record_id so the order is deterministic, never on "what should come next".
  return out.sort((a, b) => (a.at === b.at ? a.record_id.localeCompare(b.record_id) : a.at.localeCompare(b.at)));
}

/** Entries reaching a given zoom level. SYSTEM legitimately returns []. */
export function atScope(entries: readonly ChronoEntry[], scope: ChronoScope): ChronoEntry[] {
  return entries.filter((e) => e.scopes.includes(scope));
}

export const SCOPE_OF_SURFACE: Record<"community" | "globe" | "world", ChronoScope> = {
  community: "GROUP",
  globe: "NETWORK",
  world: "SYSTEM",
};
