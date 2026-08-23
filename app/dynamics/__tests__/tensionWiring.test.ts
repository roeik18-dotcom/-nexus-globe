/**
 * The tension wiring, proven rather than asserted.
 *
 * `dynamics/page.tsx` passed a literal `[]` into the causal view's `tensions`,
 * 80 lines below the place real tensions were computed and discarded — so the
 * surface said "no contradictions recorded" on every render regardless of what
 * was recorded. Two things must now be true, and the second is the one that
 * cannot be seen live while both sources are empty:
 *
 *   1. no literal empty array is passed any more
 *   2. each source, GIVEN data, actually reaches the view's shape
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildCommunityTensions, sortTensions } from "@/app/lib/philos/tension";
import { projectAllGroupStates } from "@/app/lib/philos/community/groupOperationalState";
import { projectValueGroup } from "@/app/lib/philos/projectValueGroup";
import { VALUE_GROUP_EVENTS, SEED_TODAY } from "@/app/lib/philos/valueGroupLog";
import type { GroupEvent } from "@/app/lib/philos/community/groupEvent";

describe("dynamics tension wiring", () => {
  it("no longer hands the causal view a literal empty list", () => {
    const src = readFileSync("app/dynamics/page.tsx", "utf8");
    expect(src).not.toContain("tensions: [],");
    expect(src).toContain("community?.tensions");
    expect(src).toContain("spineTensions");
  });

  it("community tensions reach the view's shape when the group HAS one", () => {
    const view = projectValueGroup(VALUE_GROUP_EVENTS, "vg_ahrayut_kehilatit", SEED_TODAY)!;
    // The real group is solvent, so it legitimately produces none.
    expect(view.budget.available).toBeGreaterThan(0);
    expect(buildCommunityTensions(view, "REAL")).toHaveLength(0);

    // Overdrawn, it produces one — and it maps to the three fields the causal
    // view renders. This is the link that was severed.
    const overdrawn = { ...view, budget: { ...view.budget, available: -1200 } };
    const items = sortTensions(buildCommunityTensions(overdrawn, "REAL"));
    expect(items.length).toBeGreaterThan(0);
    const mapped = items.map((t) => ({ label: t.label, status: t.status, detail: `${t.current_state} · ${t.evidence_source}` }));
    expect(mapped[0].label).toBeTruthy();
    expect(mapped[0].status).toBeTruthy();
    expect(mapped[0].detail).toContain("·");
  });

  it("spine tensions reach the same shape when TENSION_OBSERVED exists", () => {
    const ev: GroupEvent = {
      event_id: "t1", group_id: "gX", event_type: "TENSION_OBSERVED", object_id: "tension_1",
      occurred_at: "2026-08-20T10:00:00Z", recorded_at: "2026-08-20T10:00:00Z",
      source: "fixture", provenance: "DEMO", status: "RECORDED",
      payload: { description: "תקציב מול היקף פעילות", pole_a: "מסירות", pole_b: "קיימות" },
    };
    const states = projectAllGroupStates([ev]);
    const mapped = [...states.values()].flatMap((st) =>
      st.tensions.map((t) => ({
        label: t.description ?? t.tension_id,
        status: t.pole_a && t.pole_b ? "CONFLICT" : "OBSERVED",
        detail: `${st.group_id} · ${t.source}`,
      })));
    expect(mapped).toEqual([{ label: "תקציב מול היקף פעילות", status: "CONFLICT", detail: "gX · fixture" }]);
  });

  it("both sources empty is an ANSWER, not the old hardcoded silence", () => {
    // The distinction that matters: today's empty list is produced by reading
    // two sources that are genuinely empty, not by a literal in the call site.
    const view = projectValueGroup(VALUE_GROUP_EVENTS, "vg_ahrayut_kehilatit", SEED_TODAY)!;
    const combined = [
      ...buildCommunityTensions(view, "REAL"),
      ...[...projectAllGroupStates([]).values()].flatMap((s) => s.tensions),
    ];
    expect(combined).toHaveLength(0);
  });
});
