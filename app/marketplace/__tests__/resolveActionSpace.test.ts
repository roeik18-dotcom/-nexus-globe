/**
 * resolveActionSpace — Marketplace's Action Space bridge. Verifies: a real,
 * never-skipped check against real providers, honest absence (never a fake
 * match), and that value dimensions are never collapsed into one score.
 */
import { describe, expect, it } from "vitest";
import { findKnownNeeds, findKnownResource, VALUE_DIMENSIONS } from "../resolveActionSpace";
import type { Provider } from "@/app/lib/provider/schema";
import type { Need } from "@/app/lib/philos/canon/need";
import { InMemoryNeedStore } from "@/app/lib/philos/canon/needStore";
import { _setNeedStore } from "@/app/lib/philos/canon/needStoreAccessor";

function provider(id: string): Provider {
  return {
    id,
    type: "Provider",
    createdAt: "2026-07-14T00:00:00.000Z",
    updatedAt: "2026-07-14T00:00:00.000Z",
    evidenceGrade: "Candidate",
    context: { label: id, description: "", domain: null, providerType: "organization", website: null },
    evidence: [],
  };
}

describe("findKnownResource", () => {
  const providers = [provider("prov_yc_001"), provider("prov_acme_002")];

  it("real, never-skipped check: a person-shaped subject finds no real provider (honest absence, not omission)", () => {
    const result = findKnownResource("person_roei", providers);
    expect(result.found).toBe(false);
    expect(result.checked_entities).toBe(2);
    if (result.found) throw new Error("unreachable");
    expect(result.reason).toContain("person_roei");
  });

  it("an undefined subject is reported as its own distinct reason, not silently treated as not-found-generic", () => {
    const result = findKnownResource(undefined, providers);
    expect(result.found).toBe(false);
    if (result.found) throw new Error("unreachable");
    expect(result.reason).toContain("no subject/actor identity");
  });

  it("a subject that DOES exact-match a real provider id is found — the check is real, not hardcoded to always fail", () => {
    const result = findKnownResource("prov_yc_001", providers);
    expect(result.found).toBe(true);
    if (!result.found) throw new Error("unreachable");
    expect(result.provider.id).toBe("prov_yc_001");
    expect(result.checked_entities).toBe(2);
  });

  it("checked_entities always reflects the real provider count, even on the empty-list edge", () => {
    expect(findKnownResource("anything", []).checked_entities).toBe(0);
  });
});

function baseNeed(overrides: Partial<Need> = {}): Need {
  return {
    need_id: "need_test_1",
    subject: "person_test_x",
    desired_change: "reduce evening workload",
    scope: { kind: "domain", domain: "E" },
    provenance: "self_reported",
    context: "evening_session",
    time: "2026-08-15T10:00:00Z",
    expiry: "2026-09-15T10:00:00Z",
    consent_scope: "visible_to_matching_engine",
    ...overrides,
  };
}

describe("findKnownNeeds (Marketplace's real Need read path, injected store — no real writes)", () => {
  it("checked: true, needs: [] for a real subject with genuinely no persisted Need", async () => {
    _setNeedStore(new InMemoryNeedStore());
    const result = await findKnownNeeds("person_test_x");
    expect(result.checked).toBe(true);
    expect(result.needs).toEqual([]);
    _setNeedStore(null);
  });

  it("finds a real persisted Need for the exact subject — the check is real end to end", async () => {
    const store = new InMemoryNeedStore([
      { need: baseNeed(), recorded_at: "2026-08-15T10:00:01Z", status: "open" },
    ]);
    _setNeedStore(store);
    const result = await findKnownNeeds("person_test_x");
    expect(result.checked).toBe(true);
    expect(result.needs).toHaveLength(1);
    expect(result.needs[0].need.need_id).toBe("need_test_1");
    _setNeedStore(null);
  });

  it("undefined subject: checked true, needs empty, no store error surfaced as a false failure", async () => {
    _setNeedStore(new InMemoryNeedStore());
    const result = await findKnownNeeds(undefined);
    expect(result).toEqual({ needs: [], checked: true });
    _setNeedStore(null);
  });
});

describe("VALUE_DIMENSIONS", () => {
  it("exposes all six requested dimensions separately, never collapsed into one score", () => {
    const labels = VALUE_DIMENSIONS.map((d) => d.label);
    expect(labels).toEqual([
      "Personal Benefit",
      "Community Reinforcement",
      "Systemic Impact",
      "Cost",
      "Risk",
      "Evidence Strength",
    ]);
  });

  it("no dimension is silently marked as computed when it isn't — each status is honest", () => {
    for (const d of VALUE_DIMENSIONS) {
      expect(["not_computed", "partially_supported"]).toContain(d.status);
      expect(d.note.length).toBeGreaterThan(0);
    }
  });
});
