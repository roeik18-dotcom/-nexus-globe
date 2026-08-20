/**
 * DEVELOPMENT CREDENTIAL VERIFIER — real hashing, no production pretensions.
 *
 * This exists so the boundary can be exercised end to end without a
 * credential source. It is NOT a production password database and must not
 * grow into one: there is no registration, no reset, no lockout, no rotation,
 * and the account table is a constructor argument rather than storage.
 *
 * What it DOES do properly, because a dev implementation that models the
 * security wrongly teaches the wrong shape:
 *   - scrypt with a per-account random salt; never a bare hash, never plain
 *   - constant-time comparison of the derived keys
 *   - one answer for unknown account and wrong secret, including the same
 *     WORK: an unknown account still runs a scrypt against a dummy hash, so
 *     response time does not reveal whether the account exists
 *
 * It refuses to run in a production-like runtime — same guard as the
 * selector, because a dev verifier reachable in production is the same
 * bypass by another route.
 */
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

import { isProductionLike, type RuntimeEnv } from "./productionGuard";
import type { CredentialVerifier, SubmittedCredential, VerifiedPrincipal } from "./credentialVerifier";

const scrypt = promisify(scryptCb) as (s: string, salt: Buffer, len: number) => Promise<Buffer>;
const KEY_LEN = 32;

export interface DevAccount { account: string; salt: string; hash: string }

/** Build an account record. Used by fixtures and by a dev seed script. */
export async function makeDevAccount(account: string, secret: string): Promise<DevAccount> {
  const salt = randomBytes(16);
  const key = await scrypt(secret, salt, KEY_LEN);
  return { account, salt: salt.toString("base64"), hash: key.toString("base64") };
}

export class DevPasswordVerifier implements CredentialVerifier {
  readonly kind = "DEV_PASSWORD";
  private readonly byAccount: Map<string, DevAccount>;
  /** A salt used only to burn equivalent time on unknown accounts. */
  private readonly decoySalt = randomBytes(16);

  /* Narrow env type on purpose: a caller — a test especially — should not
     have to fabricate a whole ProcessEnv to state one classification. */
  constructor(accounts: readonly DevAccount[], env: RuntimeEnv = process.env) {
    if (isProductionLike(env)) {
      throw new Error("DevPasswordVerifier refuses to construct in a production-like runtime");
    }
    this.byAccount = new Map(accounts.map((a) => [a.account, a]));
  }

  async verify(credential: SubmittedCredential): Promise<VerifiedPrincipal | null> {
    const found = this.byAccount.get(credential.account);
    // Unknown account still does the work — otherwise a fast rejection is
    // itself the answer "no such account".
    const salt = found ? Buffer.from(found.salt, "base64") : this.decoySalt;
    const derived = await scrypt(credential.secret, salt, KEY_LEN);
    if (!found) return null;
    const expected = Buffer.from(found.hash, "base64");
    if (derived.length !== expected.length) return null;
    if (!timingSafeEqual(derived, expected)) return null;
    return { principal_id: found.account, provider: this.kind };
  }
}
