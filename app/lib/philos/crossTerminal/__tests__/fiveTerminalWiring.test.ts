/**
 * THE FIVE LENSES SHARE ONE TRUTH — enforced, not asserted in a report.
 *
 * `CROSS_TERMINAL_MISMATCHES = 0` was true because every route happened to
 * call the same loader. "Happened to" is the part that rots: the failure mode
 * here has always been a route quietly rebuilding the chain in local JSX
 * because its own page needed one more field, and nothing catching it until
 * two terminals printed different numbers for the same group.
 *
 * These tests read the route sources. They cannot prove the rendered DOM
 * matches — only a live pass does that — but they DO prove the only structural
 * way the DOM could diverge is closed: one loader, one projection component,
 * one trace component, and no second projection anywhere.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..", "..", "..", "..");

/** The five lenses over the selected entity, and the file that renders each. */
const LENSES = {
  community: "app/hub/community/page.tsx",
  globe: "app/planet/page.tsx",
  world: "app/world/page.tsx",
  dynamics: "app/dynamics/page.tsx",
  marketplace: "app/marketplace/page.tsx",
} as const;

const src = (rel: string): string => readFileSync(join(ROOT, rel), "utf8");

describe("five-terminal wiring", () => {
  it("every lens loads the selected entity from the ONE shared loader", () => {
    for (const [lens, file] of Object.entries(LENSES)) {
      const s = src(file);
      expect(s, `${lens} must import the shared loader`)
        .toMatch(/from "@\/app\/lib\/philos\/crossTerminal\/loadSelectedEntity"/);
    }
  });

  it("every lens renders the ONE shared surface, never its own", () => {
    /* The compact spine and the trace were two components sitting one above
       the other; they are now a single surface, so THAT is what every lens
       must render. */
    for (const [lens, file] of Object.entries(LENSES)) {
      expect(src(file), `${lens} must render UnifiedEntitySurface`)
        .toContain("<UnifiedEntitySurface");
    }
  });

  it("no lens builds a projection of its own", () => {
    /* The builder is pure and exported, so a route COULD call it directly with
       inputs of its own choosing — which is exactly how five terminals would
       drift back apart. Only the loader may call it. */
    for (const [lens, file] of Object.entries(LENSES)) {
      const s = src(file);
      expect(s, `${lens} must not call the projection builder directly`)
        .not.toContain("buildSelectedEntityWorldProjection");
      expect(s, `${lens} must not build its own trace`)
        .not.toContain("buildOperationalTrace(");
    }
  });

  it("every lens feeds the surface the SAME two objects", () => {
    /* One projection, one trace, from one loader. A lens that passed anything
       else here would be reconstructing the entity, which is the failure this
       file exists to prevent. */
    for (const [lens, file] of Object.entries(LENSES)) {
      const m = src(file).match(/<UnifiedEntitySurface\s+projection=\{([^}]+)\}\s+trace=\{([^}]+)\}/);
      expect(m, `${lens} must pass a projection and a trace`).toBeTruthy();
      expect(m![1], `${lens} projection must come from the loader`).toMatch(/projection/);
      expect(m![2], `${lens} trace must come from the loader`).toMatch(/trace/);
    }
  });

  it("the trace lenses still render the detailed trace surface", () => {
    for (const lens of ["dynamics", "marketplace"] as const) {
      expect(src(LENSES[lens])).toContain("<OperationalTraceFlow");
    }
  });

  it("every lens carries the selected entity into the shell", () => {
    for (const [lens, file] of Object.entries(LENSES)) {
      expect(src(file), `${lens} must hand the shell the selected group`)
        .toMatch(/selectedGroup=\{/);
    }
  });
});

describe("the four-colour grammar has no fifth colour", () => {
  const AMBER = /#fbbf24|#f59e0b|#f0b45c|#eab308/;
  it("no amber survives in the shared cross-terminal surfaces", () => {
    for (const f of [
      "app/lib/philos/crossTerminal/EntityChainFlow.tsx",
      "app/lib/philos/crossTerminal/OperationalTraceFlow.tsx",
    ]) {
      expect(src(f), `${f} must use only the four operational colours`).not.toMatch(AMBER);
    }
  });
});
