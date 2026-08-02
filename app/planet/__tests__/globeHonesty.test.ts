/**
 * The globe must not render anything it cannot source.
 *
 * PHILOS-SYSTEM-BLUEPRINT header: "every node, line, metric and status must trace
 * to a source event or a projection of source events… Decoration that implies data
 * — random points, static 'live' indicators, invented statuses — is a defect, not a
 * style choice."
 *
 * This suite asserts that rule against the source of the planet components, because
 * the failure mode is textual: a `Math.random()` swarm or a hardcoded "SYNC ·
 * REALTIME" reads to a user as measurement, and no runtime assertion catches it —
 * the pixels look fine. There is no DOM test tooling in this repo, so the component
 * source is the artefact under test.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const PLANET = join(process.cwd(), "app", "planet");
const read = (f: string) => readFileSync(join(PLANET, f), "utf8");

const WORLD_GLOBE = read("WorldGlobe.tsx");
const LIVING_FIELD = read("LivingField.tsx");

/** Strip line and block comments so a mention in prose is not a false positive. */
function code(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((l) => !l.trim().startsWith("//"))
    .join("\n");
}

const GLOBE_CODE = code(WORLD_GLOBE);

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

// ── 3. what remains is labelled for what it is ───────────────────────────────

describe("remaining ontology figures are labelled, not disguised", () => {
  it("names the static ontology rail as static", () => {
    expect(GLOBE_CODE).toContain("STATIC ONTOLOGY");
    expect(WORLD_GLOBE).toMatch(/not events/);
  });

  it("says point position is layout rather than geography", () => {
    // coordinates come from hashing an id; a viewer must not read them as places
    expect(WORLD_GLOBE).toMatch(/not geography/);
  });
});

// ── 4. no unresolved local imports ───────────────────────────────────────────

describe("planet components have no unresolved local imports", () => {
  const localImports = (src: string) =>
    [...src.matchAll(/from\s+"\.\/([A-Za-z0-9_-]+)"/g)].map((m) => m[1]);

  it("LivingField's local imports all exist on disk", () => {
    // Deliberately does NOT require any particular import. The rule is "nothing
    // tracked may import something that is not there", which must hold for
    // whatever LivingField happens to import — pinning a specific module here
    // coupled this suite to an unrelated rewrite.
    const targets = localImports(LIVING_FIELD);
    expect(targets.length).toBeGreaterThan(0);
    for (const t of targets) {
      const found = [".ts", ".tsx"].some((ext) => {
        try {
          readFileSync(join(PLANET, t + ext));
          return true;
        } catch {
          return false;
        }
      });
      expect(found, `LivingField imports ./${t}, which does not exist`).toBe(true);
    }
  });

  it("WorldGlobe's local imports all exist on disk", () => {
    for (const t of localImports(WORLD_GLOBE)) {
      const found = [".ts", ".tsx"].some((ext) => {
        try {
          readFileSync(join(PLANET, t + ext));
          return true;
        } catch {
          return false;
        }
      });
      expect(found, `WorldGlobe imports ./${t}, which does not exist`).toBe(true);
    }
  });
});
