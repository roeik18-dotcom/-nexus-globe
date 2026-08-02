/**
 * Dynamics Layer — Step 2: projectDynamics.
 *
 * PHILOS-DYNAMICS-LAYER.md §1–§6. The cross-domain causal projection over the ONE
 * event log. Two axes stay separate on every edge: `edge_origin` (explicit vs
 * inferred) and `evidence_level` (the honesty ladder). Explicit edges come ONLY
 * from `caused_by`; inferred edges come ONLY from an allow-list of foreign keys —
 * never generic entity/time adjacency. Written test-first.
 */
import { describe, expect, it } from "vitest";

import type { PhilosEvent } from "../events";
import { projectDynamics } from "../projectDynamics";
import { VALUE_GROUP_EVENTS } from "../valueGroupLog";

const ev = (over: Partial<PhilosEvent> & { event_id: string }): PhilosEvent => ({
  actor_id: "p_x",
  entity_type: "value_group",
  entity_id: "vg_a",
  event_type: "update.posted",
  value_tags: [],
  timestamp: "2026-07-01T10:00:00+03:00",
  visibility: "public",
  ...over,
});

const explicit = (g: { edges: { edge_origin: string }[] }) =>
  g.edges.filter((e) => e.edge_origin === "explicit");
const inferred = (g: { edges: { edge_origin: string }[] }) =>
  g.edges.filter((e) => e.edge_origin === "inferred");
const has = (g: { edges: { source_event_id: string; target_event_id: string }[] }, s: string, t: string) =>
  g.edges.some((e) => e.source_event_id === s && e.target_event_id === t);

// ── explicit edges (from caused_by only) ─────────────────────────────────────

describe("explicit edges — derived only from caused_by", () => {
  it("a single caused_by parent yields one explicit edge, cause → effect", () => {
    const parent = ev({ event_id: "p", event_type: "group.opened", entity_id: "g1", timestamp: "2026-07-01T09:00:00+03:00" });
    const child = ev({ event_id: "c", event_type: "member.joined", timestamp: "2026-07-01T10:00:00+03:00", caused_by: ["p"] });
    const g = projectDynamics({ events: [parent, child] });
    const ex = explicit(g);
    expect(ex).toHaveLength(1);
    expect(ex[0].source_event_id).toBe("p");
    expect(ex[0].target_event_id).toBe("c");
    expect(ex[0].edge_origin).toBe("explicit");
    expect(ex[0].evidence_level).toBe("self_report");
    expect(ex[0].provenance.source_events).toEqual(["p", "c"]);
  });

  it("multiple parents yield one explicit edge each", () => {
    const a = ev({ event_id: "a", timestamp: "2026-07-01T08:00:00+03:00" });
    const b = ev({ event_id: "b", timestamp: "2026-07-01T09:00:00+03:00" });
    const c = ev({ event_id: "c", timestamp: "2026-07-01T10:00:00+03:00", caused_by: ["a", "b"] });
    const ex = explicit(projectDynamics({ events: [a, b, c] }));
    expect(ex).toHaveLength(2);
    expect(ex.map((e) => e.source_event_id).sort()).toEqual(["a", "b"]);
    expect(ex.every((e) => e.target_event_id === "c")).toBe(true);
  });
});

// ── inferred edges (allow-list only) ─────────────────────────────────────────

