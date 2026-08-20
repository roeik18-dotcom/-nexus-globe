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
import { resolveViewerContext, setViewerProvider, LOCAL_SINGLE_USER } from "../viewerContext";
import { SESSION_VIEWER, setSessionReader, registeredViewerIds } from "../sessionViewer";
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

describe("TWO VIEWERS — the session seam resolves two distinct people", () => {
  it("knows exactly the registered sessions", () => {
    expect(registeredViewerIds().sort()).toEqual(["sess_a", "sess_b"]);
  });

  it("two different session ids resolve to two different viewers", async () => {
    setViewerProvider(SESSION_VIEWER);
    try {
      setSessionReader(async () => "sess_a");
      const a = await resolveViewerContext();
      setSessionReader(async () => "sess_b");
      const b = await resolveViewerContext();
      expect(a.subject_id).toBe("person_roei");
      expect(b.subject_id).toBe("person_bet");
      expect(a.subject_id).not.toBe(b.subject_id);
      expect(b.source).toBe("SESSION");
    } finally {
      setViewerProvider(LOCAL_SINGLE_USER);
    }
  });

  it("an UNKNOWN session resolves to nobody — it never falls back to a person", async () => {
    setViewerProvider(SESSION_VIEWER);
    try {
      setSessionReader(async () => "sess_forged");
      await expect(resolveViewerContext()).rejects.toThrow(/refusing to act without an identity/);
      setSessionReader(async () => undefined);
      await expect(resolveViewerContext()).rejects.toThrow(/refusing to act without an identity/);
    } finally {
      setViewerProvider(LOCAL_SINGLE_USER);
    }
  });

  it("the client presents a SESSION, never a subject — resolve() takes no argument", () => {
    expect(SESSION_VIEWER.resolve.length).toBe(0);
    expect(resolveViewerContext.length).toBe(0);
  });
});
