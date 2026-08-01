/**
 * verification.requested — making `under_review` a state the log carries.
 *
 * Without this event, "under review" could only be inferred from the ABSENCE of
 * a verification. Absence of checking is not evidence that checking is under
 * way, and inferring it would be the same error as deriving a verified_fraction
 * from the word "partially": a state nobody recorded, presented as fact.
 *
 * Lifecycle under test:
 *   impact.recorded → verification.requested → impact.verified
 *   reported        → under_review          → verified/partial/rejected/inconclusive
 */

import { describe, expect, it } from "vitest";

import type { PhilosEvent, VerificationResult } from "../events";
import { projectValueGroup, type ValueGroupView } from "../projectValueGroup";
import { GROUP_ID, SEED_TODAY, VALUE_GROUP_EVENTS } from "../valueGroupLog";

const IMPACT_EVENT = "e070";

/** Seed log stripped back to a bare claim — no request, no verification. */
const REPORTED_ONLY: PhilosEvent[] = VALUE_GROUP_EVENTS.filter(
  (e) => e.event_type !== "impact.verified" && e.event_type !== "verification.requested",
);

function request(
  id: string,
  opts: { at?: string; by?: string; target?: string; role?: string } = {},
): PhilosEvent {
  return {
    event_id: id,
    actor_id: opts.by ?? "p_maya",
    entity_type: "impact",
    entity_id: "imp_elder_support_july",
    event_type: "verification.requested",
    value_tags: ["אחריות"],
    timestamp: opts.at ?? "2026-08-01T09:00:00+03:00",
    visibility: "public",
    payload: {
      target_impact_event_id: opts.target ?? IMPACT_EVENT,
      reason: "נדרש אימות בלתי תלוי",
      requested_verifier_role: opts.role ?? "community",
    },
    evidence: [`req:${id}`],
  };
}

function verification(
  id: string,
  result: VerificationResult,
  at = "2026-08-01T12:00:00+03:00",
): PhilosEvent {
  return {
    event_id: id,
    actor_id: "p_dana",
    entity_type: "impact",
    entity_id: "imp_elder_support_july",
    event_type: "impact.verified",
    value_tags: ["אחריות"],
    timestamp: at,
    visibility: "public",
    payload: {
      target_impact_event_id: IMPACT_EVENT,
      verification_method: "site_visit",
      result,
    },
    evidence: [`ev:${id}`],
  };
}

const view = (events: readonly PhilosEvent[]): ValueGroupView => {
  const v = projectValueGroup(events, GROUP_ID, SEED_TODAY);
  if (!v) throw new Error("projection returned null");
  return v;
};
const impactOf = (events: readonly PhilosEvent[]) => view(events).impact[0];

// ── 1. reported only ─────────────────────────────────────────────────────────

describe("reported only", () => {
  it("is unverified, not under review — nobody asked for checking", () => {
    const i = impactOf(REPORTED_ONLY);
    expect(i.verification_level).toBe("unverified");
    expect(i.review_request).toBeNull();
    expect(i.review_request_count).toBe(0);
  });

  it("counts in the unverified bucket only", () => {
    const t = view(REPORTED_ONLY).impact_totals;
    expect(t.unverified.count).toBe(1);
    expect(t.under_review.count).toBe(0);
  });
});

// ── 2. under_review ──────────────────────────────────────────────────────────

describe("under_review", () => {
  const events = [...REPORTED_ONLY, request("r1")];

  it("is under review once a request exists and nothing has concluded it", () => {
    const i = impactOf(events);
    expect(i.verification_level).toBe("under_review");
    expect(i.verified).toBe(false);
    expect(i.rejected).toBe(false);
  });

  it("names who asked, when, why, and of which role", () => {
    const r = impactOf(events).review_request;
    expect(r?.event_id).toBe("r1");
    expect(r?.requester_id).toBe("p_maya");
    expect(r?.requester_name).not.toBe("p_maya"); // resolved
    expect(r?.requested_at).toBe("2026-08-01T09:00:00+03:00");
    expect(r?.reason).toBe("נדרש אימות בלתי תלוי");
    expect(r?.requested_verifier_role).toBe("community");
  });

  it("does not inflate the claim's evidence rung while it waits", () => {
    expect(impactOf(events).verification_status).toBe("self_report");
  });

  it("counts in the under_review bucket and nowhere else", () => {
    const t = view(events).impact_totals;
    expect(t.under_review.count).toBe(1);
    expect(t.under_review.people_affected).toBe(10);
    for (const k of ["unverified", "verified", "partial", "rejected", "inconclusive"] as const) {
      expect(t[k].count).toBe(0);
    }
  });
});

// ── 3. requested then verified ───────────────────────────────────────────────

