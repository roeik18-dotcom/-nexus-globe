/**
 * The eleven proofs the multi-group ruling asks for. Each one is a property
 * the single-`GROUP_ID` architecture could not have satisfied.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { buildValueGroupRegistry } from "../valueGroupRegistry";
import { buildValueGroupUniverse } from "../valueGroupUniverse";
import { buildViewerGroupOverlay } from "../viewerGroupOverlay";
import { resolveSelectedGroup, withSelectedGroup, SELECTED_GROUP_PARAM } from "../selectedGroupContext";
import { buildGroupRelations } from "../groupRelations";
import { resolveValueMapping } from "../valueMapping";
import { parseValueGroupJsonl, toCanonical } from "../valueGroupIngest";
import { VALUE_GROUP_EVENTS, SEED_TODAY, SEED_GROUP_ID } from "../../valueGroupLog";
import { DEMO_COMMUNITIES } from "../../demoCommunities";
import type { ViewerContext } from "../../identity/viewerContext";

const viewerA = { person_id: "p_maya", subject_id: "person_maya" } as unknown as ViewerContext;
const viewerB = { person_id: "p_bet", subject_id: "person_bet" } as unknown as ViewerContext;

const ingested = (...rows: object[]) =>
  parseValueGroupJsonl(rows.map((r) => JSON.stringify(r)).join("\n")).records;

describe("registry cardinality — 0, 1, N", () => {
  it("supports ZERO groups without falling back to anything", () => {
    const r = buildValueGroupRegistry({});
    expect(r.entries).toHaveLength(0);
    expect(r.real_count).toBe(0);
    expect(r.demo_count).toBe(0);
    // The old architecture's failure mode: an empty input still yielding the
    // seeded group because the id was a compile-time constant.
    expect(r.byId(SEED_GROUP_ID)).toBeUndefined();
    // A universe over an empty registry still renders the full taxonomy.
    const u = buildValueGroupUniverse(r);
    expect(u.coverage.family_count).toBe(28);
    expect(u.coverage.subvalue_count).toBe(223);
    expect(u.coverage.populated_subvalue_count).toBe(0);
  });

  it("supports exactly ONE group, discovered from its own log", () => {
    const r = buildValueGroupRegistry({ events: VALUE_GROUP_EVENTS, today: SEED_TODAY });
    expect(r.entries).toHaveLength(1);
    expect(r.entries[0].group.group_id).toBe(SEED_GROUP_ID);
    expect(r.real_count).toBe(1);
  });

  it("supports MANY groups from mixed sources, each with one identity", () => {
    const r = buildValueGroupRegistry({
      events: VALUE_GROUP_EVENTS,
      demo: DEMO_COMMUNITIES,
      ingested: ingested(
        { group_id: "vg_x", name: "קבוצה X", provenance: "REAL" },
        { group_id: "vg_y", name: "קבוצה Y", provenance: "REAL" },
        { group_id: "vg_z", name: "קבוצה Z", provenance: "DEMO" },
      ),
      today: SEED_TODAY,
    });
    expect(r.entries).toHaveLength(6);
    expect(r.real_count).toBe(3);
    expect(r.demo_count).toBe(3);
    expect(new Set(r.entries.map((e) => e.group.group_id)).size).toBe(6);
  });

  it("reports a duplicate group_id as a CONFLICT rather than merging it", () => {
    const r = buildValueGroupRegistry({
      events: VALUE_GROUP_EVENTS,
      ingested: ingested({ group_id: SEED_GROUP_ID, name: "העתק", provenance: "REAL" }),
      today: SEED_TODAY,
    });
    expect(r.conflicts).toHaveLength(1);
    expect(r.conflicts[0].group_id).toBe(SEED_GROUP_ID);
    expect(r.entries).toHaveLength(1);
  });
});

describe("value mapping — sub-values are shared and plural, and stay unresolved", () => {
  it("lets TWO groups share one sub-value", () => {
    const r = buildValueGroupRegistry({
      ingested: ingested(
        { group_id: "vg_a", name: "א", provenance: "REAL", primary_subvalue_id: "SV026" },
        { group_id: "vg_b", name: "ב", provenance: "REAL", primary_subvalue_id: "SV026" },
      ),
    });
    expect(r.bySubvalue("SV026").map((e) => e.group.group_id)).toEqual(["vg_a", "vg_b"]);
    const u = buildValueGroupUniverse(r);
    const node = u.families.flatMap((f) => f.subvalues).find((s) => s.subvalue_id === "SV026");
    expect(node?.group_count).toBe(2);
  });

  it("lets ONE group reference MULTIPLE sub-values", () => {
    const r = buildValueGroupRegistry({
      ingested: ingested({
        group_id: "vg_multi", name: "רב-ערכית", provenance: "REAL",
        primary_subvalue_id: "SV026", secondary_subvalue_ids: ["SV001", "SV002"],
      }),
    });
    expect(r.bySubvalue("SV026")).toHaveLength(1);
    expect(r.bySubvalue("SV001")).toHaveLength(1);
    expect(r.bySubvalue("SV002")).toHaveLength(1);
  });

  it('keeps "אחריות" UNRESOLVED and never picks one of its four candidates', () => {
    const m = resolveValueMapping("vg_ahrayut_kehilatit", "אחריות", []);
    expect(m.status).toBe("UNRESOLVED_REVIEW_REQUIRED");
    expect(m.primary).toBeUndefined();
    expect(m.family).toBeUndefined();
    expect(m.candidates.length).toBeGreaterThanOrEqual(4);
    // The candidates are offered for a ruling, never applied.
    expect(m.candidates.every((c) => c.because !== "EXACT_STRING")).toBe(true);
    expect(m.provenance).toBe("NO_RULING");
  });

  it("resolves ONLY on a recorded ruling, and says who ruled", () => {
    const m = resolveValueMapping("vg_ahrayut_kehilatit", "אחריות", [
      { group_id: "vg_ahrayut_kehilatit", primary_subvalue_id: "SV001", decided_by: "רועי", evidence: "הכרעת בורד", recorded_at: "2026-08-21" },
    ]);
    expect(m.status).toBe("RESOLVED");
    expect(m.primary).toBe("SV001");
    expect(m.provenance).toBe("RECORDED_RULING");
    expect(m.because).toContain("רועי");
  });

  it("the seeded real group stays unresolved in the live registry", () => {
    const r = buildValueGroupRegistry({ events: VALUE_GROUP_EVENTS, today: SEED_TODAY });
    const e = r.byId(SEED_GROUP_ID)!;
    expect(e.group.central_value_label).toBe("אחריות");
    expect(e.group.value_mapping_status).toBe("UNRESOLVED_REVIEW_REQUIRED");
    expect(e.group.primary_subvalue_id).toBeUndefined();
    // Unmapped is not deleted: it is visible in the universe as unplaced.
    expect(buildValueGroupUniverse(r).unplaced.map((x) => x.group.group_id)).toContain(SEED_GROUP_ID);
  });
});

describe("universe (global) vs overlay (viewer-scoped)", () => {
  const reg = () => buildValueGroupRegistry({ events: VALUE_GROUP_EVENTS, demo: DEMO_COMMUNITIES, today: SEED_TODAY });

  it("A's membership does not leak to B, though both see the same universe", () => {
    const r = reg();
    const a = buildViewerGroupOverlay(viewerA, r, VALUE_GROUP_EVENTS);
    const b = buildViewerGroupOverlay(viewerB, r, VALUE_GROUP_EVENTS);
    expect(a.membership_count).toBeGreaterThan(0);
    expect(b.membership_count).toBe(0);
    expect(b.memberGroupIds).toEqual([]);
    expect(b.relationOf(SEED_GROUP_ID)).toBe("NONE");
    // Same global universe for both — discovery is not personalised.
    expect(a.entries.length).toBe(b.entries.length);
    expect(buildValueGroupUniverse(r).coverage.group_count).toBe(3);
  });

  it("states NONE explicitly rather than leaving a group out of B's overlay", () => {
    const r = reg();
    const b = buildViewerGroupOverlay(viewerB, r, VALUE_GROUP_EVENTS);
    expect(b.entries).toHaveLength(r.entries.length);
    expect(b.entries.every((e) => e.relation === "NONE" && e.evidence === "NO_RECORD")).toBe(true);
    expect(b.entries[0].because).toContain("אין אירוע");
  });

  it("never infers membership from a shared value", () => {
    const r = buildValueGroupRegistry({
      ingested: ingested({ group_id: "vg_same", name: "אותו ערך", provenance: "REAL", primary_subvalue_id: "SV026" }),
    });
    // The viewer has no events at all; a value match must not create a relation.
    const o = buildViewerGroupOverlay(viewerA, r, []);
    expect(o.relationOf("vg_same")).toBe("NONE");
    expect(o.membership_count).toBe(0);
  });
});

describe("selected group — inspection is a third thing", () => {
  const r = buildValueGroupRegistry({ events: VALUE_GROUP_EVENTS, demo: DEMO_COMMUNITIES, today: SEED_TODAY });

  it("lets a NON-MEMBER inspect any registry group", () => {
    const sel = resolveSelectedGroup(r, DEMO_COMMUNITIES[0].group_id);
    expect(sel.status).toBe("selected");
  });

  it("inspecting a group creates NO membership", () => {
    const sel = resolveSelectedGroup(r, SEED_GROUP_ID);
    expect(sel.status).toBe("selected");
    // B inspects A's group; B's overlay is unchanged.
    const b = buildViewerGroupOverlay(viewerB, r, VALUE_GROUP_EVENTS);
    expect(b.relationOf(SEED_GROUP_ID)).toBe("NONE");
    expect(b.membership_count).toBe(0);
  });

  it("no selection is NO_GROUP_SELECTED, never a default group", () => {
    for (const raw of [undefined, "", null, "   "]) {
      const sel = resolveSelectedGroup(r, raw);
      expect(sel.status).toBe("none");
      expect(JSON.stringify(sel)).not.toContain(SEED_GROUP_ID);
    }
  });

  it("an unknown id is refused OUT LOUD, not silently replaced", () => {
    const sel = resolveSelectedGroup(r, "vg_does_not_exist");
    expect(sel.status).toBe("unknown_group");
    expect(JSON.stringify(sel)).not.toContain(SEED_GROUP_ID);
  });

  it("persists across terminal navigation as one parameter", () => {
    const sel = resolveSelectedGroup(r, SEED_GROUP_ID);
    const hops = ["/hub/community", "/planet", "/marketplace", "/dynamics", "/hub/community"];
    for (const h of hops) {
      const href = withSelectedGroup(h, sel);
      expect(href).toContain(`${SELECTED_GROUP_PARAM}=`);
      // Round-trip: the next terminal resolves the same group from the link.
      const back = resolveSelectedGroup(r, decodeURIComponent(href.split("=")[1]));
      expect(back.status === "selected" && back.group_id).toBe(SEED_GROUP_ID);
    }
    // A query string already present is appended to, not clobbered.
    expect(withSelectedGroup("/marketplace?tab=needs", sel)).toBe(`/marketplace?tab=needs&${SELECTED_GROUP_PARAM}=${SEED_GROUP_ID}`);
  });
});

describe("resilience and relations", () => {
  it("removing the real group does not crash any layer", () => {
    const without = VALUE_GROUP_EVENTS.filter((e) => e.event_type !== "group.opened");
    const r = buildValueGroupRegistry({ events: without, today: SEED_TODAY });
    expect(r.entries).toHaveLength(0);
    expect(() => buildValueGroupUniverse(r)).not.toThrow();
    expect(() => buildViewerGroupOverlay(viewerA, r, without)).not.toThrow();
    expect(() => buildGroupRelations(r, without)).not.toThrow();
    expect(resolveSelectedGroup(r, SEED_GROUP_ID).status).toBe("unknown_group");
    expect(buildValueGroupUniverse(r).coverage.subvalue_count).toBe(223);
  });

  it("derives NO relation between groups that merely resemble each other", () => {
    const r = buildValueGroupRegistry({ events: VALUE_GROUP_EVENTS, demo: DEMO_COMMUNITIES, today: SEED_TODAY });
    // Three groups, all "active", all in Israel, all unresolved values.
    expect(buildGroupRelations(r, VALUE_GROUP_EVENTS)).toHaveLength(0);
  });

  it("DOES derive a relation the moment real shared evidence exists", () => {
    const r = buildValueGroupRegistry({
      ingested: ingested(
        { group_id: "vg_p", name: "פ", provenance: "REAL", members: [{ person_id: "p1" }, { person_id: "p2" }] },
        { group_id: "vg_q", name: "ק", provenance: "REAL", members: [{ person_id: "p2" }, { person_id: "p3" }] },
      ),
    });
    const rel = buildGroupRelations(r);
    expect(rel).toHaveLength(1);
    expect(rel[0].type).toBe("OVERLAPPING_MEMBERS");
    expect(rel[0].shared).toEqual(["p2"]);
  });
});

describe("ingestion accepts a dataset without a code change", () => {
  it("reads N groups from JSONL and reports bad lines instead of dying", () => {
    const text = [
      JSON.stringify({ group_id: "vg_1", name: "אחת", provenance: "REAL" }),
      "{ not json",
      JSON.stringify({ group_id: "vg_2", name: "שתיים", provenance: "DEMO" }),
      JSON.stringify({ name: "בלי מזהה", provenance: "REAL" }),
      JSON.stringify({ group_id: "vg_1", name: "כפולה", provenance: "REAL" }),
      JSON.stringify({ group_id: "vg_3", name: "שלוש", provenance: "MAYBE" }),
    ].join("\n");
    const res = parseValueGroupJsonl(text);
    expect(res.records.map((r) => r.group_id)).toEqual(["vg_1", "vg_2"]);
    expect(res.rejected).toHaveLength(4);
    expect(res.rejected.map((r) => r.line)).toEqual([2, 4, 5, 6]);
  });

  it("an absent field stays absent — never defaulted to 0 or \"member\"", () => {
    const c = toCanonical({ group_id: "vg_bare", name: "רזה", provenance: "REAL" });
    expect(c.members).toEqual([]);
    expect(c.budget).toBeUndefined();
    expect(c.needs).toBeUndefined();
    expect(c.offers).toBeUndefined();
    expect(c.effect_count).toBeUndefined();
    expect(c.geography).toBeUndefined();
    expect(c.status).toBe("unknown");
  });

  it("scales to a large dataset with no architectural change", () => {
    const rows = Array.from({ length: 500 }, (_, i) =>
      JSON.stringify({ group_id: `vg_${i}`, name: `קבוצה ${i}`, provenance: "REAL", primary_subvalue_id: `SV${String((i % 223) + 1).padStart(3, "0")}` }));
    const r = buildValueGroupRegistry({ ingested: parseValueGroupJsonl(rows.join("\n")).records });
    expect(r.entries).toHaveLength(500);
    const u = buildValueGroupUniverse(r);
    expect(u.coverage.populated_subvalue_count).toBe(223);
    expect(u.coverage.unplaced_group_count).toBe(0);
  });
});

describe("the architectural guarantee", () => {
  it("no production module imports a singleton group id", () => {
    const files = execSync(
      `grep -rl "SEED_GROUP_ID" app --include=*.ts --include=*.tsx || true`,
      { encoding: "utf8", cwd: process.cwd() },
    ).split("\n").filter(Boolean).filter((f) => !f.includes("__tests__"));
    const importers = files.filter((f) => /^import .*SEED_GROUP_ID/m.test(readFileSync(f, "utf8")));
    expect(importers).toEqual([]);
  });

  it("the seed id appears in production CODE in exactly one module — its own log", () => {
    // Comments naming the old constant are history, not a dependency; the
    // check is on executable lines only.
    const files = execSync(
      `grep -rl "vg_ahrayut_kehilatit" app --include=*.ts --include=*.tsx || true`,
      { encoding: "utf8", cwd: process.cwd() },
    ).split("\n").filter(Boolean).filter((f) => !f.includes("__tests__"));
    const inCode = files.filter((f) => {
      let inBlock = false;
      for (const line of readFileSync(f, "utf8").split("\n")) {
        const t = line.trim();
        const opens = t.includes("/*"), closes = t.includes("*/");
        const wasInBlock = inBlock;
        if (opens && !closes) inBlock = true;
        if (closes) inBlock = false;
        if (wasInBlock || opens || t.startsWith("//") || t.startsWith("*")) continue;
        if (t.includes("vg_ahrayut_kehilatit")) return true;
      }
      return false;
    });
    expect(inCode).toEqual(["app/lib/philos/valueGroupLog.ts"]);
  });
});
