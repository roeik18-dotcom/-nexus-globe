/**
 * THE ONE SOCIAL TERMINAL — scale, not route.
 *
 * Community, Globe and World were three Next routes: three `page.tsx` files,
 * three data pipelines, three document titles, three URLs. Everything AROUND
 * the primary content was already unified — shell, frame, grammar, selection,
 * authority, accounting, client-side navigation — but the route itself was
 * not, and that is what kept them reading as three terminals.
 *
 * They are now one route with a SCALE. `/social?scale=group|network|system`
 * renders one shell and one frame; only the primary stage changes.
 *
 * The prerequisite was containment: two of the three used to own the viewport
 * with `position: fixed`, so nesting them under a shared shell painted over
 * the navigation. That was fixed first (PRIMARY_STAGE), which is what makes
 * this merge a routing change rather than a rewrite.
 *
 * The old paths stay valid and redirect, so no existing link breaks.
 */

export type SocialScale = "group" | "network" | "system";

export const SOCIAL_SCALES: SocialScale[] = ["group", "network", "system"];

export const SCALE_META: Record<SocialScale, {
  label: string;
  level: string;
  /** The route this scale used to live at — kept for redirects. */
  legacy_path: string;
  title: string;
}> = {
  group:   { label: "Community", level: "GROUP",   legacy_path: "/hub/community", title: "Philos — SOCIAL · GROUP" },
  network: { label: "Globe",     level: "NETWORK", legacy_path: "/planet",        title: "Philos — SOCIAL · NETWORK" },
  system:  { label: "World",     level: "SYSTEM",  legacy_path: "/world",         title: "Philos — SOCIAL · SYSTEM" },
};

/** Never throws on a bad value: an unknown scale falls to GROUP, which is the
 *  operational state and the safest thing to show. */
export function parseScale(raw: string | string[] | undefined): SocialScale {
  const v = (Array.isArray(raw) ? raw[0] : raw)?.trim().toLowerCase();
  return v === "network" || v === "system" || v === "group" ? v : "group";
}

export function scaleHref(scale: SocialScale, sel?: string): string {
  const base = `/social?scale=${scale}`;
  return sel ? `${base}&sel=${encodeURIComponent(sel)}` : base;
}
