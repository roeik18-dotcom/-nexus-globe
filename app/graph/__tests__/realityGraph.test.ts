import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { projectToRealityGraph } from "../projectToRealityGraph";
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

const missions    = loadJson<Mission>("missions.json");
const gaps        = loadJson<Gap>("gaps.json");
const values      = loadJson<Value>("values.json");
const capabilities = loadJson<Capability>("capabilities.json");
const providers   = loadJson<Provider>("providers.json");
const vcRelations = loadJson<ValueCapabilityRelation>("value-capability-relations.json");
const pcRelations = loadJson<ProviderCapabilityRelation>("provider-capability-relations.json");

const graph = projectToRealityGraph(
  missions, gaps, values, capabilities, providers, vcRelations, pcRelations,
);

describe("projectToRealityGraph — seed data", () => {
  it("total node count equals sum of all entity collections", () => {
    const expected = missions.length + gaps.length + values.length + capabilities.length + providers.length;
    expect(graph.nodes).toHaveLength(expected);
  });

  it("node types are correctly set", () => {
    const byType = (t: string) => graph.nodes.filter(n => n.type === t).length;
    expect(byType("mission")).toBe(missions.length);
    expect(byType("gap")).toBe(gaps.length);
    expect(byType("value")).toBe(values.length);
    expect(byType("capability")).toBe(capabilities.length);
    expect(byType("provider")).toBe(providers.length);
  });

  it("mission_gap edges derived from Mission.gaps[] embedded refs", () => {
    const expected = missions.reduce((n, m) => n + m.gaps.length, 0);
    const actual = graph.edges.filter(e => e.type === "mission_gap");
    expect(actual).toHaveLength(expected);
  });

  it("gap_value edges derived from Gap.requiredValues[] embedded refs", () => {
    const expected = gaps.reduce((n, g) => n + g.requiredValues.length, 0);
    const actual = graph.edges.filter(e => e.type === "gap_value");
    expect(actual).toHaveLength(expected);
  });

  it("value_capability edges match vcRelations count", () => {
    const actual = graph.edges.filter(e => e.type === "value_capability");
    expect(actual).toHaveLength(vcRelations.length);
  });

  it("capability_provider edges match pcRelations count", () => {
    const actual = graph.edges.filter(e => e.type === "capability_provider");
    expect(actual).toHaveLength(pcRelations.length);
  });

  it("nodeById covers every node exactly once", () => {
    expect(graph.nodeById.size).toBe(graph.nodes.length);
    for (const node of graph.nodes) {
      expect(graph.nodeById.get(node.entity.id)).toBe(node);
    }
  });

  it("nodeById lookup returns the correct node type", () => {
    const m = missions[0];
    const looked = graph.nodeById.get(m.id);
    expect(looked?.type).toBe("mission");
    expect(looked?.entity).toBe(m);
  });

  it("projection is pure — calling again produces structurally equal result", () => {
    const graph2 = projectToRealityGraph(
      missions, gaps, values, capabilities, providers, vcRelations, pcRelations,
    );
    expect(graph2.nodes.length).toBe(graph.nodes.length);
    expect(graph2.edges.length).toBe(graph.edges.length);
    expect(graph2.nodeById.size).toBe(graph.nodeById.size);
  });

  it("no hardcoded data — empty inputs produce empty graph", () => {
    const empty = projectToRealityGraph([], [], [], [], [], [], []);
    expect(empty.nodes).toHaveLength(0);
    expect(empty.edges).toHaveLength(0);
    expect(empty.nodeById.size).toBe(0);
  });
});
