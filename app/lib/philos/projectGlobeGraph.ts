/**
 * Event Log → globe graph.
 *
 * PHILOS-SYSTEM-BLUEPRINT §13: "no line exists until it represents a real event."
 *
 * The globe previously drew one arc per PUDM relation record — 95 lines whose
 * only provenance was a row in a JSON file, at coordinates derived from hashing
 * an id. A viewer could not ask "why is this line here?" and get an answer.
 *
 * This projects arcs from the canonical event log instead. Each arc names the
 * event that created it, so every line on the globe is answerable: who, to what,
 * when, and by which event. Arcs whose endpoints are not both known entities are
 * dropped rather than drawn at a guessed position.
 *
 * Pure and deterministic: same events in, same graph out. No clock, no I/O.
 */

import { inOrder, type PhilosEvent, type VerificationStatus } from "./events";

/**
 * A node the globe can place, from events.
 *
 * `recipient` is a destination named by a transfer — a project or supplier that
 * received resources. It is not a registered person: the only thing the log knows
 * about it is the name written on the approving event, which is why it has its own
 * type rather than being flattened into `person`.
 */
export interface GlobeNode {
  id: string;
  type: "person" | "value_group" | "recipient";
  label: string;
  /** ms epoch of the event that introduced it — the globe's time axis reads this. */
  born: number;
  community: string;
}

/**
 * One line on the globe, and the event that put it there.
 *
 * The financial fields are OPTIONAL and are populated only from what the event
 * actually carries. A transfer whose event has no `resource_delta` yields an arc
 * with no amount — the line still exists, because the transfer did, but the globe
 * must not display a number nobody recorded. Absence here is a fact, not a gap to
 * fill in.
 */
export interface GlobeArc {
  source_id: string;
  target_id: string;
  /** The event_type that created it, e.g. "member.joined". */
  relation: string;
  event_id: string;
  timestamp: string;
  /** Present only where the event carries one — joins are not "verified". */
  verification_status?: VerificationStatus;
  /** Human-readable, for the globe's arc label. Never invented. */
  label: string;

  // ── resource semantics: present only on resource-moving relations ──
  /** Absolute magnitude moved. Direction is expressed by source → target. */
  amount?: number;
  currency?: string;
  /** `resource_delta.kind` — money | time | knowledge | equipment | service. */
  resource_type?: string;
  /** The event's own value_tags — which value this movement served. */
  value_tags?: string[];
  /** Lifecycle state of the transfer this arc represents. */
  transfer_status?: "proposed" | "approved" | "executing" | "completed" | "reversed";
}

export interface GlobeGraph {
  nodes: GlobeNode[];
  arcs: GlobeArc[];
}

/**
 * Relation types projected as arcs, and how each maps to (source → target).
 *
 * Deliberately small. Adding a relation here is a decision about what a line on
 * the globe MEANS, not a rendering tweak — so the map is explicit rather than
 * "draw every event that happens to have two ids".
 */
const ARC_RELATIONS = new Set([
  "member.joined",
  "leader.appointed",
  "transfer.completed",
]);

const ms = (iso: string): number => {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
};

export function projectGlobeGraph(
  events: readonly PhilosEvent[],
  groupId: string,
): GlobeGraph {
  const log = inOrder(events);

  const opened = log.find(
    (e) => e.event_type === "group.opened" && e.entity_id === groupId,
  );
  if (!opened) return { nodes: [], arcs: [] };

  const groupName =
    typeof opened.payload?.name === "string" ? opened.payload.name : groupId;
  const community =
    typeof opened.payload?.central_value === "string"
      ? opened.payload.central_value
      : "general";

  // names come from registration events; an unregistered id keeps its raw id
  const names = new Map<string, string>();
  for (const e of log) {
    if (e.event_type === "person.registered" && typeof e.payload?.display_name === "string") {
      names.set(e.entity_id, e.payload.display_name);
    }
  }

  const nodes: GlobeNode[] = [{
    id: groupId,
    type: "value_group",
    label: groupName,
    born: ms(opened.timestamp),
    community,
  }];

  const seen = new Set<string>([groupId]);
  const addPerson = (id: string, born: number) => {
    if (!id || seen.has(id)) return;
    seen.add(id);
    nodes.push({
      id,
      type: "person",
      label: names.get(id) ?? id,
      born,
      community,
    });
  };

  // A completed transfer carries the money (`resource_delta`) but not the
  // recipient — that is written on the approving event for the same transfer id.
  // Index the approvals so the completion can name where the money went without
  // guessing.
  const approvalOf = new Map<string, PhilosEvent>();
  for (const e of log) {
    if (e.event_type === "transfer.approved") approvalOf.set(e.entity_id, e);
  }

  const addRecipient = (id: string, label: string, born: number) => {
    if (!id || seen.has(id)) return;
    seen.add(id);
    nodes.push({ id, type: "recipient", label, born, community });
  };

  const arcs: GlobeArc[] = [];
  for (const e of log) {
    if (!ARC_RELATIONS.has(e.event_type)) continue;

    if (e.event_type === "transfer.completed") {
      const approval = approvalOf.get(e.entity_id);
      const recipient =
        typeof approval?.payload?.recipient === "string" ? approval.payload.recipient : "";
      // No approving event means no named destination. Drawing the line anyway
      // would invent a target, so it is dropped — same rule as any other arc.
      if (!recipient) continue;

      const recipientId = `recipient:${e.entity_id}`;
      addRecipient(recipientId, recipient, ms(e.timestamp));

      const delta = e.resource_delta;
      const purpose =
        typeof approval?.payload?.purpose === "string" ? approval.payload.purpose : "";

      arcs.push({
        // money leaves the group and reaches the recipient
        source_id: groupId,
        target_id: recipientId,
        relation: e.event_type,
        event_id: e.event_id,
        timestamp: e.timestamp,
        verification_status: e.verification_status,
        label: `${groupName} → ${recipient}${purpose ? ` — ${purpose}` : ""}`,
        // Read straight off the event. Absent stays absent: an amount nobody
        // recorded must not appear as a number on the globe.
        amount: delta ? Math.abs(delta.amount) : undefined,
        currency: delta?.currency,
        resource_type: delta?.kind,
        value_tags: e.value_tags.length ? [...e.value_tags] : undefined,
        transfer_status: "completed",
      });
      continue;
    }

    let source = "";
    let target = "";
    let label = "";

    if (e.event_type === "member.joined") {
      source = e.actor_id;
      target = groupId;
      label = `${names.get(source) ?? source} הצטרפ/ה ל${groupName}`;
    } else {
      // leader.appointed — the appointer is the source, the appointee the target
      const person = typeof e.payload?.person_id === "string" ? e.payload.person_id : "";
      const by = typeof e.payload?.appointed_by === "string" ? e.payload.appointed_by : e.actor_id;
      source = by;
      target = person;
      const role = typeof e.payload?.role === "string" ? e.payload.role : "";
      label = `${names.get(by) ?? by} מינה/מינתה את ${names.get(person) ?? person}${role ? ` — ${role}` : ""}`;
    }

    if (!source || !target || source === target) continue;

    addPerson(source, ms(e.timestamp));
    addPerson(target, ms(e.timestamp));

    arcs.push({
      source_id: source,
      target_id: target,
      relation: e.event_type,
      event_id: e.event_id,
      timestamp: e.timestamp,
      verification_status: e.verification_status,
      label,
    });
  }

  return { nodes, arcs };
}
