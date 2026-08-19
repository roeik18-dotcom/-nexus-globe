/**
 * Dynamics Layer — Step 3, part 2: the view-model.
 *
 * PHILOS-DYNAMICS-UI-CONTRACT.md §2–§5. A PURE function of `projectDynamics`'s
 * output — no second data source, no re-derivation from the event log, no I/O.
 * It turns a `DynamicsGraph` into the exact marks the React/SVG layer (part 3)
 * will render, and INVENTS NOTHING: every mark traces to a graph field.
 *
 * The crown rule (§3): the two honesty axes stay separate. `edge_origin` decides
 * the line style (solid vs dashed); `evidence_level` decides the ladder word.
 * They are read from DIFFERENT fields here and never collapsed into one — a test
 * flips one and asserts the other is unaffected (§6.4).
 *
 * Absence is stated, not faked (§4): `withheld` renders its count (and nothing
 * when 0 — no "all shown" claim), unresolved claims get first-class rows. The
 * §6 honesty tests gate this file; the component is a thin map over this output.
 */
import type { VerificationStatus } from "./events";
import type { Domain, DynamicsEdge, DynamicsGraph, DynamicsNode } from "./projectDynamics";

/**
 * One stable colour per domain — a legend mapping of the real `domain` field and
 * nothing more. It encodes data the projection returned; it does not invent any.
 */
export const DOMAIN_COLOR: Record<Domain, string> = {
  people: "#4f9dff",
  community: "#8b6cff",
  activity: "#00c2a8",
  resources: "#f2b13c",
  impact: "#ff6b8b",
};

export interface NodeMark {
  event_id: string;
  domain: Domain;
  /** From DOMAIN_COLOR — decodes `domain`, explained by the legend (§13). */
  lane_color: string;
  label: string;
  /** "what happened, when" — verbatim from the event, never reworded (§2). */
  tooltip: string;
  actor_id: string;
  timestamp: string;
}

export interface EdgeMark {
  source_event_id: string;
  target_event_id: string;
  origin: "explicit" | "inferred";
  /** edge_origin axis → line style. inferred = dashed. NEVER derived from evidence. */
  dashed: boolean;
  /** evidence_level axis → the literal ladder word. NEVER derived from origin. */
  evidence_word: VerificationStatus;
  /** inferred edges only: names the basis of the guess ("via allocation_id"). */
  join_key_label?: string;
  /** inferred edges only: a hypothesis weight, labelled as such by the UI. */
  confidence?: number;
  domain_transition: [Domain, Domain];
  /** provenance.source_events — the "why is this here?" popover contents. */
  source_events: string[];
  /** Honest sentence: explicit names the declarer + time; inferred names the join and disclaims. */
  popover: string;
}

export interface DomainRipple {
  from: Domain;
  to: Domain;
  count: number;
  /** "resources → impact ×1" */
  text: string;
}

export interface WithheldLine {
  count: number;
  /** Present iff count > 0. When 0 it is empty — never a fabricated "all shown" claim (§4). */
  text: string;
}

export interface UnresolvedRow {
  event_id: string;
  kind: "missing_causal_parent" | "missing_join_target";
  reference: string;
  join_key?: string;
  text: string;
}

export interface HudCounts {
  nodes: number;
  edges: number;
  explicit_edges: number;
  inferred_edges: number;
  withheld: number;
  unresolved: number;
}

export interface DynamicsViewModel {
  nodes: NodeMark[];
  edges: EdgeMark[];
  domain_ripples: DomainRipple[];
  withheld: WithheldLine;
  unresolved: UnresolvedRow[];
  hud: HudCounts;
}

const nodeTooltip = (n: DynamicsNode): string => `${n.event_type} · ${n.timestamp}`;

/**
 * The explicit-edge popover names the DECLARER. A `caused_by` declaration lives
 * on the EFFECT (target) event: that actor stated what caused it, at that time.
 * Both are event-traceable via the target node. The inferred popover names the
 * join key and disclaims it as a guess, never a declared link (§3).
 */
const edgePopover = (edge: DynamicsEdge, target: DynamicsNode | undefined): string => {
  if (edge.edge_origin === "explicit") {
    const who = target ? target.actor_id : "unknown";
    const when = target ? target.timestamp : "unknown";
    return `declared by ${who} at ${when}`;
  }
  const via = edge.join_key ?? "an allow-listed key";
  return `inferred from ${via}; not a declared link`;
};

export function buildDynamicsView(graph: DynamicsGraph): DynamicsViewModel {
  const nodeById = new Map<string, DynamicsNode>();
  for (const n of graph.nodes) nodeById.set(n.event_id, n);

  const nodes: NodeMark[] = graph.nodes.map((n) => ({
    event_id: n.event_id,
    domain: n.domain,
    lane_color: DOMAIN_COLOR[n.domain],
    label: n.label,
    tooltip: nodeTooltip(n),
    actor_id: n.actor_id,
    timestamp: n.timestamp,
  }));

  const edges: EdgeMark[] = graph.edges.map((e) => {
    const inferred = e.edge_origin === "inferred";
    const mark: EdgeMark = {
      source_event_id: e.source_event_id,
      target_event_id: e.target_event_id,
      origin: e.edge_origin,
      dashed: inferred, // ← edge_origin axis ONLY
      evidence_word: e.evidence_level, // ← evidence_level axis ONLY (read separately)
      domain_transition: e.domain_transition,
      source_events: e.provenance.source_events,
      popover: edgePopover(e, nodeById.get(e.target_event_id)),
    };
    // join_key / confidence exist iff inferred — mirror the projection's own invariant.
    if (inferred && e.join_key !== undefined) mark.join_key_label = `via ${e.join_key}`;
    if (inferred && e.confidence !== undefined) mark.confidence = e.confidence;
    return mark;
  });

  const domain_ripples: DomainRipple[] = graph.domain_transitions.map((t) => ({
    from: t.from,
    to: t.to,
    count: t.count,
    text: `${t.from} → ${t.to} ×${t.count}`,
  }));

  const withheldCount = graph.summary.withheld;
  const withheld: WithheldLine = {
    count: withheldCount,
    text:
      withheldCount > 0
        ? `${withheldCount} cross-domain link${withheldCount === 1 ? "" : "s"} hidden from this view`
        : "",
  };

  const unresolved: UnresolvedRow[] = graph.unresolved_claims.map((u) => ({
    event_id: u.event_id,
    kind: u.kind,
    reference: u.reference,
    ...(u.join_key !== undefined ? { join_key: u.join_key } : {}),
    text:
      u.kind === "missing_causal_parent"
        ? `${u.event_id}: declared cause ${u.reference} is not a known event`
        : `${u.event_id}: join target ${u.reference} (${u.join_key ?? "?"}) is missing or wrong-typed`,
  }));

  const s = graph.summary;
  const hud: HudCounts = {
    nodes: s.node_count,
    edges: s.edge_count,
    explicit_edges: s.explicit_edges,
    inferred_edges: s.inferred_edges,
    withheld: s.withheld,
    unresolved: s.unresolved_count,
  };

  return { nodes, edges, domain_ripples, withheld, unresolved, hud };
}
