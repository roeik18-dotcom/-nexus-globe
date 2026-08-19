import { describe, expect, it } from "vitest";
import {
  buildKnowledgeGraph,
  buildRealityGraph,
  HUMAN_DOMAINS,
  REGULATORY_LAYER,
  CONTEXTUAL_FIELDS,
  PHILOS_PRINCIPLES,
  VECTOR_DEFINITIONS,
} from "../brainGraph";
import type { CanonDynamicsGraph, CanonObservationMark } from "../canon/projectCanonDynamics";
import { REAL_CURRENT_SUBJECT } from "../subjectRegistry";

describe("HUMAN_DOMAINS — functional domains, each backed by a real canon Domain", () => {
  it("has exactly 3 domains, each mapping 1:1 to G/E/C", () => {
    expect(HUMAN_DOMAINS).toHaveLength(3);
    expect(HUMAN_DOMAINS.map((d) => d.canonDomain).sort()).toEqual(["C", "E", "G"]);
  });

  it("every domain cites a real source", () => {
    for (const d of HUMAN_DOMAINS) expect(d.source).toBeTruthy();
  });
});

describe("REGULATORY_LAYER — id/ego/superego, no live data source", () => {
  it("has exactly 3 entries: id, ego, superego", () => {
    expect(REGULATORY_LAYER.map((r) => r.key).sort()).toEqual(["ego", "id", "superego"]);
  });

  it("states plainly that no canon measurement backs this layer", () => {
    for (const r of REGULATORY_LAYER) expect(r.source).toContain("לא נמדד");
  });
});

describe("CONTEXTUAL_FIELDS — exactly 3, never flattened with domain/vector", () => {
  it("has exactly 3 fields: personal, interpersonal, external", () => {
    expect(CONTEXTUAL_FIELDS.map((f) => f.key).sort()).toEqual(["external", "interpersonal", "personal"]);
  });
});

describe("PHILOS_PRINCIPLES — 10 principles, 2 expressions each, no classification function", () => {
  it("has exactly 10 principles, each with a constructive and constrained expression", () => {
    expect(PHILOS_PRINCIPLES).toHaveLength(10);
    for (const p of PHILOS_PRINCIPLES) {
      expect(p.constructive).toBeTruthy();
      expect(p.constrained).toBeTruthy();
    }
  });

  it("names 20 total distinct expressions", () => {
    const expressions = PHILOS_PRINCIPLES.flatMap((p) => [p.constructive, p.constrained]);
    expect(expressions).toHaveLength(20);
    expect(new Set(expressions).size).toBe(20);
  });

  it("terminology correction: key/label are neutral PHILOS terms, never a Kabbalistic name", () => {
    const kabbalisticNames = ["keter", "chochmah", "binah", "chesed", "gevurah", "tiferet", "netzach", "hod", "yesod", "malkhut", "כתר", "חכמה", "בינה", "חסד", "גבורה", "תפארת", "נצח", "הוד", "יסוד", "מלכות"];
    for (const p of PHILOS_PRINCIPLES) {
      const keyLower = p.key.toLowerCase();
      expect(kabbalisticNames.some((n) => keyLower.includes(n.toLowerCase()))).toBe(false);
      expect(kabbalisticNames.some((n) => p.label.includes(n))).toBe(false);
    }
  });

  it("the historical source term is preserved (not deleted), only demoted to sourceLensTerm", () => {
    const kabbalisticNames = ["KETER", "CHOCHMAH", "BINAH", "CHESED", "GEVURAH", "TIFERET", "NETZACH", "HOD", "YESOD", "MALKHUT"];
    const lensTerms = PHILOS_PRINCIPLES.map((p) => p.sourceLensTerm);
    for (const name of kabbalisticNames) {
      expect(lensTerms.some((t) => t.includes(name))).toBe(true);
    }
  });
});

describe("VECTOR_DEFINITIONS — 6 named vector types, edges not nodes", () => {
  it("has exactly 6 vectors: v0-v5", () => {
    expect(VECTOR_DEFINITIONS.map((v) => v.key).sort()).toEqual(["v0", "v1", "v2", "v3", "v4", "v5"]);
  });
});

describe("buildKnowledgeGraph", () => {
  it("no longer carries any 'force'/'force_unresolved' kind — forces moved to HUMAN_DOMAINS/REGULATORY_LAYER", () => {
    const nodes = buildKnowledgeGraph();
    expect(nodes.some((n) => (n.kind as string) === "force" || (n.kind as string) === "force_unresolved")).toBe(false);
  });

  it("renders exactly 10 real contradiction categories", () => {
    const nodes = buildKnowledgeGraph();
    expect(nodes.filter((n) => n.kind === "category")).toHaveLength(10);
  });

  it("still names the six-buildings model as a real, cited reference", () => {
    const nodes = buildKnowledgeGraph();
    const model = nodes.find((n) => n.id === "model_six_buildings");
    expect(model?.source).toBeTruthy();
  });
});

function mark(overrides: Partial<CanonObservationMark>): CanonObservationMark {
  return {
    id: overrides.canon_event_id ?? "x",
    canon_event_id: overrides.canon_event_id ?? "x",
    subject: "person_a",
    domain: "E",
    frame: "I",
    level: 0,
    stability: 0,
    deficitType: "RELATIVE",
    context: "test",
    reference: "self_goal:test",
    observed_at: "2026-08-15T10:00:00.000Z",
    recorded_at: "2026-08-15T10:00:01.000Z",
    provenance: "self_reported",
    persisted_or_derived: "persisted",
    label: "test",
    tooltip: "test",
    ...overrides,
  };
}

describe("buildRealityGraph", () => {
  it("empty canon -> empty reality graph, never fabricated", () => {
    const g: CanonDynamicsGraph = { source: "canon", nodes: [], summary: { node_count: 0, persisted_count: 0, domains: { G: 0, E: 0, C: 0 } } };
    expect(buildRealityGraph(g)).toEqual([]);
  });

  it("one real Observation for a normal-mode (REAL) subject -> one real reality node, verbatim fields", () => {
    const m = mark({ canon_event_id: "c1", subject: REAL_CURRENT_SUBJECT, domain: "G", level: -2 });
    const g: CanonDynamicsGraph = { source: "canon", nodes: [m], summary: { node_count: 1, persisted_count: 1, domains: { G: 1, E: 0, C: 0 } } };
    const [node] = buildRealityGraph(g);
    expect(node.subject).toBe(REAL_CURRENT_SUBJECT);
    expect(node.domain).toBe("G");
    expect(node.level).toBe(-2);
    expect(node.canon_event_id).toBe("c1");
  });

  it("HARD ACCEPTANCE TEST (ledger §33): TEST/PLACEHOLDER/SYSTEM subjects are excluded from the normal-mode reality backdrop, never just from the center node", () => {
    const g: CanonDynamicsGraph = {
      source: "canon",
      nodes: [
        mark({ canon_event_id: "c1", subject: "person_e2e" }),
        mark({ canon_event_id: "c2", subject: "person_qa_natural_philos_PLACEHOLDER" }),
        mark({ canon_event_id: "c3", subject: "merlin_connectivity_test_person" }),
        mark({ canon_event_id: "c4", subject: REAL_CURRENT_SUBJECT }),
      ],
      summary: { node_count: 4, persisted_count: 4, domains: { G: 0, E: 0, C: 0 } },
    };
    const nodes = buildRealityGraph(g);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].subject).toBe(REAL_CURRENT_SUBJECT);
  });
});
