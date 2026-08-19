/**
 * HumanUserBase tests. The point of most of these is ABSENCE: the type
 * must make config→state contamination structurally impossible, not merely
 * discouraged.
 */
import { describe, expect, it } from "vitest";
import { buildHumanUserBase } from "../humanUserBase";
import { resolvePersonRef } from "../personRef";
import { buildActivePersonRefs } from "../../canonical/activeConfig";

const person = resolvePersonRef("person_roei");

describe("HumanUserBase — config is never state", () => {
  const base = buildHumanUserBase(person);

  it("has NO field for measure, live state, score, dominant domain, tension or next action", () => {
    for (const forbidden of [
      "measure", "measures", "live_state", "liveState", "state", "score", "scores",
      "dominant_domain", "dominantDomain", "tension", "tensions", "next_action", "nextAction",
      "level", "stability", "current_state",
    ]) {
      expect(base).not.toHaveProperty(forbidden);
    }
  });

  it("carries no level/stability on any entry either", () => {
    for (const e of [...base.dimension, ...base.parameter]) {
      expect(e).not.toHaveProperty("level");
      expect(e).not.toHaveProperty("stability");
      expect(e).not.toHaveProperty("value");
      expect(Object.keys(e).sort()).toEqual(["id", "label", "provenance"]);
    }
  });

  it("a QUESTION is exposed but carries no answer", () => {
    for (const q of base.question) {
      expect(q).not.toHaveProperty("answer");
      expect(q).not.toHaveProperty("value");
      expect(Object.keys(q).sort()).toEqual(["ref", "runtime_status", "section", "text"]);
    }
  });
});

describe("HumanUserBase — sourced, never widened", () => {
  const base = buildHumanUserBase(person);

  it("cannot activate more than activeConfig.ts does", () => {
    const active = buildActivePersonRefs();
    expect(base.dimension.length + base.parameter.length).toBeLessThanOrEqual(active.refs.length);
    const ids = new Set([...base.dimension, ...base.parameter].map((e) => e.id));
    for (const id of ids) expect(active.refs).toContain(id);
  });

  it("reports the real lock provenance", () => {
    expect(base.provenance.source_lock).toContain("HUMAN_CONFIG_MASTER_SOURCE_LOCK");
    expect(base.provenance.total_in_lock).toBe(189);
    expect(base.provenance.active_refs).toBe(19);
  });

  it("maps SCALE to DIMENSION and DYNAMIC_PARAMETER/STATIC_ATTRIBUTE to PARAMETER", () => {
    expect(base.dimension.every((e) => e.provenance.source_type === "SCALE")).toBe(true);
    expect(base.parameter.every((e) => ["DYNAMIC_PARAMETER", "STATIC_ATTRIBUTE"].includes(e.provenance.source_type))).toBe(true);
    expect(base.dimension).toHaveLength(2);
    expect(base.parameter).toHaveLength(17);
  });

  it("states a real reason for every empty structural role — never silently omitted", () => {
    for (const role of ["context", "direction", "capability", "resource", "process", "environment", "relation"] as const) {
      expect(base[role]).toEqual([]);
      expect(base.unresolved.some((u) => u.toUpperCase().startsWith(role.toUpperCase()))).toBe(true);
    }
  });

  it("never fabricates a confidence — the lock has no such field", () => {
    expect(base.confidence.entries_with_confidence).toBe(0);
    expect(base.confidence.entries_without).toBe(19);
    for (const e of [...base.dimension, ...base.parameter]) expect(e.provenance.confidence).toBeNull();
  });
});

describe("HumanUserBase — domain-agnostic", () => {
  it("mentions no domain anywhere in its output", () => {
    const s = JSON.stringify(buildHumanUserBase(person));
    for (const w of ["music", "MUSIC", "music_canon", "business", "health"]) {
      expect(s.includes(w)).toBe(false);
    }
  });

  it("is pure — same person in, identical structure out", () => {
    expect(JSON.stringify(buildHumanUserBase(person))).toBe(JSON.stringify(buildHumanUserBase(person)));
  });
});
