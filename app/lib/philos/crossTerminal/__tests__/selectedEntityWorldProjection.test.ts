/**
 * The cross-terminal projection's contract: ONE object, THREE terminals, and
 * an explicit record of every place two stores disagree.
 */
import { describe, it, expect } from "vitest";
import {
  buildSelectedEntityWorldProjection,
  type ProjectionInput,
} from "../selectedEntityWorldProjection";
import type { OperationalGroupProfile } from "../../valueSystem/operationalGroup";
import type { GroupOperationalState } from "../../community/groupOperationalState";
import type { SystemEvidenceResult } from "../../world/systemEvidenceProjection";

const sysEv = (external = 0): SystemEvidenceResult => ({
  systemEvidence: new Map(),
  rejections: [],
  unresolvedCandidates: [],
  counts: { evidence_records: 3, real: 3, derived: 0, demo: 0, external_verified: external, system_eligible: 0 },
});

const baseView = () => ({
  group_id: "g_real", name: "אחריות קהילתית", central_value: "אחריות", goal: "", region: "תל אביב",
  visibility: "public", status: "active", opened_at: "2026-07-18",
  founder: { person_id: "p_you", display_name: "" }, creation_reason: "", leaders: [],
  members: Array.from({ length: 9 }, (_, i) => ({ person_id: `p${i}`, display_name: `m${i}` })),
  today: [],
  /* The budget's OWN provenance names the three money-moving events —
     `resource_delta.kind === "money"`, amount !== 0 — which is the set
     `budgetTransactionCount` must report. Allocations/transfers below are
     FUNDING DECISIONS (intents) and deliberately a different number. */
  budget: { available: 13400, currency: "ILS", received: 18400, spent: 5000, committed: 0,
    provenance: { source_events: ["e030", "e031", "e051"], sample_size: 3,
      verification_status: "evidence", time_range: ["2026-07-18", "2026-08-01"] } },
  allocations: [{}, {}], transfers: [{}, {}],
  impact: [], impact_totals: {}, event_count: 42,
}) as unknown as OperationalGroupProfile["view"];

const profile = (over: Partial<OperationalGroupProfile> = {}): OperationalGroupProfile => ({
  group_id: "g_real", name: "אחריות קהילתית", provenance: "REAL",
  view: baseView(),
  leading_family: { family_ref: "F03", label: "אחריות, זכויות וחובות", via_base_value: "BV05 אחריות" },
  general_values: [], members: [], supporters: "UNKNOWN",
  resolution: {} as OperationalGroupProfile["resolution"],
  member_needs: [], member_offers: [], capabilities: "UNKNOWN",
  linked_actions: [], effect_claims: 1, verified_effects: 1,
  evidence_statements: ["10 קשישים"], learnings: [],
  capital_flow: [],
  /* Six real `member.joined` events against nine affiliated members: the
     founder and two appointed leaders never emitted one. */
  membership_over_time: Array.from({ length: 6 }, (_, i) => ({ date: `2026-07-2${i}`, count: i + 1 })),
  trend: "",
  quality: { status: "PARTIAL", note: "" }, tensions: [], trace: [],
  ...over,
});

const input = (over: Partial<ProjectionInput> = {}): ProjectionInput => ({
  profile: profile(), state: null, systemEvidence: sysEv(),
  systemEligibleRecords: 0, observedWorldEvents: 0,
  systemZeroReason: "NO_EVIDENCE_RECORD",
  linkedNeedIds: [], viaNeedActionIds: [], realizedMatchIds: [], groupEffects: [], groupEvidence: [],
  ...over,
});

const EFFECT = { effect_id: "imp_elder_support_july", status: "VERIFIED", provenance: "REAL" } as const;
const EVIDENCE = { evidence_id: "ev_imp_elder", effect_id: "imp_elder_support_july", level: "verified", provenance: "REAL" } as const;

