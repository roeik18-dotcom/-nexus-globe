/**
 * THE COLD PATH, END TO END, at the two seams that carry the destination:
 * the middleware that WRITES `returnTo`, and the action that FOLLOWS it.
 *
 * Both call `isSafeReturnTo`/`resolveReturnTo`, so a path the action would
 * refuse can never be written into the URL in the first place. These tests
 * exist because the two used to disagree by omission — the middleware wrote
 * nothing, and the action went to a hardcoded page regardless.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const VERIFY = "/verify/effect_fixture_000001";

// ── MIDDLEWARE ────────────────────────────────────────────────────────────

describe("middleware carries the intended destination to /signin", () => {
  const saved = process.env.PHILOS_VIEWER_MODE;
  beforeEach(() => { delete process.env.PHILOS_VIEWER_MODE; });
  afterEach(() => {
    if (saved === undefined) delete process.env.PHILOS_VIEWER_MODE;
    else process.env.PHILOS_VIEWER_MODE = saved;
  });

  /** A NextRequest is heavy; this is the surface the middleware actually uses. */
  function req(pathname: string, opts: { cookie?: boolean; search?: string } = {}) {
    const url = new URL(`http://localhost:3050${pathname}${opts.search ?? ""}`);
    return {
      nextUrl: Object.assign(url, { clone: () => new URL(url.toString()) }),
      cookies: { get: (_n: string) => (opts.cookie ? { value: "tok" } : undefined) },
    } as never;
  }

  it("redirects a signed-out verify link to /signin WITH returnTo", async () => {
    const { middleware } = await import("@/middleware");
    const res = middleware(req(VERIFY));
    const loc = new URL(res.headers.get("location") as string);
    expect(loc.pathname).toBe("/signin");
    expect(loc.searchParams.get("returnTo")).toBe(VERIFY);
  });

  it("keeps the query string of the intended destination", async () => {
    const { middleware } = await import("@/middleware");
    const res = middleware(req("/hub", { search: "?date=2026-08-27" }));
    const loc = new URL(res.headers.get("location") as string);
    expect(loc.searchParams.get("returnTo")).toBe("/hub?date=2026-08-27");
  });

  it("does not redirect a request that already carries a session cookie", async () => {
    const { middleware } = await import("@/middleware");
    const res = middleware(req(VERIFY, { cookie: true }));
    expect(res.headers.get("location")).toBeNull();
  });

  it("leaves /signin itself alone, so it cannot redirect to itself", async () => {
    const { middleware } = await import("@/middleware");
    const res = middleware(req("/signin"));
    expect(res.headers.get("location")).toBeNull();
  });

  it("is inert in LOCAL_DEV, which has no sessions by design", async () => {
    process.env.PHILOS_VIEWER_MODE = "LOCAL_DEV";
    const { middleware } = await import("@/middleware");
    const res = middleware(req(VERIFY));
    expect(res.headers.get("location")).toBeNull();
  });
});

// ── SIGN-IN ACTION ────────────────────────────────────────────────────────

const redirectCalls: string[] = [];
const cookieSets: Array<[string, string]> = [];

vi.mock("next/navigation", () => ({
  redirect: (to: string) => { redirectCalls.push(to); throw new Error("NEXT_REDIRECT"); },
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    set: (n: string, v: string) => { cookieSets.push([n, v]); },
    get: () => undefined,
    delete: () => {},
  }),
}));

describe("signInAction returns the person to where they were going", () => {
  const savedEnv = { ...process.env };
  beforeEach(() => {
    redirectCalls.length = 0; cookieSets.length = 0;
    process.env.PHILOS_ENV = "development";
    process.env.PHILOS_DEV_SIGNIN = "1";
  });
  afterEach(() => { process.env = { ...savedEnv }; });

  const form = (fields: Record<string, string>) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.set(k, v);
    return fd;
  };
  const run = async (fd: FormData) => {
    const { signInAction } = await import("@/app/signin/actions");
    const { activateAuth } = await import("@/app/lib/philos/auth/bootstrap");
    await activateAuth();
    try { await signInAction({}, fd); } catch { /* redirect() throws by design */ }
  };

  it("redirects the verifier back to the exact effect they were sent", async () => {
    await run(form({ account: "bet@local", secret: "philos-dev-bet", returnTo: VERIFY }));
    expect(cookieSets.map(([n]) => n)).toContain("philos_session");
    expect(redirectCalls).toEqual([VERIFY]);
  });

  it("falls back to the default when no destination was carried", async () => {
    await run(form({ account: "bet@local", secret: "philos-dev-bet" }));
    expect(redirectCalls).toEqual(["/hub/community"]);
  });

  // An open redirect would let a verification link be used to bounce someone
  // off-site with a fresh session cookie in hand.
  it("refuses an off-site destination and uses the default instead", async () => {
    await run(form({ account: "bet@local", secret: "philos-dev-bet", returnTo: "//evil.example" }));
    expect(redirectCalls).toEqual(["/hub/community"]);
  });

  it("issues no session and no redirect when the secret is wrong", async () => {
    const { signInAction } = await import("@/app/signin/actions");
    const { activateAuth } = await import("@/app/lib/philos/auth/bootstrap");
    await activateAuth();
    const state = await signInAction({}, form({ account: "bet@local", secret: "wrong", returnTo: VERIFY }));
    expect(state.error).toBeTruthy();
    expect(cookieSets).toEqual([]);
    expect(redirectCalls).toEqual([]);
  });
});
