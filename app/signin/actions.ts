"use server";

/**
 * SIGN IN / SIGN OUT — the two request paths.
 *
 * WHAT THE BROWSER SENDS: an account name and a secret. It does NOT send a
 * person_id, subject_id, viewer_id, or anything the server treats as an
 * identity. The account name is a claim addressed to the credential source;
 * WHO that account is remains a server fact resolved by the identity
 * directory after the secret has been verified.
 *
 * The previous version accepted a KEY from a fixed list and mapped it
 * straight to a viewer. That is better than accepting a person_id and still
 * wrong: it authenticated nothing at all — the "credential" was the identity.
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { signInWithCredential } from "@/app/lib/philos/auth/signIn";
import { assertRuntimeSafe } from "@/app/lib/philos/auth/productionGuard";
import { DEFAULT_SESSION_TTL_MS, revokeSession } from "@/app/lib/philos/identity/sessionStore";
import { SESSION_COOKIE } from "@/app/lib/philos/identity/sessionViewer";
import { resolveReturnTo } from "@/app/lib/philos/auth/returnTo";

export type SignInFormState = { error?: string };

export async function signInAction(
  _prev: SignInFormState,
  formData: FormData,
): Promise<SignInFormState> {
  /* Re-checked here, not only at boot: a process can be reconfigured after
     startup, and a guard that ran once is a guard that can be outlived. */
  assertRuntimeSafe();

  /* Read BEFORE the credential check, so a failed attempt re-renders the form
     with the destination still attached and a retry does not lose it. */
  const returnTo = resolveReturnTo(formData.get("returnTo"));

  const result = await signInWithCredential({
    account: String(formData.get("account") ?? ""),
    secret: String(formData.get("secret") ?? ""),
  });

  if (!result.ok) {
    /* ONE message for every failure. Unknown account, wrong secret and a
       verified-but-unmapped principal are indistinguishable here, because
       "that account exists" is worth money to an attacker and nothing to a
       person who already knows which of their own details they mistyped. */
    return { error: "פרטי הכניסה שגויים" };
  }

  const jar = await cookies();
  jar.set(SESSION_COOKIE, result.token, {
    httpOnly: true,
    /* `secure` only over TLS: on plain-http localhost the browser silently
       DROPS a secure cookie, which presents as "sign-in did nothing". */
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    /* Cookie expires WITH the session, so an expired session stops being sent
       and reads as signed-out rather than reaching a page and throwing. */
    maxAge: Math.floor(DEFAULT_SESSION_TTL_MS / 1000),
  });
  redirect(returnTo);
}

export async function signOut(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  /* Revoke server-side FIRST, and durably. Deleting only the cookie would
     leave a live session for anyone who had copied the token: the browser
     forgets, the server does not. */
  await revokeSession(token);
  jar.delete(SESSION_COOKIE);
  redirect("/signin");
}
