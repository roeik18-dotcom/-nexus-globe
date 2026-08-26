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

/**
 * event_type → domain. Exhaustive over the EventType union (TS-enforced).
 *
 * THE TWO `day.*` ENTRIES ARE LEGACY OPERATIONAL ROUTING METADATA — nothing
 * more. They exist so this five-value routing map stays exhaustive; they do
 * NOT classify the person, and they do NOT classify the day.
 *
 * They are routed to `"activity"` because a day opening/closing is an act
 * someone performed, and `"activity"` is the existing member for acts. The
 * canon-side sense of these events is domain `C` (COGNITIVE) in the
 * Observation model's own `G`/`E`/`C` vocabulary (`canon/observation.ts`) —
 * a DIFFERENT `Domain` type from this one, and the collision between the two
 * is real, pre-existing and documented at `canon/canonEvent.ts:14-22`. This
 * map is not widened to carry a cognitive member: adding one would change the
 * old five-value Domain model, which this phase explicitly does not do. The
 * canonical C sense is recorded in `day/dayEvent.ts` instead.
 *
 * Routing metadata is not classification. Neither entry replaces, summarises
 * or stands in for the 10-unit analysis model.
 */
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
  // Legacy routing only — see the header above. Not a classification.
  "day.opened": "activity",
  "day.closing_recorded": "activity",
};

export interface DynamicsNode {
  event_id: string;
  /**
   * Who authored this event — and, for an effect, who DECLARED its `caused_by`.
   * Event-traceable (copied verbatim from the event), so the UI's explicit-edge
   * "declared by {actor}" popover names a real actor instead of an invented one.
   */
  actor_id: string;
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
  /** Edges suppressed because an endpoint was hidden by the viewer/window filter. */
  withheld: number;
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

/**
 * Strongly-connected components of the resolved, non-self `caused_by` graph
 * (child → its parents), by Tarjan. Two events share an SCC id iff they are
 * mutually reachable — i.e. entangled in a cycle. An explicit edge whose parent
 * and child share an SCC is cyclic and must not render as a declared fact.
 *
 * This is why cycle suppression can't key off `findCycles`' reported paths:
 * findCycles guarantees only ≥1 back-edge per cycle, not every cyclic edge, so
 * overlapping cycles would leak an edge. SCC membership suppresses them all.
 * Deterministic — nodes are visited in `inOrder`.
 */
function computeSccs(
  log: readonly PhilosEvent[],
  byId: Map<string, PhilosEvent>,
): Map<string, number> {
  const adj = new Map<string, string[]>();
  for (const e of log) {
    const ps: string[] = [];
    for (const p of causalParents(e)) {
      if (typeof p === "string" && p.length > 0 && p !== e.event_id && byId.has(p)) ps.push(p);
    }
    adj.set(e.event_id, ps);
  }

  const sccOf = new Map<string, number>();
  const idx = new Map<string, number>();
  const low = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  let index = 0;
  let sccCount = 0;

  const strongconnect = (v: string): void => {
    idx.set(v, index);
    low.set(v, index);
    index += 1;
    stack.push(v);
    onStack.add(v);
    for (const w of adj.get(v) ?? []) {
      if (!idx.has(w)) {
        strongconnect(w);
        low.set(v, Math.min(low.get(v) ?? 0, low.get(w) ?? 0));
      } else if (onStack.has(w)) {
        low.set(v, Math.min(low.get(v) ?? 0, idx.get(w) ?? 0));
      }
    }
    if ((low.get(v) ?? 0) === (idx.get(v) ?? 0)) {
      let w = "";
      do {
        w = stack.pop() as string;
        onStack.delete(w);
        sccOf.set(w, sccCount);
      } while (w !== v);
      sccCount += 1;
    }
  };

  for (const e of log) if (!idx.has(e.event_id)) strongconnect(e.event_id);
  return sccOf;
}

export function projectDynamics(query: DynamicsQuery): DynamicsGraph {
  const mode: CausalityMode = query.mode ?? "lenient";
  const log = inOrder(query.events);
  const byId = new Map<string, PhilosEvent>();
  for (const e of log) byId.set(e.event_id, e);

  // ── causality validation over the FULL set (parents may sit outside a window) ──
  const report = validateCausality(log, mode);

  // Each rejection reason is handled where it belongs — a single catch-all over
  // `parent_id` was wrong (it dropped valid-but-duplicated edges and pre-empted
  // the unresolved-claim push for strict missing parents):
  //   • parent_after_child → the ONE code that rejects a specific resolvable pair.
  //   • invalid_timestamp   → drop by event (badTimestamp).
  //   • causal_cycle        → suppressed by SCC membership (sccOf), which is
  //     complete where a per-reported-path set would leak overlapping cycles.
  //   • duplicate_parent    → render once (the `done` set), diagnostic still shown.
  //   • missing_parent      → flows to unresolved_claims in BOTH modes.
  //   • self_reference / invalid_parent_id → caught structurally in the loop.
  const temporallyRejected = new Set<string>(); // `${child}|${parent}`
  const badTimestamp = new Set<string>();
  for (const d of report.errors) {
    if (d.code === "invalid_timestamp") badTimestamp.add(d.event_id);
    else if (d.code === "parent_after_child" && d.parent_id !== undefined) {
      temporallyRejected.add(`${d.event_id}|${d.parent_id}`);
    }
  }
  const sccOf = computeSccs(log, byId);

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
      if (done.has(parentId)) continue; // duplicate — render once (diagnostic still shown)
      done.add(parentId);
      if (temporallyRejected.has(`${child.event_id}|${parentId}`)) continue; // parent_after_child
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
      // Same SCC ⇒ the relation is part of a cycle; never render it as a fact.
      if (sccOf.get(parent.event_id) === sccOf.get(child.event_id)) continue;
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
    if (source.event_id === target.event_id) return; // no self-loop (mirrors the explicit guard)
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
      // The cause must actually be an impact.recorded (mirrors Rule B typing both
      // endpoints). A dangling OR wrong-typed reference is a mislink, surfaced as
      // an unresolved claim — never drawn as a causal edge.
      if (recorded === undefined || recorded.event_type !== "impact.recorded") {
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
  // A provided-but-unusable window bound must fail loud, not silently disable the
  // filter and return the whole log ("no silent failure").
  if (query.window && (from === null || to === null)) {
    throw new Error(
      `projectDynamics: window bounds must be ISO-8601 with an explicit timezone offset ` +
        `(Z or ±HH:MM); got [${String(query.window[0])}, ${String(query.window[1])}]`,
    );
  }
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
      actor_id: e.actor_id,
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

  // Unresolved claims are filtered to the displayed graph: a claim owned by an
  // event the viewer/window hid must not leak that event's id, and the count must
  // reconcile with the shown nodes/edges.
  const visibleUnresolved = unresolved_claims.filter((u) => keptIds.has(u.event_id));
  const withheld = edges.length - keptEdges.length;

  const explicit_edges = keptEdges.filter((e) => e.edge_origin === "explicit").length;
  return {
    nodes,
    edges: keptEdges,
    domain_transitions,
    unresolved_claims: visibleUnresolved,
    diagnostics: report.diagnostics,
    summary: {
      node_count: nodes.length,
      edge_count: keptEdges.length,
      explicit_edges,
      inferred_edges: keptEdges.length - explicit_edges,
      domains,
      unresolved_count: visibleUnresolved.length,
      withheld,
    },
  };
}
