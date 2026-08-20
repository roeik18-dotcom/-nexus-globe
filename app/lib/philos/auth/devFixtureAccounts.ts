/**
 * DEVELOPMENT ACCOUNTS — two people, real hashing, published secrets.
 *
 * The secrets are IN THIS FILE on purpose. A development fixture whose
 * password is hidden invites someone to reuse it somewhere real; one that is
 * printed in the repository cannot be mistaken for a credential. They work
 * only in a development or test runtime, because `DevPasswordVerifier`
 * refuses to construct anywhere else.
 *
 * The mapping from account to PHILOS person lives in the DIRECTORY, not in
 * the account: `roei@local` proves a secret, and the directory decides that
 * this principal is `person_roei`. The account name is not the identity, and
 * changing the account name here would not change who anyone is.
 */
import { makeDevAccount, type DevAccount } from "./devPasswordVerifier";
import type { CanonicalViewer } from "./identityDirectory";

export const DEV_ACCOUNT_SECRETS: Readonly<Record<string, string>> = {
  "roei@local": "philos-dev-roei",
  "bet@local": "philos-dev-bet",
};

let _cache: DevAccount[] | null = null;

/** Hashed once per process — scrypt is deliberately slow. */
export async function DEV_ACCOUNTS(): Promise<DevAccount[]> {
  if (_cache) return _cache;
  _cache = await Promise.all(
    Object.entries(DEV_ACCOUNT_SECRETS).map(([account, secret]) => makeDevAccount(account, secret)),
  );
  return _cache;
}

/** principal -> canonical PHILOS person. Server-side, keyed `provider:id`. */
export const DEV_IDENTITY_TABLE: Readonly<Record<string, CanonicalViewer>> = {
  "DEV_PASSWORD:roei@local": { viewer_id: "person_roei", subject_id: "person_roei", person_id: "p_you" },
  "DEV_PASSWORD:bet@local": { viewer_id: "person_bet", subject_id: "person_bet", person_id: "p_bet" },
};
