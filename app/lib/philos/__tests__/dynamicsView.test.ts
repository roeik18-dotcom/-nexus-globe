/**
 * The Dynamics view must not display anything the projection did not return.
 *
 * PHILOS-DYNAMICS-UI-CONTRACT.md §6 — the nine honesty tests that gate the view
 * BEFORE any React. They run over `buildDynamicsView` (the pure view-model) fed
 * by `projectDynamics`, mirroring app/planet/__tests__/globeHonesty.test.ts: the
 * view-model is the artefact under test (there is no DOM tooling in this repo),
 * so honesty is asserted where it is decidable — on the marks, not on pixels.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { PhilosEvent } from "../events";
import { projectDynamics, type DynamicsGraph, type DynamicsNode } from "../projectDynamics";
import { buildDynamicsView } from "../dynamicsView";
import { VALUE_GROUP_EVENTS } from "../valueGroupLog";

// ── fixtures ─────────────────────────────────────────────────────────────────

const ev = (
  o: Partial<PhilosEvent> & Pick<PhilosEvent, "event_id" | "event_type">,
): PhilosEvent => ({
  actor_id: "p_x",
  entity_type: "person",
  entity_id: "e1",
  value_tags: [],
  timestamp: "2026-07-01T10:00:00+03:00",
  visibility: "public",
  ...o,
});

const nodeLit = (id: string): DynamicsNode => ({
  event_id: id,
  actor_id: "p_x",
  domain: "people",
  entity_type: "person",
  entity_id: `e_${id}`,
  event_type: "person.registered",
  timestamp: "2026-07-01T09:00:00+03:00",
  label: id,
});

const seedGraph = projectDynamics({ events: VALUE_GROUP_EVENTS });
const seedView = buildDynamicsView(seedGraph);

// A graph with BOTH an explicit and an inferred edge, to contrast the two axes.
// p1 → m1 : caused_by declaration (explicit). t1 → i1 : shared allocation_id (inferred).
const mixedLog: PhilosEvent[] = [
  ev({ event_id: "p1", event_type: "person.registered", timestamp: "2026-07-01T09:00:00+03:00" }),
  ev({ event_id: "m1", event_type: "member.joined", timestamp: "2026-07-01T09:30:00+03:00", caused_by: ["p1"] }),
  ev({ event_id: "t1", event_type: "transfer.completed", entity_type: "transfer", timestamp: "2026-07-01T10:00:00+03:00", payload: { allocation_id: "A" } }),
  ev({ event_id: "i1", event_type: "impact.recorded", entity_type: "impact", timestamp: "2026-07-01T11:00:00+03:00", payload: { allocation_id: "A" } }),
];
const mixedView = buildDynamicsView(projectDynamics({ events: mixedLog }));
const explicitEdges = mixedView.edges.filter((e) => e.origin === "explicit");
const inferredEdges = mixedView.edges.filter((e) => e.origin === "inferred");

// A cross-domain explicit edge whose EFFECT is private to another actor: with a
// viewer, the effect node is hidden and the edge is withheld.
const hiddenLog: PhilosEvent[] = [
  ev({ event_id: "cause_pub", event_type: "transfer.completed", entity_type: "transfer", actor_id: "p_seen", timestamp: "2026-07-01T09:00:00+03:00" }),
  ev({ event_id: "effect_priv", event_type: "impact.recorded", entity_type: "impact", actor_id: "p_other", visibility: "private", timestamp: "2026-07-01T10:00:00+03:00", caused_by: ["cause_pub"] }),
];
const scopedGraph = projectDynamics({ events: hiddenLog, viewer: "p_seen" });
const scopedView = buildDynamicsView(scopedGraph);

// ── §6.2 no fabricated marks ─────────────────────────────────────────────────

describe("no fabricated marks", () => {
  it("renders exactly summary.node_count nodes and summary.edge_count edges", () => {
    expect(seedView.nodes.length).toBe(seedGraph.summary.node_count);
    expect(seedView.edges.length).toBe(seedGraph.summary.edge_count);
    // the seed carries real causal links, so the gate is not vacuous
    expect(seedView.edges.length).toBeGreaterThan(0);
  });
});

// ── §6.1 provenance completeness ─────────────────────────────────────────────

describe("provenance completeness", () => {
  it("every edge carries source_events, each resolving to a rendered node", () => {
    const nodeIds = new Set(seedView.nodes.map((n) => n.event_id));
    for (const e of seedView.edges) {
      expect(e.source_events.length).toBeGreaterThan(0);
      for (const id of e.source_events) expect(nodeIds.has(id)).toBe(true);
    }
  });
});

// ── §6.3 explicit ≠ inferred ─────────────────────────────────────────────────

describe("explicit and inferred are visually distinct, never 'verified'", () => {
  it("the fixture actually contains both kinds", () => {
    expect(explicitEdges.length).toBeGreaterThan(0);
    expect(inferredEdges.length).toBeGreaterThan(0);
  });

  it("every inferred edge is dashed, system_inference, with a named join key + confidence", () => {
    for (const e of inferredEdges) {
      expect(e.dashed).toBe(true);
      expect(e.evidence_word).toBe("system_inference");
      expect(e.join_key_label && e.join_key_label.length > 0).toBe(true);
      expect(typeof e.confidence).toBe("number");
    }
  });

  it("every explicit edge is solid, self_report, with no join key or confidence", () => {
    for (const e of explicitEdges) {
      expect(e.dashed).toBe(false);
      expect(e.evidence_word).toBe("self_report");
      expect(e.join_key_label).toBeUndefined();
      expect(e.confidence).toBeUndefined();
    }
  });

  it("no edge is ever labelled a verified status", () => {
    for (const e of mixedView.edges) {
      expect(["community_verified", "external_verified"]).not.toContain(e.evidence_word);
    }
  });
});

// ── §6.4 the two axes are not collapsed ──────────────────────────────────────

describe("edge_origin and evidence_level are read from separate fields", () => {
  const craft = (origin: "explicit" | "inferred", evidence: PhilosEvent["verification_status"]): DynamicsGraph => ({
    nodes: [nodeLit("a"), nodeLit("b")],
    edges: [
      {
        source_event_id: "a",
        target_event_id: "b",
        edge_origin: origin,
        evidence_level: evidence!,
        domain_transition: ["people", "people"],
        ...(origin === "inferred" ? { join_key: "allocation_id", confidence: 0.5 } : {}),
        provenance: { source_events: ["a", "b"], sample_size: 2, verification_status: evidence! },
      },
    ],
    domain_transitions: [],
    unresolved_claims: [],
    diagnostics: [],
    summary: {
      node_count: 2,
      edge_count: 1,
      explicit_edges: origin === "explicit" ? 1 : 0,
      inferred_edges: origin === "inferred" ? 1 : 0,
      domains: { people: 2, community: 0, activity: 0, resources: 0, impact: 0 },
      unresolved_count: 0,
      withheld: 0,
    },
  });

  it("line style follows edge_origin even when evidence_level says otherwise", () => {
    const v = buildDynamicsView(craft("explicit", "system_inference"));
    expect(v.edges[0].dashed).toBe(false); // origin=explicit → solid
    expect(v.edges[0].evidence_word).toBe("system_inference"); // evidence read independently
  });

  it("evidence word follows evidence_level even when edge_origin says otherwise", () => {
    const v = buildDynamicsView(craft("inferred", "self_report"));
    expect(v.edges[0].dashed).toBe(true); // origin=inferred → dashed
    expect(v.edges[0].evidence_word).toBe("self_report");
  });
});

// ── §6.5 withheld is stated, never faked ─────────────────────────────────────

describe("withheld absence is stated", () => {
  it("renders the exact count and hides the endpoints when withheld > 0", () => {
    expect(scopedGraph.summary.withheld).toBeGreaterThan(0);
    expect(scopedView.withheld.count).toBe(scopedGraph.summary.withheld);
    expect(scopedView.withheld.text).toContain(String(scopedGraph.summary.withheld));
  });

  it("makes no 'all shown' claim when nothing is withheld", () => {
    const v = buildDynamicsView(buildOpenGraph());
    expect(v.withheld.count).toBe(0);
    expect(v.withheld.text).toBe("");
  });

  function buildOpenGraph(): DynamicsGraph {
    return projectDynamics({ events: hiddenLog }); // no viewer → nothing hidden
  }
});

// ── §6.6 unresolved is inspectable ───────────────────────────────────────────

describe("unresolved claims are first-class rows", () => {
  const danglingGraph = projectDynamics({
    events: [ev({ event_id: "orphan", event_type: "member.joined", caused_by: ["ghost"] })],
  });
  const danglingView = buildDynamicsView(danglingGraph);

  it("renders exactly summary.unresolved_count rows, each naming its reference", () => {
    expect(danglingView.unresolved.length).toBe(danglingGraph.summary.unresolved_count);
    expect(danglingView.unresolved.length).toBeGreaterThan(0);
    for (const r of danglingView.unresolved) expect(r.text).toContain(r.reference);
  });
});

// ── §6.7 the viewer gate holds ───────────────────────────────────────────────

describe("viewer gate", () => {
  it("no hidden event_id appears anywhere in the scoped view", () => {
    const blob = JSON.stringify(scopedView);
    expect(blob).not.toContain("effect_priv");
    // the visible endpoint is still there — the gate hides data, not the whole graph
    expect(blob).toContain("cause_pub");
  });
});

// ── §6.8 determinism ─────────────────────────────────────────────────────────

describe("determinism", () => {
  it("builds byte-identical output for the same graph", () => {
    expect(JSON.stringify(buildDynamicsView(seedGraph))).toBe(JSON.stringify(buildDynamicsView(seedGraph)));
  });
});

// ── §6.9 no external data source ─────────────────────────────────────────────

describe("no external data reaches the view-model", () => {
  const SRC = readFileSync(join(process.cwd(), "app", "lib", "philos", "dynamicsView.ts"), "utf8");
  const code = SRC.replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((l) => !l.trim().startsWith("//"))
    .join("\n");

  it("reads no json store, no fs, no fetch", () => {
    expect(code).not.toMatch(/\.json/);
    expect(code).not.toMatch(/readFile|readFileSync|from "node:fs"|from "fs"|fetch\s*\(/);
  });

  it("imports only from within app/lib/philos (relative ./)", () => {
    const specs = [...code.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
    expect(specs.length).toBeGreaterThan(0);
    for (const spec of specs) {
      expect(spec.startsWith("./"), `unexpected import "${spec}"`).toBe(true);
    }
  });
});

// ── backing the actor claim (Milestone-1 projection change) ──────────────────

describe("actor_id backs the explicit popover", () => {
  it("every node mark carries an event-traceable actor_id", () => {
    for (const n of seedView.nodes) expect(n.actor_id.length).toBeGreaterThan(0);
  });

  it("each explicit popover names the effect event's declaring actor", () => {
    for (const e of explicitEdges) {
      const target = mixedView.nodes.find((n) => n.event_id === e.target_event_id);
      expect(target).toBeDefined();
      expect(e.popover).toContain("declared by");
      expect(e.popover).toContain(target!.actor_id);
    }
  });
});
