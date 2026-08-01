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

/** One line on the globe, and the event that put it there. */
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
const ARC_RELATIONS = new Set(["member.joined", "leader.appointed"]);

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

  const arcs: GlobeArc[] = [];
  for (const e of log) {
    if (!ARC_RELATIONS.has(e.event_type)) continue;

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
