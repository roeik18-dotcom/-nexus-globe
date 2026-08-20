/**
 * VIEWER FIXTURES — two humans, used by every isolation test.
 *
 * These are the ONLY place a test may name a viewer. A test that builds a
 * ViewerContext inline can quietly grant itself an identity the product's own
 * provider would never produce, which is how a single-user assumption survives
 * a "multi-user" test suite.
 *
 * USER_A is the product's real designated user, so the existing baseline keeps
 * meaning what it meant. USER_B is a second human with no records of their
 * own, which is exactly the state a genuinely new user arrives in.
 */
import type { ViewerContext, ViewerProvider } from "../viewerContext";

export const USER_A: ViewerContext = {
  viewer_id: "person_roei",
  subject_id: "person_roei",
  person_id: "p_you",
  source: "LOCAL_SINGLE_USER",
};

export const USER_B: ViewerContext = {
  viewer_id: "person_bet",
  subject_id: "person_bet",
  person_id: "p_bet",
  source: "SESSION",
};

/** A provider pinned to one fixture viewer, for tests that exercise a code
 *  path which resolves the viewer itself rather than receiving it. */
export function providerFor(v: ViewerContext): ViewerProvider {
  return { kind: v.source, resolve: async () => v };
}