describe("inferred edges — allow-listed foreign keys only", () => {
  it("impact.verified → impact.recorded via target_impact_event_id", () => {
    const rec = ev({ event_id: "r", event_type: "impact.recorded", entity_type: "impact", entity_id: "imp1", timestamp: "2026-07-01T08:00:00+03:00" });
    const ver = ev({ event_id: "v", event_type: "impact.verified", entity_type: "impact", entity_id: "imp1", timestamp: "2026-07-01T09:00:00+03:00", payload: { target_impact_event_id: "r" } });
    const inf = inferred(projectDynamics({ events: [rec, ver] }));
    expect(inf).toHaveLength(1);
    expect(inf[0].source_event_id).toBe("r"); // recorded is the cause
    expect(inf[0].target_event_id).toBe("v"); // verified is the effect
    expect(inf[0].join_key).toBe("target_impact_event_id");
    expect(inf[0].edge_origin).toBe("inferred");
    expect(inf[0].evidence_level).toBe("system_inference");
    expect(typeof inf[0].confidence).toBe("number");
  });

  it("transfer.completed → impact.recorded via shared allocation_id", () => {
    const tr = ev({ event_id: "t", event_type: "transfer.completed", entity_type: "transfer", entity_id: "tr1", timestamp: "2026-07-01T08:00:00+03:00", payload: { allocation_id: "al1" } });
    const im = ev({ event_id: "i", event_type: "impact.recorded", entity_type: "impact", entity_id: "imp1", timestamp: "2026-07-01T09:00:00+03:00", payload: { allocation_id: "al1" } });
    const inf = inferred(projectDynamics({ events: [tr, im] }));
    expect(inf).toHaveLength(1);
    expect(inf[0].source_event_id).toBe("t");
    expect(inf[0].target_event_id).toBe("i");
    expect(inf[0].join_key).toBe("allocation_id");
    expect(inf[0].evidence_level).toBe("system_inference");
  });

  it("does NOT infer from generic shared entity_id + time adjacency", () => {
    const a = ev({ event_id: "a", event_type: "update.posted", entity_id: "vg1", timestamp: "2026-07-01T08:00:00+03:00" });
    const b = ev({ event_id: "b", event_type: "meeting.scheduled", entity_id: "vg1", timestamp: "2026-07-01T09:00:00+03:00" });
    expect(projectDynamics({ events: [a, b] }).edges).toHaveLength(0);
  });

  it("does NOT treat verification.requested as an inference source (allow-list is impact.verified only)", () => {
    const rec = ev({ event_id: "r", event_type: "impact.recorded", entity_type: "impact", entity_id: "imp1", timestamp: "2026-07-01T08:00:00+03:00" });
    const req = ev({ event_id: "q", event_type: "verification.requested", entity_type: "impact", entity_id: "imp1", timestamp: "2026-07-01T09:00:00+03:00", payload: { target_impact_event_id: "r" } });
    expect(projectDynamics({ events: [rec, req] }).edges).toHaveLength(0);
  });
});

// ── precedence, invalidity, unresolved ───────────────────────────────────────

describe("collisions and invalid declarations", () => {
  it("explicit wins over inferred for the same pair — no duplicate edge", () => {
    const rec = ev({ event_id: "r", event_type: "impact.recorded", entity_type: "impact", entity_id: "imp1", timestamp: "2026-07-01T08:00:00+03:00" });
    const ver = ev({ event_id: "v", event_type: "impact.verified", entity_type: "impact", entity_id: "imp1", timestamp: "2026-07-01T09:00:00+03:00", caused_by: ["r"], payload: { target_impact_event_id: "r" } });
    const g = projectDynamics({ events: [rec, ver] });
    const pair = g.edges.filter((e) => e.source_event_id === "r" && e.target_event_id === "v");
    expect(pair).toHaveLength(1);
    expect(pair[0].edge_origin).toBe("explicit");
  });

  it("an invalid caused_by (parent after child) never renders an edge, but the diagnostic surfaces", () => {
    const parent = ev({ event_id: "p", timestamp: "2026-07-02T10:00:00+03:00" });
    const child = ev({ event_id: "c", timestamp: "2026-07-01T10:00:00+03:00", caused_by: ["p"] });
    const g = projectDynamics({ events: [parent, child] });
    expect(explicit(g)).toHaveLength(0);
    expect(g.diagnostics.some((d) => d.code === "parent_after_child")).toBe(true);
  });

  it("a self-referential caused_by renders no edge", () => {
    const g = projectDynamics({ events: [ev({ event_id: "s", caused_by: ["s"] })] });
    expect(g.edges).toHaveLength(0);
  });

  it("missing parent — lenient keeps an inspectable unresolved claim and no edge", () => {
    const g = projectDynamics({ events: [ev({ event_id: "c", caused_by: ["ghost"] })] });
    expect(g.edges).toHaveLength(0);
    expect(g.unresolved_claims.some((u) => u.reference === "ghost" && u.kind === "missing_causal_parent")).toBe(true);
  });

  it("missing parent — strict raises it to an error diagnostic", () => {
    const g = projectDynamics({ events: [ev({ event_id: "c", caused_by: ["ghost"] })], mode: "strict" });
    expect(g.diagnostics.some((d) => d.code === "missing_parent" && d.severity === "error")).toBe(true);
  });
});

