/**
 * Dynamics Layer — Step 2: the cross-domain causal projection.
 *
 * PHILOS-DYNAMICS-LAYER.md §1–§6. Projects the ONE event log into a causal graph:
 * which event produced which, and how the effect crosses domains. Pure and
 * deterministic — same events in, same graph out; no clock, no I/O, no UI.
 *
 * Two axes are kept SEPARATE on every edge and never collapsed:
 *   • edge_origin    — "explicit" (a caused_by declaration) vs "inferred" (a guess)
 *   • evidence_level — the honesty ladder (self_report … system_inference)
 * evidence_level is NOT derived from edge_origin as a rule: the values below are
 * the honest CURRENT defaults (a declaration is self_report until independently
 * verified; a guess is system_inference), and a later step may raise an explicit
 * edge's evidence_level via a causality.verified event without touching its origin.
 *
 * Explicit edges come ONLY from `caused_by`, gated by the Step-1 causality
 * validator. Inferred edges come ONLY from an explicit ALLOW-LIST of foreign keys
 * — never generic same-entity or time-adjacency guessing. Every edge names the
 * event ids it was computed from; every inferred edge names its join key.
 */

import type { EntityType, EventType, PhilosEvent, Provenance, VerificationStatus } from "./events";
import { inOrder } from "./events";
import {
  causalParents,
  validateCausality,
  type CausalityDiagnostic,
  type CausalityMode,
} from "./eventCausality";

/** The domains a node can belong to — only the five that have real event types. */
export type Domain = "people" | "community" | "activity" | "resources" | "impact";

/** event_type → domain. Exhaustive over the 16-type union (TS-enforced). */
const DOMAIN_OF: Record<EventType, Domain> = {
  "person.registered": "people",
  "leader.appointed": "people",
  "member.joined": "people",
  "group.opened": "community",
  "request.opened": "activity",
  "update.posted": "activity",
  "meeting.scheduled": "activity",
  "resource.received": "resources",
  "allocation.proposed": "resources",
  "allocation.voted": "resources",
  "allocation.approved": "resources",
  "transfer.approved": "resources",
  "transfer.completed": "resources",
  "impact.recorded": "impact",
  "verification.requested": "impact",
  "impact.verified": "impact",
};

export interface DynamicsNode {
  event_id: string;
  domain: Domain;
  entity_type: EntityType;
  entity_id: string;
  event_type: EventType;
  timestamp: string;
  /** From payload where present, else the event_type. Never invented. */
  label: string;
}

export interface DynamicsEdge {
  source_event_id: string; // the cause
  target_event_id: string; // the effect
  edge_origin: "explicit" | "inferred";
  /** Separate axis from edge_origin — see file header. */
  evidence_level: VerificationStatus;
  /** Named for inferred edges (the foreign key that produced them); absent for explicit. */
  join_key?: string;
  domain_transition: [Domain, Domain];
  /** Explicit for inferred edges (a join-key-reliability prior); absent for explicit. */
  confidence?: number;
  provenance: Provenance;
}

export interface DomainTransition {
  from: Domain;
  to: Domain;
  count: number;
}

export interface UnresolvedClaim {
  event_id: string;
  kind: "missing_causal_parent" | "missing_join_target";
  reference: string;
  join_key?: string;
}

export interface DynamicsSummary {
  node_count: number;
  edge_count: number;
  explicit_edges: number;
  inferred_edges: number;
  domains: Record<Domain, number>;
  unresolved_count: number;
}

export interface DynamicsGraph {
  nodes: DynamicsNode[];
  edges: DynamicsEdge[];
  domain_transitions: DomainTransition[];
  unresolved_claims: UnresolvedClaim[];
  diagnostics: CausalityDiagnostic[];
  summary: DynamicsSummary;
}

export interface DynamicsQuery {
  events: readonly PhilosEvent[];
  /** ISO [from, to], inclusive. Default: no window (all events). */
  window?: [string, string];
  /** person_id. Non-public events are hidden unless the viewer is their actor. */
  viewer?: string;
  /** Feeds the Step-1 causality validator. Default "lenient". */
  mode?: CausalityMode;
}

/**
 * The inference ALLOW-LIST. Nothing infers outside this. Each entry pairs an
 * effect event_type with the payload foreign key that links it back to its cause,
 * and a heuristic confidence PRIOR on that key's reliability.
 *
 * The confidences are NOT measurements of real-world causal strength — they only
 * rank the two heuristics against each other (a foreign key the verifier wrote
 * naming the exact target is a stronger signal than a merely shared allocation id).
 * The honest "this is a guess" signal is edge_origin:"inferred" + evidence_level:
 * "system_inference"; these numbers never promote a guess to a fact.
 */
