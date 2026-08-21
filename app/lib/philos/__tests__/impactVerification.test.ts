/**
 * impact.verified as a first-class event.
 *
 * Before this, verification was a `verification_status` field written on the
 * claim itself — so a claim appeared to verify itself, with no verifier, no
 * timestamp, no method and no evidence of the checking. §10's ladder is only
 * meaningful if the rung a claim sits on was put there by a second party.
 *
 * These tests pin the six states that separates: never checked, verified,
 * partially verified, rejected, re-verified (latest wins), and a verification
 * pointing at an impact that does not exist.
 */

import { describe, expect, it } from "vitest";

import type { PhilosEvent, VerificationMethod, VerificationResult } from "../events";
import { projectValueGroup } from "../projectValueGroup";
import { SEED_GROUP_ID, SEED_TODAY, VALUE_GROUP_EVENTS } from "../valueGroupLog";

const IMPACT_EVENT = "e070";

/** The seed log with every verification stripped — an impact only reported. */
const REPORTED_ONLY: PhilosEvent[] = VALUE_GROUP_EVENTS.filter(
  (e) => e.event_type !== "impact.verified" && e.event_type !== "verification.requested",
);

function verification(
  id: string,
  result: VerificationResult,
  opts: {
    at?: string;
    by?: string;
    method?: VerificationMethod;
    target?: string;
    notes?: string;
  } = {},
): PhilosEvent {
  return {
    event_id: id,
    actor_id: opts.by ?? "p_dana",
    entity_type: "impact",
    entity_id: "imp_elder_support_july",
    event_type: "impact.verified",
    value_tags: ["אחריות"],
    timestamp: opts.at ?? "2026-08-01T12:00:00+03:00",
    visibility: "public",
    payload: {
      target_impact_event_id: opts.target ?? IMPACT_EVENT,
      verification_method: opts.method ?? "site_visit",
      result,
      notes: opts.notes,
    },
    evidence: [`ev:${id}`],
    confidence: 0.8,
  };
}

const impactOf = (events: readonly PhilosEvent[]) => {
  const v = projectValueGroup(events, SEED_GROUP_ID, SEED_TODAY);
  if (!v) throw new Error("projection returned null");
  return v.impact[0];
};

// ── 1. recorded, never checked ───────────────────────────────────────────────

describe("recorded impact without verification", () => {
  it("stays reported and is not verified", () => {
    const i = impactOf(REPORTED_ONLY);
    expect(i.verified).toBe(false);
    expect(i.rejected).toBe(false);
    expect(i.verification).toBeNull();
    expect(i.verification_count).toBe(0);
    expect(i.verification_status).toBe("self_report");
  });

  it("still reports the claim itself — absence of checking is not absence of data", () => {
    const i = impactOf(REPORTED_ONLY);
    expect(i.people_affected).toBe(10);
    expect(i.statement).not.toBe("");
  });
});

// ── 2. verified ──────────────────────────────────────────────────────────────

describe("verified impact", () => {
  it("is verified, and names who verified it and when", () => {
    const i = impactOf([...REPORTED_ONLY, verification("v1", "verified", { by: "p_itai" })]);
    expect(i.verified).toBe(true);
    expect(i.verification?.result).toBe("verified");
    expect(i.verification?.verifier_id).toBe("p_itai");
    expect(i.verification?.verifier_name).not.toBe("p_itai"); // resolved to a name
    expect(i.verification?.verified_at).toBe("2026-08-01T12:00:00+03:00");
  });

  it("the method decides which rung of the ladder it reaches", () => {
    const community = impactOf([
      ...REPORTED_ONLY,
      verification("v1", "verified", { method: "community_attestation" }),
    ]);
    const external = impactOf([
      ...REPORTED_ONLY,
      verification("v1", "verified", { method: "external_audit" }),
    ]);
    expect(community.verification_status).toBe("community_verified");
    expect(external.verification_status).toBe("external_verified");
    expect(community.verified && external.verified).toBe(true);
  });

  it("system inference can never confer verification", () => {
    const i = impactOf([
      ...REPORTED_ONLY,
      verification("v1", "verified", { method: "system_inference" }),
    ]);
    expect(i.verification_status).toBe("system_inference");
    expect(i.verified).toBe(false);
  });

  it("carries the verification's own evidence, not only the claim's", () => {
    const i = impactOf([...REPORTED_ONLY, verification("v1", "verified")]);
    expect(i.evidence).toContain("ev:v1");
    expect(i.provenance.source_events).toEqual([IMPACT_EVENT, "v1"]);
  });
});

// ── 3. partially verified ────────────────────────────────────────────────────

describe("partially verified impact", () => {
  it("is evidence, not a verified fact", () => {
    const i = impactOf([...REPORTED_ONLY, verification("v1", "partially_verified")]);
    expect(i.verification?.result).toBe("partially_verified");
    expect(i.verification_status).toBe("evidence");
    expect(i.verified).toBe(false);
    expect(i.rejected).toBe(false);
  });

  it("still counts its verifier — partial checking is checking", () => {
    const i = impactOf([...REPORTED_ONLY, verification("v1", "partially_verified")]);
    expect(i.verified_by_count).toBe(1);
  });
});

