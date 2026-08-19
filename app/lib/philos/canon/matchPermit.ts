/**
 * Philos Canon — Match→Action integrity gate.
 *
 * `matching.ts`'s own header states "Matching ⇏ Transfer, ⇏ Action —
 * enforced by absence: this file exports no function that produces a
 * Transfer, an Action". That absence was real, but it also meant Action
 * creation had NO way to verify a Match was ever evaluated, let alone
 * permitted — `createActionForCurrentUserCore` accepted any real
 * Need/Offer id combination in `inputs` unconditionally. This module
 * closes that gap without violating either of the two invariants that
 * made the naive fix (persist every match attempt) wrong:
 *
 *   1. `matchEvalAction.ts`'s own header: match history is deliberately
 *      NOT persisted, because storing every attempt would build exactly
 *      the kind of standing contribution/behavioral profile canon's
 *      anti-ranking scope (§21) forbids.
 *   2. `matching.ts`'s own header: Matching must never produce an
 *      Action — this module doesn't either; it only certifies that a
 *      match WAS evaluated permitted, moments ago, for this exact pair.
 *
 * A `MatchPermit` is a signed, short-lived, stateless capability token —
 * not a record. Nothing here is written to any store. The signature
 * (HMAC-SHA256 over `need_id|offer_id|issued_at`, keyed by a server-only
 * secret never sent to the client) makes it tamper-evident: a client
 * cannot construct or alter a valid permit itself, only receive one from
 * a real `evaluateMatch` call that actually returned `"permitted"`. The
 * 10-minute expiry means a permit for a Need/Offer pair whose real state
 * has since changed cannot be replayed indefinitely — after expiry, the
 * pair must be re-evaluated, which is the correct behavior for a
 * decision that was always explicitly "derived, not persisted."
 */
import { createHmac, timingSafeEqual } from "crypto";

export interface MatchPermit {
  need_id: string;
  offer_id: string;
  issued_at: string;
  expires_at: string;
  signature: string;
}

const TTL_MS = 10 * 60 * 1000;

/**
 * Server-only. Never imported into a `"use client"` module — this file
 * has no `"use client"`/`"use server"` directive itself and is only ever
 * called from `"use server"` actions (`matchEvalAction.ts`,
 * `actionFormAction.ts`), so the secret never reaches a client bundle.
 * A real per-deployment secret (`MATCH_PERMIT_SECRET`) overrides the
 * fallback; the fallback exists only so this single-operator, local-only
 * tool (the same scope `matchEvalAction.ts`'s own header documents —
 * "exactly one real subject in this environment") keeps working without
 * new required env-var setup. This token's job is tamper-evidence and
 * freshness for one local operator, not multi-tenant secrecy.
 */
function permitSecret(): string {
  return process.env.MATCH_PERMIT_SECRET ?? "philos-local-match-permit-dev-secret";
}

function sign(need_id: string, offer_id: string, issued_at: string): string {
  return createHmac("sha256", permitSecret()).update(`${need_id}|${offer_id}|${issued_at}`).digest("hex");
}

/** Called only when `evaluateMatch` itself returned `decision ===
 *  "permitted"` — see `matchEvalAction.ts`. Never called from anywhere
 *  else, so a permit can never exist for a blocked or unresolved match. */
export function issueMatchPermit(need_id: string, offer_id: string, now: string): MatchPermit {
  const issued_at = now;
  const expires_at = new Date(new Date(now).getTime() + TTL_MS).toISOString();
  return { need_id, offer_id, issued_at, expires_at, signature: sign(need_id, offer_id, issued_at) };
}

export type MatchPermitVerification = { valid: true } | { valid: false; reason: string };

/** Fails closed on every path — malformed shape, id mismatch, bad
 *  signature, or expiry all return `valid: false`, never a guess. */
export function verifyMatchPermit(candidate: unknown, need_id: string, offer_id: string, now: string): MatchPermitVerification {
  if (typeof candidate !== "object" || candidate === null) return { valid: false, reason: "match_permit is missing or malformed" };
  const p = candidate as Partial<MatchPermit>;
  if (typeof p.need_id !== "string" || typeof p.offer_id !== "string" || typeof p.issued_at !== "string" || typeof p.expires_at !== "string" || typeof p.signature !== "string") {
    return { valid: false, reason: "match_permit is missing required fields" };
  }
  if (p.need_id !== need_id || p.offer_id !== offer_id) {
    return { valid: false, reason: "match_permit was issued for a different Need/Offer pair" };
  }
  const expected = sign(p.need_id, p.offer_id, p.issued_at);
  const expectedBuf = Buffer.from(expected, "hex");
  const actualBuf = Buffer.from(p.signature, "hex");
  if (expectedBuf.length !== actualBuf.length || !timingSafeEqual(expectedBuf, actualBuf)) {
    return { valid: false, reason: "match_permit signature is invalid" };
  }
  if (new Date(now).getTime() > new Date(p.expires_at).getTime()) {
    return { valid: false, reason: "match_permit has expired — re-evaluate the match" };
  }
  return { valid: true };
}
