/**
 * Globe arcs must be derived from events, not decoration.
 *
 * PHILOS-SYSTEM-BLUEPRINT §13: "no line exists until it represents a real
 * event." The globe used to draw one arc per PUDM relation row, at coordinates
 * hashed from an id — a viewer could not ask why a line existed and get an
 * answer. These tests pin the replacement: every arc names the event that
 * created it, and removing that event removes the arc.
 */
import { describe, expect, it } from "vitest";

import type { PhilosEvent } from "../events";
import { projectGlobeGraph } from "../projectGlobeGraph";
import { SEED_GROUP_ID, VALUE_GROUP_EVENTS } from "../valueGroupLog";

const graph = (events: readonly PhilosEvent[] = VALUE_GROUP_EVENTS) =>
  projectGlobeGraph(events, SEED_GROUP_ID);

// ── derived, not hardcoded ───────────────────────────────────────────────────

describe("arcs are derived from the event log", () => {
  it("produces at least one arc from the seed log", () => {
    expect(graph().arcs.length).toBeGreaterThan(0);
  });

  it("every arc names the event that created it", () => {
    const ids = new Set(VALUE_GROUP_EVENTS.map((e) => e.event_id));
    for (const a of graph().arcs) {
      expect(a.event_id).toBeTruthy();
      expect(ids.has(a.event_id)).toBe(true);
    }
  });

  it("removing the events removes the arcs — the decisive test", () => {
    const withoutJoins = VALUE_GROUP_EVENTS.filter(
      (e) => e.event_type !== "member.joined",
    );
    const before = graph().arcs.filter((a) => a.relation === "member.joined");
    const after = graph(withoutJoins).arcs.filter((a) => a.relation === "member.joined");
    expect(before.length).toBeGreaterThan(0);
    expect(after).toHaveLength(0);
  });

  it("adding a join event adds exactly one arc", () => {
    const extra: PhilosEvent = {
      event_id: "e_test_join",
      actor_id: "p_dana",
      entity_type: "person",
      entity_id: "p_dana",
      event_type: "member.joined",
      value_tags: [],
      timestamp: "2026-08-02T09:00:00+03:00",
      visibility: "public",
      payload: {},
    };
    const before = graph().arcs.length;
    const after = graph([...VALUE_GROUP_EVENTS, extra]).arcs;
    expect(after).toHaveLength(before + 1);
    expect(after.some((a) => a.event_id === "e_test_join")).toBe(true);
  });

  it("returns nothing for a group that was never opened", () => {
    expect(projectGlobeGraph(VALUE_GROUP_EVENTS, "no_such_group")).toEqual({
      nodes: [],
      arcs: [],
    });
  });
});

// ── every arc is answerable ──────────────────────────────────────────────────

describe("every arc exposes its provenance", () => {
  it("carries source, target, relation, event_id and timestamp", () => {
    const arcs = graph().arcs;
    expect(arcs.length).toBeGreaterThan(0);
    for (const a of arcs) {
      expect(a.source_id).toBeTruthy();
      expect(a.target_id).toBeTruthy();
      expect(a.relation).toBeTruthy();
      expect(a.event_id).toBeTruthy();
      expect(a.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    }
  });

  it("timestamps match the source event, not the render time", () => {
    const byId = new Map(VALUE_GROUP_EVENTS.map((e) => [e.event_id, e]));
    for (const a of graph().arcs) {
      expect(a.timestamp).toBe(byId.get(a.event_id)!.timestamp);
    }
  });

  it("labels resolve person ids to names rather than showing raw ids", () => {
    for (const a of graph().arcs) {
      expect(a.label).not.toMatch(/\bp_[a-z]+\b/);
    }
  });

  it("only projects the relation types it declares", () => {
    // Adding a relation here is a decision about what a line on the globe MEANS,
    // so the list is asserted explicitly rather than derived — a new arc type
    // must fail this test and be justified, never appear silently.
    // Mission B, B9: `group.opened` was added, one real arc from the group to
    // its own new `value` node (the group's own real central_value — see
    // `projectGlobeGraph.ts`'s header on `GlobeNode["type"]`).
    const kinds = new Set(graph().arcs.map((a) => a.relation));
    expect([...kinds].sort()).toEqual([
      "group.opened",
      "leader.appointed",
      "member.joined",
      "transfer.completed",
    ]);
  });
});

// ── nodes ────────────────────────────────────────────────────────────────────

describe("nodes come from the same events", () => {
  it("includes the value group itself", () => {
    const g = graph();
    const group = g.nodes.find((n) => n.id === SEED_GROUP_ID);
    expect(group?.type).toBe("value_group");
    expect(group?.label).not.toBe(SEED_GROUP_ID);   // resolved to its real name
  });

  it("every arc endpoint has a placeable node", () => {
    const g = graph();
    const ids = new Set(g.nodes.map((n) => n.id));
    for (const a of g.arcs) {
      expect(ids.has(a.source_id)).toBe(true);
      expect(ids.has(a.target_id)).toBe(true);
    }
  });

  it("does not duplicate a person who appears in several events", () => {
    const ids = graph().nodes.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("born comes from the event timestamp, never from Date.now()", () => {
    const now = Date.now();
    for (const n of graph().nodes) {
      expect(n.born).toBeLessThan(now);
      expect(n.born).toBeGreaterThan(0);
    }
  });

  it("is deterministic — same events, same graph", () => {
    expect(graph()).toEqual(graph());
  });
});
