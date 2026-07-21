import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { computeExplainPaths } from "../computeExplainPaths";
import type { Mission } from "../../lib/mission/schema";
import type { Gap } from "../../lib/gap/schema";
import type { Value } from "../../lib/value/schema";
import type { Capability } from "../../lib/capability/schema";
import type { Provider } from "../../lib/provider/schema";
import type { ValueCapabilityRelation } from "../../lib/value-capability-relation/schema";
import type { ProviderCapabilityRelation } from "../../lib/provider-capability-relation/schema";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(__dirname, "../../../data");

function loadJson<T>(file: string): T[] {
  return JSON.parse(readFileSync(resolve(dataDir, file), "utf-8"));
}

const missions     = loadJson<Mission>("missions.json");
const gaps         = loadJson<Gap>("gaps.json");
const values       = loadJson<Value>("values.json");
const capabilities = loadJson<Capability>("capabilities.json");
const providers    = loadJson<Provider>("providers.json");
const vcRelations  = loadJson<ValueCapabilityRelation>("value-capability-relations.json");
const pcRelations  = loadJson<ProviderCapabilityRelation>("provider-capability-relations.json");

describe("computeExplainPaths — seed data", () => {
  it("empty inputs return empty array", () => {
    const result = computeExplainPaths(missions[0], "any", "provider", [], [], [], [], [], []);
    expect(result).toHaveLength(0);
  });

  it("unknown targetId returns empty array", () => {
    const result = computeExplainPaths(missions[0], "no-such-id", "provider", gaps, values, capabilities, providers, vcRelations, pcRelations);
    expect(result).toHaveLength(0);
  });

  it("capability target: paths have 3 steps with correct kinds", () => {
    const mission = missions[0];
    const gapById = new Map(gaps.map(g => [g.id, g]));
    let targetCapId = "";
    outer:
    for (const gapRef of mission.gaps) {
      const gap = gapById.get(gapRef.gapId);
      if (!gap) continue;
      for (const valRef of gap.requiredValues) {
        const vcr = vcRelations.find(r => r.valueId === valRef.valueId);
        if (vcr) { targetCapId = vcr.capabilityId; break outer; }
      }
    }
    if (!targetCapId) return;

    const paths = computeExplainPaths(mission, targetCapId, "capability", gaps, values, capabilities, providers, vcRelations, pcRelations);
    expect(paths.length).toBeGreaterThan(0);
    for (const path of paths) {
      expect(path).toHaveLength(3);
      expect(path[0].kind).toBe("mission_gap");
      expect(path[1].kind).toBe("gap_value");
      expect(path[2].kind).toBe("value_capability");
      if (path[2].kind === "value_capability") {
        expect(path[2].capability.id).toBe(targetCapId);
      }
    }
  });

  it("provider target: paths have 4 steps with correct kinds", () => {
    const mission = missions[0];
    const gapById = new Map(gaps.map(g => [g.id, g]));
    let targetProvId = "";
    outer:
    for (const gapRef of mission.gaps) {
      const gap = gapById.get(gapRef.gapId);
      if (!gap) continue;
      for (const valRef of gap.requiredValues) {
        const vcr = vcRelations.find(r => r.valueId === valRef.valueId);
        if (!vcr) continue;
        const pcr = pcRelations.find(r => r.capabilityId === vcr.capabilityId);
        if (pcr) { targetProvId = pcr.providerId; break outer; }
      }
    }
    if (!targetProvId) return;

    const paths = computeExplainPaths(mission, targetProvId, "provider", gaps, values, capabilities, providers, vcRelations, pcRelations);
    expect(paths.length).toBeGreaterThan(0);
    for (const path of paths) {
      expect(path).toHaveLength(4);
      expect(path[0].kind).toBe("mission_gap");
      expect(path[1].kind).toBe("gap_value");
      expect(path[2].kind).toBe("value_capability");
      expect(path[3].kind).toBe("capability_provider");
      if (path[3].kind === "capability_provider") {
        expect(path[3].provider.id).toBe(targetProvId);
      }
    }
  });

  it("all returned paths end at the specified target", () => {
    const mission = missions[0];
    const gapById = new Map(gaps.map(g => [g.id, g]));
    let targetProvId = "";
    outer:
    for (const gapRef of mission.gaps) {
      const gap = gapById.get(gapRef.gapId);
      if (!gap) continue;
      for (const valRef of gap.requiredValues) {
        const vcr = vcRelations.find(r => r.valueId === valRef.valueId);
        if (!vcr) continue;
        const pcr = pcRelations.find(r => r.capabilityId === vcr.capabilityId);
        if (pcr) { targetProvId = pcr.providerId; break outer; }
      }
    }
    if (!targetProvId) return;

    const paths = computeExplainPaths(mission, targetProvId, "provider", gaps, values, capabilities, providers, vcRelations, pcRelations);
    for (const path of paths) {
      const last = path[path.length - 1];
      if (last.kind === "capability_provider") {
        expect(last.provider.id).toBe(targetProvId);
      }
    }
  });

  it("multi-path: at least one mission-provider pair yields >1 path", () => {
    let maxPaths = 0;
    for (const mission of missions) {
      for (const provider of providers) {
        const paths = computeExplainPaths(mission, provider.id, "provider", gaps, values, capabilities, providers, vcRelations, pcRelations);
        if (paths.length > maxPaths) maxPaths = paths.length;
      }
    }
    expect(maxPaths).toBeGreaterThan(1);
  });

  it("determinism: repeated calls return identical paths in the same order", () => {
    // Find a (mission, provider) pair with at least 1 path
    const gapById = new Map(gaps.map(g => [g.id, g]));
    let testMission = missions[0];
    let testProvId  = "";
    outer:
    for (const m of missions) {
      for (const gapRef of m.gaps) {
        const gap = gapById.get(gapRef.gapId);
        if (!gap) continue;
        for (const valRef of gap.requiredValues) {
          for (const vcr of vcRelations) {
            if (vcr.valueId !== valRef.valueId) continue;
            for (const pcr of pcRelations) {
              if (pcr.capabilityId !== vcr.capabilityId) continue;
              testMission = m;
              testProvId  = pcr.providerId;
              break outer;
            }
          }
        }
      }
    }
    expect(testProvId).toBeTruthy();

    const paths1 = computeExplainPaths(testMission, testProvId, "provider", gaps, values, capabilities, providers, vcRelations, pcRelations);
    const paths2 = computeExplainPaths(testMission, testProvId, "provider", gaps, values, capabilities, providers, vcRelations, pcRelations);

    expect(paths1.length).toBeGreaterThan(0);
    expect(paths2.length).toBe(paths1.length);
    for (let i = 0; i < paths1.length; i++) {
      expect(paths2[i].length).toBe(paths1[i].length);
      for (let j = 0; j < paths1[i].length; j++) {
        expect(paths2[i][j].kind).toBe(paths1[i][j].kind);
      }
      const s1vc = paths1[i][2]; const s2vc = paths2[i][2];
      if (s1vc.kind === "value_capability" && s2vc.kind === "value_capability") {
        expect(s2vc.vcr.id).toBe(s1vc.vcr.id);
      }
      const s1cp = paths1[i][3]; const s2cp = paths2[i][3];
      if (s1cp.kind === "capability_provider" && s2cp.kind === "capability_provider") {
        expect(s2cp.pcr.id).toBe(s1cp.pcr.id);
      }
    }
  });

  it("path count matches reference manual traversal", () => {
    const mission    = missions[0];
    const targetProv = providers[0];
    const gapById    = new Map(gaps.map(g => [g.id, g]));
    const valueById  = new Map(values.map(v => [v.id, v]));

    let expected = 0;
    for (const gapRef of mission.gaps) {
      const gap = gapById.get(gapRef.gapId);
      if (!gap) continue;
      for (const valRef of gap.requiredValues) {
        const val = valueById.get(valRef.valueId);
        if (!val) continue;
        for (const vcr of vcRelations.filter(r => r.valueId === val.id)) {
          for (const pcr of pcRelations.filter(r => r.capabilityId === vcr.capabilityId && r.providerId === targetProv.id)) {
            void pcr;
            expected++;
          }
        }
      }
    }

    const paths = computeExplainPaths(mission, targetProv.id, "provider", gaps, values, capabilities, providers, vcRelations, pcRelations);
    expect(paths).toHaveLength(expected);
  });
});
