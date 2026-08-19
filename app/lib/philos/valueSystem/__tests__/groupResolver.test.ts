/**
 * Value Group Resolver — operationalization acceptance (this pass's §9):
 * the Spider observation, one existing operational group, one unmatched
 * value-family case. The invariant under test everywhere: MEMBERSHIP IS
 * NEVER INFERRED FROM VALUE SIMILARITY, and no group is ever created.
 */
import { describe, expect, it } from "vitest";

import { classifyObservationText } from "../classifier";
import { resolveValueGroups, type ResolverGroupInput } from "../groupResolver";

const SPIDER_TEXT =
  "עכביש נראה שונה/מכוער ומעורר רתיעה. הרגש יכול לדחוף לפעולה פיזית של הריגה, למרות שהשכל מבין שהוא חלק מהמערכת ולא פחות חשוב רק מפני שהוא שונה. קבלת השונה היא ערך כללי. יש כאן ניגוד בין תגובה גופנית, רגשית ושכלית ובין פנימי לחיצוני.";

/** Mirrors the REAL group אחריות קהילתית's real shape (members, one
 *  transfer, one verified effect, one bridge action). */
const REAL_GROUP = (over: Partial<ResolverGroupInput> = {}): ResolverGroupInput => ({
  group_id: "grp_real", name: "אחריות קהילתית", central_value: "אחריות", provenance: "REAL",
  member_ids: ["p_you", "p_dana"],
  transfers: [{ transfer_id: "tr_1", recipient: "p_dana" }],
  effects: [{ id: "im_1", verified: true }],
  tension_ids: [],
  bridge_action_ids: ["action_1"],
  bridge_effect_ids: [],
  ...over,
});

const VIEWER = { linked: true, community_member_id: "p_you" };

describe("spider observation (unmatched value-family case)", () => {
  const c = classifyObservationText(SPIDER_TEXT);
  const r = resolveValueGroups({
    familyMatches: c.value_family_matches,
    generalValueMatches: c.general_value_matches,
    baseValueMatches: c.base_value_matches,
    groups: [REAL_GROUP()],
    viewer: VIEWER,
  });

  it("F21 joins no group → listed under unresolved_families, no group created", () => {
    expect(r.unresolved_families.map((f) => f.family_ref)).toContain("F21");
    expect(r.groups).toHaveLength(1); // only the input group — nothing minted
  });

  it("THE core repair: observation graph UNRESOLVED even though the person is a member", () => {
    // person membership must never certify observation→group relevance
    expect(r.observation_overall).toBe("UNRESOLVED");
    expect(r.groups[0].observation_state).toBe("UNRESOLVED");
    expect(r.groups[0].observation_relations).toHaveLength(0);
    // while the SUBJECT graph independently carries the real membership
    expect(r.subject_overall).toBe("MATCHED");
    expect(r.subject_group_relations.map((x) => x.relation_type)).toContain("MEMBER_OF");
  });

  it("subject-graph relations appear from REAL records only — never via value similarity", () => {
    const g = r.groups[0];
    const types = g.subject_relations.map((x) => x.relation_type);
    expect(types).toContain("MEMBER_OF");        // real member list
    expect(types).toContain("CONTRIBUTES_TO");   // real bridge action
    expect(types).not.toContain("SHARED_VALUE"); // value joins live in the observation graph
    expect(types).not.toContain("OPPOSES");      // no opposition record type exists
    for (const rel of g.subject_relations) {
      expect(rel.operational_evidence.length).toBeGreaterThan(0);
      expect(rel.provenance).not.toBe("VALUE_JOIN");
    }
  });

  it("every relation exposes group_id/family_ref/type/reason/confidence/provenance/evidence", () => {
    for (const rel of [...r.groups[0].subject_relations, ...r.groups[0].observation_relations]) {
      expect(rel.group_id).toBe("grp_real");
      expect(rel.match_reason.length).toBeGreaterThan(3);
      expect(rel.confidence).toBeGreaterThan(0);
      expect(rel.provenance).toBeTruthy();
      expect("family_ref" in rel).toBe(true);
    }
  });
});

