/**
 * THE DEMO BOUNDARY MUST RENDER IDENTICALLY ON SERVER AND FIRST CLIENT PASS.
 *
 * A hydration diagnostic named this `<details>` with `- open=""`, meaning the
 * DOM React hydrated against carried `open` while the render did not produce
 * it. `open` cannot come from this component: it is a server component, it
 * takes no `open`/`defaultOpen` prop, and no caller passes one. The attribute
 * therefore arrived from outside React — a browser restoring `<details>` state
 * across a reload, or a harness mutating the DOM before hydration.
 *
 * These tests pin the half that IS ours: the markup must be deterministic and
 * must start CLOSED, on every terminal, on repeated renders. If someone later
 * adds client state, a random value or a defaultOpen, this fails — which is
 * the only honest guard available against a mismatch whose other half lives in
 * the browser.
 */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";

import DemoSimulationSection from "../DemoSimulationSection";

const TERMINALS = ["hub", "brain", "community", "dynamics", "marketplace", "planet", "world"] as const;

const render = (terminal: (typeof TERMINALS)[number]) =>
  renderToStaticMarkup(React.createElement(DemoSimulationSection as never, { terminal } as never));

describe("DemoSimulationSection — deterministic, closed initial markup", () => {
  it("renders <details> with NO open attribute", () => {
    for (const t of TERMINALS) {
      const html = render(t);
      expect(html, t).toContain("<details");
      /* The exact attribute the mismatch reported. It must never be emitted. */
      expect(/<details[^>]*\sopen(\s|=|>)/.test(html), t).toBe(false);
    }
  });

  it("is byte-identical across repeated renders — no clock, no random", () => {
    for (const t of TERMINALS) {
      expect(render(t), t).toBe(render(t));
    }
  });

  it("the source declares no client state and no open/defaultOpen prop", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("app/lib/philos/analysis/DemoSimulationSection.tsx", "utf8");
    expect(src).not.toContain('"use client"');
    expect(src).not.toMatch(/useState|useEffect|Math\.random|Date\.now/);
    expect(src).not.toMatch(/<details[^>]*\bopen\b/);
    /* And no suppressHydrationWarning: the render is deterministic, so hiding
       a warning here would hide a real future regression. */
    expect(src).not.toContain("suppressHydrationWarning");
  });

  it("no caller passes an open/defaultOpen prop to it", async () => {
    const { readFileSync } = await import("node:fs");
    const callers = [
      "app/hub/page.tsx", "app/brain/page.tsx", "app/hub/community/page.tsx",
      "app/dynamics/page.tsx", "app/marketplace/page.tsx", "app/planet/page.tsx",
      "app/world/page.tsx",
    ];
    for (const f of callers) {
      const src = readFileSync(f, "utf8");
      for (const m of src.matchAll(/<DemoSimulationSection[^>]*>/g)) {
        expect(m[0], f).not.toMatch(/\bopen\b|defaultOpen/);
      }
    }
  });
});
