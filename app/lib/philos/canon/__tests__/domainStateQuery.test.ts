import { describe, expect, it } from "vitest";
import { findLatestDomainState, buildDomainStateTimeline, domainStateParametersForSubject, buildDomainStateProjectionRows, resolveValueDomainParam } from "../domainStateQuery";
import type { DomainStateRecord } from "../domainStateStore";
import type { DomainState } from "../../valueDomain/valueDomainConfig";

function state(overrides: Partial<DomainState> = {}): DomainState {
  return {
    domain_id: "human_temperament", parameter_id: "temperament_pace", subject: "person_roei",
    level: 0.3, confidence: 0.8, observed_at: "2026-08-16T10:00:00Z", provenance: "REAL",
    ...overrides,
  };
}
function rec(state_id: string, s: Partial<DomainState>): DomainStateRecord {
  return { state_id, state: state(s), recorded_at: state(s).observed_at };
}

describe("findLatestDomainState — real, chronological, never fabricated", () => {
  it("returns null when genuinely nothing exists for this exact triple", () => {
    expect(findLatestDomainState([], "person_roei", "human_temperament", "temperament_pace")).toBeNull();
  });

  it("returns the single real reading when only one exists", () => {
    const records = [rec("d1", { observed_at: "2026-08-16T10:00:00Z", level: 0.3 })];
    const result = findLatestDomainState(records, "person_roei", "human_temperament", "temperament_pace");
    expect(result?.level).toBe(0.3);
  });

  it("returns the MOST RECENT of multiple real readings", () => {
    const records = [
      rec("d1", { observed_at: "2026-08-16T10:00:00Z", level: 0.3 }),
      rec("d2", { observed_at: "2026-08-18T10:00:00Z", level: 0.7 }),
      rec("d3", { observed_at: "2026-08-17T10:00:00Z", level: 0.5 }),
    ];
    const result = findLatestDomainState(records, "person_roei", "human_temperament", "temperament_pace");
    expect(result?.level).toBe(0.7);
  });

  it("respects `before` — never returns a reading at or after the given time when strictly-prior is asked for", () => {
    const records = [
      rec("d1", { observed_at: "2026-08-16T10:00:00Z", level: 0.3 }),
      rec("d2", { observed_at: "2026-08-18T10:00:00Z", level: 0.7 }),
    ];
    const result = findLatestDomainState(records, "person_roei", "human_temperament", "temperament_pace", "2026-08-17T00:00:00Z");
    expect(result?.level).toBe(0.3);
  });

  it("never returns a different subject's or different parameter's state, even if more recent", () => {
    const records = [
      rec("d1", { observed_at: "2026-08-16T10:00:00Z", level: 0.3, subject: "person_roei" }),
      rec("d2", { observed_at: "2026-08-19T10:00:00Z", level: 0.9, subject: "someone_else" }),
      rec("d3", { observed_at: "2026-08-19T10:00:00Z", level: 0.9, parameter_id: "other_param" }),
    ];
    const result = findLatestDomainState(records, "person_roei", "human_temperament", "temperament_pace");
    expect(result?.level).toBe(0.3);
  });
});

describe("buildDomainStateTimeline — real history, computed deltas, never invented", () => {
  it("returns an empty timeline for a parameter with 0 real readings", () => {
    expect(buildDomainStateTimeline([], "person_roei", "human_temperament", "temperament_pace")).toEqual([]);
  });

  it("the first real point has delta_from_prior === null, never a fabricated zero", () => {
    const records = [rec("d1", { observed_at: "2026-08-16T10:00:00Z", level: 0.3 })];
    const timeline = buildDomainStateTimeline(records, "person_roei", "human_temperament", "temperament_pace");
    expect(timeline).toHaveLength(1);
    expect(timeline[0].delta_from_prior).toBeNull();
  });

  it("computes real deltas between consecutive real readings, in chronological order", () => {
    const records = [
      rec("d1", { observed_at: "2026-08-16T10:00:00Z", level: 0.3 }),
      rec("d2", { observed_at: "2026-08-17T10:00:00Z", level: 0.5 }),
    ];
    const timeline = buildDomainStateTimeline(records, "person_roei", "human_temperament", "temperament_pace");
    expect(timeline[1].delta_from_prior).toBeCloseTo(0.2);
  });
});

