/**
 * USER A / USER B, END TO END.
 *
 * Every assertion here runs the REAL loader. The predicate-level suite in
 * `isolation.test.ts` passed for months while `loadSocialSystem` computed its
 * scoped arrays and then handed the unfiltered ones to the chronology — a
 * correct helper called by a leaking caller. A test that never runs the thing
 * a user meets cannot see that.
 */
import { describe, expect, it } from "vitest";

import { loadSocialSystem } from "../../social/loadSocialSystem";
import { resolveGroupContext } from "../../community/groupContext";
import { loadPhilosEvents } from "@/app/lib/philos-event-store";
import { resolveViewerContext, tryResolveViewerContext, setViewerProvider, LOCAL_SINGLE_USER } from "../viewerContext";
import { SESSION_VIEWER, setSessionReader } from "../sessionViewer";
import { issueSession, resolveSession, revokeSession, setSessionRepository, type SessionRecord } from "../sessionStore";
import { providerForMode, resolveViewerMode } from "../viewerMode";
import { USER_A, USER_B } from "./viewerFixtures";

/** Roei's baseline, as ratified after the scoping ruling. 51/11 are the
 *  UNSCOPED historical counts and are deliberately NOT asserted anywhere. */
const BASELINE = { GROUP: 34, NETWORK: 10, SYSTEM: 0 } as const;

describe("TWO VIEWERS — the real loader", () => {
  it("A keeps the ratified baseline", async () => {
    const a = await loadSocialSystem(USER_A);
    expect(a.counts.GROUP).toBe(BASELINE.GROUP);
    expect(a.counts.NETWORK).toBe(BASELINE.NETWORK);
    expect(a.counts.SYSTEM).toBe(BASELINE.SYSTEM);
  });

  it("chronology is isolated in BOTH directions", async () => {
    const [a, b] = await Promise.all([loadSocialSystem(USER_A), loadSocialSystem(USER_B)]);
    const foreign = (rows: typeof a.chronology, self: typeof USER_A) =>
      rows.filter((e) => e.owner_subject !== undefined
        && e.owner_subject !== self.subject_id && e.owner_subject !== self.person_id);
    expect(foreign(a.chronology, USER_A)).toEqual([]);
    expect(foreign(b.chronology, USER_B)).toEqual([]);
    expect(b.chronology.length).toBe(0);
  });

  it("personal values are isolated — neither inherits the other's", async () => {
    const [a, b] = await Promise.all([loadSocialSystem(USER_A), loadSocialSystem(USER_B)]);
    expect(b.values.all.some((v) => v.holder_id === USER_A.subject_id)).toBe(false);
    expect(a.values.all.some((v) => v.holder_id === USER_B.subject_id)).toBe(false);
    expect(b.values.personal).toBeNull();
    expect(b.values.group).toBeNull();
  });

  it("needs / offers / actions / effects are isolated", async () => {
    const b = await loadSocialSystem(USER_B);
    expect(b.totals).toEqual({ needs: 0, offers: 0, actions: 0, effects: 0, verifiedEffects: 0 });
  });

  it("memberships and group context are isolated", async () => {
    const events = await loadPhilosEvents();
    const a = resolveGroupContext(USER_A, events);
    const b = resolveGroupContext(USER_B, events);
    expect(a.status).toBe("resolved");
    expect(b.status).toBe("none");
    // B is not handed A's group under any status.
    expect(JSON.stringify(b)).not.toContain("vg_ahrayut_kehilatit");
  });

  it("an explicit selection of a group the viewer has no relation to is REFUSED, not narrowed", async () => {
    const events = await loadPhilosEvents();
    const r = resolveGroupContext(USER_B, events, "vg_ahrayut_kehilatit");
    expect(r.status).toBe("forbidden");
  });

  it("roles are isolated — B activates none of A's", async () => {
    const b = await loadSocialSystem(USER_B);
    // Roles are derived per selected record; with no records there is nothing
    // to activate, and that is an answer rather than an empty screen.
    expect(b.objects).toEqual([]);
  });

  /* ── DEMO VISIBILITY ────────────────────────────────────────────────────
     All 25 DEMO links target `demo_*` / `dg_*` / `region_*` fixtures; not one
     names a real person or a real group. The ruling is that DEMO may live on
     explicitly labelled reference surfaces and must never enter personal
     analysis. These assert the second half. */
  it("DEMO never enters personal analysis for EITHER viewer", async () => {
    const [a, b] = await Promise.all([loadSocialSystem(USER_A), loadSocialSystem(USER_B)]);
    for (const [who, s] of [["A", a], ["B", b]] as const) {
      expect(s.chronology.filter((c) => c.provenance === "DEMO"), `${who} chronology`).toEqual([]);
      expect(s.objects.filter((o) => o.provenance === "DEMO"), `${who} objects`).toEqual([]);
      // A ValueDeclaration carries no `provenance` field — it is a declared
      // record with an authority, never a fixture tier. Asserted as the
      // absence of any demo-named holder instead of inventing a field.
      expect(s.values.all.filter((v) => /^demo_/.test(v.holder_id)), `${who} values`).toEqual([]);
    }
  });

  it("every DEMO link names only demo entities — none reaches a real person", async () => {
    const a = await loadSocialSystem(USER_A);
    const demo = a.bridgeLinks.filter((l) => l.provenance === "DEMO");
    expect(demo.length).toBe(25);
    const real = demo.filter((l) =>
      !/^(demo_|dg_|region_)/.test(l.source.canonical_id) && !/^(demo_|dg_|region_)/.test(l.target.canonical_id));
    expect(real.map((l) => `${l.source.canonical_id}->${l.target.canonical_id}`)).toEqual([]);
  });
});

