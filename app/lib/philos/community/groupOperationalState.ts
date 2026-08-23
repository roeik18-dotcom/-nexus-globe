/**
 * GROUP OPERATIONAL STATE — the one projection. `GroupEvent[]` in, current
 * state out, and every terminal reads THIS rather than rebuilding its own.
 *
 * Four surfaces previously each reconstructed what a group currently is, from
 * whatever slice of the log they happened to load. Four reconstructions of one
 * fact is four chances to disagree, and Community/Network/System disagreeing
 * about membership (9 / 6 / UNKNOWN) is exactly how that failure looked the
 * last time. One authority removes the category of bug, not one instance.
 *
 * ORDERING. Events are folded in `occurred_at` order, ties broken by
 * `recorded_at` and then `event_id`, so an out-of-order file produces the same
 * state as an ordered one — a bulk import cannot depend on line order. But
 * `recorded_at` is kept per object: when PHILOS learned something is a
 * different fact from when it happened, and collapsing them would let a
 * back-dated import silently rewrite history.
 *
 * MISSING ≠ ZERO, throughout. A group with no need events has
 * `needs_channel: "NO_EVENTS"`, not `needs: []` read as "measured, none". The
 * distinction survives all the way to the screen.
 */
import { isKnownType, type GroupEvent, type GroupEventStatus } from "./groupEvent";
import type {
  NeedPayload, ResourcePayload, ActionPayload, EffectPayload,
  EvidencePayload, MatchPayload, TensionPayload, BudgetPayload,
  MemberPayload, ValueMappingPayload,
} from "./groupEvent";

export type Channel = "NO_EVENTS" | "MEASURED";

export interface NeedState extends NeedPayload {
  need_id: string;
  group_id: string;
  status: "OPEN" | "MATCHED" | "IN_PROGRESS" | "RESOLVED" | "CANCELLED";
  provenance: string;
  source: string;
  evidence?: string;
  declared_at: string;
  last_event_id: string;
}

export interface ResourceState extends ResourcePayload {
  resource_id: string;
  group_id: string;
  status: "AVAILABLE" | "MATCHED" | "WITHDRAWN";
  provenance: string;
  source: string;
  evidence?: string;
  offered_at: string;
  last_event_id: string;
}

export interface ActionState extends ActionPayload {
  action_id: string;
  group_id: string;
  status: "PROPOSED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  provenance: string;
  source: string;
  proposed_at: string;
  last_event_id: string;
}

export interface EffectState extends EffectPayload {
  effect_id: string;
  group_id: string;
  /** CLAIMED until an EVIDENCE_ATTACHED event references it. */
  status: "CLAIMED" | "VERIFIED";
  provenance: string;
  source: string;
  observed_at: string;
  event_ids: string[];
}

export interface EvidenceState extends EvidencePayload {
  evidence_id: string;
  group_id: string;
  provenance: string;
  source: string;
  attached_at: string;
  event_id: string;
}

export interface MatchState extends MatchPayload {
  match_id: string;
  group_id: string;
  /** CANDIDATE ≠ ACCEPTED ≠ ACTION. Three states, never collapsed. */
  status: "CANDIDATE" | "ACCEPTED" | "REJECTED";
  provenance: string;
  source: string;
  proposed_at: string;
  last_event_id: string;
}

export interface TensionState extends TensionPayload {
  tension_id: string;
  group_id: string;
  provenance: string;
  source: string;
  observed_at: string;
  event_id: string;
}

export interface MemberState {
  person_id: string;
  display_name?: string;
  role?: string;
  joined_at: string;
  left_at?: string;
  active: boolean;
  event_ids: string[];
}

export interface BudgetState {
  received: number;
  spent: number;
  committed: number;
  available: number;
  currency: string;
  event_ids: string[];
}

export interface ValueMappingState {
  subvalue_id: string;
  secondary_subvalue_ids?: string[];
  status: "PROPOSED" | "CONFIRMED";
  decided_by?: string;
  evidence?: string;
  event_id: string;
}