describe("SelectedEntityWorldProjection", () => {
  it("joins on the canonical group id, never the display label", () => {
    const p = buildSelectedEntityWorldProjection(input())!;
    expect(p.groupId).toBe("g_real");
    expect(p.groupName).toBe("אחריות קהילתית");
  });

  it("publishes the acceptance figures the three terminals must agree on", () => {
    const p = buildSelectedEntityWorldProjection(input({
      groupEffects: [EFFECT], groupEvidence: [EVIDENCE],
    }))!;
    expect(p.memberCount).toBe(9);
    expect(p.membershipHistoryCount).toBe(6);
    expect(p.budget).toMatchObject({ available: 13400, currency: "ILS" });
    /* THE CORRECTED FIGURE. This used to assert `moneyMovements === 4`, which
       encoded the defect: allocations+transfers counts INTENTS, double counts
       an executed allocation against its own transfer, and omits both inbound
       receipts. The movement count is the budget's own money-event set. */
    expect(p.budgetTransactionCount).toBe(3);
    expect(p.budgetTransactionIds).toEqual(["e030", "e031", "e051"]);
    /* Kept, under a name that cannot be read as money having moved. */
    expect(p.fundingDecisionCount).toBe(4);
    expect(p.effects).toBe(1);
    expect(p.evidence).toBe(1);
  });

  it("counts evidence that REFERENCES an effect, never evidence merely adjacent", () => {
    const adjacent = buildSelectedEntityWorldProjection(input({
      groupEffects: [EFFECT],
      groupEvidence: [{ ...EVIDENCE, effect_id: "imp_someone_elses" }],
    }))!;
    expect(adjacent.evidence).toBe(0);
    const c = adjacent.chain.find((x) => x.key === "evidence")!;
    expect(c.absence).toBe("NO_CANONICAL_LINK");
    expect(c.because).toContain("סמיכות אינה תמיכה");
  });

  it("separates a canonical need↔group join from a member merely owning a need", () => {
    const need = { need: { need_id: "need_x" } } as unknown as OperationalGroupProfile["member_needs"][number];
    const joined = buildSelectedEntityWorldProjection(input({
      profile: profile({ member_needs: [need] }), linkedNeedIds: ["need_x"],
    }))!;
    expect(joined.needs).toBe(1);
    expect(joined.chain.find((c) => c.key === "need")!.status).toBe("REAL");

    const notJoined = buildSelectedEntityWorldProjection(input({
      profile: profile({ member_needs: [need] }), linkedNeedIds: [],
    }))!;
    expect(notJoined.needs).toBe(0);
    const cell = notJoined.chain.find((c) => c.key === "need")!;
    expect(cell.status).toBe("PROJECTED");
    expect(cell.absence).toBe("NO_CANONICAL_LINK");
    const reading = cell.readings!.find((r) => r.join === "MEMBERSHIP_ONLY")!;
    expect(reading.count).toBe(1);
  });

  it("never reports a resource as canonically joined — no offer↔group store exists", () => {
    const offer = { offer: { offer_id: "offer_x" } } as unknown as OperationalGroupProfile["member_offers"][number];
    const p = buildSelectedEntityWorldProjection(input({ profile: profile({ member_offers: [offer] }) }))!;
    expect(p.resources).toBe(0);
    const r = p.chain.find((c) => c.key === "need")!.readings!.find((x) => x.label.startsWith("משאב"))!;
    expect(r.join).toBe("MEMBERSHIP_ONLY");
    expect(r.count).toBe(1);
  });

  it("calls a failed SYSTEM gate NOT_QUALIFIED, never missing", () => {
    const p = buildSelectedEntityWorldProjection(input())!;
    expect(p.systemEligibility).toBe("NOT_QUALIFIED");
    const c = p.chain.find((x) => x.key === "system")!;
    expect(c.absence).toBe("NOT_QUALIFIED");
    expect(c.gate_reason).toBe("NO_EVIDENCE_RECORD");
    expect(c.because).toContain("הישות קיימת ואמיתית");
  });

  it("keeps world relevance, external evidence and world event as three states", () => {
    const p = buildSelectedEntityWorldProjection(input())!;
    expect(p.chain.find((c) => c.key === "relevance")!.absence).toBe("UNCONNECTED");
    expect(p.chain.find((c) => c.key === "external")!.absence).toBe("NOT_OBSERVED");
    expect(p.chain.find((c) => c.key === "system")!.absence).toBe("NOT_QUALIFIED");
  });

  it("never reports an administrative resolution as a plottable coordinate", () => {
    const p = buildSelectedEntityWorldProjection(input())!;
    expect(p.plottable).toBe(false);
    const c = p.chain.find((x) => x.key === "location")!;
    expect(c.absence).toBe("NO_COORDINATE");
    expect(c.provenance).toBe("DERIVED");
    expect(c.status).toBe("PROJECTED");
    expect(c.value).toContain("ISR");
  });

  it("gives every cell a provenance and a record list", () => {
    const p = buildSelectedEntityWorldProjection(input({
      groupEffects: [EFFECT], groupEvidence: [EVIDENCE],
    }))!;
    for (const c of p.chain) {
      expect(c.provenance).toBeTruthy();
      expect(Array.isArray(c.record_ids)).toBe(true);
      if (c.status !== "REAL") expect(c.absence ?? c.status).toBeTruthy();
    }
    expect(p.chain.find((c) => c.key === "evidence")!.record_ids).toEqual(["ev_imp_elder"]);
  });

  it("keeps a green GROUP effect from turning SYSTEM green", () => {
    const p = buildSelectedEntityWorldProjection(input({ groupEffects: [EFFECT], groupEvidence: [EVIDENCE] }))!;
    expect(p.chain.find((c) => c.key === "effect")!.status).toBe("REAL");
    expect(p.chain.find((c) => c.key === "system")!.status).toBe("MISSING");
    expect(p.systemEligibility).toBe("NOT_QUALIFIED");
  });

  it("keeps a white SYSTEM cell from erasing the real green group state", () => {
    const p = buildSelectedEntityWorldProjection(input())!;
    expect(p.chain.find((c) => c.key === "group")!.status).toBe("REAL");
    expect(p.chain.find((c) => c.key === "members")!.value).toBe("9");
  });

  it("never presents an action's inputs as a canonical Match record", () => {
    /* REGRESSION GATE. `matchPermit.ts`: match history is deliberately not
       persisted and a permit is "not a record. Nothing here is written to any
       store." An action consuming a need and an offer therefore proves a match
       was REALIZED, never that a canonical Match object existed first. If this
       test ever goes green on status "REAL", a record type the system
       deliberately does not have has been invented in the UI. */
    const p = buildSelectedEntityWorldProjection(input({ realizedMatchIds: ["action_x"] }))!;
    const c = p.chain.find((x) => x.key === "match")!;
    expect(c.status).toBe("PROJECTED");
    expect(c.status).not.toBe("REAL");
    expect(c.provenance).toBe("DERIVED");
    expect(c.because).toContain("REALIZED_MATCH");
    expect(c.because).toContain("DERIVED_FROM_ACTION_INPUTS");
    expect(c.record_ids).toEqual(["action_x"]);
  });

  it("keeps a recorded MATCH_* event canonical and green, unlike the derivation", () => {
    const state = {
      group_id: "g_real", roles: [], history: [{}], needs: [], resources: [],
      matches: [{ match_id: "m1" }], actions: [], effects: [], evidence: [], tensions: [],
      members: [], budget: null, value_mappings: [], unrecognised: [],
      channels: { members: "MEASURED", budget: "NO_EVENTS", needs: "NO_EVENTS", resources: "NO_EVENTS",
        matches: "MEASURED", actions: "NO_EVENTS", effects: "NO_EVENTS", evidence: "NO_EVENTS",
        tensions: "NO_EVENTS", value_mappings: "NO_EVENTS" },
      counts: { events: 1, real: 1, derived: 0, demo: 0, imported: 0 },
    } as unknown as GroupOperationalState;
    const p = buildSelectedEntityWorldProjection(input({ state }))!;
    expect(p.chain.find((c) => c.key === "match")!.status).toBe("REAL");
  });

  it("joins an action through its own declared inputs, not through membership", () => {
    /* `action.inputs ∋ need_id` where `need_group_link(need_id) = group_id`.
       Every hop is an id on a stored record. The bridge-only reading missed
       this and reported an empty channel while a real action named a real
       need of this group. */
    const p = buildSelectedEntityWorldProjection(input({ viaNeedActionIds: ["action_x"] }))!;
    expect(p.actions).toBe(1);
    const c = p.chain.find((x) => x.key === "action")!;
    expect(c.status).toBe("REAL");
    expect(c.record_ids).toEqual(["action_x"]);
  });

  it("counts an action reachable two ways once, never twice", () => {
    const p = buildSelectedEntityWorldProjection(input({
      profile: profile({ linked_actions: [{ action: { action: { action_id: "act_1" } } }] as unknown as OperationalGroupProfile["linked_actions"] }),
      viaNeedActionIds: ["act_1"],
    }))!;
    expect(p.actions).toBe(1);
  });

  it("records the ACTION contradiction with both stores rather than hiding it", () => {
    const state = {
      group_id: "g_real", roles: [], history: [{}],
      needs: [], resources: [], matches: [], actions: [], effects: [], evidence: [], tensions: [],
      members: [], budget: null, value_mappings: [], unrecognised: [],
      channels: { members: "MEASURED", budget: "NO_EVENTS", needs: "NO_EVENTS", resources: "NO_EVENTS",
        matches: "NO_EVENTS", actions: "NO_EVENTS", effects: "NO_EVENTS", evidence: "NO_EVENTS",
        tensions: "NO_EVENTS", value_mappings: "NO_EVENTS" },
      counts: { events: 1, real: 1, derived: 0, demo: 0, imported: 0 },
    } as unknown as GroupOperationalState;

    const withCanon = buildSelectedEntityWorldProjection(input({
      profile: profile({ linked_actions: [{ action: { action: { action_id: "act_1" } } }] as unknown as OperationalGroupProfile["linked_actions"] }),
      state,
    }))!;

    const c = withCanon.contradictions.find((x) => x.key === "action")!;
    expect(c).toBeDefined();
    // three stores now answer: bridge, declared inputs, operational spine
            expect(c.readings.map((r) => r.value)).toEqual(["1", "0", "NO_EVENTS"]);
    expect(c.canonical).toBe("1");
  });

  it("renders MISSING at the exact chain position rather than shortening the chain", () => {
    const p = buildSelectedEntityWorldProjection(input())!;
    expect(p.chain).toHaveLength(14);
    expect(p.chain.map((c) => c.key)).toEqual([
      "value", "group", "members", "money", "need", "match", "action",
      "effect", "evidence", "tension", "location", "relevance", "system", "external",
    ]);
    expect(p.chain.find((c) => c.key === "external")!.status).toBe("MISSING");
    expect(p.chain.find((c) => c.key === "external")!.value).toBeNull();
  });

  it("resolves geography with the same resolver Globe uses, and never upgrades", () => {
    const p = buildSelectedEntityWorldProjection(input())!;
    expect(p.location.raw_label).toBe("תל אביב");
    expect(p.geoResolution).not.toBe("UNLOCATED");
    const unknown = buildSelectedEntityWorldProjection(input({
      profile: profile({ view: { ...baseView(), region: "מקום שלא קיים" } }),
    }))!;
    expect(unknown.geoResolution).toBe("UNLOCATED");
  });

  it("returns null rather than inventing a group when none resolves", () => {
    expect(buildSelectedEntityWorldProjection(input({ profile: null }))).toBeNull();
  });
});
