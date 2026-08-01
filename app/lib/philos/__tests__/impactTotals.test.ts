/**
 * Partial verification is its own state, never a weaker `verified`.
 *
 * The failure mode being prevented: a "Verified Impact" figure that quietly
 * includes claims only partly supported. That makes the number bigger and the
 * truth table wrong. Philos does not turn doubt into fact to improve a statistic.
 *
 * So partial impact must be (a) fully visible and (b) absent from verified
 * totals — both, at once. These tests pin exactly that pair.
 */

import { describe, expect, it } from "vitest";

import type { PhilosEvent, VerificationMethod, VerificationResult } from "../events";
import { projectValueGroup, type ValueGroupView } from "../projectValueGroup";
import { GROUP_ID, SEED_TODAY, VALUE_GROUP_EVENTS } from "../valueGroupLog";

const IMPACT_EVENT = "e070";

const REPORTED_ONLY: PhilosEvent[] = VALUE_GROUP_EVENTS.filter(
  (e) => e.event_type !== "impact.verified",
);

function verification(
  id: string,
  result: VerificationResult,
  opts: { method?: VerificationMethod; fraction?: number; at?: string } = {},
): PhilosEvent {
  return {
    event_id: id,
    actor_id: "p_dana",
    entity_type: "impact",
    entity_id: "imp_elder_support_july",
    event_type: "impact.verified",
    value_tags: ["אחריות"],
    timestamp: opts.at ?? "2026-08-01T12:00:00+03:00",
    visibility: "public",
    payload: {
      target_impact_event_id: IMPACT_EVENT,
      verification_method: opts.method ?? "site_visit",
      result,
      ...(opts.fraction === undefined ? {} : { verified_fraction: opts.fraction }),
    },
    evidence: [`ev:${id}`],
  };
}

const view = (events: readonly PhilosEvent[]): ValueGroupView => {
  const v = projectValueGroup(events, GROUP_ID, SEED_TODAY);
  if (!v) throw new Error("projection returned null");
  return v;
};

const withResult = (r: VerificationResult, o?: { method?: VerificationMethod; fraction?: number }) =>
  view([...REPORTED_ONLY, verification("v1", r, o)]);

// ── 1. verified is strictly result === "verified" ────────────────────────────

describe("verified flag", () => {
  it("is true only for a full verification", () => {
    expect(withResult("verified").impact[0].verified).toBe(true);
  });

  it.each(["partially_verified", "rejected", "inconclusive"] as const)(
    "is false for %s",
    (r) => {
      expect(withResult(r).impact[0].verified).toBe(false);
    },
  );

  it("is false even for a 'verified' result reached only by inference", () => {
    const i = withResult("verified", { method: "system_inference" }).impact[0];
    expect(i.verified).toBe(false);
    expect(i.verification_level).toBe("inferred");
  });
});

// ── 2. partial stays visible ─────────────────────────────────────────────────

describe("partially verified impact remains visible", () => {
  const v = withResult("partially_verified");
  const i = v.impact[0];

  it("is still present in the impact list", () => {
    expect(v.impact).toHaveLength(1);
    expect(i.statement).not.toBe("");
    expect(i.people_affected).toBe(10);
  });

  it("declares its own level rather than hiding behind a false boolean", () => {
    expect(i.verification_level).toBe("partial");
    expect(i.verification?.result).toBe("partially_verified");
  });

  it("names the verifier and the moment, exactly as a full verification does", () => {
    expect(i.verification?.verifier_name).toBeTruthy();
    expect(i.verification?.verified_at).toBe("2026-08-01T12:00:00+03:00");
  });

  it("keeps its verification evidence", () => {
    expect(i.evidence).toContain("ev:v1");
  });
});

// ── 3 + 4. separate buckets, no bleed into verified ──────────────────────────

describe("impact totals are counted per level", () => {
  it("puts a partial impact in the partial bucket and NOT in verified", () => {
    const t = withResult("partially_verified").impact_totals;
    expect(t.partial.count).toBe(1);
    expect(t.partial.people_affected).toBe(10);
    expect(t.verified.count).toBe(0);
    expect(t.verified.people_affected).toBe(0);
  });

  it.each([
    ["verified", "verified"],
    ["partially_verified", "partial"],
    ["rejected", "rejected"],
    ["inconclusive", "inconclusive"],
  ] as const)("routes %s into the %s bucket only", (result, bucket) => {
    const t = withResult(result).impact_totals;
    expect(t[bucket].count).toBe(1);
    const others = (Object.keys(t) as (keyof typeof t)[]).filter((k) => k !== bucket);
    for (const k of others) expect(t[k].count).toBe(0);
  });

  it("counts an unchecked claim as unverified, not as anything else", () => {
    const t = view(REPORTED_ONLY).impact_totals;
    expect(t.unverified.count).toBe(1);
    expect(t.verified.count).toBe(0);
    expect(t.partial.count).toBe(0);
  });

  it("never sums across levels — rejected resources stay out of verified", () => {
    const t = withResult("rejected").impact_totals;
    expect(t.rejected.resources_invested).toBe(5000);
    expect(t.verified.resources_invested).toBe(0);
  });

  it("the seed log's fully-verified impact lands only in verified", () => {
    const t = view(VALUE_GROUP_EVENTS).impact_totals;
    expect(t.verified.count).toBe(1);
    expect(t.partial.count).toBe(0);
    expect(t.rejected.count).toBe(0);
    expect(t.inconclusive.count).toBe(0);
  });
});

// ── 5. verified_fraction is explicit only ────────────────────────────────────

describe("verified_fraction", () => {
  it("is undefined when the verifier did not state one", () => {
    const i = withResult("partially_verified").impact[0];
    expect(i.verified_fraction).toBeUndefined();
    expect(i.verification?.verified_fraction).toBeUndefined();
  });

  it("is surfaced verbatim when stated", () => {
    const i = withResult("partially_verified", { fraction: 0.6 }).impact[0];
    expect(i.verified_fraction).toBe(0.6);
    expect(i.verification?.verified_fraction).toBe(0.6);
  });

  it("is never manufactured from the level — partial does not imply 0.5", () => {
    const i = withResult("partially_verified").impact[0];
    expect(i.verified_fraction).not.toBe(0.5);
    expect(i.verified_fraction).toBeUndefined();
  });

  it("does not turn a partial into a verified, however high the fraction", () => {
    const i = withResult("partially_verified", { fraction: 0.99 }).impact[0];
    expect(i.verified).toBe(false);
    expect(i.verification_level).toBe("partial");
  });

  it("a stated fraction does not move any people into the verified bucket", () => {
    const t = withResult("partially_verified", { fraction: 0.6 }).impact_totals;
    expect(t.verified.people_affected).toBe(0);
    expect(t.partial.people_affected).toBe(10);
  });
});
