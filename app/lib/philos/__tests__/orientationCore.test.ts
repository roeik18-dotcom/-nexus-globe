import { describe, expect, it } from "vitest";
import { ALL_CELL_KEYS, buildMeasuredStateSpace, resolveDefaultSubject, resolveMostRecentObservedSubject } from "../orientationCore";
import { REAL_CURRENT_SUBJECT } from "../subjectRegistry";
import type { CanonDynamicsGraph, CanonObservationMark } from "../canon/projectCanonDynamics";

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

function graph(nodes: CanonObservationMark[]): CanonDynamicsGraph {
  return { source: "canon", nodes, summary: { node_count: nodes.length, persisted_count: nodes.length, domains: { G: 0, E: 0, C: 0 } } };
}

describe("resolveDefaultSubject — ledger §33: always the one designated REAL subject, never inferred from canon content", () => {
  it("empty canon -> still REAL_CURRENT_SUBJECT, not undefined", () => {
    expect(resolveDefaultSubject(graph([]))).toBe(REAL_CURRENT_SUBJECT);
  });

  it("canon full of OTHER subjects' Observations -> still REAL_CURRENT_SUBJECT, never a TEST/PLACEHOLDER fallback", () => {
    const g = graph([
      mark({ canon_event_id: "a", subject: "person_e2e", observed_at: "2026-08-15T09:00:00.000Z" }),
      mark({ canon_event_id: "b", subject: "person_qa_natural_philos_PLACEHOLDER", observed_at: "2026-08-15T11:00:00.000Z" }),
    ]);
    expect(resolveDefaultSubject(g)).toBe(REAL_CURRENT_SUBJECT);
  });
});

describe("resolveMostRecentObservedSubject — the old unfiltered logic, kept for diagnostics only", () => {
  it("empty canon -> undefined, never a guessed subject", () => {
    expect(resolveMostRecentObservedSubject(graph([]))).toBeUndefined();
  });

  it("real most-recent Observation's subject, chronological only, unfiltered by classification", () => {
    const g = graph([
      mark({ canon_event_id: "a", subject: "person_a", observed_at: "2026-08-15T09:00:00.000Z" }),
      mark({ canon_event_id: "b", subject: "person_b", observed_at: "2026-08-15T11:00:00.000Z" }),
    ]);
    expect(resolveMostRecentObservedSubject(g)).toBe("person_b");
  });
});

describe("buildMeasuredStateSpace — Domain rollup (not a cell, not a person model)", () => {
  it("a subject with one Observation per domain gets all three populated", () => {
    const g = graph([
      mark({ canon_event_id: "g1", subject: "person_a", domain: "G", observed_at: "2026-08-15T09:00:00.000Z" }),
      mark({ canon_event_id: "e1", subject: "person_a", domain: "E", observed_at: "2026-08-15T09:00:00.000Z" }),
      mark({ canon_event_id: "c1", subject: "person_a", domain: "C", observed_at: "2026-08-15T09:00:00.000Z" }),
    ]);
    const core = buildMeasuredStateSpace(g, "person_a");
    expect(core.G?.canon_event_id).toBe("g1");
    expect(core.E?.canon_event_id).toBe("e1");
    expect(core.C?.canon_event_id).toBe("c1");
  });

  it("a domain with zero real Observations for this subject stays undefined — UNKNOWN, not defaulted", () => {
    const g = graph([mark({ canon_event_id: "e1", subject: "person_a", domain: "E" })]);
    const core = buildMeasuredStateSpace(g, "person_a");
    expect(core.G).toBeUndefined();
    expect(core.C).toBeUndefined();
    expect(core.E?.canon_event_id).toBe("e1");
  });

  it("only the MOST RECENT Observation per domain is kept, never merged/averaged", () => {
    const g = graph([
      mark({ canon_event_id: "e_old", subject: "person_a", domain: "E", observed_at: "2026-08-15T08:00:00.000Z", level: -2 }),
      mark({ canon_event_id: "e_new", subject: "person_a", domain: "E", observed_at: "2026-08-15T12:00:00.000Z", level: 1 }),
    ]);
    const core = buildMeasuredStateSpace(g, "person_a");
    expect(core.E?.canon_event_id).toBe("e_new");
    expect(core.E?.level).toBe(1);
  });

  it("Observations for a DIFFERENT subject are never mixed in", () => {
    const g = graph([
      mark({ canon_event_id: "e1", subject: "person_a", domain: "E" }),
      mark({ canon_event_id: "e2", subject: "person_b", domain: "E" }),
    ]);
    const core = buildMeasuredStateSpace(g, "person_a");
    expect(core.E?.canon_event_id).toBe("e1");
  });

  it("TIME: a second real Observation for the same domain surfaces the real prior, chronological only", () => {
    const g = graph([
      mark({ canon_event_id: "e_old", subject: "person_a", domain: "E", observed_at: "2026-08-15T08:00:00.000Z", level: -2 }),
      mark({ canon_event_id: "e_new", subject: "person_a", domain: "E", observed_at: "2026-08-15T12:00:00.000Z", level: 1 }),
    ]);
    const core = buildMeasuredStateSpace(g, "person_a");
    expect(core.E?.canon_event_id).toBe("e_new");
    expect(core.priorE?.canon_event_id).toBe("e_old");
    expect(core.priorE?.level).toBe(-2);
  });

  it("only ONE real Observation for a domain -> priorE undefined, never fabricated", () => {
    const g = graph([mark({ canon_event_id: "e1", subject: "person_a", domain: "E" })]);
    const core = buildMeasuredStateSpace(g, "person_a");
    expect(core.priorE).toBeUndefined();
    expect(core.priorG).toBeUndefined();
    expect(core.priorC).toBeUndefined();
  });
});

