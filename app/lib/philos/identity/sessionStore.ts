/**
 * SESSION STORE — server-owned, opaque-token sessions.
 *
 * The previous seam mapped a cookie value straight to a viewer through a
 * literal table: `sess_a` meant person_roei. That is not authentication, it is
 * a NAME. Anyone who could set a cookie could set `sess_b` and become the
 * other user, and the identity was legible in the browser.
 *
 * What changes here, and only this:
 *
 *   THE TOKEN CARRIES NO IDENTITY. It is 32 random bytes. It is not derived
 *   from the viewer, it does not encode them, and reading it tells an
 *   attacker nothing about who it belongs to or what another valid token
 *   would look like. Guessing one is guessing 256 bits.
 *
 *   THE SERVER OWNS THE MAPPING. token -> { viewer, issued, expires, revoked }
 *   lives here. The client holds a bearer string and nothing else.
 *
 *   FAILURE IS NOBODY. Unknown, expired and revoked all resolve to null — the
 *   same answer, so a caller cannot distinguish "wrong token" from "expired
 *   token" and learn which half to attack.
 *
 * WHAT THIS STILL IS NOT. There is no credential check: `issue()` is called by
 * trusted code that has already decided who this is. A real sign-in replaces
 * `issue()`'s caller, not this file. Sessions live in memory, so a restart
 * logs everyone out — correct for a store with no persistence, and the reason
 * `SessionRepository` is an interface rather than a module-level Map.
 */
import { randomBytes, timingSafeEqual } from "crypto";

import type { ViewerContext } from "./viewerContext";

export interface SessionRecord {
  /** The identity this token stands for. Never sent to the client. */
  viewer: Omit<ViewerContext, "source">;
  issued_at: string;
  expires_at: string;
  revoked_at?: string;
}

export interface SessionRepository {
  get(token: string): Promise<SessionRecord | null>;
  put(token: string, record: SessionRecord): Promise<void>;
  delete(token: string): Promise<void>;
  /** Every live token — for revoke-all and for tests. Never for lookup. */
  tokens(): Promise<string[]>;
}

class InMemorySessionRepository implements SessionRepository {
  private readonly rows = new Map<string, SessionRecord>();
  async get(token: string) { return this.rows.get(token) ?? null; }
  async put(token: string, record: SessionRecord) { this.rows.set(token, record); }
  async delete(token: string) { this.rows.delete(token); }
  async tokens() { return [...this.rows.keys()]; }
}

let _repo: SessionRepository = new InMemorySessionRepository();

/** Swap the store (a real one in production, a fixture in tests). */
export function setSessionRepository(repo: SessionRepository): void { _repo = repo; }
export function sessionRepository(): SessionRepository { return _repo; }

export const DEFAULT_SESSION_TTL_MS = 12 * 60 * 60 * 1000;

/** 32 random bytes, base64url. No structure, no prefix, no identity. */
export function mintSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Issue a session for an already-established identity.
 *
 * The caller is responsible for having verified who this is. That is the line
 * a real sign-in sits on, and it is deliberately OUTSIDE this module: mixing
 * credential checking into session storage is how a session store becomes an
 * auth product nobody can audit.
 */
export async function issueSession(
  viewer: Omit<ViewerContext, "source">,
  opts?: { ttlMs?: number; now?: number },
): Promise<string> {
  const now = opts?.now ?? Date.now();
  const token = mintSessionToken();
  await _repo.put(token, {
    viewer,
    issued_at: new Date(now).toISOString(),
    expires_at: new Date(now + (opts?.ttlMs ?? DEFAULT_SESSION_TTL_MS)).toISOString(),
  });
  return token;
}

/**
 * Resolve a bearer token to a viewer, or to NOBODY.
 *
 * Unknown, expired and revoked are one answer on purpose. Returning different
 * results would tell a caller which of the three it hit, which is a probe.
 */
export async function resolveSession(
  token: string | undefined,
  now: number = Date.now(),
): Promise<Omit<ViewerContext, "source"> | null> {
  if (!token) return null;
  const record = await _repo.get(token);
  if (!record) return null;
  if (record.revoked_at) return null;
  if (Date.parse(record.expires_at) <= now) return null;
  return record.viewer;
}

/** Log out. Idempotent — revoking an unknown token is not an error and is not
 *  distinguishable from revoking a real one. */
export async function revokeSession(token: string | undefined, now: number = Date.now()): Promise<void> {
  if (!token) return;
  const record = await _repo.get(token);
  if (!record) return;
  await _repo.put(token, { ...record, revoked_at: new Date(now).toISOString() });
}

/** Whether two tokens are the same, without leaking length-prefix timing.
 *  Used by tests and by any caller comparing a presented token to a known one. */
export function sameToken(a: string, b: string): boolean {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
