/**
 * SESSION LIFECYCLE — issue, resolve, revoke — over a DURABLE log.
 *
 * The store used to be a Map, so a restart forgot every session AND every
 * revocation. Both halves matter. Losing issuance is an annoyance; losing
 * revocation would be a hole the moment issuance became durable, because a
 * revoked token would come back as merely unknown and then, once the log
 * remembered issuance, as VALID. Persisting one without the other is the
 * dangerous half-fix, so both are entries in the same append-only log.
 *
 * THE TOKEN IS 32 RANDOM BYTES and is never written down: the log stores
 * sha256(token). Reading the file yields digests, and a digest cannot be
 * presented as a bearer token.
 *
 * ONE ANSWER FOR EVERY FAILURE. Unknown, expired and revoked all return null.
 * Returning different results would let a caller learn which of the three it
 * hit, which is a probe: "this token was valid once" is information.
 */
import { randomBytes, timingSafeEqual } from "crypto";

import type { ViewerContext } from "./viewerContext";
import { sessionLog, tokenDigest, type SessionState } from "./sessionLog";

export const DEFAULT_SESSION_TTL_MS = 12 * 60 * 60 * 1000;

export type SessionRecord = SessionState;

/** 32 random bytes, base64url. No structure, no prefix, no identity. */
export function mintSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Issue a session for an ALREADY-VERIFIED identity.
 *
 * The credential check is deliberately outside this module — see
 * `auth/credentialVerifier.ts`. Mixing verification into session storage is
 * how a session store becomes an auth product nobody can audit, and it is why
 * this function takes a viewer rather than a credential.
 */
export async function issueSession(
  viewer: Omit<ViewerContext, "source">,
  opts?: { ttlMs?: number; now?: number },
): Promise<string> {
  const now = opts?.now ?? Date.now();
  const token = mintSessionToken();
  await sessionLog().append({
    type: "issued",
    token_digest: tokenDigest(token),
    viewer,
    issued_at: new Date(now).toISOString(),
    expires_at: new Date(now + (opts?.ttlMs ?? DEFAULT_SESSION_TTL_MS)).toISOString(),
  });
  return token;
}

/** Resolve a bearer token to a viewer, or to NOBODY. */
export async function resolveSession(
  token: string | undefined,
  now: number = Date.now(),
): Promise<Omit<ViewerContext, "source"> | null> {
  if (!token) return null;
  const state = await sessionLog().read(tokenDigest(token));
  if (!state) return null;
  if (state.revoked_at) return null;
  if (Date.parse(state.expires_at) <= now) return null;
  return state.viewer;
}

/**
 * Log out. Idempotent, and indistinguishable from revoking a token that never
 * existed — an attacker probing revocation learns nothing about which tokens
 * are real.
 */
export async function revokeSession(token: string | undefined, now: number = Date.now()): Promise<void> {
  if (!token) return;
  await sessionLog().append({
    type: "revoked",
    token_digest: tokenDigest(token),
    revoked_at: new Date(now).toISOString(),
  });
}

/** Constant-time token comparison, for any caller matching a presented token
 *  against a known one. */
export function sameToken(a: string, b: string): boolean {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