describe("buildMeasuredStateSpace — the nine measured cells (PHILOS-PERSON-CONTRACT.md §4)", () => {
  it("returns exactly 9 cells, keyed Domain/Frame — no fourth Domain, no fifth Frame", () => {
    const space = buildMeasuredStateSpace(graph([]), "person_a");
    const keys = Object.keys(space.cells).sort();
    expect(keys).toHaveLength(9);
    expect(keys).toEqual([...ALL_CELL_KEYS].sort());
    expect(keys).toEqual(["C/I", "C/R", "C/S", "E/I", "E/R", "E/S", "G/I", "G/R", "G/S"]);
  });

  it("empty canon -> 9 UNKNOWN cells, observed_count 0, nothing defaulted", () => {
    const space = buildMeasuredStateSpace(graph([]), "person_a");
    expect(space.observed_count).toBe(0);
    for (const key of ALL_CELL_KEYS) {
      expect(space.cells[key].status).toBe("UNKNOWN");
      expect(space.cells[key].level).toBeUndefined();
      expect(space.cells[key].stability).toBeUndefined();
    }
  });

  it("CURRENT REAL STORE SHAPE: one E/I Observation at level -1, stability 0 -> 1 OBSERVED / 8 UNKNOWN", () => {
    const g = graph([
      mark({ canon_event_id: "c47fbabb-6e38", subject: "person_roei", domain: "E", frame: "I", level: -1, stability: 0 }),
    ]);
    const space = buildMeasuredStateSpace(g, "person_roei");
    expect(space.observed_count).toBe(1);
    expect(space.cells["E/I"].status).toBe("OBSERVED");
    expect(space.cells["E/I"].level).toBe(-1);
    expect(space.cells["E/I"].stability).toBe(0);
    const unknown = ALL_CELL_KEYS.filter((k) => space.cells[k].status === "UNKNOWN");
    expect(unknown).toHaveLength(8);
    expect(unknown).not.toContain("E/I");
  });

  it("FRAME IS PRESERVED: same Domain, different Frame -> two distinct cells, never collapsed", () => {
    const g = graph([
      mark({ canon_event_id: "ei", subject: "person_a", domain: "E", frame: "I", level: -1 }),
      mark({ canon_event_id: "er", subject: "person_a", domain: "E", frame: "R", level: 2 }),
    ]);
    const space = buildMeasuredStateSpace(g, "person_a");
    expect(space.observed_count).toBe(2);
    expect(space.cells["E/I"].canon_event_id).toBe("ei");
    expect(space.cells["E/I"].level).toBe(-1);
    expect(space.cells["E/R"].canon_event_id).toBe("er");
    expect(space.cells["E/R"].level).toBe(2);
    expect(space.cells["E/S"].status).toBe("UNKNOWN");
  });

  it("most recent per (Domain, Frame) wins — chronological selection, never merged or averaged", () => {
    const g = graph([
      mark({ canon_event_id: "old", subject: "person_a", domain: "C", frame: "S", observed_at: "2026-08-15T08:00:00.000Z", level: -4 }),
      mark({ canon_event_id: "new", subject: "person_a", domain: "C", frame: "S", observed_at: "2026-08-15T12:00:00.000Z", level: 1 }),
    ]);
    const space = buildMeasuredStateSpace(g, "person_a");
    expect(space.observed_count).toBe(1);
    expect(space.cells["C/S"].canon_event_id).toBe("new");
    expect(space.cells["C/S"].level).toBe(1);
  });

  it("every canon field required by the contract is carried verbatim onto an OBSERVED cell", () => {
    const g = graph([
      mark({
        canon_event_id: "full", subject: "person_a", domain: "G", frame: "R",
        level: -2, stability: 3, deficitType: "OBJECTIVE", provenance: "third_party",
        confidence: 0.75, observed_at: "2026-08-16T07:00:00.000Z", reference: "norm:team_baseline",
      }),
    ]);
    const cell = buildMeasuredStateSpace(g, "person_a").cells["G/R"];
    expect(cell).toMatchObject({
      key: "G/R", domain: "G", frame: "R", status: "OBSERVED",
      level: -2, stability: 3, deficit_type: "OBJECTIVE", provenance: "third_party",
      confidence: 0.75, observed_at: "2026-08-16T07:00:00.000Z",
      canon_event_id: "full", reference: "norm:team_baseline",
    });
  });

  it("NO COMPOSITE: no sum, average, total, dominant domain, person score, or 6-class field exists", () => {
    const g = graph([
      mark({ canon_event_id: "a", subject: "person_a", domain: "E", frame: "I", level: -1 }),
      mark({ canon_event_id: "b", subject: "person_a", domain: "G", frame: "S", level: -3 }),
    ]);
    const space = buildMeasuredStateSpace(g, "person_a");
    const forbidden = [
      "sum", "total", "average", "avg", "mean", "score", "person_score", "rank",
      "dominant", "dominant_domain", "dominantDomain", "level", "overall", "aggregate",
      "internal", "external", "six_class", "sixClass", "dimension",
    ];
    const topLevel = Object.keys(space);
    for (const key of forbidden) expect(topLevel).not.toContain(key);
    for (const cellKey of ALL_CELL_KEYS) {
      const cellKeys = Object.keys(space.cells[cellKey]);
      for (const key of ["sum", "total", "average", "score", "dominant", "internal", "external", "six_class"]) {
        expect(cellKeys).not.toContain(key);
      }
    }
    // observed_count is a COUNT OF RECORDS, not a measure of the person.
    expect(space.observed_count).toBe(2);
  });

  it("NO CROSS-FRAME AGGREGATION (canon §21): three frames of one Domain stay three cells", () => {
    const g = graph([
      mark({ canon_event_id: "i", subject: "person_a", domain: "E", frame: "I", level: -1 }),
      mark({ canon_event_id: "r", subject: "person_a", domain: "E", frame: "R", level: -2 }),
      mark({ canon_event_id: "s", subject: "person_a", domain: "E", frame: "S", level: -3 }),
    ]);
    const space = buildMeasuredStateSpace(g, "person_a");
    expect(space.observed_count).toBe(3);
    expect([space.cells["E/I"].level, space.cells["E/R"].level, space.cells["E/S"].level]).toEqual([-1, -2, -3]);
  });

  it("BACKWARD COMPATIBILITY: previous Domain-only consumers still read the rollup unchanged", () => {
    const g = graph([
      mark({ canon_event_id: "e_old", subject: "person_a", domain: "E", frame: "R", observed_at: "2026-08-15T08:00:00.000Z", level: -2 }),
      mark({ canon_event_id: "e_new", subject: "person_a", domain: "E", frame: "I", observed_at: "2026-08-15T12:00:00.000Z", level: 1 }),
    ]);
    const space = buildMeasuredStateSpace(g, "person_a");
    // rollup ignores Frame, exactly as before
    expect(space.E?.canon_event_id).toBe("e_new");
    expect(space.priorE?.canon_event_id).toBe("e_old");
    expect(space.G).toBeUndefined();
    // ...while the cells keep them apart
    expect(space.cells["E/I"].canon_event_id).toBe("e_new");
    expect(space.cells["E/R"].canon_event_id).toBe("e_old");
  });
});
