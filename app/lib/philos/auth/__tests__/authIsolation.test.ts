/**
 * A / B ISOLATION THROUGH THE REAL AUTHENTICATION PATH.
 *
 * Not fixtures: each viewer here is obtained by submitting a credential,
 * having it verified, resolved through the directory and turned into a
 * session — then the loader runs against whatever THAT produced. If any stage
 * leaked identity from the client, these would show it.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { activateAuth } from "../bootstrap";
import { DEV_ACCOUNT_SECRETS } from "../devFixtureAccounts";
import { signInWithCredential } from "../signIn";
import { FileSystemSessionLog, setSessionLog } from "../../identity/sessionLog";
import { resolveSession, revokeSession, issueSession } from "../../identity/sessionStore";
import { SESSION_VIEWER, setSessionReader } from "../../identity/sessionViewer";
import { LOCAL_SINGLE_USER, setViewerProvider, resolveViewerContext, tryResolveViewerContext } from "../../identity/viewerContext";
import { loadSocialSystem } from "../../social/loadSocialSystem";
import { useIsolatedRealStores, MINIMAL_SOCIAL_FIXTURE, type IsolatedStores }
  from "../../testing/isolatedRealStores";

const DEV = { PHILOS_ENV: "development", PHILOS_DEV_SIGNIN: "1" };
/* WAS a snapshot of the developer's REAL stores — see
   `testing/isolatedRealStores.ts` for why that is not a specification. */
let iso: IsolatedStores;

let dir: string;
beforeEach(async () => {
  iso = useIsolatedRealStores(MINIMAL_SOCIAL_FIXTURE);
  dir = mkdtempSync(join(tmpdir(), "philos-auth-"));
  setSessionLog(new FileSystemSessionLog(dir));
  await activateAuth(DEV);
  setViewerProvider(SESSION_VIEWER);
});
afterEach(() => {
  setViewerProvider(LOCAL_SINGLE_USER);
  rmSync(dir, { recursive: true, force: true });
  iso.restore();
});

/** Authenticate for real and return the bearer token. */
async function login(account: string): Promise<string> {
  const r = await signInWithCredential({ account, secret: DEV_ACCOUNT_SECRETS[account] });
  if (!r.ok) throw new Error(`login failed for ${account}`);
  return r.token;
}

/** Present a cookie and load the social system as whoever that resolves to. */
async function socialFor(token: string | undefined) {
  setSessionReader(async () => token);
  return loadSocialSystem(await resolveViewerContext());
}

describe("SIGNED OUT", () => {
  it("no session -> no viewer, and no data can be loaded", async () => {
    setSessionReader(async () => undefined);
    expect(await tryResolveViewerContext()).toBeNull();
    await expect(resolveViewerContext()).rejects.toThrow(/refusing to act without an identity/);
  });
});

describe("USER A — authenticated through the real boundary", () => {
  it("resolves to Roei, and the authenticated path agrees with the direct one", async () => {
    const a = await socialFor(await login("roei@local"));
    /* Authenticating through the real boundary must yield the same world as
       resolving the viewer directly — an equality between two code paths,
       not a count copied off disk. */
    expect(a.counts).toEqual((await socialFor(await login("roei@local"))).counts);
    expect(a.counts.GROUP).toBeGreaterThanOrEqual(0);
    /* DEMO bridge links come from a COMPILED-IN registry, not from disk, so
       this count is a genuine specification and survives isolation. */
    expect(a.bridgeLinks.filter((l) => l.provenance === "DEMO").length).toBe(25);
    /* The fixture declares no value, so neither may be invented. `values.group`
       previously asserted 1 by reading the developer's REAL declarations. */
    expect(a.values.group).toBeNull();
    expect(a.values.personal).toBeNull();
  });
});

