import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { computeCoverageMetrics } from "../computeCoverageMetrics";
import type { Mission } from "../../lib/mission/schema";
import type { Gap } from "../../lib/gap/schema";
import type { ValueCapabilityRelation } from "../../lib/value-capability-relation/schema";
import type { ProviderCapabilityRelation } from "../../lib/provider-capability-relation/schema";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(__dirname, "../../../data");

function loadJson<T>(file: string): T[] {
  return JSON.parse(readFileSync(resolve(dataDir, file), "utf-8"));
}

const missions     = loadJson<Mission>("missions.json");
const gaps         = loadJson<Gap>("gaps.json");
const vcRelations  = loadJson<ValueCapabilityRelation>("value-capability-relations.json");
const pcRelations  = loadJson<ProviderCapabilityRelation>("provider-capability-relations.json");

const gapById = new Map(gaps.map(g => [g.id, g]));

// ── Null / empty guards ───────────────────────────────────────────────────────

describe("computeCoverageMetrics — null/empty guards", () => {
  it("returns empty metrics for null mission", () => {
    const m = computeCoverageMetrics(null, gapById, vcRelations, pcRelations);
    expect(m.coveragePct).toBe(0);
    expect(m.graphIntegrityPct).toBe(0);
    expect(m.missionHealthPct).toBe(0);
    expect(m.activeCapIds.size).toBe(0);
    expect(m.activeProvIds.size).toBe(0);
    expect(m.missionStage).toBe("Initialization");
  });

  it("returns empty metrics for undefined mission", () => {
    const m = computeCoverageMetrics(undefined, gapById, vcRelations, pcRelations);
    expect(m.coveragePct).toBe(0);
    expect(m.activeCapIds.size).toBe(0);
  });

  it("returns zero metrics for empty vcRelations", () => {
    const mission = missions[0];
    const m = computeCoverageMetrics(mission, gapById, [], pcRelations);
    expect(m.contextualVcrs).toHaveLength(0);
    expect(m.activeCapIds.size).toBe(0);
    expect(m.graphIntegrityPct).toBe(0);
    expect(m.missionHealthPct).toBe(0);
  });
});

// ── Formula parity — all seed missions ───────────────────────────────────────

describe("computeCoverageMetrics — formula parity", () => {
  it("missionHealthPct formula matches coefficients exactly for all missions", () => {
    for (const mission of missions) {
      const m = computeCoverageMetrics(mission, gapById, vcRelations, pcRelations, "contextual");
      const expected = Math.round(
        m.graphIntegrityPct * 0.55
        + (m.validationPass ? 40 : 0)
        + (m.activeProvIds.size > 0 ? 5 : 0)
      );
      expect(m.missionHealthPct).toBe(expected);
    }
  });

  it("coveragePct is in [0, 100] for all missions", () => {
    for (const mission of missions) {
      const m = computeCoverageMetrics(mission, gapById, vcRelations, pcRelations);
      expect(m.coveragePct).toBeGreaterThanOrEqual(0);
      expect(m.coveragePct).toBeLessThanOrEqual(100);
    }
  });

  it("graphIntegrityPct is in [0, 100] for all missions", () => {
    for (const mission of missions) {
      const m = computeCoverageMetrics(mission, gapById, vcRelations, pcRelations);
      expect(m.graphIntegrityPct).toBeGreaterThanOrEqual(0);
      expect(m.graphIntegrityPct).toBeLessThanOrEqual(100);
    }
  });

  it("evidenceCount is 0 for all missions (all signals are Intent in seed data)", () => {
    for (const mission of missions) {
      const m = computeCoverageMetrics(mission, gapById, vcRelations, pcRelations);
      expect(m.evidenceCount).toBe(0);
    }
  });

  it("coveredCapCount + uncoveredCapCount === activeCapIds.size", () => {
    for (const mission of missions) {
      const m = computeCoverageMetrics(mission, gapById, vcRelations, pcRelations);
      expect(m.coveredCapCount + m.uncoveredCapCount).toBe(m.activeCapIds.size);
    }
  });

  it("validationPass is true only when graphIntegrityPct === 100 and contextualVcrs exist", () => {
    for (const mission of missions) {
      const m = computeCoverageMetrics(mission, gapById, vcRelations, pcRelations);
      const expectedPass = m.graphIntegrityPct === 100 && m.contextualVcrs.length > 0;
      expect(m.validationPass).toBe(expectedPass);
    }
  });

  it("missionStage is Initialization when no contextualVcrs exist", () => {
    const mission = missions[0];
    const m = computeCoverageMetrics(mission, gapById, [], pcRelations);
    expect(m.missionStage).toBe("Initialization");
  });

  it("missionStage is Contextual Qualification when contextualVcrs exist", () => {
    for (const mission of missions) {
      const m = computeCoverageMetrics(mission, gapById, vcRelations, pcRelations);
      if (m.contextualVcrs.length > 0) {
        expect(m.missionStage).toBe("Contextual Qualification");
      }
    }
  });
});

// ── Coverage Delta Explorer — sandbox VCR toggle ─────────────────────────────

describe("computeCoverageMetrics — sandbox VCR toggle (Coverage Delta Explorer)", () => {
  it("does not mutate input vcRelations when building patch", () => {
    const mission = missions[0];
    const originalLength = vcRelations.length;
    const patchedVcrs = [...vcRelations, {
      id: "__synthetic__",
      type: "ValueCapabilityRelation" as const,
      valueId: "knowledge",
      capabilityId: "cap_test_only",
      missionId: mission.id,
      gapId: "gap_test_only",
      relationType: "required_for" as const,
      status: "candidate" as const,
      evidenceGrade: "Candidate" as const,
      createdAt: "",
      updatedAt: "",
      evidence: [],
    }];
    computeCoverageMetrics(mission, gapById, patchedVcrs, pcRelations);
    expect(vcRelations).toHaveLength(originalLength);
  });

  it("removing an existing required_for VCR never increases graphIntegrityPct", () => {
    for (const mission of missions) {
      const before = computeCoverageMetrics(mission, gapById, vcRelations, pcRelations);
      if (before.contextualVcrs.length === 0) continue;
      const removedId = before.contextualVcrs[0].id;
      const patchedVcrs = vcRelations.filter(r => r.id !== removedId);
      const after = computeCoverageMetrics(mission, gapById, patchedVcrs, pcRelations);
      expect(after.graphIntegrityPct).toBeLessThanOrEqual(before.graphIntegrityPct);
    }
  });

  it("delta before/after is deterministic: same patch always yields same result", () => {
    const mission = missions[0];
    const before = computeCoverageMetrics(mission, gapById, vcRelations, pcRelations);
    if (before.contextualVcrs.length === 0) return;
    const removedId = before.contextualVcrs[0].id;
    const patchedVcrs = vcRelations.filter(r => r.id !== removedId);
    const after1 = computeCoverageMetrics(mission, gapById, patchedVcrs, pcRelations);
    const after2 = computeCoverageMetrics(mission, gapById, patchedVcrs, pcRelations);
    expect(after1.coveragePct).toBe(after2.coveragePct);
    expect(after1.graphIntegrityPct).toBe(after2.graphIntegrityPct);
    expect(after1.missionHealthPct).toBe(after2.missionHealthPct);
  });
});