describe("requested then verified", () => {
  const events = [...REPORTED_ONLY, request("r1"), verification("v1", "verified")];

  it("resolves to the verification, not the request", () => {
    const i = impactOf(events);
    expect(i.verification_level).toBe("verified");
    expect(i.verified).toBe(true);
    expect(i.verification?.event_id).toBe("v1");
  });

  it("clears the open request once answered", () => {
    const i = impactOf(events);
    expect(i.review_request).toBeNull();
    expect(i.review_request_count).toBe(1); // history is kept, the question is closed
  });

  it("a NEW request after the verification re-opens the review", () => {
    const reopened = [...events, request("r2", { at: "2026-08-01T18:00:00+03:00" })];
    const i = impactOf(reopened);
    expect(i.verification_level).toBe("under_review");
    expect(i.verified).toBe(false);
    expect(i.review_request?.event_id).toBe("r2");
  });
});

// ── 4. requested then partially_verified ─────────────────────────────────────

describe("requested then partially_verified", () => {
  const events = [...REPORTED_ONLY, request("r1"), verification("v1", "partially_verified")];

  it("lands in partial, not under_review and not verified", () => {
    const i = impactOf(events);
    expect(i.verification_level).toBe("partial");
    expect(i.verified).toBe(false);
    expect(i.review_request).toBeNull();
  });

  it("keeps the partial bucket separate from verified, as before", () => {
    const t = view(events).impact_totals;
    expect(t.partial.count).toBe(1);
    expect(t.verified.count).toBe(0);
    expect(t.under_review.count).toBe(0);
  });
});

// ── 5. multiple requests ─────────────────────────────────────────────────────

describe("multiple requests", () => {
  it("counts them all and surfaces the latest as the open one", () => {
    const i = impactOf([
      ...REPORTED_ONLY,
      request("r1", { at: "2026-08-01T09:00:00+03:00" }),
      request("r2", { at: "2026-08-01T10:00:00+03:00", by: "p_itai", role: "external" }),
    ]);
    expect(i.review_request_count).toBe(2);
    expect(i.review_request?.event_id).toBe("r2");
    expect(i.review_request?.requested_verifier_role).toBe("external");
    expect(i.verification_level).toBe("under_review");
  });

  it("is order-independent and tie-broken by event_id", () => {
    const tie = "2026-08-01T09:00:00+03:00";
    const a = impactOf([...REPORTED_ONLY, request("rA", { at: tie }), request("rB", { at: tie })]);
    const b = impactOf([...REPORTED_ONLY, request("rB", { at: tie }), request("rA", { at: tie })]);
    expect(a.review_request?.event_id).toBe("rB");
    expect(b.review_request?.event_id).toBe("rB");
  });

  it("a request that predates the verification does not re-open it", () => {
    const i = impactOf([
      ...REPORTED_ONLY,
      request("r1", { at: "2026-08-01T09:00:00+03:00" }),
      request("r2", { at: "2026-08-01T10:00:00+03:00" }),
      verification("v1", "verified", "2026-08-01T12:00:00+03:00"),
    ]);
    expect(i.verification_level).toBe("verified");
    expect(i.review_request).toBeNull();
  });
});

// ── 6. request referencing a nonexistent impact ──────────────────────────────

describe("request referencing a nonexistent impact event", () => {
  const orphan = request("r9", { target: "e999_does_not_exist" });

  it("is ignored — it cannot put anything under review", () => {
    const i = impactOf([...REPORTED_ONLY, orphan]);
    expect(i.verification_level).toBe("unverified");
    expect(i.review_request).toBeNull();
    expect(i.review_request_count).toBe(0);
  });

  it("never leaks onto a different impact record", () => {
    const t = view([...REPORTED_ONLY, orphan]).impact_totals;
    expect(t.under_review.count).toBe(0);
    expect(t.unverified.count).toBe(1);
  });

  it("a malformed request (missing reason) is rejected by the type guard", () => {
    const malformed = {
      ...request("r8"),
      payload: { target_impact_event_id: IMPACT_EVENT, requested_verifier_role: "community" },
    } as PhilosEvent;
    const i = impactOf([...REPORTED_ONLY, malformed]);
    expect(i.verification_level).toBe("unverified");
    expect(i.review_request_count).toBe(0);
  });
});

// ── the seed log carries the full lifecycle ──────────────────────────────────

describe("seed log lifecycle", () => {
  it("records, requests, then verifies — and ends verified", () => {
    const i = impactOf(VALUE_GROUP_EVENTS);
    expect(i.review_request_count).toBe(1);
    expect(i.verification_count).toBe(3);
    expect(i.verification_level).toBe("verified");
    expect(i.review_request).toBeNull();
  });

  it("leaves every existing total unchanged", () => {
    const t = view(VALUE_GROUP_EVENTS).impact_totals;
    expect(t.verified.count).toBe(1);
    expect(t.under_review.count).toBe(0);
    expect(t.unverified.count).toBe(0);
    expect(t.partial.count).toBe(0);
    expect(t.rejected.count).toBe(0);
    expect(t.inconclusive.count).toBe(0);
  });
});
