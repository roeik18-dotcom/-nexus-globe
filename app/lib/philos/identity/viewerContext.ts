/**
 * VIEWER CONTEXT — the one answer to "who is acting", resolved server-side.
 *
 * WHY THIS REPLACES `REAL_CURRENT_SUBJECT`. That constant was imported by 18
 * runtime modules, each of which independently decided that the acting person
 * is `person_roei`. Patching them one at a time would produce eighteen places
 * that could drift; this makes the question answerable in exactly one place,
 * and everything else depend on the answer.
 *
 * THE SECURITY PRINCIPLE IS PRESERVED, NOT RELAXED. Identity is resolved by
 * the SERVER. It is never read from a form field, a URL parameter, or any
 * other client-supplied value. A client that submits `subject=person_roei`
 * must not become Roei, and the only way to guarantee that is for the write
 * paths never to look at what the client said.
 *
 * `?subject=` KEEPS ITS EXISTING MEANING and gains no authority: it selects
 * WHOSE DATA IS BEING VIEWED, subject to what the viewer is allowed to see.
 * It has never been, and must never become, a statement about who is acting.
 *
 * THREE IDS, deliberately separate rather than one:
 *   viewer_id   the authenticated principal — the session's identity
 *   subject_id  the canon subject that principal writes as (`Need.subject`,
 *               `Action.owner`, `Effect.subject`)
 *   person_id   the Value-Group log's person id for the same human
 * They are equal today for the single local user, and the identity-link store
 * exists precisely because they are NOT equal in general — canon uses free
 * text subjects while the group log uses `p_*` ids. Collapsing them into one
 * field would delete a distinction the data already makes.
 */

export interface ViewerContext {
  /** The authenticated principal. Authority for every write. */
  viewer_id: string;
  /** Canon subject this principal writes as. */
  subject_id: string;
  /** Value-Group log person id for the same human. */
  person_id: string;
  /** How this identity was established — auditable, never assumed. */
  source: "LOCAL_SINGLE_USER" | "SESSION";
}

/** A provider answers who is acting. One implementation per deployment mode. */
export interface ViewerProvider {
  readonly kind: ViewerContext["source"];
  resolve(): Promise<ViewerContext | null>;
}

/**
 * Development provider: one local user, stated explicitly rather than implied
 * by a constant scattered through the codebase.
 *
 * This is NOT a fallback that silently activates. It is selected, it names
 * itself in every context it produces, and `source: "LOCAL_SINGLE_USER"` is
 * carried on the record so a reader can tell that a write was made without
 * authentication. When a session provider lands, this one is replaced rather
 * than out-voted.
 */
export const LOCAL_SINGLE_USER: ViewerProvider = {
  kind: "LOCAL_SINGLE_USER",
  async resolve() {
    return {
      viewer_id: "person_roei",
      subject_id: "person_roei",
      person_id: "p_you",
      source: "LOCAL_SINGLE_USER",
    };
  },
};

/**
 * THE DEFAULT PROVIDER IS THE MODE, RESOLVED PER CALL — not a boot side-effect.
 *
 * This was `let _provider = LOCAL_SINGLE_USER`, with `instrumentation.ts`
 * calling `activateViewerProvider()` at startup to replace it. That failed
 * open, and did: the dev server had already booted, `register()` never re-ran
 * after the wiring landed, and the module kept the single-user provider — so
 * middleware redirected the signed-out correctly while a request carrying ANY
 * cookie value at all rendered Roei's complete social state. Verified with
 * `-b philos_session=forged`: 200, person_roei, 34 records.
 *
 * A boot side-effect that silently does not run leaves the system in its
 * PERMISSIVE state, which is the wrong direction to fail in. The mode is now
 * consulted on every resolution, so there is no window in which the provider
 * is more permissive than the configuration says.
 *
 * The import is dynamic on purpose: `viewerMode` reaches `sessionViewer`,
 * which imports `next/headers`, and this module is imported almost everywhere
 * including inside client boundaries. A static import would drag a
 * server-only API across that line.
 */
const MODE_PROVIDER: ViewerProvider = {
  kind: "SESSION",
  async resolve() {
    const { providerForMode, resolveViewerMode } = await import("./viewerMode");
    return providerForMode(resolveViewerMode()).resolve();
  },
};

let _provider: ViewerProvider = MODE_PROVIDER;

/** Install a provider (a real session provider in production, a fixture in
 *  tests). Never called from a request path. */
export function setViewerProvider(provider: ViewerProvider): void {
  _provider = provider;
}

export function currentViewerProvider(): ViewerProvider {
  return _provider;
}

/**
 * THE one entry point. Throws rather than falling back: an unresolvable viewer
 * must stop the request, because the alternative is serving or writing data as
 * somebody. A silent default is how single-user assumptions survive into
 * multi-user systems.
 */
export async function resolveViewerContext(): Promise<ViewerContext> {
  const ctx = await _provider.resolve();
  if (!ctx) {
    throw new Error("viewer could not be resolved; refusing to act without an identity");
  }
  return ctx;
}

/**
 * Whether this viewer may read records owned by `subject`.
 *
 * Deliberately conservative and deliberately explicit: a viewer reads their
 * own records. Group and public material is authorised separately, by an
 * actual membership or an explicit public flag — never by "we already loaded
 * it anyway".
 */
export function mayReadSubject(viewer: ViewerContext, subject: string | undefined): boolean {
  if (!subject) return false;
  return subject === viewer.subject_id || subject === viewer.person_id;
}

/**
 * The outcome of asking who is acting, without throwing.
 *
 * `resolveViewerContext()` throws, which is right for a render that must not
 * proceed. A route that has to answer 401 rather than 500 needs the same
 * question asked politely — and needs it to be IMPOSSIBLE to answer it with a
 * fallback identity, so this returns null and nothing else.
 */
export async function tryResolveViewerContext(): Promise<ViewerContext | null> {
  return currentViewerProvider().resolve();
}