describe("domainStateParametersForSubject — only real, ever-observed parameters, never the full catalog", () => {
  it("returns 0 for a subject with no real readings", () => {
    expect(domainStateParametersForSubject([], "person_roei")).toEqual([]);
  });

  it("returns each distinct real (domain_id, parameter_id) exactly once", () => {
    const records = [
      rec("d1", { domain_id: "human_temperament", parameter_id: "temperament_pace" }),
      rec("d2", { domain_id: "human_temperament", parameter_id: "temperament_pace" }),
      rec("d3", { domain_id: "music", parameter_id: "harmony_practice" }),
    ];
    const result = domainStateParametersForSubject(records, "person_roei");
    expect(result).toHaveLength(2);
  });
});

// ── Dynamics P0 wiring — buildDomainStateProjectionRows / resolveValueDomainParam ──
// The exact 6 isolated-fixture scenarios this task's own acceptance section
// requires, proven at the pure-function level (the level everything in this
// codebase's test suite is actually verified at — see every other *Core/
// derive* test in this directory).

describe("buildDomainStateProjectionRows — what Dynamics sees, real and generic across Human/Value domains", () => {
  it("SCENARIO 1 — one Human DomainState → Dynamics sees BASELINE (no delta)", () => {
    const records = [rec("d1", { domain_id: "human_temperament", parameter_id: "temperament_pace", subject: "person_roei", level: 0.3, observed_at: "2026-08-16T10:00:00Z" })];
    const rows = buildDomainStateProjectionRows(records, "person_roei");
    expect(rows).toHaveLength(1);
    expect(rows[0].domain_id).toBe("human_temperament");
    expect(rows[0].timeline).toHaveLength(1);
    expect(rows[0].timeline[0].level).toBe(0.3);
    expect(rows[0].timeline[0].delta_from_prior).toBeNull(); // honest — no fabricated movement
  });

  it("SCENARIO 2 — second Human DomainState, same parameter → Dynamics sees a real delta", () => {
    const records = [
      rec("d1", { domain_id: "human_temperament", parameter_id: "temperament_pace", subject: "person_roei", level: 0.3, observed_at: "2026-08-16T10:00:00Z" }),
      rec("d2", { domain_id: "human_temperament", parameter_id: "temperament_pace", subject: "person_roei", level: 0.6, observed_at: "2026-08-17T10:00:00Z" }),
    ];
    const rows = buildDomainStateProjectionRows(records, "person_roei");
    expect(rows).toHaveLength(1);
    expect(rows[0].timeline).toHaveLength(2);
    const latest = rows[0].timeline[1];
    expect(latest.level).toBe(0.6);
    expect(latest.delta_from_prior).toBeCloseTo(0.3);
  });

  it("SCENARIO 3 — one Value DomainState → Dynamics sees BASELINE, same query path as Human, no special-casing", () => {
    const records = [rec("d1", { domain_id: "music", parameter_id: "harmony_practice", subject: "person_roei", level: 2, observed_at: "2026-08-16T10:00:00Z" })];
    const rows = buildDomainStateProjectionRows(records, "person_roei");
    expect(rows).toHaveLength(1);
    expect(rows[0].domain_id).toBe("music");
    expect(rows[0].timeline).toHaveLength(1);
    expect(rows[0].timeline[0].delta_from_prior).toBeNull();
  });

  it("SCENARIO 4 — second Value DomainState, same parameter → Dynamics sees a real delta", () => {
    const records = [
      rec("d1", { domain_id: "music", parameter_id: "harmony_practice", subject: "person_roei", level: 2, observed_at: "2026-08-16T10:00:00Z" }),
      rec("d2", { domain_id: "music", parameter_id: "harmony_practice", subject: "person_roei", level: 5, observed_at: "2026-08-18T10:00:00Z" }),
    ];
    const rows = buildDomainStateProjectionRows(records, "person_roei");
    expect(rows[0].timeline).toHaveLength(2);
    expect(rows[0].timeline[1].delta_from_prior).toBeCloseTo(3);
  });

  it("SCENARIO 5 — wrong subject is excluded entirely", () => {
    const records = [
      rec("d1", { domain_id: "human_temperament", parameter_id: "temperament_pace", subject: "person_roei", observed_at: "2026-08-16T10:00:00Z" }),
      rec("d2", { domain_id: "human_temperament", parameter_id: "temperament_pace", subject: "someone_else", observed_at: "2026-08-17T10:00:00Z" }),
    ];
    const rows = buildDomainStateProjectionRows(records, "person_roei");
    expect(rows).toHaveLength(1);
    expect(rows[0].timeline).toHaveLength(1); // the other subject's reading never leaks in as a second point
  });

  it("SCENARIO 6 — wrong parameter produces a SEPARATE timeline, never merged into another parameter's history", () => {
    const records = [
      rec("d1", { domain_id: "human_temperament", parameter_id: "temperament_pace", subject: "person_roei", level: 0.3, observed_at: "2026-08-16T10:00:00Z" }),
      rec("d2", { domain_id: "human_temperament", parameter_id: "temperament_activity_level", subject: "person_roei", level: 0.9, observed_at: "2026-08-17T10:00:00Z" }),
    ];
    const rows = buildDomainStateProjectionRows(records, "person_roei");
    expect(rows).toHaveLength(2);
    const pace = rows.find((r) => r.parameter_id === "temperament_pace")!;
    const activity = rows.find((r) => r.parameter_id === "temperament_activity_level")!;
    expect(pace.timeline).toHaveLength(1);
    expect(activity.timeline).toHaveLength(1);
    expect(pace.timeline[0].level).toBe(0.3);
    expect(activity.timeline[0].level).toBe(0.9);
  });

  it("returns [] for a subject with 0 real DomainState — honest empty, never fabricated", () => {
    expect(buildDomainStateProjectionRows([], "person_roei")).toEqual([]);
  });
});

