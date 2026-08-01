/**
 * Event Log → Value Group projection.
 *
 * The blueprint's §17 names fabricated screen numbers as the highest-priority
 * gap. These tests exist to keep that gap closed: every figure the group screen
 * shows must be derivable from events, so each assertion here traces a rendered
 * value back to the log rather than to a constant.
 */

import { describe, expect, it } from "vitest";

import { isVerified, VERIFICATION_LEVELS } from "../events";
import {
  joinEvent,
  projectValueGroup,
  type ValueGroupView,
} from "../projectValueGroup";
import { GROUP_ID, SEED_TODAY, VALUE_GROUP_EVENTS } from "../valueGroupLog";

function view(today = SEED_TODAY): ValueGroupView {
  const v = projectValueGroup(VALUE_GROUP_EVENTS, GROUP_ID, today);
  if (!v) throw new Error("projection returned null");
  return v;
}

// ── identity ─────────────────────────────────────────────────────────────────

describe("identity", () => {
  it("derives who opened the group and why", () => {
    const v = view();
    expect(v.founder.person_id).toBe("p_dana");
    expect(v.founder.display_name).toBe("דנה לוי");
    expect(v.creation_reason).toContain("שלושה קשישים");
    expect(v.opened_at).toBe("2026-07-18");
  });

  it("returns null for a group that has no group.opened event", () => {
    expect(projectValueGroup(VALUE_GROUP_EVENTS, "vg_does_not_exist", SEED_TODAY)).toBeNull();
  });

  it("is deterministic — same input, same output", () => {
    expect(view()).toEqual(view());
  });

  it("does not depend on the order events arrive in", () => {
    const shuffled = [...VALUE_GROUP_EVENTS].reverse();
    expect(projectValueGroup(shuffled, GROUP_ID, SEED_TODAY)).toEqual(view());
  });
});

// ── people ───────────────────────────────────────────────────────────────────

describe("people", () => {
  it("derives exactly two value leaders with roles and who appointed them", () => {
    const v = view();
    expect(v.leaders).toHaveLength(2);
    const omer = v.leaders.find((l) => l.person_id === "p_omer");
    expect(omer?.role).toBe("resources");
    expect(omer?.role_label).toBe("אחראי כספים");
    expect(omer?.appointed_by_name).toBe("דנה לוי");
    expect(omer?.since).toBe("2026-07-18");
  });

  it("counts founder + leaders + five joiners as members, without duplicates", () => {
    const v = view();
    // 1 founder + 2 leaders + 5 participants
    expect(v.members).toHaveLength(8);
    const ids = v.members.map((m) => m.person_id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain("p_dana"); // founder is a member
    expect(ids).toContain("p_tomer"); // last joiner
  });

  it("resolves display names from person.registered, never raw ids", () => {
    const v = view();
    expect(v.members.every((m) => m.display_name !== m.person_id)).toBe(true);
  });
});

// ── today's activity ─────────────────────────────────────────────────────────

describe("today's activity", () => {
  it("shows only events dated today", () => {
    const v = view();
    expect(v.today.length).toBeGreaterThan(0);
    expect(v.today.map((t) => t.event_id)).toEqual(["e070", "e060", "e061", "e062"]);
  });

  it("is empty on a day with no events", () => {
    expect(view("2026-07-25").today).toHaveLength(0);
  });

  it("renders times in the event's own offset without shifting them", () => {
    const v = view();
    expect(v.today.find((t) => t.event_id === "e060")?.time).toBe("09:20");
    expect(v.today.find((t) => t.event_id === "e062")?.time).toBe("18:00");
  });
});

// ── budget ───────────────────────────────────────────────────────────────────

describe("budget", () => {
  it("derives received and spent from resource deltas, not a constant", () => {
    const b = view().budget;
    expect(b.received).toBe(18400); // 12000 + 6400
    expect(b.spent).toBe(5000); // the one completed transfer
  });

  it("treats approved-but-untransferred allocations as committed, not available", () => {
    const b = view().budget;
    // alloc_elder_support was approved AND transferred → not committed twice
    expect(b.committed).toBe(0);
    expect(b.available).toBe(b.received - b.spent - b.committed);
    expect(b.available).toBe(13400);
  });

  it("carries provenance: which events, how many, over what range", () => {
    const p = view().budget.provenance;
    expect(p.source_events).toEqual(["e030", "e031", "e051"]);
    expect(p.sample_size).toBe(3);
    expect(p.time_range).toEqual(["2026-07-18", SEED_TODAY]);
  });
});

// ── the honesty rule ─────────────────────────────────────────────────────────

describe("provenance", () => {
  it("every figure the screen shows carries source events", () => {
    const v = view();
    const provenances = [
      v.budget.provenance,
      ...v.allocations.map((a) => a.provenance),
      ...v.transfers.map((t) => t.provenance),
      ...v.impact.map((i) => i.provenance),
    ];
    expect(provenances.length).toBeGreaterThan(0);
    for (const p of provenances) {
      expect(p.source_events.length).toBeGreaterThan(0);
      expect(VERIFICATION_LEVELS).toContain(p.verification_status);
    }
  });

  it("reports how many events the whole view was built from", () => {
    expect(view().event_count).toBe(VALUE_GROUP_EVENTS.length);
  });
});

// ── joining (the beginner journey) ───────────────────────────────────────────

describe("join", () => {
  it("appending a join event increases membership by one", () => {
    const before = view().members.length;
    const extended = [
      ...VALUE_GROUP_EVENTS,
      ...joinEvent(GROUP_ID, "p_guest", "אורח/ת", "2026-08-01T20:00:00+03:00"),
    ];
    const after = projectValueGroup(extended, GROUP_ID, SEED_TODAY);
    expect(after?.members).toHaveLength(before + 1);
    expect(after?.members.at(-1)?.display_name).toBe("אורח/ת");
  });

  it("a join today appears in today's activity", () => {
    const extended = [
      ...VALUE_GROUP_EVENTS,
      ...joinEvent(GROUP_ID, "p_guest", "אורח/ת", "2026-08-01T20:00:00+03:00"),
    ];
    const after = projectValueGroup(extended, GROUP_ID, SEED_TODAY);
    expect(after?.today.some((t) => t.kind === "join")).toBe(true);
  });

  it("joining does not move any money", () => {
    const extended = [
      ...VALUE_GROUP_EVENTS,
      ...joinEvent(GROUP_ID, "p_guest", "אורח/ת", "2026-08-01T20:00:00+03:00"),
    ];
    expect(projectValueGroup(extended, GROUP_ID, SEED_TODAY)?.budget).toEqual(view().budget);
  });
});

// ── the six evidence levels ──────────────────────────────────────────────────

describe("verification levels", () => {
  it("treats only community/external verification as verified", () => {
    expect(isVerified("community_verified")).toBe(true);
    expect(isVerified("external_verified")).toBe(true);
    expect(isVerified("claim")).toBe(false);
    expect(isVerified("self_report")).toBe(false);
    expect(isVerified("evidence")).toBe(false);
  });

  it("never counts system inference as verified fact", () => {
    // blueprint §10: "Never present inferred impact as verified fact."
    expect(isVerified("system_inference")).toBe(false);
  });
});
