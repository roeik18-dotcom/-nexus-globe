/**
 * DEMO QUARANTINE — the boundary, asserted structurally.
 *
 * These are source-level assertions rather than render tests, for the same
 * reason the repository's other boundary tests are: the property being
 * protected is "no page mounts the scenario directly, and every mount is
 * collapsed and labelled". That is a fact about the call sites, and a render
 * test of one component cannot observe it.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { DEMO_SECTION_LABEL } from "../DemoSimulationSection";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

const TERMINAL_PAGES = [
  "app/hub/page.tsx",
  "app/brain/page.tsx",
  "app/hub/community/page.tsx",
  "app/dynamics/page.tsx",
  "app/marketplace/page.tsx",
  "app/planet/page.tsx",
  "app/world/page.tsx",
] as const;

describe("the DEMO scenario has exactly one mount point", () => {
  it("no terminal page imports PersonEventOrientationHeader directly", () => {
    for (const p of TERMINAL_PAGES) {
      expect(read(p), `${p} must go through DemoSimulationSection`)
        .not.toMatch(/from "@\/app\/lib\/philos\/analysis\/PersonEventOrientationHeader"/);
    }
  });

  it("every terminal page mounts DemoSimulationSection", () => {
    for (const p of TERMINAL_PAGES) {
      expect(read(p), `${p} must mount the DEMO section`).toMatch(/<DemoSimulationSection/);
    }
  });

  it("only the boundary component imports the scenario header", () => {
    const boundary = read("app/lib/philos/analysis/DemoSimulationSection.tsx");
    expect(boundary).toMatch(/import PersonEventOrientationHeader from ".\/PersonEventOrientationHeader"/);
  });

  it("the scenario component itself is unchanged in role — still the header, still fed the scenario", () => {
    const header = read("app/lib/philos/analysis/PersonEventOrientationHeader.tsx");
    expect(header).toMatch(/loadAcceptanceScenario/);
  });
});

describe("the boundary is collapsed and labelled", () => {
  const boundary = read("app/lib/philos/analysis/DemoSimulationSection.tsx");

  it("uses a native details element with no client directive", () => {
    expect(boundary).toMatch(/<details/);
    expect(boundary).not.toMatch(/"use client"/);
  });

  it("is collapsed by default — no open attribute", () => {
    expect(boundary).not.toMatch(/<details[^>]*\sopen[\s>]/);
  });

  it("carries the exact required label", () => {
    expect(DEMO_SECTION_LABEL).toBe("DEMO / SIMULATION — כלי בדיקה, אינו נתון המשתמש");
    expect(boundary).toContain(DEMO_SECTION_LABEL);
  });
});

describe("REAL content precedes DEMO on every terminal", () => {
  it("REAL content is mounted before the DEMO section on every single-route terminal", () => {
    // Marketplace is excluded here and asserted per-branch below: its two
    // mounts live in mutually exclusive routes, so a raw file-offset
    // comparison would compare the prototype route's section against the
    // default route's strip — two things that never co-render.
    for (const p of TERMINAL_PAGES.filter((x) => x !== "app/marketplace/page.tsx")) {
      const src = read(p);
      // Dynamics mounts the section through DynamicsView's slot prop, which
      // is passed after the strip in the same expression.
      const strip = src.indexOf("<DayStatusStrip");
      const demo = src.indexOf("<DemoSimulationSection");
      expect(strip, `${p} must mount DayStatusStrip`).toBeGreaterThan(-1);
      expect(demo, `${p} must mount DemoSimulationSection`).toBeGreaterThan(-1);
      expect(strip, `${p}: REAL strip must precede the DEMO section`).toBeLessThan(demo);
    }
  });

  it("marketplace puts REAL before DEMO inside EACH route separately", () => {
    const src = read("app/marketplace/page.tsx");
    const guardEnd = src.indexOf('if (params.view === "prototype")');
    const defaultStart = src.lastIndexOf("  return (");

    // Prototype route: the real prototype component, then its DEMO section.
    const protoReal = src.indexOf("<MarketplacePrototype", guardEnd);
    const protoDemo = src.indexOf("<DemoSimulationSection", guardEnd);
    expect(protoReal).toBeGreaterThan(-1);
    expect(protoDemo).toBeGreaterThan(-1);
    expect(protoReal, "prototype route: real content precedes DEMO").toBeLessThan(protoDemo);
    expect(protoDemo, "prototype mount belongs to the early return").toBeLessThan(defaultStart);

    // Default route: the real strip, then its own DEMO section.
    const mainStrip = src.indexOf("<DayStatusStrip", defaultStart);
    const mainDemo = src.indexOf("<DemoSimulationSection", defaultStart);
    expect(mainStrip).toBeGreaterThan(-1);
    expect(mainDemo).toBeGreaterThan(-1);
    expect(mainStrip, "default route: real strip precedes DEMO").toBeLessThan(mainDemo);
  });

  it("real chrome (SignOutButton) is never passed into the DEMO section", () => {
    for (const p of TERMINAL_PAGES) {
      const src = read(p);
      const m = src.match(/<DemoSimulationSection[^>]*\/>/g) ?? [];
      for (const mount of m) {
        expect(mount, `${p}: sign-out must stay outside the DEMO section`).not.toMatch(/SignOutButton/);
      }
    }
  });
});

describe("marketplace routes are mutually exclusive, so neither mount is a duplicate", () => {
  const src = read("app/marketplace/page.tsx");

  it("the prototype branch is an early return", () => {
    const guard = src.indexOf('if (params.view === "prototype")');
    expect(guard).toBeGreaterThan(-1);
    // The default route's return comes after the guarded block closes.
    const lastReturn = src.lastIndexOf("  return (");
    expect(lastReturn).toBeGreaterThan(guard);
  });

  it("mounts exactly one section per route — two call sites, never both rendered", () => {
    const mounts = src.match(/<DemoSimulationSection/g) ?? [];
    expect(mounts).toHaveLength(2);
  });
});
