/**
 * resolveContext — resolves a SystemContextRef against data the /dynamics
 * page already has, with no second store call. Verifies: real data only,
 * no fabricated edges, UNKNOWN stays UNKNOWN, persisted/derived and
 * claimed/verified reused verbatim from the real canon axes.
 */
import { describe, expect, it } from "vitest";
import { resolveContext } from "../page";
import type { CanonDynamicsGraph } from "@/app/lib/philos/canon/projectCanonDynamics";
import type { DynamicsViewModel } from "@/app/lib/philos/dynamicsView";

const EMPTY_CANON: CanonDynamicsGraph = {
  source: "canon",
  nodes: [],
  summary: { node_count: 0, persisted_count: 0, domains: { G: 0, E: 0, C: 0 } },
};

const canonWithOne: CanonDynamicsGraph = {
  source: "canon",
  nodes: [
    {
      id: "canon_evt_1",
      canon_event_id: "canon_evt_1",
      subject: "person_x",
      domain: "E",
      frame: "I",
      level: -3,
      stability: 4,
      deficitType: "RELATIVE",
      context: "evening_session",
      reference: "self_goal:baseline_energy",
      observed_at: "2026-08-14T15:00:00.000Z",
      recorded_at: "2026-08-14T15:00:01.000Z",
      provenance: "self_reported",
      persisted_or_derived: "persisted",
      label: "PHILOS canon Observation — E/I (evening_session)",
      tooltip: "subject=person_x level=-3 stability=4",
    },
  ],
  summary: { node_count: 1, persisted_count: 1, domains: { G: 0, E: 1, C: 0 } },
};

const EMPTY_VIEW: DynamicsViewModel = {
  nodes: [],
  edges: [],
  domain_ripples: [],
  withheld: { count: 0, text: "" },
  unresolved: [],
  hud: { nodes: 0, edges: 0, explicit_edges: 0, inferred_edges: 0, withheld: 0, unresolved: 0 },
};

const viewWithNodeAndEdge: DynamicsViewModel = {
  nodes: [
    {
      event_id: "e010",
      domain: "people",
      lane_color: "#4f9dff",
      label: "person joined",
      tooltip: "member.joined · 2026-08-01T00:00:00Z",
      actor_id: "person_roei",
      timestamp: "2026-08-01T00:00:00Z",
    },
    {
      event_id: "e011",
      domain: "activity",
      lane_color: "#00c2a8",
      label: "update posted",
      tooltip: "update.posted · 2026-08-01T01:00:00Z",
      actor_id: "person_roei",
      timestamp: "2026-08-01T01:00:00Z",
    },
  ],
  edges: [
    {
      source_event_id: "e010",
      target_event_id: "e011",
      origin: "explicit",
      dashed: false,
      evidence_word: "self_report",
      domain_transition: ["people", "activity"],
      source_events: ["e010", "e011"],
      popover: "declared by person_roei at 2026-08-01T01:00:00Z",
    },
  ],
  domain_ripples: [],
  withheld: { count: 0, text: "" },
  unresolved: [],
  hud: { nodes: 2, edges: 1, explicit_edges: 1, inferred_edges: 0, withheld: 0, unresolved: 0 },
};

const viewWithLonelyNode: DynamicsViewModel = {
  nodes: [
    {
      event_id: "e099",
      domain: "resources",
      lane_color: "#f2b13c",
      label: "resource received",
      tooltip: "resource.received · 2026-08-01T00:00:00Z",
      actor_id: "person_roei",
      timestamp: "2026-08-01T00:00:00Z",
    },
  ],
  edges: [],
  domain_ripples: [],
  withheld: { count: 0, text: "" },
  unresolved: [],
  hud: { nodes: 1, edges: 0, explicit_edges: 0, inferred_edges: 0, withheld: 0, unresolved: 0 },
};

