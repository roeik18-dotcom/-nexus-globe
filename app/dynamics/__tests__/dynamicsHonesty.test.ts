/**
 * The Dynamics view must not draw anything the projection did not return.
 *
 * PHILOS-DYNAMICS-UI-CONTRACT.md §0/§3/§5, applied to the component. As with
 * app/planet/__tests__/globeHonesty.test.ts, the failure mode is textual — a
 * hardcoded count, an invented status, a second data read, an inferred edge drawn
 * solid — and there is no DOM tooling in this repo, so the component source is the
 * artefact under test, paired with a projection-output check on what feeds it.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { buildDynamicsView } from "@/app/lib/philos/dynamicsView";
import { projectDynamics } from "@/app/lib/philos/projectDynamics";
import { VALUE_GROUP_EVENTS } from "@/app/lib/philos/valueGroupLog";

const DIR = join(process.cwd(), "app", "dynamics");
const read = (f: string) => readFileSync(join(DIR, f), "utf8");

const VIEW_SRC = read("DynamicsView.tsx");
const PAGE_SRC = read("page.tsx");

const strip = (src: string) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((l) => !l.trim().startsWith("//"))
    .join("\n");

const VIEW = strip(VIEW_SRC);
const PAGE = strip(PAGE_SRC);

// ── 1. every mark maps from the view-model, nothing invented ──────────────────

describe("draws only projection marks", () => {
  it("renders nodes and edges by mapping the view-model arrays", () => {
    expect(VIEW).toMatch(/view\.nodes\.map\(/);
    expect(VIEW).toMatch(/view\.edges\.map\(/);
  });

  it("edge endpoints are looked up in the node position map, dropped if absent", () => {
    // an id that is not a projection node has no coordinate, so its edge is not drawn
    expect(VIEW).toContain("pos.get(e.source_event_id)");
    expect(VIEW).toContain("pos.get(e.target_event_id)");
    expect(VIEW).toContain("if (!s || !t) return null;");
  });

  it("HUD counts read the summary the projection computed, not a literal", () => {
    for (const field of ["view.hud.nodes", "view.hud.edges", "view.hud.explicit_edges", "view.hud.inferred_edges", "view.hud.withheld", "view.hud.unresolved"]) {
      expect(VIEW).toContain(field);
    }
  });

  it("node fill comes from the view-model's lane colour", () => {
    expect(VIEW).toContain("fill={n.lane_color}");
  });
});

// ── 2. explicit vs inferred is carried by the two separate fields ─────────────

describe("explicit and inferred stay distinct", () => {
  it("line style is driven by e.dashed (the edge_origin axis), never by evidence", () => {
    expect(VIEW).toContain("e.dashed");
    expect(VIEW).toMatch(/strokeDasharray=\{e\.dashed \? "5 4" : undefined\}/);
  });

  it("the evidence word is rendered literally from the view-model", () => {
    expect(VIEW).toContain("e.evidence_word");
  });

  it("names both honesty words in the legend", () => {
    expect(VIEW).toContain("self_report");
    expect(VIEW).toContain("system_inference");
  });
});

// ── 3. absence is stated, position is labelled ────────────────────────────────

describe("absence and layout are stated honestly", () => {
  it("shows the withheld line and the unresolved panel from the view-model", () => {
    expect(VIEW).toContain("view.withheld.text");
    expect(VIEW).toContain("view.unresolved.map(");
  });

  it("labels x as time and within-lane offset as layout, not measurement", () => {
    expect(VIEW).toMatch(/layout, not measurement/);
  });
});

// ── 4. no fabricated presentation, no second data source ──────────────────────

describe("no fabricated presentation reaches the route", () => {
  it("invents no live/realtime/sync status", () => {
    expect(VIEW).not.toMatch(/\bLIVE\b/);
    expect(VIEW).not.toMatch(/REALTIME/i);
    expect(VIEW).not.toMatch(/\bSYNC\b/i);
  });

  it("uses no clock and no randomness (determinism)", () => {
    expect(VIEW).not.toMatch(/Math\.random/);
    expect(VIEW).not.toMatch(/Date\.now/);
  });

  it("reads no json store or fs on the route", () => {
    for (const src of [VIEW, PAGE]) {
      expect(src).not.toMatch(/\.json/);
      expect(src).not.toMatch(/readFile|from "node:fs"|from "fs"|fetch\s*\(/);
    }
  });

  it("the page's only data source is the projection pipeline over the one log", () => {
    expect(PAGE).toContain("projectDynamics");
    expect(PAGE).toContain("buildDynamicsView");
    // The events arrive from the durable store rather than the seed constant, so
    // this screen shows real recorded acts. Same single log, same pipeline — the
    // assertion is that nothing ELSE feeds the route, which still holds.
    expect(PAGE).toContain("loadPhilosEvents");
    expect(PAGE).not.toContain("VALUE_GROUP_EVENTS");
  });
});

// ── 5. the feed is event-backed and non-empty ─────────────────────────────────

describe("the seed feed is real and drawable", () => {
  const view = buildDynamicsView(projectDynamics({ events: VALUE_GROUP_EVENTS }));

  it("yields nodes and at least one causal edge to render", () => {
    expect(view.nodes.length).toBeGreaterThan(0);
    expect(view.edges.length).toBeGreaterThan(0);
  });

  it("HUD counts equal the drawn array lengths", () => {
    expect(view.hud.nodes).toBe(view.nodes.length);
    expect(view.hud.edges).toBe(view.edges.length);
  });
});