describe("operational group case — a claim that DOES join the real group", () => {
  const c = classifyObservationText("אחריות היא ערך מרכזי בשבילי בקהילה.");
  const r = resolveValueGroups({
    familyMatches: c.value_family_matches,
    generalValueMatches: c.general_value_matches,
    baseValueMatches: c.base_value_matches,
    groups: [REAL_GROUP()],
    viewer: VIEWER,
  });

  it("observation graph MATCHED via SHARED_VALUE (labeled as value overlap, not membership) + SUPPORTS", () => {
    const g = r.groups[0];
    expect(g.observation_state).toBe("MATCHED");
    const shared = g.observation_relations.find((x) => x.relation_type === "SHARED_VALUE")!;
    expect(shared.match_reason).toContain("לא חברות");
    expect(shared.provenance).toBe("VALUE_JOIN");
    const supports = g.observation_relations.find((x) => x.relation_type === "SUPPORTS")!;
    expect(supports.operational_evidence).toContain("action_1");
    expect(r.observation_overall).toBe("MATCHED");
  });

  it("BENEFITS_FROM only for a real transfer naming the viewer — p_you got none", () => {
    expect(r.groups[0].subject_relations.map((x) => x.relation_type)).not.toContain("BENEFITS_FROM");
  });
});

describe("membership never inferred from value similarity", () => {
  const c = classifyObservationText("אחריות היא ערך מרכזי בשבילי.");
  const r = resolveValueGroups({
    familyMatches: c.value_family_matches,
    generalValueMatches: c.general_value_matches,
    baseValueMatches: c.base_value_matches,
    // viewer NOT in member list; value overlap is perfect
    groups: [REAL_GROUP({ member_ids: ["p_other"] })],
    viewer: VIEWER,
  });

  it("perfect value overlap yields SHARED_VALUE (observation graph) but NO MEMBER_OF (subject graph)", () => {
    expect(r.groups[0].observation_relations.map((x) => x.relation_type)).toContain("SHARED_VALUE");
    expect(r.groups[0].subject_relations.map((x) => x.relation_type)).not.toContain("MEMBER_OF");
  });
});

describe("DEMO / non-operational groups cap at CANDIDATE", () => {
  const c = classifyObservationText("קיימות היא ערך חשוב.");
  it("DEMO group with apparent person-evidence (fixture member list) still caps at CANDIDATE", () => {
    const r = resolveValueGroups({
      familyMatches: [], generalValueMatches: [], baseValueMatches: [],
      groups: [REAL_GROUP({ group_id: "grp_demo2", provenance: "DEMO", member_ids: ["p_you"] })],
      viewer: VIEWER,
    });
    expect(r.groups[0].subject_state).toBe("CANDIDATE");
    expect(r.groups[0].subject_relations.find((x) => x.relation_type === "MEMBER_OF")!.match_reason).toContain("DEMO");
  });

  it("DEMO group with value join → CANDIDATE, never MATCHED", () => {
    const r = resolveValueGroups({
      familyMatches: c.value_family_matches, generalValueMatches: c.general_value_matches,
      baseValueMatches: c.base_value_matches,
      groups: [REAL_GROUP({ group_id: "grp_demo", central_value: "קיימות", provenance: "DEMO", member_ids: ["m1"], bridge_action_ids: [], transfers: [], effects: [{ id: "e", verified: false }] })],
      viewer: { linked: false },
    });
    expect(r.groups[0].observation_state).toBe("CANDIDATE");
  });

  it("nothing joins → UNRESOLVED overall", () => {
    const r = resolveValueGroups({
      familyMatches: c.value_family_matches, generalValueMatches: c.general_value_matches,
      baseValueMatches: c.base_value_matches,
      groups: [REAL_GROUP({ central_value: "שכנות טובה", member_ids: ["p_other"], bridge_action_ids: [] })],
      viewer: { linked: false },
    });
    expect(r.observation_overall).toBe("UNRESOLVED");
    expect(r.subject_overall).toBe("UNRESOLVED");
    expect(r.groups[0].subject_relations).toHaveLength(0);
    expect(r.groups[0].observation_relations).toHaveLength(0);
  });
});