// ── 4. rejected ──────────────────────────────────────────────────────────────

describe("rejected impact", () => {
  it("is never counted as verified", () => {
    const i = impactOf([...REPORTED_ONLY, verification("v1", "rejected")]);
    expect(i.rejected).toBe(true);
    expect(i.verified).toBe(false);
  });

  it("does not fall back to looking merely unchecked", () => {
    const i = impactOf([...REPORTED_ONLY, verification("v1", "rejected")]);
    expect(i.verification).not.toBeNull();
    expect(i.verification?.result).toBe("rejected");
    expect(i.verification_count).toBe(1);
  });

  it("a rejection does not count toward verified_by_count", () => {
    const i = impactOf([...REPORTED_ONLY, verification("v1", "rejected")]);
    expect(i.verified_by_count).toBe(0);
  });

  it("an inconclusive result is not verified and not rejected", () => {
    const i = impactOf([...REPORTED_ONLY, verification("v1", "inconclusive")]);
    expect(i.verified).toBe(false);
    expect(i.rejected).toBe(false);
    expect(i.verification?.result).toBe("inconclusive");
  });
});

// ── 5. multiple verifications — latest wins, deterministically ───────────────

describe("multiple verification events", () => {
  const early = verification("v1", "verified", { at: "2026-08-01T12:00:00+03:00" });
  const late = verification("v2", "rejected", { at: "2026-08-01T15:00:00+03:00" });

  it("resolves to the latest by timestamp, whatever the array order", () => {
    const a = impactOf([...REPORTED_ONLY, early, late]);
    const b = impactOf([...REPORTED_ONLY, late, early]);
    expect(a.verification?.event_id).toBe("v2");
    expect(a.verified).toBe(false);
    expect(a.rejected).toBe(true);
    expect(b).toEqual(a);
  });

  it("a later re-verification can restore a rejected claim", () => {
    const restored = verification("v3", "verified", { at: "2026-08-01T18:00:00+03:00" });
    const i = impactOf([...REPORTED_ONLY, early, late, restored]);
    expect(i.verification?.event_id).toBe("v3");
    expect(i.verified).toBe(true);
    expect(i.rejected).toBe(false);
  });

  it("breaks timestamp ties by event_id so the result never depends on input order", () => {
    const tie = "2026-08-01T20:00:00+03:00";
    const x = verification("vA", "verified", { at: tie });
    const y = verification("vB", "rejected", { at: tie });
    const a = impactOf([...REPORTED_ONLY, x, y]);
    const b = impactOf([...REPORTED_ONLY, y, x]);
    expect(a.verification?.event_id).toBe("vB"); // higher event_id wins the tie
    expect(b.verification?.event_id).toBe("vB");
  });

  it("counts every distinct affirming verifier, not every event", () => {
    const i = impactOf([
      ...REPORTED_ONLY,
      verification("v1", "verified", { by: "p_dana", at: "2026-08-01T12:00:00+03:00" }),
      verification("v2", "verified", { by: "p_dana", at: "2026-08-01T13:00:00+03:00" }),
      verification("v3", "verified", { by: "p_itai", at: "2026-08-01T14:00:00+03:00" }),
    ]);
    expect(i.verification_count).toBe(3);
    expect(i.verified_by_count).toBe(2);
  });
});

// ── 6. verification of an impact that does not exist ─────────────────────────

describe("verification referencing a nonexistent impact event", () => {
  const orphan = verification("v9", "verified", { target: "e999_does_not_exist" });

  it("is ignored — it cannot verify anything", () => {
    const i = impactOf([...REPORTED_ONLY, orphan]);
    expect(i.verified).toBe(false);
    expect(i.verification).toBeNull();
    expect(i.verification_count).toBe(0);
  });

  it("never leaks onto a different impact record", () => {
    const i = impactOf([...REPORTED_ONLY, orphan]);
    expect(i.provenance.source_events).toEqual([IMPACT_EVENT]);
    expect(i.evidence).not.toContain("ev:v9");
  });

  it("a malformed verification (missing target) is rejected by the type guard", () => {
    const malformed = {
      ...verification("v8", "verified"),
      payload: { verification_method: "site_visit", result: "verified" },
    } as PhilosEvent;
    const i = impactOf([...REPORTED_ONLY, malformed]);
    expect(i.verified).toBe(false);
    expect(i.verification_count).toBe(0);
  });
});

// ── the seed log itself ──────────────────────────────────────────────────────

describe("seed log", () => {
  it("reports the impact and verifies it in three separate events", () => {
    const i = impactOf(VALUE_GROUP_EVENTS);
    expect(i.reported_status).toBe("self_report");
    expect(i.verification_count).toBe(3);
    expect(i.verified_by_count).toBe(3);
    expect(i.verified).toBe(true);
    expect(i.verification?.event_id).toBe("e073");
  });
});
