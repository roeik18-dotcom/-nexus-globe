/**
 * Mission B, B13 (Visual Convergence) — the ONE color palette every
 * Community surface (VALUE UNIVERSE, VALUE GROUPS, RELATION MAP, QUALITY
 * GROUPS, the Value detail page) shares for scope and promotion-status.
 * Standalone module, no dependency on `CommunityUniverse.tsx`, so it can
 * be imported from both that file and its own child views
 * (`ValueUniverseView.tsx`/`QualityGroupView.tsx`) without a circular
 * import — the previous version defined these constants inside
 * `CommunityUniverse.tsx` and re-exported them, which created exactly
 * that cycle (`CommunityUniverse.tsx` imports `ValueUniverseView.tsx`
 * which imported the constant back) and broke at runtime with
 * "Cannot access 'PROMOTION_STATUS_COLOR' before initialization" —
 * caught by live dev-server verification, not by `tsc`/`next build`.
 */
import type { ValueEntry } from "@/app/lib/philos/community/valueRegistry";

export const SCOPE_COLOR: Record<ValueEntry["scope"], string> = {
  INDIVIDUAL: "#8fa3c9", GROUP: "#5b9cf6", COMMON: "#34d399",
};

/** Plain string keys (not tied to one status enum type) so
 *  `RuntimeStatus` (CANONICAL_RUNTIME/REFERENCE_ONLY/REVIEW_REQUIRED/
 *  REJECTED_FOR_RUNTIME) and `SubvalueStatus` (...same 3 + UNSUPPORTED)
 *  both index into it without a type mismatch. */
export const PROMOTION_STATUS_COLOR: Record<string, string> = {
  CANONICAL_RUNTIME: "#34d399",
  REVIEW_REQUIRED: "#fbbf24",
  REFERENCE_ONLY: "#8fa3c9",
  REJECTED_FOR_RUNTIME: "#5a76a3",
  UNSUPPORTED: "#5a76a3",
};
