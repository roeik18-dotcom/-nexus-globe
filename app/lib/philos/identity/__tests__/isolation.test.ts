import { describe, expect, it } from "vitest";

import { mayReadSubject, LOCAL_SINGLE_USER, resolveViewerContext, setViewerProvider, type ViewerContext } from "../viewerContext";
import { USER_A, USER_B } from "./viewerFixtures";
import { buildSocialChronology, type ChronoEntry } from "../../social/socialChronology";
import { projectSocialSystem } from "../../social/socialSystemProjection";

/* FIXTURES ONLY. Constructed in memory and discarded — this file writes no
   record to .philos-canon-data. */
const A: ViewerContext = { viewer_id: "person_a", subject_id: "person_a", person_id: "p_a", source: "LOCAL_SINGLE_USER" };
const B: ViewerContext = { viewer_id: "person_b", subject_id: "person_b", person_id: "p_b", source: "LOCAL_SINGLE_USER" };

const chron = (over: Partial<ChronoEntry>): ChronoEntry => ({
  record_id: "r", layer: "CANON", kind: "need", at: "2026-08-20T10:00:00+03:00",
  label: "x", scopes: ["GROUP"], references: [], verification: "CLAIMED",
  provenance: "REAL", ...over,
});

describe("ISOLATION — read authority", () => {
  it("a viewer may read their own records", () => {
    expect(mayReadSubject(A, "person_a")).toBe(true);
    expect(mayReadSubject(A, "p_a")).toBe(true);
  });

  it("B cannot read A private records", () => {
    expect(mayReadSubject(B, "person_a")).toBe(false);
    expect(mayReadSubject(B, "p_a")).toBe(false);
  });

  it("A cannot read B private records — isolation is symmetric", () => {
    expect(mayReadSubject(A, "person_b")).toBe(false);
  });

  it("an absent or empty subject is never readable — no bypass", () => {
    expect(mayReadSubject(A, undefined)).toBe(false);
    expect(mayReadSubject(A, "")).toBe(false);
  });
});

describe("ISOLATION — chronology carries ownership so it CAN be filtered", () => {
  it("a personal record names its owner", () => {
    const built = buildSocialChronology({
      events: [], offers: [], actions: [], effects: [], observations: [],
      needs: [{ need_id: "need_a", desired_change: "x", recorded_at: "2026-08-20T10:00:00+03:00", subject: "person_a" }],
    });
    expect(built[0].owner_subject).toBe("person_a");
  });

  it("B chronology contains no A-private record", () => {
    const all = [chron({ record_id: "a1", owner_subject: "person_a" }), chron({ record_id: "b1", owner_subject: "person_b" })];
    expect(all.filter((e) => mayReadSubject(B, e.owner_subject)).map((e) => e.record_id)).toEqual(["b1"]);
  });

  it("an UNOWNED group record is nobody's personal data", () => {
    const g = chron({ record_id: "g1", kind: "group.opened", owner_group: "group_a" });
    expect(g.owner_subject).toBeUndefined();
    expect(mayReadSubject(A, g.owner_subject)).toBe(false);
    expect(mayReadSubject(B, g.owner_subject)).toBe(false);
    expect(g.owner_group).toBe("group_a");
  });

  it("B analysis is computed over B records only", () => {
    const all = [
      chron({ record_id: "a1", owner_subject: "person_a", kind: "effect", verification: "VERIFIED" }),
      chron({ record_id: "b1", owner_subject: "person_b", kind: "need" }),
    ];
    const forB = all.filter((e) => mayReadSubject(B, e.owner_subject));
    const objects = projectSocialSystem({ chronology: forB, needGroups: new Map() });
    expect(objects).toHaveLength(1);
    expect(objects[0].record_id).toBe("b1");
    expect(objects.some((o) => o.record_id === "a1")).toBe(false);
  });

  it("B does not acquire A-private relations through a reference", () => {
    const all = [
      chron({ record_id: "a_action", owner_subject: "person_a", kind: "action" }),
      chron({ record_id: "b_effect", owner_subject: "person_b", kind: "effect", references: ["a_action"] }),
    ];
    const forB = all.filter((e) => mayReadSubject(B, e.owner_subject));
    const objects = projectSocialSystem({ chronology: forB, needGroups: new Map() });
    expect(objects[0].source_record_ids).toEqual(["a_action"]);
    expect(objects.map((o) => o.record_id)).not.toContain("a_action");
  });
});