export interface GroupOperationalState {
  group_id: string;
  members: MemberState[];
  roles: { person_id: string; role: string }[];
  budget: BudgetState | null;
  needs: NeedState[];
  resources: ResourceState[];
  matches: MatchState[];
  actions: ActionState[];
  effects: EffectState[];
  evidence: EvidenceState[];
  tensions: TensionState[];
  value_mappings: ValueMappingState[];
  /** Every event that produced this state, in fold order. */
  history: GroupEvent[];
  /** Per-dimension: was this ever recorded, or is it simply absent? */
  channels: {
    members: Channel; budget: Channel; needs: Channel; resources: Channel;
    matches: Channel; actions: Channel; effects: Channel; evidence: Channel;
    tensions: Channel; value_mappings: Channel;
  };
  /** Types this build does not know. Preserved, counted, never dropped. */
  unrecognised: GroupEvent[];
  counts: { events: number; real: number; derived: number; demo: number; imported: number };
}

/** Deterministic total order. Out-of-order input folds identically. */
export function orderEvents(events: readonly GroupEvent[]): GroupEvent[] {
  return [...events].sort((a, b) =>
    a.occurred_at.localeCompare(b.occurred_at) ||
    a.recorded_at.localeCompare(b.recorded_at) ||
    a.event_id.localeCompare(b.event_id));
}

const NEED_STATUS: Record<string, NeedState["status"]> = {
  OPEN: "OPEN", MATCHED: "MATCHED", IN_PROGRESS: "IN_PROGRESS", RESOLVED: "RESOLVED", CANCELLED: "CANCELLED",
};