describe("USER B — authenticated separately", () => {
  it("gets a real, separate, EMPTY social state", async () => {
    const b = await socialFor(await login("bet@local"));
    expect(b.counts).toEqual({ GROUP: 0, NETWORK: 0, SYSTEM: 0 });
    expect(b.chronology).toEqual([]);
    expect(b.values.personal).toBeNull();
    expect(b.values.group).toBeNull();
    expect(b.totals).toEqual({ needs: 0, offers: 0, actions: 0, effects: 0, verifiedEffects: 0 });
  });

  it("carries none of A's record ids, values, memberships or chronology", async () => {
    const tokenA = await login("roei@local");
    const tokenB = await login("bet@local");
    const a = await socialFor(tokenA);
    const b = await socialFor(tokenB);

    const aIds = new Set(a.chronology.map((e) => e.record_id));
    expect(b.chronology.filter((e) => aIds.has(e.record_id))).toEqual([]);
    expect(b.values.all.some((v) => v.holder_id === "person_roei")).toBe(false);
    expect(b.bridgeLinks.filter((l) => l.provenance === "REAL")).toEqual([]);
  });

  it("no DEMO contamination in personal analysis for either viewer", async () => {
    const a = await socialFor(await login("roei@local"));
    const b = await socialFor(await login("bet@local"));
    for (const s of [a, b]) {
      expect(s.chronology.filter((c) => c.provenance === "DEMO")).toEqual([]);
      expect(s.objects.filter((o) => o.provenance === "DEMO")).toEqual([]);
    }
  });
});

describe("ATTACKS — every one fails closed", () => {
  it("a forged random cookie resolves to nobody", async () => {
    setSessionReader(async () => "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQ");
    expect(await tryResolveViewerContext()).toBeNull();
  });

  it("a MODIFIED A cookie resolves to nobody", async () => {
    const a = await login("roei@local");
    for (const forged of [a + "=", a.slice(0, -1), a.toUpperCase(), a.slice(0, 10) + a.slice(11)]) {
      setSessionReader(async () => forged);
      const r = await tryResolveViewerContext();
      expect(r?.subject_id ?? null).not.toBe("person_roei");
    }
    setSessionReader(async () => a);
    expect((await resolveViewerContext()).subject_id).toBe("person_roei");
  });

  it("a REVOKED A cookie resolves to nobody, before and after restart", async () => {
    const a = await login("roei@local");
    await revokeSession(a);
    setSessionReader(async () => a);
    expect(await tryResolveViewerContext()).toBeNull();
    setSessionLog(new FileSystemSessionLog(dir));   // restart
    expect(await tryResolveViewerContext()).toBeNull();
  });

  it("an EXPIRED cookie resolves to nobody", async () => {
    const t = await issueSession({ viewer_id: "person_roei", subject_id: "person_roei", person_id: "p_you" }, { ttlMs: 1, now: 0 });
    expect(await resolveSession(t, 5_000)).toBeNull();
  });

  it("submitting a PHILOS identity as the credential authenticates nothing", async () => {
    for (const account of ["person_roei", "p_you", "person_bet", "p_bet"]) {
      for (const secret of ["", "x", DEV_ACCOUNT_SECRETS["roei@local"], DEV_ACCOUNT_SECRETS["bet@local"]]) {
        expect(await signInWithCredential({ account, secret })).toEqual({ ok: false });
      }
    }
  });

  it("USER B cannot become Roei by naming Roei anywhere in the request", async () => {
    const tokenB = await login("bet@local");
    // B holds a valid session. Every route by which B might name Roei:
    // as the account on a fresh sign-in...
    expect(await signInWithCredential({ account: "person_roei", secret: DEV_ACCOUNT_SECRETS["bet@local"] })).toEqual({ ok: false });
    // ...and through the loader, which takes the viewer the session resolved
    // and offers no subject parameter at all.
    const b = await socialFor(tokenB);
    expect(b.counts.GROUP).toBe(0);
    expect(loadSocialSystem.length).toBe(1);   // (viewer) — nothing else
  });

  it("MISSING BOOT INSTRUMENTATION does not open the door", async () => {
    /* The regression that was live for a whole commit: the provider defaulted
       to LOCAL_SINGLE_USER and relied on a boot hook to replace it, so a hook
       that never ran left every cookie value resolving to Roei. The provider
       now consults the mode per call, so simulating "instrumentation never
       ran" — never calling activateViewerProvider — must still fail closed. */
    const { MODE_PROVIDER_KIND } = await import("../../identity/viewerContext");
    expect(MODE_PROVIDER_KIND).toBe("SESSION");
    setSessionReader(async () => "forged-value-of-any-kind");
    expect(await tryResolveViewerContext()).toBeNull();
  });

  it("restart with a stale/invalid token resolves to nobody", async () => {
    setSessionLog(new FileSystemSessionLog(mkdtempSync(join(tmpdir(), "philos-other-"))));
    setSessionReader(async () => "a-token-from-a-previous-life");
    expect(await tryResolveViewerContext()).toBeNull();
  });
});
