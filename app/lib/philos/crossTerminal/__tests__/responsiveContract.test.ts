/**
 * THE RESPONSIVE CONTRACT — enforced in source, because measuring once proves
 * nothing about the next edit.
 *
 * Community, Globe and World were measured clean at 1400 / 768 / 375. Dynamics
 * and Marketplace render the SAME two components, so they inherit the result —
 * but "inherit" only holds while the components keep the properties that made
 * the measurement pass. A single `width: 900` or a `white-space: nowrap`
 * without an ellipsis re-introduces the horizontal scroll on the narrow
 * viewport nobody re-checks.
 *
 * These tests pin the properties, not the pixels:
 *   · the path reflows (auto-fit + minmax), it does not scroll
 *   · no fixed pixel width on any container
 *   · every cell can shrink (minInlineSize: 0) inside its grid track
 *   · long values are clipped with an ellipsis, never allowed to push
 *   · nothing sets overflow-x on the page
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const dir = join(__dirname, "..");
const SHARED = ["UnifiedEntitySurface.tsx", "OperationalTraceFlow.tsx"] as const;
const src = (f: string): string => readFileSync(join(dir, f), "utf8");

describe("responsive contract of the shared surfaces", () => {
  it("the path reflows instead of scrolling sideways", () => {
    for (const f of SHARED) {
      const s = src(f);
      /* The compact strip interpolates its floor, so the assertion matches
         the auto-fit contract rather than one literal spelling of it. */
      expect(s, `${f} must lay the path out on an auto-fit grid`)
        .toMatch(/gridTemplateColumns:\s*[`"]repeat\(auto-fit,\s*minmax\(/);
    }
  });

  it("no shared surface pins a pixel width", () => {
    for (const f of SHARED) {
      const s = src(f);
      /* `minInlineSize` inside minmax() is the reflow floor and is allowed;
         a bare `width:`/`inlineSize:` number on a container is not. */
      const offenders = [...s.matchAll(/\b(?:width|inlineSize|minWidth):\s*(\d{3,})/g)]
        .map((m) => m[0]);
      expect(offenders, `${f} must not pin a fixed width`).toEqual([]);
    }
  });

  it("every cell can shrink inside its grid track", () => {
    for (const f of SHARED) {
      expect(src(f), `${f} cells must set minInlineSize: 0 so they can shrink`)
        .toContain("minInlineSize: 0");
    }
  });

  it("long values are clipped, never allowed to push the layout", () => {
    for (const f of SHARED) {
      const s = src(f);
      expect(s, `${f} must clip overflowing text`).toContain("textOverflow: \"ellipsis\"");
      expect(s, `${f} must break long ids rather than widen the page`)
        .toContain("overflowWrap: \"anywhere\"");
    }
  });

  it("no shared surface introduces a horizontal scroller", () => {
    for (const f of SHARED) {
      expect(src(f), `${f} must not scroll horizontally`).not.toMatch(/overflowX:\s*"(auto|scroll)"/);
    }
  });

  it("the two unmeasured lenses render only the shared surfaces for the chain", () => {
    /* Dynamics and Marketplace were never measured live. They inherit the
       measured result ONLY because they render these components and add no
       chain markup of their own — so that is what is pinned here. */
    const APP = join(dir, "..", "..", "..");
    for (const f of ["dynamics/page.tsx", "marketplace/page.tsx"]) {
      const s = readFileSync(join(APP, f), "utf8");
      expect(s).toContain("<UnifiedEntitySurface");
      expect(s).toContain("<OperationalTraceFlow");
      expect(s, "must not hand the shared surface a fixed width")
        .not.toMatch(/<(UnifiedEntitySurface|OperationalTraceFlow)[^>]*width=/);
    }
  });
});