describe("TWO VIEWERS — authenticated sessions", () => {
  /* Fixtures are ISSUED, not written. `issueSession` mints 32 random bytes and
     the store holds the mapping; the test never learns a token by construction
     and could not forge a second one if it tried. That is the property being
     tested, so faking it here would test nothing. */
  async function twoSessions() {
    setSessionRepository(new Map0());
    const a = await issueSession({ viewer_id: "person_roei", subject_id: "person_roei", person_id: "p_you" });
    const b = await issueSession({ viewer_id: "person_bet", subject_id: "person_bet", person_id: "p_bet" });
    return { a, b };
  }

  it("A resolves only A, B resolves only B", async () => {
    const { a, b } = await twoSessions();
    setViewerProvider(SESSION_VIEWER);
    try {
      setSessionReader(async () => a);
      expect((await resolveViewerContext()).subject_id).toBe("person_roei");
      setSessionReader(async () => b);
      expect((await resolveViewerContext()).subject_id).toBe("person_bet");
    } finally { setViewerProvider(LOCAL_SINGLE_USER); }
  });

  it("the token carries NO identity — it is not derived from the viewer", async () => {
    const { a, b } = await twoSessions();
    for (const t of [a, b]) {
      expect(t).not.toMatch(/roei|bet|person|p_you|p_bet|sess/i);
      // 32 bytes base64url
      expect(Buffer.from(t, "base64url").length).toBe(32);
    }
    expect(a).not.toBe(b);
  });

  it("an UNKNOWN token resolves to nobody", async () => {
    await twoSessions();
    setViewerProvider(SESSION_VIEWER);
    try {
      setSessionReader(async () => "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQ");
      await expect(resolveViewerContext()).rejects.toThrow(/refusing to act/);
      setSessionReader(async () => undefined);
      await expect(resolveViewerContext()).rejects.toThrow(/refusing to act/);
    } finally { setViewerProvider(LOCAL_SINGLE_USER); }
  });

  it("an EXPIRED token resolves to nobody", async () => {
    setSessionRepository(new Map0());
    const t = await issueSession({ viewer_id: "x", subject_id: "x", person_id: "px" }, { ttlMs: 1000, now: 0 });
    expect(await resolveSession(t, 999)).not.toBeNull();
    expect(await resolveSession(t, 1000)).toBeNull();
    expect(await resolveSession(t, 5000)).toBeNull();
  });

  it("a REVOKED token resolves to nobody — logout works and is idempotent", async () => {
    const { a } = await twoSessions();
    expect(await resolveSession(a)).not.toBeNull();
    await revokeSession(a);
    expect(await resolveSession(a)).toBeNull();
    await revokeSession(a);
    await revokeSession("never-existed");
    expect(await resolveSession(a)).toBeNull();
  });

  it("B's session cannot be transformed into A's", async () => {
    const { a, b } = await twoSessions();
    setViewerProvider(SESSION_VIEWER);
    try {
      // every mutation a client could attempt on its own token
      for (const forged of [b + "=", b.slice(0, -1), b.toUpperCase(), a.slice(0, 10) + b.slice(10)]) {
        setSessionReader(async () => forged);
        const r = await tryResolveViewerContext();
        expect(r?.subject_id ?? null).not.toBe("person_roei");
      }
      setSessionReader(async () => a);
      expect((await resolveViewerContext()).subject_id).toBe("person_roei");
    } finally { setViewerProvider(LOCAL_SINGLE_USER); }
  });

  it("MODE is chosen, never fallen back to — a missing env var means SESSION", () => {
    expect(resolveViewerMode({})).toBe("SESSION");
    expect(resolveViewerMode({ PHILOS_VIEWER_MODE: "" })).toBe("SESSION");
    expect(resolveViewerMode({ PHILOS_VIEWER_MODE: "production" })).toBe("SESSION");
    expect(resolveViewerMode({ PHILOS_VIEWER_MODE: "LOCAL_DEV" })).toBe("LOCAL_DEV");
  });

  it("SESSION mode never resolves the dev viewer", async () => {
    setViewerProvider(providerForMode("SESSION"));
    try {
      setSessionReader(async () => undefined);
      expect(await tryResolveViewerContext()).toBeNull();
    } finally { setViewerProvider(LOCAL_SINGLE_USER); }
  });
});

