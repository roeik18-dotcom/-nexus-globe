/**
 * THE GROUP OPERATIONAL EVENT SPINE — one canonical event model for
 * everything a value group DOES over time.
 *
 * The alternative, and the reason this exists: three new event types for
 * needs, three more for resources, four for actions, each with its own store,
 * its own loader and its own projection, and every terminal edited again on
 * the next feature. That is the shape the single-`GROUP_ID` constant already
 * cost once. One spine, extended by adding a type to a list and a payload
 * shape beside it, is the version that survives the next requirement.
 *
 * FORWARD COMPATIBILITY IS PART OF THE CONTRACT. An event whose `event_type`
 * this build does not recognise is PRESERVED, counted, and carried through the
 * projection as `unrecognised` rather than dropped. A newer producer writing a
 * newer type must not lose data against an older reader — that is what makes
 * "extensible without changing every terminal" true rather than aspirational.
 *
 * AI IS NEVER A SOCIAL ACTOR. `actor_id` names a person, and only a person.
 * Anything the system infers carries `provenance: "DERIVED"` and states its
 * derivation in `source`; there is no code path that gives a derivation an
 * actor. This is an architectural invariant, not a convention — `validate()`
 * rejects a DERIVED event that carries an `actor_id`.
 */

export const GROUP_EVENT_TYPES = [
  "NEED_DECLARED", "NEED_UPDATED", "NEED_RESOLVED",
  "RESOURCE_OFFERED", "RESOURCE_UPDATED", "RESOURCE_WITHDRAWN",
  "ACTION_PROPOSED", "ACTION_STARTED", "ACTION_COMPLETED", "ACTION_CANCELLED",
  "EFFECT_OBSERVED", "EVIDENCE_ATTACHED",
  "MEMBER_JOINED", "MEMBER_LEFT", "ROLE_CHANGED",
  "BUDGET_RECEIVED", "BUDGET_SPENT", "BUDGET_COMMITTED",
  "TENSION_OBSERVED",
  "VALUE_MAPPING_PROPOSED", "VALUE_MAPPING_CONFIRMED",
  "MATCH_PROPOSED", "MATCH_ACCEPTED", "MATCH_REJECTED",
  /* INVITATION — the join path, recorded in this same log rather than in a
     store of its own. The spine already carries MEMBER_JOINED and already
     preserves unrecognised types, so an invitation is a sequence of group
     events like any other. There is no EXPIRED event: expiry is the passage
     of time, not an act anyone performs, so it is DERIVED from `expires_at`
     at read time and never written. */
  "INVITATION_ISSUED", "INVITATION_VIEWED",
  "INVITATION_ACCEPTED", "INVITATION_DECLINED", "INVITATION_REVOKED",
] as const;

export type GroupEventType = (typeof GROUP_EVENT_TYPES)[number];

/** REAL — a person recorded it. DERIVED — the system inferred it, and says
 *  from what. DEMO — a declared demonstration. IMPORTED — bulk-ingested from
 *  a named external dataset. Never inferred from where the record was found. */
export type GroupEventProvenance = "REAL" | "DERIVED" | "DEMO" | "IMPORTED";

export type GroupEventStatus =
  | "RECORDED" | "OPEN" | "MATCHED" | "IN_PROGRESS" | "RESOLVED" | "CANCELLED"
  | "WITHDRAWN" | "CLAIMED" | "VERIFIED" | "PROPOSED" | "CONFIRMED" | "REJECTED";

export interface GroupEvent {
  event_id: string;
  group_id: string;
  event_type: GroupEventType | (string & {});
  /** When it happened in the world. */
  occurred_at: string;
  /** When PHILOS learned it. CHRONOLOGY ≠ CAUSALITY, and these two differ. */
  recorded_at: string;
  /** A PERSON. Absent for anything the system derived — never a stand-in. */
  actor_id?: string;
  /** The need / resource / action / effect this event is about. */
  object_id: string;
  source: string;
  provenance: GroupEventProvenance;
  evidence?: string;
  status: GroupEventStatus | (string & {});
  payload?: Record<string, unknown>;
}

/* ── typed payloads ──────────────────────────────────────────────────────── */

