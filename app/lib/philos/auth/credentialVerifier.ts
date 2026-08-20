/**
 * THE AUTHENTICATION BOUNDARY.
 *
 * Three stages, deliberately separate, because collapsing any two of them is
 * how a client ends up choosing who it is:
 *
 *   1. CREDENTIAL VERIFICATION  — does this secret belong to this principal?
 *   2. IDENTITY RESOLUTION      — which PHILOS person is that principal?
 *   3. SESSION ISSUANCE         — mint a token for that person.
 *
 * A `VerifiedPrincipal` is NOT a PHILOS viewer. It is whatever the credential
 * source calls the account — a username, a subject claim from an IdP, a row
 * id. The mapping from principal to canonical person is stage 2, server-side,
 * and is the ONLY place a PHILOS identity is decided. That separation is what
 * makes "the browser cannot declare its own identity" structural rather than
 * a rule someone has to keep remembering: there is no parameter to pass.
 *
 * WHAT A VERIFIER MAY NOT DO. It may not return a viewer. It may not read the
 * identity directory. It may not issue a session. It receives a submitted
 * credential and answers with a principal or with null — nothing else.
 *
 * FAILURE IS ONE ANSWER. Unknown account and wrong secret both return null.
 * Distinguishing them tells an attacker which half to work on, which is how
 * account enumeration works. The interface makes the safe thing the only
 * expressible thing: there is no error type to leak.
 */

/** What the browser submits. Never an identity — a claim plus a secret. */
export interface SubmittedCredential {
  /** How the person names themselves to the credential source. NOT a
   *  PHILOS person_id, subject_id or viewer_id, and never used as one. */
  account: string;
  secret: string;
}

/** Who the credential source says that was. Still not a PHILOS identity. */
export interface VerifiedPrincipal {
  /** Stable id WITHIN the credential source, namespaced by provider so two
   *  sources cannot collide into one PHILOS person. */
  principal_id: string;
  /** Which provider vouched. Recorded so an audit can tell them apart. */
  provider: string;
}

export interface CredentialVerifier {
  readonly kind: string;
  /** A principal, or null. Null covers unknown account, wrong secret, locked
   *  account and every other failure — one answer, on purpose. */
  verify(credential: SubmittedCredential): Promise<VerifiedPrincipal | null>;
}

/**
 * THE PRODUCTION VERIFIER IS MISSING, and this is it saying so.
 *
 * There is no credential source in this repository — no user table, no
 * password column, no IdP configuration. Writing one now would mean inventing
 * a production password database and calling the boundary finished, which is
 * exactly the shape of a security feature that is really a placeholder.
 *
 * So the default verifier authenticates NOBODY. A deployment that reaches
 * here has no way in, which is the correct behaviour for a system whose
 * credential source has not been connected yet. It is not a stub that
 * accidentally passes: it cannot pass.
 */
export const NO_CREDENTIAL_PROVIDER: CredentialVerifier = {
  kind: "NO_CREDENTIAL_PROVIDER",
  async verify(): Promise<VerifiedPrincipal | null> {
    return null;
  },
};

let _verifier: CredentialVerifier = NO_CREDENTIAL_PROVIDER;

/** Install the verifier for this deployment. Never called from a request. */
export function setCredentialVerifier(v: CredentialVerifier): void { _verifier = v; }
export function currentCredentialVerifier(): CredentialVerifier { return _verifier; }
