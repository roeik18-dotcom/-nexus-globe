/**
 * PRIMARY_STAGE — the containment contract every social surface's primary
 * content renders into.
 *
 * THE PROBLEM THIS REPLACES. Two of the three surfaces owned the viewport:
 * `position: fixed; inset: 0`, sized from `window.innerWidth/innerHeight`.
 * A fixed element escapes every ancestor, so nesting such a surface inside
 * the shared frame painted it over the navigation and the frame itself — the
 * page rendered as a bare starfield with no way out. Fullscreen-sibling was
 * the workaround, and it is what stopped the three scales from being one
 * workspace.
 *
 * THE CONTRACT. A stage is a normal block that OWNS ITS OWN BOX:
 *
 *   position: relative     children position against the stage, not the window
 *   width: 100%            the parent decides width
 *   min-height             the stage asks for height; it does not take the screen
 *   overflow: hidden       nothing escapes, stated rather than assumed
 *   isolation: isolate     a local stacking context, so a child's z-index is
 *                          scoped to the stage and can never sort itself above
 *                          the navigation
 *
 * `isolation: isolate` is the load-bearing line. Without it a descendant with
 * `z-index: 9999` still competes with the shell; with it, the stage's own
 * z-order is a sealed universe and the shell always wins.
 *
 * CHILDREN MUST USE `position: absolute; inset: 0` — NOT `fixed`. Inside a
 * `position: relative` parent those two look identical until the page scrolls
 * or the stage is nested, at which point `fixed` silently re-anchors to the
 * viewport. Any `fixed` inside a stage is a bug, not a style choice.
 *
 * SIZING. Children must measure the STAGE, not the window. `window.innerWidth`
 * inside a stage is the same bug in another form: it happens to be right only
 * while the stage happens to fill the screen.
 */
import type { CSSProperties } from "react";

export interface StageOptions {
  /** Height the stage asks for. Number = px; string passes through (e.g. "70vh"). */
  minHeight?: number | string;
  /** Only for a stage that genuinely scrolls its own content. */
  scroll?: boolean;
}

export function primaryStage({ minHeight = 520, scroll = false }: StageOptions = {}): CSSProperties {
  return {
    position: "relative",
    width: "100%",
    minHeight: typeof minHeight === "number" ? `${minHeight}px` : minHeight,
    overflow: scroll ? "auto" : "hidden",
    // Sealed stacking context: a child's z-index cannot reach the shell.
    isolation: "isolate",
  };
}

/** For a child that should fill the stage. Absolute, never fixed. */
export const STAGE_FILL: CSSProperties = {
  position: "absolute",
  inset: 0,
};
