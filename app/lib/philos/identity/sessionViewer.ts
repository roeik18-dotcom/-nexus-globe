/**
 * SESSION VIEWER — the provider that turns a cookie into a viewer.
 *
 * It does exactly two things: read the opaque token from the request, and ask
 * the session store who it belongs to. It contains no identity table, no
 * fallback and no default. Everything it knows, it learned from the store.
 *
 * THE COOKIE IS NOT THE IDENTITY. The first version of this file mapped the
 * literal cookie value `sess_a` to person_roei, so the identity was written in
 * the browser in plain text and a second valid value was guessable by anyone
 * who had seen the first. The cookie now carries 32 random bytes that mean
 * nothing off this server.
 *
 * NO SILENT FALLBACK. If the token is missing, unknown, expired or revoked,
 * `resolve()` returns null and `resolveViewerContext()` throws — the request
 * stops. It never becomes person_roei because that is the only identity the
 * codebase happens to know about.
 */
import { cookies } from "next/headers";

import { resolveSession } from "./sessionStore";
import type { ViewerContext, ViewerProvider } from "./viewerContext";

export const SESSION_COOKIE = "philos_session";

/**
 * How the token is read. Overridable ONLY so tests can drive the provider
 * without a request scope; never called with a value a page passed in.
 */
let _readToken: () => Promise<string | undefined> = async () => {
  const jar = await cookies();
  return jar.get(SESSION_COOKIE)?.value;
};

export function setSessionReader(reader: () => Promise<string | undefined>): void {
  _readToken = reader;
}

export const SESSION_VIEWER: ViewerProvider = {
  kind: "SESSION",
  async resolve(): Promise<ViewerContext | null> {
    const viewer = await resolveSession(await _readToken());
    return viewer ? { ...viewer, source: "SESSION" } : null;
  },
};

/** The cookie attributes a real deployment must set. Stated here so the
 *  requirement lives beside the token rather than in a deploy doc: the value
 *  is a bearer credential, so it must not be readable by scripts, must not
 *  travel over plaintext, and must not be sent cross-site. */
export const SESSION_COOKIE_ATTRIBUTES = {
  httpOnly: true,
  secure: true,
  sameSite: "lax",
  path: "/",
} as const;
