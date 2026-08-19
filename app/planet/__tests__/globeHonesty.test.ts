/**
 * The globe must not render anything it cannot source.
 *
 * PHILOS-SYSTEM-BLUEPRINT header: "every node, line, metric and status must trace
 * to a source event or a projection of source events… Decoration that implies data
 * — random points, static 'live' indicators, invented statuses — is a defect, not a
 * style choice."
 *
 * This suite asserts that rule against the source of the planet route, because the
 * failure mode is textual: a `Math.random()` swarm, a hardcoded "SYNC · REALTIME"
 * or a second population read out of `data/*.json` reads to a user as measurement,
 * and no runtime assertion catches it — the pixels look fine. There is no DOM test
 * tooling in this repo, so the component source is the artefact under test, paired
 * with runtime checks on the projection that feeds it.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { projectGlobeGraph } from "@/app/lib/philos/projectGlobeGraph";
import { GROUP_ID, VALUE_GROUP_EVENTS } from "@/app/lib/philos/valueGroupLog";

const PLANET = join(process.cwd(), "app", "planet");
const read = (f: string) => readFileSync(join(PLANET, f), "utf8");

const WORLD_GLOBE = read("WorldGlobe.tsx");
const PAGE = read("page.tsx");

/** Strip line and block comments so a mention in prose is not a false positive. */
function code(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((l) => !l.trim().startsWith("//"))
    .join("\n");
}

const GLOBE_CODE = code(WORLD_GLOBE);
const PAGE_CODE = code(PAGE);

// ── 1. no fabricated presentation ────────────────────────────────────────────

