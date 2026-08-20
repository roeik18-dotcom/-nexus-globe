/**
 * WHICH PROVIDER IS ACTIVE, and why it is never a guess.
 *
 * Two providers now exist. The dangerous shape would be "use SESSION, and if
 * nothing resolves fall back to LOCAL_SINGLE_USER" — which reads like
 * robustness and is actually a bypass: every unauthenticated request would
 * silently become person_roei, which is the exact single-user assumption this
 * whole phase removed.
 *
 * So mode is CHOSEN, once, from the environment, and the two modes have no
 * overlap:
 *
 *   LOCAL_DEV  — LOCAL_SINGLE_USER. One developer, no sessions. Only ever
 *                selected by an explicit env value.
 *   SESSION    — SESSION_VIEWER. A valid session or nothing. There is no
 *                third outcome.
 *
 * The DEFAULT is SESSION. A missing env var must not open the dev door: if
 * someone deploys without setting anything, they get "unauthenticated", not
 * "everyone is Roei".
 */
import { LOCAL_SINGLE_USER, setViewerProvider, type ViewerProvider } from "./viewerContext";
import { SESSION_VIEWER } from "./sessionViewer";

export type ViewerMode = "LOCAL_DEV" | "SESSION";

/** The one variable this module reads. Narrow on purpose: a caller — a test
 *  especially — should not have to fabricate a whole environment to ask a
 *  one-key question. */
export interface ViewerEnv { PHILOS_VIEWER_MODE?: string }

/** `PHILOS_VIEWER_MODE=LOCAL_DEV` is the ONLY way to get the dev provider. */
/** Reads ONE variable. Typed as the narrow shape it actually needs so a
 *  caller — a test especially — cannot be forced to fabricate a whole
 *  environment to ask a one-key question. */
export function resolveViewerMode(env: ViewerEnv = process.env as ViewerEnv): ViewerMode {
  return env.PHILOS_VIEWER_MODE === "LOCAL_DEV" ? "LOCAL_DEV" : "SESSION";
}

export function providerForMode(mode: ViewerMode): ViewerProvider {
  return mode === "LOCAL_DEV" ? LOCAL_SINGLE_USER : SESSION_VIEWER;
}

/** Install the provider this deployment runs with. Idempotent; call at boot. */
export function activateViewerProvider(env: ViewerEnv = process.env as ViewerEnv): ViewerMode {
  const mode = resolveViewerMode(env);
  setViewerProvider(providerForMode(mode));
  return mode;
}