describe("resolveValueDomainParam — the ONE shared buildCarryForward resolver (Hub and Dynamics both call this)", () => {
  it("returns undefined for a subject with 0 real DomainState — carryForward stays unknown_blocked, never fabricated", () => {
    expect(resolveValueDomainParam("person_roei", [])).toBeUndefined();
  });

  it("builds a real config from the subject's own records only, excluding other subjects", () => {
    const records = [
      rec("d1", { domain_id: "human_temperament", parameter_id: "temperament_pace", subject: "person_roei", level: 0.4, observed_at: "2026-08-16T10:00:00Z" }),
      rec("d2", { domain_id: "human_temperament", parameter_id: "temperament_pace", subject: "someone_else", level: 0.9, observed_at: "2026-08-19T10:00:00Z" }),
    ];
    const result = resolveValueDomainParam("person_roei", records);
    expect(result?.config.states).toHaveLength(1);
    expect(result?.config.states[0].level).toBe(0.4);
  });

  it("when the subject has state in more than one domain, the MOST RECENTLY OBSERVED domain wins", () => {
    const records = [
      rec("d1", { domain_id: "human_temperament", parameter_id: "temperament_pace", subject: "person_roei", level: 0.3, observed_at: "2026-08-16T10:00:00Z" }),
      rec("d2", { domain_id: "music", parameter_id: "harmony_practice", subject: "person_roei", level: 2, observed_at: "2026-08-19T10:00:00Z" }),
    ];
    const result = resolveValueDomainParam("person_roei", records);
    expect(result?.config.domain.domain_id).toBe("music");
    expect(result?.config.states).toHaveLength(1);
  });
});