/** A SessionRepository backed by a fresh Map — one per test, so no test can
 *  see a token another test issued. */
class Map0 {
  private rows = new Map<string, SessionRecord>();
  async get(t: string) { return this.rows.get(t) ?? null; }
  async put(t: string, r: SessionRecord) { this.rows.set(t, r); }
  async delete(t: string) { this.rows.delete(t); }
  async tokens() { return [...this.rows.keys()]; }
}

/* ──────────────────────────────────────────────────────────────────────────
   USER #2 READINESS — through the ACTUAL runtime provider.
   ──────────────────────────────────────────────────────────────────────────
   Everything above either passes a fixture ViewerContext to the loader or
   tests the provider alone. This does neither: it installs SESSION_VIEWER as
   the live provider, presents a token, and lets the loader resolve the viewer
   the same way a request would. It is the only test here that would catch a
   loader which resolved identity a second way of its own.

   No production User #2 data is created. B logs in and correctly finds
   nothing, which is exactly the state a new user arrives in. */
describe("USER #2 READINESS — live provider, no fixture viewer passed", () => {
  async function sessionFor(v: { viewer_id: string; subject_id: string; person_id: string }) {
    return issueSession(v);
  }

  it("A logs in and gets A's scoped SOCIAL; B logs in and gets a separate empty one", async () => {
    setSessionRepository(new Map0());
    const tokenA = await sessionFor({ viewer_id: "person_roei", subject_id: "person_roei", person_id: "p_you" });
    const tokenB = await sessionFor({ viewer_id: "person_bet", subject_id: "person_bet", person_id: "p_bet" });
    setViewerProvider(SESSION_VIEWER);
    try {
      setSessionReader(async () => tokenA);
      const a = await loadSocialSystem(await resolveViewerContext());
      setSessionReader(async () => tokenB);
      const b = await loadSocialSystem(await resolveViewerContext());

      // A: the ratified baseline, reached through a session rather than a fixture.
      expect(a.counts).toEqual({ GROUP: 34, NETWORK: 10, SYSTEM: 0 });
      // B: a real, separate, empty social state.
      expect(b.counts).toEqual({ GROUP: 0, NETWORK: 0, SYSTEM: 0 });
      expect(b.chronology).toEqual([]);
      expect(b.values.personal).toBeNull();
      expect(b.values.group).toBeNull();

      // and nothing of A's reached B by any route.
      const aIds = new Set(a.chronology.map((e) => e.record_id));
      expect(b.chronology.filter((e) => aIds.has(e.record_id))).toEqual([]);
    } finally { setViewerProvider(LOCAL_SINGLE_USER); }
  });

  it("with no session, the loader is never reached — there is no viewer to load for", async () => {
    setSessionRepository(new Map0());
    setViewerProvider(SESSION_VIEWER);
    try {
      setSessionReader(async () => undefined);
      await expect(resolveViewerContext()).rejects.toThrow(/refusing to act without an identity/);
      expect(await tryResolveViewerContext()).toBeNull();
    } finally { setViewerProvider(LOCAL_SINGLE_USER); }
  });

  it("DEMO is absent from personal analysis for a session-resolved viewer", async () => {
    setSessionRepository(new Map0());
    const t = await sessionFor({ viewer_id: "person_roei", subject_id: "person_roei", person_id: "p_you" });
    setViewerProvider(SESSION_VIEWER);
    try {
      setSessionReader(async () => t);
      const a = await loadSocialSystem(await resolveViewerContext());
      expect(a.chronology.filter((c) => c.provenance === "DEMO")).toEqual([]);
      expect(a.objects.filter((o) => o.provenance === "DEMO")).toEqual([]);
      // registry-wide provenance is unchanged — that cell is labelled as such
      expect(a.bridgeLinks.filter((l) => l.provenance === "DEMO").length).toBe(25);
    } finally { setViewerProvider(LOCAL_SINGLE_USER); }
  });
});