describe("no fabricated presentation remains", () => {
  it("generates no random point swarm", () => {
    expect(GLOBE_CODE).not.toMatch(/swarm/i);
    // the 720-point cloud was the single largest untraceable element on screen
    expect(GLOBE_CODE).not.toContain("720");
  });

  it("declares no invented status strings", () => {
    expect(GLOBE_CODE).not.toContain("SYNC · REALTIME");
    expect(GLOBE_CODE).not.toContain("ORBIT · OPTIMAL");
  });

  it("no longer labels entity counts as LIVING FORCES", () => {
    // TRUST was the relationship count, with no trust ledger behind it
    expect(GLOBE_CODE).not.toContain("LIVING FORCES");
    expect(GLOBE_CODE).not.toMatch(/"TRUST"/);
    expect(GLOBE_CODE).not.toMatch(/"PURPOSE"/);
  });

  it("no longer presents static rows as a LIVE STREAM", () => {
    expect(GLOBE_CODE).not.toContain("LIVE STREAM");
    expect(GLOBE_CODE).not.toContain("sampleEvents");
  });

  it("shows no static live indicator", () => {
    // A pulsing green dot beside the title asserted that something was
    // streaming. Nothing is: the log gained a writer, but a write is a request
    // the globe does not observe — there is no stream, so a "live" indicator
    // would still be a status with no source, the header rule's own example.
    expect(GLOBE_CODE).not.toMatch(/liveDot/i);
    expect(GLOBE_CODE).not.toMatch(/\bLIVE\b/);
  });

  it("shows no time scrub that no clock drives", () => {
    // A bar filled to a hardcoded 62% reads as a position on a time axis. The
    // globe has no time axis, so the position meant nothing.
    expect(GLOBE_CODE).not.toMatch(/scrub/i);
    expect(GLOBE_CODE).not.toContain("62%");
  });

  it("randomness survives only for the starfield backdrop, which asserts nothing", () => {
    // `seeded` is still declared; what matters is where it is CALLED. The
    // starfield is background texture that claims nothing — a point cloud
    // sitting on the globe claimed population.
    const calls = (GLOBE_CODE.match(/seeded\(/g) ?? []).length;
    const declarations = (GLOBE_CODE.match(/function seeded\(/g) ?? []).length;
    expect(calls - declarations).toBe(1);
    expect(GLOBE_CODE).toContain("starShadows");
  });
});

// ── 2. real content preserved ────────────────────────────────────────────────

describe("event-backed content is preserved", () => {
  it("still renders arcs from the projection", () => {
    expect(GLOBE_CODE).toContain("arcsData={arcs}");
    expect(GLOBE_CODE).toContain("eventArcs");
  });

  it("still distinguishes transfers from membership lines", () => {
    expect(GLOBE_CODE).toContain("isTransfer");
    expect(GLOBE_CODE).toMatch(/transfer\.completed/);
  });

  it("keeps the legend, including the transfer entry", () => {
    expect(WORLD_GLOBE).toContain("LEGEND");
    expect(WORLD_GLOBE).toMatch(/resource transfer/);
    expect(WORLD_GLOBE).toMatch(/membership \/ appointment/);
  });

  it("names every node type the projection can produce", () => {
    // A point whose colour the legend does not explain is a mark the viewer
    // cannot decode — §13's rule applies to nodes as much as to lines.
    for (const t of ["value group", "person", "recipient"]) {
      expect(WORLD_GLOBE).toContain(t);
    }
  });

  it("keeps event provenance in the arc tooltip", () => {
    expect(GLOBE_CODE).toContain("event ${d.event_id}");
    expect(GLOBE_CODE).toContain("d.timestamp");
  });

  it("keeps the transfer's financial fields", () => {
    for (const field of ["d.amount", "d.currency", "d.resource_type", "d.value_tags"]) {
      expect(GLOBE_CODE).toContain(field);
    }
  });

  it("still refuses to print an amount the event did not carry", () => {
    expect(GLOBE_CODE).toContain("amount not recorded");
  });
});

// ── 3. the event log is the route's ONLY source ──────────────────────────────

describe("no ontology reaches the globe", () => {
  it("the route reads no data/*.json store", () => {
    // 61 ontology entities used to render beside the event nodes, positioned by
    // hashing an id. They could not name an event, so half the screen failed the
    // traceability rule while the other half passed it.
    expect(PAGE_CODE).not.toMatch(/readJsonStore/);
    expect(PAGE_CODE).not.toMatch(/json-store/);
    expect(PAGE_CODE).not.toMatch(/\.json/);
    expect(PAGE_CODE).not.toMatch(/\bfrom "path"/);
  });

  it("passes the projection's nodes straight through, unmixed", () => {
    expect(PAGE_CODE).toContain("projectGlobeGraph");
    // `allNodes` was the concatenation of ontology and event nodes
    expect(PAGE_CODE).not.toMatch(/allNodes/);
    expect(PAGE_CODE).toMatch(/nodes=\{nodes\}/);
    expect(PAGE_CODE).toMatch(/arcs=\{arcs\}/);
  });

  it("reports no counts the screen is not drawing", () => {
    // The HUD reported 61 entities and 147 PUDM relations while 8 lines were on
    // screen. Those rails and that stat bar are gone; what is left counts the
    // render arrays.
    expect(GLOBE_CODE).not.toContain("STATIC ONTOLOGY");
    expect(GLOBE_CODE).not.toMatch(/counts/);
    expect(GLOBE_CODE).not.toMatch(/mission/i);
    expect(GLOBE_CODE).toContain("points.length");
    expect(GLOBE_CODE).toContain("arcs.length");
  });

  it("says point position is layout rather than geography", () => {
    // coordinates come from an even sphere spread; a viewer must not read them
    // as places
    expect(WORLD_GLOBE).toMatch(/not geography/);
  });
});

// ── 4. every drawn id traces to the projection ───────────────────────────────

describe("every point the globe can draw is a projection node", () => {
  const graph = projectGlobeGraph(VALUE_GROUP_EVENTS, GROUP_ID);

  it("the seed log yields a non-empty graph to check against", () => {
    expect(graph.nodes.length).toBeGreaterThan(0);
    expect(graph.arcs.length).toBeGreaterThan(0);
  });

  it("draws the reference slice the blueprint quotes — 11 nodes, 9 arcs", () => {
    // Pinned deliberately. §0 of PHILOS-SYSTEM-BLUEPRINT states these figures as
    // the verified runtime, so a change to the seed log that moves them should
    // fail here and force the document to be updated with it. Mission B/B9 added
    // one real `value` node (the group's own central_value) and its one real
    // `group.opened` arc — bumped from the prior 10/8 pin.
    expect(graph.nodes).toHaveLength(11);
    expect(graph.arcs).toHaveLength(9);
    const byRelation = graph.arcs.reduce<Record<string, number>>(
      (acc, a) => ({ ...acc, [a.relation]: (acc[a.relation] ?? 0) + 1 }),
      {},
    );
    expect(byRelation).toEqual({
      "member.joined": 5,
      "leader.appointed": 2,
      "transfer.completed": 1,
      "group.opened": 1,
    });
  });

  it("positions are assigned from the nodes prop and nothing else", () => {
    // `pos` is the map every arc endpoint is looked up in. It is filled inside
    // nodes.map, so an id that is not a projection node has no coordinate and
    // its arc is dropped rather than drawn at a guess.
    expect(GLOBE_CODE).toMatch(/nodes\.map\(/);
    expect(GLOBE_CODE).toMatch(/pos\.set\(n\.id/);
    expect(GLOBE_CODE).toContain("if (!s || !t) return null;");
  });

  it("every arc endpoint is a node in the same projection", () => {
    const ids = new Set(graph.nodes.map((n) => n.id));
    for (const a of graph.arcs) {
      expect(ids.has(a.source_id), `${a.event_id} source ${a.source_id}`).toBe(true);
      expect(ids.has(a.target_id), `${a.event_id} target ${a.target_id}`).toBe(true);
    }
  });

  it("no node id repeats, so no point stands for two entities", () => {
    const ids = graph.nodes.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every node carries the event timestamp that introduced it", () => {
    for (const n of graph.nodes) expect(n.born).toBeGreaterThan(0);
  });
});

// ── 5. no unresolved local imports ───────────────────────────────────────────

describe("planet components have no unresolved local imports", () => {
  const localImports = (src: string) =>
    [...src.matchAll(/from\s+"\.\/([A-Za-z0-9_-]+)"/g)].map((m) => m[1]);

  const resolves = (t: string) =>
    [".ts", ".tsx"].some((ext) => {
      try {
        readFileSync(join(PLANET, t + ext));
        return true;
      } catch {
        return false;
      }
    });

  it("the route's local imports all exist on disk", () => {
    const targets = localImports(PAGE);
    expect(targets.length).toBeGreaterThan(0);
    for (const t of targets) {
      expect(resolves(t), `page.tsx imports ./${t}, which does not exist`).toBe(true);
    }
  });

  it("WorldGlobe's local imports all exist on disk", () => {
    for (const t of localImports(WORLD_GLOBE)) {
      expect(resolves(t), `WorldGlobe imports ./${t}, which does not exist`).toBe(true);
    }
  });
});