export interface NeedPayload {
  description?: string;
  quantity?: number;
  unit?: string;
  geography?: string;
  urgency?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  deadline?: string;
  /** Canonical `SV###`. Never a free-text value string. */
  subvalue_id?: string;
}

export interface ResourcePayload {
  description?: string;
  quantity?: number;
  unit?: string;
  geography?: string;
  constraints?: string;
  /** A resource need not belong to the viewer, or even to a group. */
  provider_kind?: "GROUP" | "PERSON" | "ORGANIZATION";
  provider_id?: string;
  available_from?: string;
  available_until?: string;
  subvalue_id?: string;
}

export interface ActionPayload {
  description?: string;
  /** The MATCH this action executes, if any. A match is not an action. */
  match_ref?: string;
  /** Needs and resources consumed, by id. The chain is ids, never text. */
  inputs?: string[];
}

export interface EffectPayload {
  description?: string;
  metric?: string;
  value?: number;
  /** The action this effect followed. Following is not being caused by. */
  action_ref?: string;
}

export interface EvidencePayload {
  /** The effect being evidenced. */
  effect_ref?: string;
  verified_by?: string;
  level?: string;
  note?: string;
}

export interface MatchPayload {
  need_ref: string;
  resource_ref: string;
  /** Why these two were paired. A candidate is a proposal, not a fact. */
  basis?: string;
}

export interface TensionPayload {
  description?: string;
  pole_a?: string;
  pole_b?: string;
  intensity?: number;
}

export interface BudgetPayload {
  amount: number;
  currency: string;
  purpose?: string;
  /** For a transfer between registry groups — the producer of RESOURCE_FLOW. */
  counterparty_group_id?: string;
}

export interface MemberPayload { person_id: string; display_name?: string; role?: string }

export interface ValueMappingPayload {
  subvalue_id: string;
  secondary_subvalue_ids?: string[];
  decided_by?: string;
}

/* ── validation ──────────────────────────────────────────────────────────── */

export interface EventRejection { event_id?: string; because: string }

const ISO = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?([.,]\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/;

/**
 * Total and pure. Returns the reason rather than throwing, because a bad line
 * in a bulk import must be reportable beside the good ones, not fatal to them.
 */
export function validateGroupEvent(e: unknown): { ok: true; event: GroupEvent } | { ok: false; rejection: EventRejection } {
  const r = e as Partial<GroupEvent>;
  const bad = (because: string) => ({ ok: false as const, rejection: { event_id: r?.event_id, because } });
  if (!r || typeof r !== "object") return bad("לא אובייקט");
  if (typeof r.event_id !== "string" || !r.event_id) return bad("חסר event_id");
  if (typeof r.group_id !== "string" || !r.group_id) return bad("חסר group_id");
  if (typeof r.event_type !== "string" || !r.event_type) return bad("חסר event_type");
  if (typeof r.object_id !== "string" || !r.object_id) return bad("חסר object_id");
  if (typeof r.occurred_at !== "string" || !ISO.test(r.occurred_at)) return bad("occurred_at אינו תאריך ISO");
  if (typeof r.recorded_at !== "string" || !ISO.test(r.recorded_at)) return bad("recorded_at אינו תאריך ISO");
  if (typeof r.source !== "string" || !r.source) return bad("חסר source");
  if (r.provenance !== "REAL" && r.provenance !== "DERIVED" && r.provenance !== "DEMO" && r.provenance !== "IMPORTED") {
    return bad("provenance חייב להיות REAL / DERIVED / DEMO / IMPORTED");
  }
  if (typeof r.status !== "string" || !r.status) return bad("חסר status");
  // THE INVARIANT: a derivation has no actor. AI never becomes a citizen.
  if (r.provenance === "DERIVED" && r.actor_id) {
    return bad("אירוע DERIVED לא יכול לשאת actor_id — מסקנה אינה שחקן חברתי");
  }
  if (r.actor_id !== undefined && typeof r.actor_id !== "string") return bad("actor_id אינו מחרוזת");
  return { ok: true, event: r as GroupEvent };
}

export const isKnownType = (t: string): t is GroupEventType =>
  (GROUP_EVENT_TYPES as readonly string[]).includes(t);
