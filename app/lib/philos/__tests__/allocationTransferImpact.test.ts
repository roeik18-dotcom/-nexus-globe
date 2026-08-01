/**
 * Allocation state · transfer state · impact verification state.
 *
 * These three are where a screen most easily lies: an allocation that looks
 * approved when it is still being voted on, a transfer that looks completed when
 * it is only authorised, and an impact figure presented as fact when it is a
 * claim. Each state here is derived from events and asserted against them.
 */

import { describe, expect, it } from "vitest";

import type { PhilosEvent } from "../events";
import { projectValueGroup } from "../projectValueGroup";
import { GROUP_ID, SEED_TODAY, VALUE_GROUP_EVENTS } from "../valueGroupLog";

const view = (events: readonly PhilosEvent[] = VALUE_GROUP_EVENTS) => {
  const v = projectValueGroup(events, GROUP_ID, SEED_TODAY);
  if (!v) throw new Error("projection returned null");
  return v;
};

const alloc = (id: string, events?: readonly PhilosEvent[]) => {
  const a = view(events).allocations.find((x) => x.allocation_id === id);
  if (!a) throw new Error(`allocation ${id} missing`);
  return a;
};

// ── allocation state ─────────────────────────────────────────────────────────

describe("allocation state", () => {
  it("derives exactly two proposals", () => {
    expect(view().allocations).toHaveLength(2);
  });

  it("counts only votes in favour, from vote events", () => {
    expect(alloc("alloc_elder_support").votes_for).toBe(5);
    expect(alloc("alloc_medical_kit").votes_for).toBe(2);
  });

  it("a proposal short of quorum is 'voting', not approved", () => {
    const a = alloc("alloc_medical_kit");
    expect(a.state).toBe("voting");
    expect(a.votes_for).toBeLessThan(a.votes_required);
  });

  it("a proposal whose money has moved is 'transferred', not merely approved", () => {
    expect(alloc("alloc_elder_support").state).toBe("transferred");
  });

  it("an approved proposal with no transfer stays 'approved'", () => {
    const withoutTransfer = VALUE_GROUP_EVENTS.filter(
      (e) => e.event_type !== "transfer.completed",
    );
    expect(alloc("alloc_elder_support", withoutTransfer).state).toBe("approved");
  });

  it("approved-but-unspent money is committed and leaves the available balance", () => {
    const withoutTransfer = VALUE_GROUP_EVENTS.filter(
      (e) => e.event_type !== "transfer.completed",
    );
    const b = view(withoutTransfer).budget;
    expect(b.committed).toBe(5000);
    expect(b.spent).toBe(0);
    expect(b.available).toBe(18400 - 5000);
  });

  it("names the proposer from the event actor", () => {
    expect(alloc("alloc_elder_support").proposed_by_name).toBe("עומר כהן");
    expect(alloc("alloc_medical_kit").proposed_by_name).toBe("יעל שמש");
  });
});

// ── transfer state ───────────────────────────────────────────────────────────

describe("transfer state", () => {
  it("derives exactly one transfer", () => {
    expect(view().transfers).toHaveLength(1);
  });

  it("is 'completed' only once a completion event exists", () => {
    const t = view().transfers[0];
    expect(t.state).toBe("completed");
    expect(t.completed_at).toBe("2026-07-31");
  });

  it("is 'approved' when authorised but not yet executed", () => {
    const noCompletion = VALUE_GROUP_EVENTS.filter(
      (e) => e.event_type !== "transfer.completed",
    );
    const t = view(noCompletion).transfers[0];
    expect(t.state).toBe("approved");
    expect(t.completed_at).toBeUndefined();
  });

  it("records who approved it and under which permission tier", () => {
    const t = view().transfers[0];
    expect(t.tier).toBe("medium"); // §9: medium = resources-lead approval
    expect(t.approvals).toHaveLength(1);
    expect(t.approvals[0].role).toBe("resources");
  });

  it("carries the ledger evidence for the money that left", () => {
    const t = view().transfers[0];
    expect(t.evidence).toContain("ledger:tx_out_0001");
    expect(t.provenance.verification_status).toBe("evidence");
  });

  it("the transfer amount matches the allocation it settles", () => {
    const t = view().transfers[0];
    expect(t.amount).toBe(alloc("alloc_elder_support").amount);
  });
});

// ── impact verification state ────────────────────────────────────────────────

describe("impact verification state", () => {
  it("derives exactly one impact record", () => {
    expect(view().impact).toHaveLength(1);
  });

  it("is community_verified and therefore reportable as verified", () => {
    const i = view().impact[0];
    expect(i.verification_status).toBe("community_verified");
    expect(i.verified).toBe(true);
    expect(i.verified_by_count).toBe(3);
  });

  it("carries evidence and a confidence figure", () => {
    const i = view().impact[0];
    expect(i.evidence.length).toBeGreaterThan(0);
    expect(i.confidence).toBe(0.9);
  });

  it("ties the claim to the resources actually invested", () => {
    const i = view().impact[0];
    expect(i.resources_invested).toBe(view().transfers[0].amount);
    expect(i.people_affected).toBe(10);
  });

  // Verification now comes from impact.verified events, so these three cases
  // must strip them: what is under test is the claim standing on its own.
  const unverified = (status?: PhilosEvent["verification_status"]): PhilosEvent[] =>
    VALUE_GROUP_EVENTS.filter((e) => e.event_type !== "impact.verified").map((e) =>
      e.event_type === "impact.recorded" ? { ...e, verification_status: status } : e,
    );

  it("a self-reported impact is NOT marked verified", () => {
    const i = view(unverified("self_report")).impact[0];
    expect(i.verification_status).toBe("self_report");
    expect(i.verified).toBe(false);
  });

  it("an inferred impact is NOT marked verified", () => {
    // §10: "Never present inferred impact as verified fact."
    expect(view(unverified("system_inference")).impact[0].verified).toBe(false);
  });

  it("an impact event with no stated status defaults to 'claim', not verified", () => {
    const i = view(unverified(undefined)).impact[0];
    expect(i.verification_status).toBe("claim");
    expect(i.verified).toBe(false);
  });

  it("a claim cannot verify itself — a verified status on the report is downgraded", () => {
    // the failure mode the separate event exists to prevent
    const selfVerified = VALUE_GROUP_EVENTS
      .filter((e) => e.event_type !== "impact.verified")
      .map((e) =>
        e.event_type === "impact.recorded"
          ? { ...e, verification_status: "external_verified" as const }
          : e,
      );
    const i = view(selfVerified).impact[0];
    expect(i.reported_status).toBe("self_report");
    expect(i.verified).toBe(false);
    expect(i.verification).toBeNull();
  });
});