export function projectGroupOperationalState(
  group_id: string,
  allEvents: readonly GroupEvent[],
): GroupOperationalState {
  const events = orderEvents(allEvents.filter((e) => e.group_id === group_id));

  const members = new Map<string, MemberState>();
  const needs = new Map<string, NeedState>();
  const resources = new Map<string, ResourceState>();
  const matches = new Map<string, MatchState>();
  const actions = new Map<string, ActionState>();
  const effects = new Map<string, EffectState>();
  const evidence = new Map<string, EvidenceState>();
  const tensions = new Map<string, TensionState>();
  const mappings = new Map<string, ValueMappingState>();
  const unrecognised: GroupEvent[] = [];
  let budget: BudgetState | null = null;
  const touched = new Set<string>();

  const p = <T,>(e: GroupEvent) => (e.payload ?? {}) as T;
  const base = (e: GroupEvent) => ({ provenance: e.provenance, source: e.source, evidence: e.evidence });

  for (const e of events) {
    if (!isKnownType(e.event_type)) { unrecognised.push(e); continue; }
    switch (e.event_type) {
      case "NEED_DECLARED": {
        touched.add("needs");
        needs.set(e.object_id, {
          ...p<NeedPayload>(e), need_id: e.object_id, group_id,
          status: NEED_STATUS[e.status] ?? "OPEN", ...base(e),
          declared_at: e.occurred_at, last_event_id: e.event_id,
        });
        break;
      }
      case "NEED_UPDATED":
      case "NEED_RESOLVED": {
        touched.add("needs");
        const prior = needs.get(e.object_id);
        // An update to a need nobody declared is still real information —
        // recorded as the need's first state rather than dropped.
        needs.set(e.object_id, {
          ...(prior ?? { need_id: e.object_id, group_id, declared_at: e.occurred_at, status: "OPEN" as const, provenance: e.provenance, source: e.source }),
          ...p<NeedPayload>(e),
          need_id: e.object_id, group_id,
          status: e.event_type === "NEED_RESOLVED" ? "RESOLVED" : (NEED_STATUS[e.status] ?? prior?.status ?? "OPEN"),
          ...base(e), last_event_id: e.event_id,
          declared_at: prior?.declared_at ?? e.occurred_at,
        });
        break;
      }
      case "RESOURCE_OFFERED": {
        touched.add("resources");
        resources.set(e.object_id, {
          ...p<ResourcePayload>(e), resource_id: e.object_id, group_id,
          status: "AVAILABLE", ...base(e), offered_at: e.occurred_at, last_event_id: e.event_id,
        });
        break;
      }
      case "RESOURCE_UPDATED":
      case "RESOURCE_WITHDRAWN": {
        touched.add("resources");
        const prior = resources.get(e.object_id);
        resources.set(e.object_id, {
          ...(prior ?? { resource_id: e.object_id, group_id, offered_at: e.occurred_at, status: "AVAILABLE" as const, provenance: e.provenance, source: e.source }),
          ...p<ResourcePayload>(e), resource_id: e.object_id, group_id,
          status: e.event_type === "RESOURCE_WITHDRAWN" ? "WITHDRAWN"
            : (e.status === "MATCHED" ? "MATCHED" : prior?.status ?? "AVAILABLE"),
          ...base(e), offered_at: prior?.offered_at ?? e.occurred_at, last_event_id: e.event_id,
        });
        break;
      }
      case "MATCH_PROPOSED": {
        touched.add("matches");
        const pl = p<MatchPayload>(e);
        matches.set(e.object_id, {
          ...pl, match_id: e.object_id, group_id, status: "CANDIDATE",
          ...base(e), proposed_at: e.occurred_at, last_event_id: e.event_id,
        });
        break;
      }
      case "MATCH_ACCEPTED":
      case "MATCH_REJECTED": {
        touched.add("matches");
        const prior = matches.get(e.object_id);
        const pl = { ...(prior ?? {}), ...p<MatchPayload>(e) } as MatchPayload;
        matches.set(e.object_id, {
          ...pl, match_id: e.object_id, group_id,
          status: e.event_type === "MATCH_ACCEPTED" ? "ACCEPTED" : "REJECTED",
          ...base(e), proposed_at: prior?.proposed_at ?? e.occurred_at, last_event_id: e.event_id,
        });
        break;
      }
      case "ACTION_PROPOSED": {
        touched.add("actions");
        actions.set(e.object_id, {
          ...p<ActionPayload>(e), action_id: e.object_id, group_id, status: "PROPOSED",
          ...base(e), proposed_at: e.occurred_at, last_event_id: e.event_id,
        });
        break;
      }
      case "ACTION_STARTED":
      case "ACTION_COMPLETED":
      case "ACTION_CANCELLED": {
        touched.add("actions");
        const prior = actions.get(e.object_id);
        actions.set(e.object_id, {
          ...(prior ?? { action_id: e.object_id, group_id, proposed_at: e.occurred_at, status: "PROPOSED" as const, provenance: e.provenance, source: e.source }),
          ...p<ActionPayload>(e), action_id: e.object_id, group_id,
          status: e.event_type === "ACTION_STARTED" ? "IN_PROGRESS"
            : e.event_type === "ACTION_COMPLETED" ? "COMPLETED" : "CANCELLED",
          ...base(e), proposed_at: prior?.proposed_at ?? e.occurred_at, last_event_id: e.event_id,
        });
        break;
      }
      case "EFFECT_OBSERVED": {
        touched.add("effects");
        const prior = effects.get(e.object_id);
        effects.set(e.object_id, {
          ...p<EffectPayload>(e), effect_id: e.object_id, group_id,
          status: prior?.status ?? "CLAIMED", ...base(e),
          observed_at: prior?.observed_at ?? e.occurred_at,
          event_ids: [...(prior?.event_ids ?? []), e.event_id],
        });
        break;
      }
      case "EVIDENCE_ATTACHED": {
        touched.add("evidence");
        const pl = p<EvidencePayload>(e);
        evidence.set(e.object_id, {
          ...pl, evidence_id: e.object_id, group_id, ...base(e),
          attached_at: e.occurred_at, event_id: e.event_id,
        });
        // VERIFIED is what evidence DOES to an effect. Nothing else sets it.
        if (pl.effect_ref) {
          const eff = effects.get(pl.effect_ref);
          if (eff) effects.set(pl.effect_ref, { ...eff, status: "VERIFIED", event_ids: [...eff.event_ids, e.event_id] });
        }
        break;
      }
      case "MEMBER_JOINED": {
        touched.add("members");
        const pl = p<MemberPayload>(e);
        const id = pl.person_id ?? e.object_id;
        const prior = members.get(id);
        members.set(id, {
          person_id: id, display_name: pl.display_name ?? prior?.display_name,
          role: pl.role ?? prior?.role, joined_at: prior?.joined_at ?? e.occurred_at,
          left_at: undefined, active: true, event_ids: [...(prior?.event_ids ?? []), e.event_id],
        });
        break;
      }
      case "MEMBER_LEFT": {
        touched.add("members");
        const pl = p<MemberPayload>(e);
        const id = pl.person_id ?? e.object_id;
        const prior = members.get(id);
        if (prior) members.set(id, { ...prior, active: false, left_at: e.occurred_at, event_ids: [...prior.event_ids, e.event_id] });
        break;
      }
      case "ROLE_CHANGED": {
        touched.add("members");
        const pl = p<MemberPayload>(e);
        const id = pl.person_id ?? e.object_id;
        const prior = members.get(id);
        members.set(id, {
          person_id: id, display_name: pl.display_name ?? prior?.display_name, role: pl.role,
          joined_at: prior?.joined_at ?? e.occurred_at, left_at: prior?.left_at,
          active: prior?.active ?? true, event_ids: [...(prior?.event_ids ?? []), e.event_id],
        });
        break;
      }
      case "BUDGET_RECEIVED":
      case "BUDGET_SPENT":
      case "BUDGET_COMMITTED": {
        touched.add("budget");
        const pl = p<BudgetPayload>(e);
        const b: BudgetState = budget ?? { received: 0, spent: 0, committed: 0, available: 0, currency: pl.currency ?? "ILS", event_ids: [] };
        const next: BudgetState = { ...b, event_ids: [...b.event_ids, e.event_id] };
        if (e.event_type === "BUDGET_RECEIVED") next.received += pl.amount ?? 0;
        if (e.event_type === "BUDGET_SPENT") next.spent += pl.amount ?? 0;
        if (e.event_type === "BUDGET_COMMITTED") next.committed += pl.amount ?? 0;
        next.available = next.received - next.spent - next.committed;
        budget = next;
        break;
      }
      case "TENSION_OBSERVED": {
        touched.add("tensions");
        tensions.set(e.object_id, {
          ...p<TensionPayload>(e), tension_id: e.object_id, group_id,
          ...base(e), observed_at: e.occurred_at, event_id: e.event_id,
        });
        break;
      }
      case "VALUE_MAPPING_PROPOSED":
      case "VALUE_MAPPING_CONFIRMED": {
        touched.add("value_mappings");
        const pl = p<ValueMappingPayload>(e);
        if (pl.subvalue_id) {
          mappings.set(e.object_id, {
            subvalue_id: pl.subvalue_id, secondary_subvalue_ids: pl.secondary_subvalue_ids,
            status: e.event_type === "VALUE_MAPPING_CONFIRMED" ? "CONFIRMED" : "PROPOSED",
            decided_by: pl.decided_by ?? e.actor_id, evidence: e.evidence, event_id: e.event_id,
          });
        }
        break;
      }
    }
  }

  const ch = (k: string): Channel => (touched.has(k) ? "MEASURED" : "NO_EVENTS");
  const memberList = [...members.values()];
  const count = (pv: string) => events.filter((e) => e.provenance === pv).length;

  return {
    group_id,
    members: memberList,
    roles: memberList.filter((m) => m.role && m.active).map((m) => ({ person_id: m.person_id, role: m.role! })),
    budget,
    needs: [...needs.values()],
    resources: [...resources.values()],
    matches: [...matches.values()],
    actions: [...actions.values()],
    effects: [...effects.values()],
    evidence: [...evidence.values()],
    tensions: [...tensions.values()],
    value_mappings: [...mappings.values()],
    history: events,
    channels: {
      members: ch("members"), budget: ch("budget"), needs: ch("needs"),
      resources: ch("resources"), matches: ch("matches"), actions: ch("actions"),
      effects: ch("effects"), evidence: ch("evidence"), tensions: ch("tensions"),
      value_mappings: ch("value_mappings"),
    },
    unrecognised,
    counts: {
      events: events.length, real: count("REAL"), derived: count("DERIVED"),
      demo: count("DEMO"), imported: count("IMPORTED"),
    },
  };
}

/** All groups at once, keyed by id — what the terminals actually consume. */
export function projectAllGroupStates(events: readonly GroupEvent[]): Map<string, GroupOperationalState> {
  const ids = [...new Set(events.map((e) => e.group_id))];
  return new Map(ids.map((id) => [id, projectGroupOperationalState(id, events)]));
}
