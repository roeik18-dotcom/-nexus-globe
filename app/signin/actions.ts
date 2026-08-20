"use server";

/**
 * SIGN IN / SIGN OUT — the two request paths that were missing.
 *
 * Everything for sessions existed except a way to obtain one: `issueSession`
 * had no caller outside tests, and nothing ever set the cookie. A lock, a key,
 * and no door.
 *
 * WHAT THE CLIENT SENDS. A key from a fixed list — "roei" or "bet". It does
 * NOT send a subject_id, a person_id or a viewer_id: the server maps the key
 * to an identity it already holds, so the widest thing a client can express is
 * "which of the identities you know about", never "who I claim to be".
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { devIdentity, devSignInEnabled } from "@/app/lib/philos/identity/devIdentities";
import { DEFAULT_SESSION_TTL_MS, issueSession, revokeSession } from "@/app/lib/philos/identity/sessionStore";
import { SESSION_COOKIE } from "@/app/lib/philos/identity/sessionViewer";

export async function signInAsDevIdentity(key: string): Promise<void> {
  if (!devSignInEnabled()) throw new Error("dev sign-in is disabled");
  const identity = devIdentity(key);
  // An unknown key is not a new user and not a default.
  if (!identity) throw new Error("unknown identity");

  const token = await issueSession(identity.viewer);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    /* `secure` only over TLS: setting it on plain-http localhost makes the
       browser silently DROP the cookie, which presents as "sign-in did
       nothing" with no error anywhere to explain it. */
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    /* The cookie expires WITH the session. Not decoration: an expired session
       whose cookie is still sent reaches the page and throws, while an expired
       cookie is simply not sent — so the request looks signed-out and
       redirects cleanly instead of 500ing. */
    maxAge: Math.floor(DEFAULT_SESSION_TTL_MS / 1000),
  });
  redirect("/hub/community");
}

export async function signOut(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  /* Revoke server-side FIRST. Deleting only the cookie would leave a live
     session behind for anyone who had already copied the token — the browser
     would forget it, the server would not. */
  await revokeSession(token);
  jar.delete(SESSION_COOKIE);
  redirect("/signin");
}
