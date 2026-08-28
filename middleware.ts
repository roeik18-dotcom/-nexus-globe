/**
 * THE SIGNED-OUT REDIRECT — one place, not twenty.
 *
 * In SESSION mode a request with no viewer must not render. Every page
 * resolves the viewer through `resolveViewerContext()`, which THROWS — correct
 * for a render that must not proceed, and a 500 for a person who simply is not
 * signed in. Adding a redirect to each page would mean twenty call sites that
 * must all remember; missing one is a page that 500s instead of asking you to
 * sign in.
 *
 * WHAT THIS CHECKS, AND WHAT IT DOES NOT. Presence of the cookie, nothing
 * more. Middleware cannot reach the session store, so it cannot tell a valid
 * token from a revoked one — and it must not pretend to: this is a redirect
 * for the signed-out, NOT an authorisation check. Authority still lives
 * entirely in the provider, which every page consults regardless of what
 * happened here. A forged cookie value gets past this line and then resolves
 * to nobody, exactly as it should.
 *
 * Expiry is handled by the cookie's own `maxAge` matching the session TTL, so
 * an expired session stops being sent and reads as signed-out here.
 */
import { NextResponse, type NextRequest } from "next/server";

import { isSafeReturnTo } from "@/app/lib/philos/auth/returnTo";

const SESSION_COOKIE = "philos_session";

/** Paths that must stay reachable without a session, or the sign-in screen
 *  itself would redirect to itself. */
const PUBLIC = [/^\/signin(\/|$)/, /^\/api\//, /^\/_next\//, /^\/favicon\./];

export function middleware(request: NextRequest): NextResponse {
  // LOCAL_DEV has no sessions by design; this middleware is inert there.
  if (process.env.PHILOS_VIEWER_MODE === "LOCAL_DEV") return NextResponse.next();

  const { pathname } = request.nextUrl;
  if (PUBLIC.some((re) => re.test(pathname))) return NextResponse.next();
  if (request.cookies.get(SESSION_COOKIE)) return NextResponse.next();

  /* CARRY THE DESTINATION. Without this, someone sent a verification link
     signs in and lands on a fixed page, and the link they were sent — the
     entire reason they signed in — is gone. Validated by the same function
     the action uses, so a path that cannot be followed is never written. */
  const url = request.nextUrl.clone();
  url.pathname = "/signin";
  url.search = "";
  const intended = `${pathname}${request.nextUrl.search}`;
  if (isSafeReturnTo(intended)) url.searchParams.set("returnTo", intended);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