// ── window filtering, determinism, removal ───────────────────────────────────

describe("view: window, determinism, removal", () => {
  it("window filtering drops out-of-window nodes and any edge that loses an endpoint", () => {
    const parent = ev({ event_id: "p", event_type: "group.opened", entity_id: "g1", timestamp: "2026-07-01T09:00:00+03:00" });
    const child = ev({ event_id: "c", event_type: "member.joined", timestamp: "2026-07-05T10:00:00+03:00", caused_by: ["p"] });
    const g = projectDynamics({ events: [parent, child], window: ["2026-07-03T00:00:00+03:00", "2026-07-10T00:00:00+03:00"] });
    expect(g.nodes.some((n) => n.event_id === "p")).toBe(false);
    expect(g.nodes.some((n) => n.event_id === "c")).toBe(true);
    expect(g.edges).toHaveLength(0);
  });

  it("deterministic — same input yields a deep-equal graph", () => {
    expect(projectDynamics({ events: VALUE_GROUP_EVENTS })).toEqual(projectDynamics({ events: VALUE_GROUP_EVENTS }));
  });

  it("removing a source event removes its node and its edges", () => {
    const full = projectDynamics({ events: VALUE_GROUP_EVENTS });
    expect(full.edges.some((e) => e.source_event_id === "e051")).toBe(true); // inferred e051→e070
    const without = projectDynamics({ events: VALUE_GROUP_EVENTS.filter((e) => e.event_id !== "e051") });
    expect(without.nodes.some((n) => n.event_id === "e051")).toBe(false);
    expect(without.edges.some((e) => e.source_event_id === "e051" || e.target_event_id === "e051")).toBe(false);
  });
});

// ── flagship vertical slice (real seed) ──────────────────────────────────────

