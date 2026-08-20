/**
 * SESSION VIEWER — the minimum real provider, and deliberately no more.
 *
 * This is not an auth product. It has no passwords, no tokens it mints, no
 * account lifecycle. It does exactly one thing the single-user provider
 * cannot: resolve TWO DISTINCT viewers, server-side, from request state the
 * client cannot forge into a different person than the one the server already
 * knows about.
 *
 * THE PROPERTY THAT MATTERS. `resolve()` takes no argument from a caller and
 * reads no value that a page passed in. It reads a cookie, inside a request
 * scope, and maps it through a registry the server owns. A client can present
 * a session id; it cannot present a `subject_id`. If the cookie names nothing
 * the registry knows, resolution FAILS — it does not fall back to a person.
 *
 * REGISTERED VIEWERS are a server-side table, not an open mapping. A session
 * value that is not in it resolves to nothing, so an attacker guessing cookie
 * values gets a refused request rather than an invented identity.
 *
 * WHAT IS STILL MISSING, stated rather than implied: nothing here
 * AUTHENTICATES. Presenting the cookie is presenting the identity. That is
 * sufficient to run and test two real viewers end to end, and insufficient to
 * put on the internet — a real sign-in replaces `readSessionId` and this
 * file's registry, and nothing else changes, which is the point of the seam.
 */
import { cookies } from "next/headers";

import type { ViewerContext, ViewerProvider } from "./viewerContext";

export const SESSION_COOKIE = "philos_session";

/**
 * The viewers this deployment knows. Keyed by session id — the id is the
 * credential presented, the record is what the server believes about it, and
 * the two are never the same string as a subject.
 */
const REGISTRY: Record<string, Omit<ViewerContext, "source">> = {
  sess_a: { viewer_id: "person_roei", subject_id: "person_roei", person_id: "p_you" },
  sess_b: { viewer_id: "person_bet", subject_id: "person_bet", person_id: "p_bet" },
};

/** Overridable ONLY for tests; never called from a request path. */
let _readSessionId: () => Promise<string | undefined> = async () => {
  const jar = await cookies();
  return jar.get(SESSION_COOKIE)?.value;
};

export function setSessionReader(reader: () => Promise<string | undefined>): void {
  _readSessionId = reader;
}

export function registeredViewerIds(): string[] {
  return Object.keys(REGISTRY);
}

export const SESSION_VIEWER: ViewerProvider = {
  kind: "SESSION",
  async resolve(): Promise<ViewerContext | null> {
    const id = await _readSessionId();
    if (!id) return null;
    const known = REGISTRY[id];
    // An unknown session is NOT a new user and NOT a fallback to anybody.
    if (!known) return null;
    return { ...known, source: "SESSION" };
  },
};
