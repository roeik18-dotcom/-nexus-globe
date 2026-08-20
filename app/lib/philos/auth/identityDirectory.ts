/**
 * IDENTITY RESOLUTION — principal to canonical PHILOS person.
 *
 * Stage 2 of the boundary, and the only place a PHILOS identity is decided.
 * The browser has no way to influence it: it submitted an account name and a
 * secret, a verifier turned those into a principal, and this maps the
 * principal to a viewer using a table only the server holds.
 *
 * WHY THIS IS NOT A FIELD ON THE CREDENTIAL. If the credential carried a
 * person_id — or an email that was used AS the person_id, which is the same
 * thing wearing a hat — then verifying the secret would prove the secret and
 * nothing about the identity that came with it. Separating them means the
 * strongest statement a client can make is "here is a secret for account X",
 * and who X *is* remains a server fact.
 *
 * An unmapped principal resolves to NOTHING. A verified credential with no
 * PHILOS person behind it is a real state — an account that exists in the
 * credential source and has not been linked — and inventing a person for it
 * would create identities as a side effect of logging in.
 */
import type { ViewerContext } from "../identity/viewerContext";
import type { VerifiedPrincipal } from "./credentialVerifier";

export type CanonicalViewer = Omit<ViewerContext, "source">;

export interface IdentityDirectory {
  readonly kind: string;
  resolve(principal: VerifiedPrincipal): Promise<CanonicalViewer | null>;
}

/** Explicit principal -> person mapping. The table is server-side data. */
export class StaticIdentityDirectory implements IdentityDirectory {
  readonly kind = "STATIC";
  constructor(private readonly table: Readonly<Record<string, CanonicalViewer>>) {}
  async resolve(principal: VerifiedPrincipal): Promise<CanonicalViewer | null> {
    return this.table[`${principal.provider}:${principal.principal_id}`] ?? null;
  }
}

/** No directory configured: nobody resolves. Same reasoning as the missing
 *  credential provider — a default that cannot succeed. */
export const NO_IDENTITY_DIRECTORY: IdentityDirectory = {
  kind: "NO_IDENTITY_DIRECTORY",
  async resolve() { return null; },
};

let _directory: IdentityDirectory = NO_IDENTITY_DIRECTORY;
export function setIdentityDirectory(d: IdentityDirectory): void { _directory = d; }
export function currentIdentityDirectory(): IdentityDirectory { return _directory; }