const JOIN_CONFIDENCE = {
  target_impact_event_id: 0.9,
  allocation_id: 0.5,
} as const;

/**
 * A timestamp is usable for ordering only if unambiguous — an explicit offset
 * (`Z` or `±HH:MM`) AND parseable. Mirrors eventCausality's invalid_timestamp
 * gate on purpose: an inferred edge cannot be ordered off a timestamp the
 * validator would reject either. Returns the instant, or null if unusable.
 */
const TZ_SUFFIX = /(?:Z|[+-]\d{2}:\d{2})$/;
const usableInstant = (ts: string): number | null => {
  if (typeof ts !== "string" || !TZ_SUFFIX.test(ts)) return null;
  const t = Date.parse(ts);
  return Number.isNaN(t) ? null : t;
};

const labelOf = (e: PhilosEvent): string => {
  const p = e.payload ?? {};
  for (const k of ["display_name", "name", "title", "text"]) {
    const v = p[k];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return e.event_type;
};

const strField = (e: PhilosEvent, key: string): string | undefined => {
  const v = e.payload?.[key];
  return typeof v === "string" && v.length > 0 ? v : undefined;
};

export function projectDynamics(query: DynamicsQuery): DynamicsGraph {
  const mode: CausalityMode = query.mode ?? "lenient";
  const log = inOrder(query.events);
  const byId = new Map<string, PhilosEvent>();
  for (const e of log) byId.set(e.event_id, e);

  // ── causality validation over the FULL set (parents may sit outside a window) ──
  const report = validateCausality(log, mode);

  // Relations the validator rejects must never render. Key by `${child}|${parent}`.
  const rejectedPairs = new Set<string>();
  const badTimestamp = new Set<string>();
  for (const d of report.errors) {
    if (d.code === "invalid_timestamp") {
      badTimestamp.add(d.event_id);
    } else if (d.code === "causal_cycle" && d.cycle) {
      // path [a,b,c,a]: consecutive (x,y) means y ∈ caused_by(x) → causal edge y→x,
      // i.e. the rejected relation is (child x, parent y).
      for (let i = 0; i + 1 < d.cycle.length; i++) {
        rejectedPairs.add(`${d.cycle[i]}|${d.cycle[i + 1]}`);
      }
    } else if (d.parent_id !== undefined) {
      rejectedPairs.add(`${d.event_id}|${d.parent_id}`);
    }
  }

  const unresolved_claims: UnresolvedClaim[] = [];
  const edges: DynamicsEdge[] = [];
  const explicitPairs = new Set<string>(); // `${source}->${target}` — for precedence
  const seenPairs = new Set<string>(); // guards against duplicate edges of any origin

  const pushEdge = (
    source: PhilosEvent,
    target: PhilosEvent,
    origin: "explicit" | "inferred",
    joinKey?: string,
    confidence?: number,
  ): void => {
    const key = `${source.event_id}->${target.event_id}`;
    if (seenPairs.has(key)) return;
    seenPairs.add(key);
    const evidence_level: VerificationStatus = origin === "explicit" ? "self_report" : "system_inference";
    const provenance: Provenance = {
      source_events: [source.event_id, target.event_id],
      sample_size: 2,
      verification_status: evidence_level,
      ...(confidence !== undefined ? { confidence } : {}),
      time_range: [source.timestamp, target.timestamp],
    };
    edges.push({
      source_event_id: source.event_id,
      target_event_id: target.event_id,
      edge_origin: origin,
      evidence_level,
      ...(joinKey !== undefined ? { join_key: joinKey } : {}),
      domain_transition: [DOMAIN_OF[source.event_type], DOMAIN_OF[target.event_type]],
      ...(confidence !== undefined ? { confidence } : {}),
      provenance,
    });
  };

  // ── 1) explicit edges — from caused_by, minus anything validation rejected ──
  for (const child of log) {
    const parents = causalParents(child);
    if (parents.length === 0) continue;
    const done = new Set<string>();
    for (const parentId of parents) {
      if (typeof parentId !== "string" || parentId.length === 0) continue; // invalid_parent_id
      if (parentId === child.event_id) continue; // self_reference
      if (done.has(parentId)) continue; // duplicate — one attempt per parent
      done.add(parentId);
      if (rejectedPairs.has(`${child.event_id}|${parentId}`)) continue; // cycle / temporal / duplicate
      if (badTimestamp.has(child.event_id) || badTimestamp.has(parentId)) continue;

      const parent = byId.get(parentId);
      if (parent === undefined) {
        unresolved_claims.push({
          event_id: child.event_id,
          kind: "missing_causal_parent",
          reference: parentId,
        });
        continue;
      }
      explicitPairs.add(`${parent.event_id}->${child.event_id}`);
      pushEdge(parent, child, "explicit");
    }
  }

  // ── 2) inferred edges — allow-list only, explicit-over-inferred precedence ──
  const inferEdge = (
    source: PhilosEvent,
    target: PhilosEvent,
    joinKey: keyof typeof JOIN_CONFIDENCE,
  ): void => {
    if (explicitPairs.has(`${source.event_id}->${target.event_id}`)) return; // explicit wins
    const si = usableInstant(source.timestamp);
    const ti = usableInstant(target.timestamp);
    if (si === null || ti === null || si > ti) return; // unorderable or wrong direction
    pushEdge(source, target, "inferred", joinKey, JOIN_CONFIDENCE[joinKey]);
  };

  for (const e of log) {
    // Rule A: impact.verified names its recorded impact via target_impact_event_id.
    // The recorded impact is the cause, the verification the effect.
    if (e.event_type === "impact.verified") {
      const targetId = strField(e, "target_impact_event_id");
      if (targetId === undefined) continue;
      const recorded = byId.get(targetId);
      if (recorded === undefined) {
        unresolved_claims.push({
          event_id: e.event_id,
          kind: "missing_join_target",
          reference: targetId,
          join_key: "target_impact_event_id",
        });
        continue;
      }
      inferEdge(recorded, e, "target_impact_event_id");
    }

    // Rule B: impact.recorded and transfer.completed sharing an allocation_id.
    // The transfer funds the work; the recorded impact is its result.
    if (e.event_type === "impact.recorded") {
      const alloc = strField(e, "allocation_id");
      if (alloc === undefined) continue;
      for (const t of log) {
        if (t.event_type !== "transfer.completed") continue;
        if (strField(t, "allocation_id") !== alloc) continue;
        inferEdge(t, e, "allocation_id");
      }
    }
  }

  // ── 3) nodes: one per event, then filter by viewer visibility + window ──
  const from = query.window ? usableInstant(query.window[0]) : null;
  const to = query.window ? usableInstant(query.window[1]) : null;
  const inWindow = (ts: string): boolean => {
    if (!query.window || from === null || to === null) return true;
    const t = usableInstant(ts);
    return t !== null && t >= from && t <= to;
  };
  const visible = (e: PhilosEvent): boolean => {
    if (query.viewer === undefined) return true;
    if (e.visibility === "public") return true;
    return e.actor_id === query.viewer;
  };

  const keptIds = new Set<string>();
  const nodes: DynamicsNode[] = [];
  for (const e of log) {
    if (!visible(e) || !inWindow(e.timestamp)) continue;
    keptIds.add(e.event_id);
    nodes.push({
      event_id: e.event_id,
      domain: DOMAIN_OF[e.event_type],
      entity_type: e.entity_type,
      entity_id: e.entity_id,
      event_type: e.event_type,
      timestamp: e.timestamp,
      label: labelOf(e),
    });
  }

  // Edges survive only when BOTH endpoints are kept nodes. Sorted deterministically.
  const keptEdges = edges
    .filter((e) => keptIds.has(e.source_event_id) && keptIds.has(e.target_event_id))
    .sort(
      (a, b) =>
        a.source_event_id.localeCompare(b.source_event_id) ||
        a.target_event_id.localeCompare(b.target_event_id) ||
        a.edge_origin.localeCompare(b.edge_origin),
    );

  // ── 4) domain transitions + summary over the DISPLAYED graph ──
  const transitionCounts = new Map<string, DomainTransition>();
  for (const e of keptEdges) {
    const [f, t] = e.domain_transition;
    const key = `${f}->${t}`;
    const existing = transitionCounts.get(key);
    if (existing) existing.count += 1;
    else transitionCounts.set(key, { from: f, to: t, count: 1 });
  }
  const domain_transitions = [...transitionCounts.values()].sort(
    (a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to),
  );

  const domains: Record<Domain, number> = {
    people: 0,
    community: 0,
    activity: 0,
    resources: 0,
    impact: 0,
  };
  for (const n of nodes) domains[n.domain] += 1;

  const explicit_edges = keptEdges.filter((e) => e.edge_origin === "explicit").length;
  return {
    nodes,
    edges: keptEdges,
    domain_transitions,
    unresolved_claims,
    diagnostics: report.diagnostics,
    summary: {
      node_count: nodes.length,
      edge_count: keptEdges.length,
      explicit_edges,
      inferred_edges: keptEdges.length - explicit_edges,
      domains,
      unresolved_count: unresolved_claims.length,
    },
  };
}