describe("ISOLATION — values and membership do not transfer", () => {
  it("B does not inherit A Personal Value", () => {
    const values = [{ scope: "PERSONAL", holder_id: "person_a" }, { scope: "PERSONAL", holder_id: "person_b" }];
    const forB = values.filter((v) => mayReadSubject(B, v.holder_id));
    expect(forB.map((v) => v.holder_id)).toEqual(["person_b"]);
  });

  it("B does not inherit A membership — membership is never global", () => {
    const memberships = [{ person: "p_a", group: "group_a" }, { person: "p_b", group: "group_b" }];
    const bGroups = new Set(memberships.filter((m) => m.person === B.person_id).map((m) => m.group));
    expect([...bGroups]).toEqual(["group_b"]);
    expect(bGroups.has("group_a")).toBe(false);
  });

  it("a GROUP value is shared with its members WITHOUT duplicating truth", () => {
    const gv = { scope: "GROUP", holder_id: "group_shared", value_id: "v1" };
    const aGroups = new Set(["group_shared"]), bGroups = new Set(["group_shared"]);
    expect(aGroups.has(gv.holder_id) && bGroups.has(gv.holder_id)).toBe(true);
    expect(gv.value_id).toBe("v1");
  });
});

describe("ISOLATION — the client cannot choose who is acting", () => {
  it("the viewer comes from the provider, never an argument", async () => {
    setViewerProvider({ kind: "LOCAL_SINGLE_USER", async resolve() { return B; } });
    expect((await resolveViewerContext()).subject_id).toBe("person_b");
    setViewerProvider(LOCAL_SINGLE_USER);
  });

  it("an unresolvable viewer THROWS rather than defaulting to somebody", async () => {
    setViewerProvider({ kind: "SESSION", async resolve() { return null; } });
    await expect(resolveViewerContext()).rejects.toThrow(/refusing to act without an identity/);
    setViewerProvider(LOCAL_SINGLE_USER);
  });

  it("resolveViewerContext takes NO parameters — impersonation has no channel", () => {
    expect(resolveViewerContext.length).toBe(0);
  });
});

/* ──────────────────────────────────────────────────────────────────────────
   END-TO-END SCOPING THROUGH THE LOADER
   ──────────────────────────────────────────────────────────────────────────
   The suite above proves `mayReadSubject` is correct, and it was — while
   `loadSocialSystem` computed `visibleNeeds` / `visibleOffers` /
   `visibleActions` / `visibleEffects` and then passed the UNFILTERED arrays
   into the chronology. Observations were not filtered at all. Every unit test
   here passed throughout, because none of them ran the loader.

   Scoping that is computed but not applied is worse than no scoping: it reads
   as done. These assert the OUTPUT of the real loader, which is the only thing
   a second user actually meets. */
describe("ISOLATION — the real loader, not the helper it calls", () => {
  it("B, who owns nothing, gets an EMPTY social projection — not A's", async () => {
    const { loadSocialSystem } = await import("../../social/loadSocialSystem");
    const b = await loadSocialSystem(USER_B);
    for (const entry of b.chronology) {
      expect(entry.owner_subject === undefined || entry.owner_subject === USER_B.subject_id).toBe(true);
      expect(entry.owner_subject).not.toBe(USER_A.subject_id);
    }
    expect(b.totals.needs).toBe(0);
    expect(b.totals.actions).toBe(0);
    expect(b.totals.effects).toBe(0);
  });

  it("B inherits none of A's scale counts", async () => {
    const { loadSocialSystem } = await import("../../social/loadSocialSystem");
    const [a, b] = await Promise.all([loadSocialSystem(USER_A), loadSocialSystem(USER_B)]);
    expect(b.counts.GROUP).toBeLessThan(a.counts.GROUP);
    expect(b.counts.NETWORK).toBe(0);
    expect(b.counts.SYSTEM).toBe(0);
  });

  it("B inherits no PERSONAL value and no membership of A's group", async () => {
    const { loadSocialSystem } = await import("../../social/loadSocialSystem");
    const b = await loadSocialSystem(USER_B);
    expect(b.values.personal).toBeNull();
    expect(b.values.all.every((v) => v.holder_id !== USER_A.subject_id)).toBe(true);
  });

  it("A's own projection still contains A's records — scoping is not a blanket empty", async () => {
    const { loadSocialSystem } = await import("../../social/loadSocialSystem");
    const a = await loadSocialSystem(USER_A);
    expect(a.counts.GROUP).toBeGreaterThan(0);
    expect(a.totals.needs).toBeGreaterThan(0);
  });

  it("NO record owned by anyone other than the viewer survives into A's chronology", async () => {
    const { loadSocialSystem } = await import("../../social/loadSocialSystem");
    const a = await loadSocialSystem(USER_A);
    const foreign = a.chronology.filter(
      (e) => e.owner_subject !== undefined
        && e.owner_subject !== USER_A.subject_id
        && e.owner_subject !== USER_A.person_id,
    );
    expect(foreign.map((e) => `${e.kind}:${e.owner_subject}`)).toEqual([]);
  });
});