describe("flagship chain — real seed, honest edges", () => {
  const g = projectDynamics({ events: VALUE_GROUP_EVENTS });

  it("explicit funding chain: group.opened → proposal → approval → transfer.approved → completed", () => {
    expect(has(g, "e010", "e040")).toBe(true); // group.opened → allocation.proposed
    expect(has(g, "e040", "e047")).toBe(true); // proposal → approved
    expect(has(g, "e047", "e050")).toBe(true); // approved → transfer.approved
    expect(has(g, "e050", "e051")).toBe(true); // transfer.approved → completed
  });

  it("inferred cross-domain edge: transfer.completed →(allocation_id) impact.recorded", () => {
    const edge = g.edges.find((e) => e.source_event_id === "e051" && e.target_event_id === "e070");
    expect(edge?.edge_origin).toBe("inferred");
    expect(edge?.join_key).toBe("allocation_id");
    expect(edge?.domain_transition).toEqual(["resources", "impact"]);
  });

  it("inferred impact edges: impact.recorded →(target_impact_event_id) each impact.verified", () => {
    for (const v of ["e071", "e072", "e073"]) {
      const edge = g.edges.find((e) => e.source_event_id === "e070" && e.target_event_id === v);
      expect(edge?.edge_origin).toBe("inferred");
      expect(edge?.join_key).toBe("target_impact_event_id");
    }
  });

  it("surfaces the resources → impact domain transition", () => {
    expect(g.domain_transitions.some((d) => d.from === "resources" && d.to === "impact")).toBe(true);
  });

  it("the seed produces no unresolved claims and validates clean", () => {
    expect(g.unresolved_claims).toEqual([]);
    expect(g.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  });
});

// ── adversarial-pass fixes (Step-2 review) ───────────────────────────────────

describe("adversarial-pass hardening", () => {
  it("Rule A never self-loops when target_impact_event_id points at its own event", () => {
    const v = ev({ event_id: "v", event_type: "impact.verified", entity_type: "impact", entity_id: "imp1", payload: { target_impact_event_id: "v" } });
    expect(projectDynamics({ events: [v] }).edges).toHaveLength(0);
  });

  it("Rule A draws no edge when target_impact_event_id resolves to a non-impact.recorded event", () => {
    const grp = ev({ event_id: "g", event_type: "group.opened", entity_id: "g1", timestamp: "2026-07-01T08:00:00+03:00" });
    const v = ev({ event_id: "v", event_type: "impact.verified", entity_type: "impact", entity_id: "imp1", timestamp: "2026-07-01T09:00:00+03:00", payload: { target_impact_event_id: "g" } });
    const g = projectDynamics({ events: [grp, v] });
    expect(inferred(g)).toHaveLength(0);
    expect(g.unresolved_claims.some((u) => u.kind === "missing_join_target" && u.reference === "g")).toBe(true);
  });

  it("a duplicated caused_by parent renders exactly one explicit edge, diagnostic still shown", () => {
    const a = ev({ event_id: "a", timestamp: "2026-07-01T08:00:00+03:00" });
    const c = ev({ event_id: "c", timestamp: "2026-07-01T10:00:00+03:00", caused_by: ["a", "a"] });
    const g = projectDynamics({ events: [a, c] });
    expect(explicit(g).filter((e) => e.source_event_id === "a" && e.target_event_id === "c")).toHaveLength(1);
    expect(g.diagnostics.some((d) => d.code === "duplicate_parent")).toBe(true);
  });

  it("a 2-node caused_by cycle renders no explicit edge and flags causal_cycle", () => {
    const t = "2026-07-01T10:00:00+03:00";
    const a = ev({ event_id: "a", timestamp: t, caused_by: ["b"] });
    const b = ev({ event_id: "b", timestamp: t, caused_by: ["a"] });
    const g = projectDynamics({ events: [a, b] });
    expect(explicit(g)).toHaveLength(0);
    expect(g.diagnostics.some((d) => d.code === "causal_cycle")).toBe(true);
  });

  it("an overlapping/nested cycle leaks NO cyclic edge (SCC suppression, not per-path)", () => {
    const t = "2026-07-01T10:00:00+03:00";
    // a↔c is a 2-cycle NOT on findCycles' single reported path; SCC still catches it.
    const a = ev({ event_id: "a", timestamp: t, caused_by: ["b", "c"] });
    const b = ev({ event_id: "b", timestamp: t, caused_by: ["c"] });
    const c = ev({ event_id: "c", timestamp: t, caused_by: ["a"] });
    const g = projectDynamics({ events: [a, b, c] });
    expect(explicit(g)).toHaveLength(0);
    expect(g.diagnostics.some((d) => d.code === "causal_cycle")).toBe(true);
  });

  it("strict mode still records a dangling parent as an inspectable unresolved claim", () => {
    const g = projectDynamics({ events: [ev({ event_id: "c", caused_by: ["ghost"] })], mode: "strict" });
    expect(g.unresolved_claims.some((u) => u.reference === "ghost" && u.kind === "missing_causal_parent")).toBe(true);
    expect(g.summary.unresolved_count).toBe(1);
  });

  it("a window bound without a timezone offset throws, never silently returns everything", () => {
    expect(() => projectDynamics({ events: VALUE_GROUP_EVENTS, window: ["2026-07-03", "2026-07-10"] })).toThrow(/timezone offset/);
  });

  it("an offsetless (ambiguous) timestamp yields no explicit edge and flags invalid_timestamp", () => {
    const p = ev({ event_id: "p", timestamp: "2026-07-01T09:00:00" });
    const c = ev({ event_id: "c", timestamp: "2026-07-02T10:00:00+03:00", caused_by: ["p"] });
    const g = projectDynamics({ events: [p, c] });
    expect(explicit(g)).toHaveLength(0);
    expect(g.diagnostics.some((d) => d.code === "invalid_timestamp")).toBe(true);
  });

  it("a private parent is hidden from a non-actor viewer; its edge is withheld and counted", () => {
    const p = ev({ event_id: "p", event_type: "group.opened", entity_id: "g1", actor_id: "p_owner", visibility: "private", timestamp: "2026-07-01T09:00:00+03:00" });
    const c = ev({ event_id: "c", event_type: "member.joined", actor_id: "p_pub", timestamp: "2026-07-01T10:00:00+03:00", caused_by: ["p"] });
    const hidden = projectDynamics({ events: [p, c], viewer: "p_intruder" });
    expect(hidden.nodes.some((n) => n.event_id === "p")).toBe(false);
    expect(hidden.edges).toHaveLength(0);
    expect(hidden.summary.withheld).toBe(1);
    const shown = projectDynamics({ events: [p, c], viewer: "p_owner" });
    expect(shown.nodes.some((n) => n.event_id === "p")).toBe(true);
    expect(shown.edges).toHaveLength(1);
  });

  it("unresolved claims owned by a hidden event never leak past the viewer gate", () => {
    const secret = ev({ event_id: "e_secret", actor_id: "p_owner", visibility: "private", caused_by: ["ghost"], timestamp: "2026-07-01T10:00:00+03:00" });
    const intruder = projectDynamics({ events: [secret], viewer: "p_intruder" });
    expect(intruder.unresolved_claims).toEqual([]);
    expect(intruder.summary.unresolved_count).toBe(0);
    const owner = projectDynamics({ events: [secret], viewer: "p_owner" });
    expect(owner.unresolved_claims.some((u) => u.event_id === "e_secret")).toBe(true);
  });
});

// ── honesty invariants ───────────────────────────────────────────────────────

describe("honesty invariants", () => {
  const g = projectDynamics({ events: VALUE_GROUP_EVENTS });

  it("every edge traces to real event ids via provenance", () => {
    const ids = new Set(VALUE_GROUP_EVENTS.map((e) => e.event_id));
    for (const e of g.edges) {
      expect(ids.has(e.source_event_id)).toBe(true);
      expect(ids.has(e.target_event_id)).toBe(true);
      expect(e.provenance.source_events).toContain(e.source_event_id);
      expect(e.provenance.source_events).toContain(e.target_event_id);
    }
  });

  it("every inferred edge names its join key and is labelled system_inference; explicit edges carry none", () => {
    for (const e of g.edges) {
      if (e.edge_origin === "inferred") {
        expect(typeof e.join_key).toBe("string");
        expect(e.evidence_level).toBe("system_inference");
      } else {
        expect(e.join_key).toBeUndefined();
        expect(e.evidence_level).toBe("self_report");
      }
    }
  });

  it("summary counts reconcile with the edge list", () => {
    expect(g.summary.edge_count).toBe(g.edges.length);
    expect(g.summary.explicit_edges).toBe(explicit(g).length);
    expect(g.summary.inferred_edges).toBe(inferred(g).length);
    expect(g.summary.node_count).toBe(g.nodes.length);
  });

  it("no UI dependency — output is plain data", () => {
    expect(Array.isArray(g.nodes)).toBe(true);
    expect(Array.isArray(g.edges)).toBe(true);
    expect(g).not.toHaveProperty("render");
  });
});
