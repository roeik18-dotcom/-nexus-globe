/**
 * THE ONE SIGN-IN PATH. Verify, resolve, issue — in that order, always.
 *
 * Every failure returns the SAME outcome. Unknown account, wrong secret,
 * verified-but-unmapped principal and a runtime that refuses dev sign-in are
 * one answer to the caller, because distinguishing them is account
 * enumeration: "that account exists, the password was wrong" is a fact worth
 * money to an attacker and worth nothing to a legitimate user, who already
 * knows which of their own details they mistyped.
 *
 * The operator still needs the distinction, so it is RECORDED rather than
 * returned — `reason` never crosses the response boundary.
 *
 * NOTHING IS ISSUED BEFORE VERIFICATION SUCCEEDS. There is no branch here
 * that reaches `issueSession` without a principal and a directory hit, and no
 * parameter through which a caller could supply either.
 */
import { issueSession } from "../identity/sessionStore";
import { currentCredentialVerifier, type SubmittedCredential } from "./credentialVerifier";
import { currentIdentityDirectory } from "./identityDirectory";

export type SignInResult =
  | { ok: true; token: string }
  /** One shape for every failure. No field distinguishes the cause. */
  | { ok: false };

/** Why it failed. For logs and tests ONLY — never returned to a caller. */
export type SignInFailure =
  | "NO_CREDENTIAL_SUBMITTED"
  | "CREDENTIAL_REJECTED"
  | "PRINCIPAL_NOT_MAPPED";

export interface SignInObserver { (failure: SignInFailure): void }

let _observe: SignInObserver = () => {};
export function setSignInObserver(o: SignInObserver): void { _observe = o; }

export async function signInWithCredential(
  credential: SubmittedCredential,
): Promise<SignInResult> {
  if (!credential?.account?.trim() || !credential?.secret) {
    _observe("NO_CREDENTIAL_SUBMITTED");
    return { ok: false };
  }

  // STAGE 1 — does this secret belong to this account?
  const principal = await currentCredentialVerifier().verify(credential);
  if (!principal) {
    _observe("CREDENTIAL_REJECTED");
    return { ok: false };
  }

  // STAGE 2 — which PHILOS person is that principal? Server-side, from a
  // table the client cannot address. This is the ONLY place a canonical
  // identity is decided.
  const viewer = await currentIdentityDirectory().resolve(principal);
  if (!viewer) {
    // A verified credential with no PHILOS person behind it is a real state:
    // an account that exists and has not been linked. Creating a person here
    // would mint identities as a side effect of logging in.
    _observe("PRINCIPAL_NOT_MAPPED");
    return { ok: false };
  }

  // STAGE 3 — only now.
  return { ok: true, token: await issueSession(viewer) };
}