describe("resolveContext", () => {
  it("null ref -> status none", () => {
    expect(resolveContext(null, EMPTY_CANON, EMPTY_VIEW)).toEqual({ status: "none" });
  });

  it("unknown ref stays unknown", () => {
    expect(resolveContext({ kind: "unknown", raw: "garbage:1" }, EMPTY_CANON, EMPTY_VIEW)).toEqual({
      status: "unknown",
      raw: "garbage:1",
    });
  });

  it("a real-shaped canon ref with no matching record -> not_found (UNKNOWN stays UNKNOWN)", () => {
    const ref = { kind: "canon_observation" as const, canon_event_id: "does_not_exist" };
    expect(resolveContext(ref, EMPTY_CANON, EMPTY_VIEW)).toEqual({ status: "not_found", ref });
  });

  it("a real-shaped legacy ref with no matching node -> not_found", () => {
    const ref = { kind: "legacy_event" as const, event_id: "does_not_exist" };
    expect(resolveContext(ref, EMPTY_CANON, EMPTY_VIEW)).toEqual({ status: "not_found", ref });
  });

  it("a matching canon Observation resolves with real fields, no fabricated edge, not_applicable claimed/verified", () => {
    const ref = { kind: "canon_observation" as const, canon_event_id: "canon_evt_1" };
    const result = resolveContext(ref, canonWithOne, EMPTY_VIEW);
    expect(result).toEqual({
      status: "found",
      ref,
      system: "canon",
      matched_id: "canon_evt_1",
      label: "PHILOS canon Observation — E/I (evening_session)",
      domain: "E (emotional)",
      frame: "I (individual)",
      provenance: "self_reported",
      persisted_or_derived: "persisted",
      claimed_or_verified: "not_applicable",
      subject: "person_x",
      related: null,
      timestamp: "2026-08-14T15:00:00.000Z",
      priorState: null, // only Observation for this subject — checked, genuinely none
      delta: null,
      relationships: [], // canon has no edges at all — checked, genuinely none
      currentState: { level: -3, stability: 4, deficitType: "RELATIVE" },
    });
  });

  it("a matching legacy event WITH a real OUTGOING edge lists it in relationships, direction preserved", () => {
    const ref = { kind: "legacy_event" as const, event_id: "e010" };
    const result = resolveContext(ref, EMPTY_CANON, viewWithNodeAndEdge);
    expect(result.status).toBe("found");
    if (result.status !== "found") throw new Error("unreachable");
    expect(result.relationships).toEqual([
      {
        direction: "outgoing",
        other_id: "e011",
        other_label: "update posted",
        relation_label: "leads to (declared)",
        origin: "explicit",
        evidence_level: "self_report",
      },
    ]);
    // e010 is only ever a SOURCE in this fixture, never a TARGET, so the
    // lighter `related` pointer (incoming-only) is honestly null here —
    // never fabricated from an outgoing edge.
    expect(result.related).toBeNull();
  });

  it("a matching legacy event WITH a real INCOMING edge surfaces it via both relationships and related", () => {
    const ref = { kind: "legacy_event" as const, event_id: "e011" };
    const result = resolveContext(ref, EMPTY_CANON, viewWithNodeAndEdge);
    expect(result.status).toBe("found");
    if (result.status !== "found") throw new Error("unreachable");
    expect(result.relationships).toEqual([
      {
        direction: "incoming",
        other_id: "e010",
        other_label: "person joined",
        relation_label: "caused by (declared)",
        origin: "explicit",
        evidence_level: "self_report",
      },
    ]);
    expect(result.related).toEqual({ description: "e010 → e011 (caused by (declared))", event_id: "e010" });
  });

  it("a matching legacy event with NO connected edge resolves relationships: [] — UNRESOLVED, never invented", () => {
    const ref = { kind: "legacy_event" as const, event_id: "e099" };
    const result = resolveContext(ref, EMPTY_CANON, viewWithLonelyNode);
    expect(result.status).toBe("found");
    if (result.status !== "found") throw new Error("unreachable");
    expect(result.related).toBeNull();
    expect(result.relationships).toEqual([]);
    // Legacy events are discrete facts, not repeated measurements — state
    // history is genuinely not computed here, not fabricated as absent.
    expect(result.priorState).toBeUndefined();
    expect(result.delta).toBeUndefined();
  });

  it("STATE+TIME: a second canon Observation for the SAME subject finds the real prior and a real delta", () => {
    const earlier = canonWithOne.nodes[0];
    const later = {
      ...earlier,
      id: "canon_evt_2",
      canon_event_id: "canon_evt_2",
      observed_at: "2026-08-14T16:00:00.000Z",
      recorded_at: "2026-08-14T16:00:01.000Z",
      level: -1,
      stability: 5,
      label: "PHILOS canon Observation — E/I (morning_session)",
    };
    const twoObs: CanonDynamicsGraph = {
      source: "canon",
      nodes: [earlier, later],
      summary: { node_count: 2, persisted_count: 2, domains: { G: 0, E: 2, C: 0 } },
    };
    const ref = { kind: "canon_observation" as const, canon_event_id: "canon_evt_2" };
    const result = resolveContext(ref, twoObs, EMPTY_VIEW);
    expect(result.status).toBe("found");
    if (result.status !== "found") throw new Error("unreachable");
    expect(result.priorState).toEqual({
      matched_id: "canon_evt_1",
      label: earlier.label,
      observed_at: earlier.observed_at,
      level: -3,
      stability: 4,
    });
    // real arithmetic, not a fabricated significance claim
    expect(result.delta).toEqual({ level: -1 - -3, stability: 5 - 4 });
  });

  it("STATE+TIME: a different subject's Observation is never used as a prior — no fabricated cross-subject state", () => {
    const other = { ...canonWithOne.nodes[0], id: "canon_evt_other", canon_event_id: "canon_evt_other", subject: "person_y", observed_at: "2026-08-14T10:00:00.000Z" };
    const graph: CanonDynamicsGraph = {
      source: "canon",
      nodes: [other, canonWithOne.nodes[0]],
      summary: { node_count: 2, persisted_count: 2, domains: { G: 0, E: 2, C: 0 } },
    };
    const ref = { kind: "canon_observation" as const, canon_event_id: "canon_evt_1" };
    const result = resolveContext(ref, graph, EMPTY_VIEW);
    expect(result.status).toBe("found");
    if (result.status !== "found") throw new Error("unreachable");
    expect(result.priorState).toBeNull();
    expect(result.delta).toBeNull();
  });
});
