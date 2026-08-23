/**
 * projectCanonDynamics — the additive canon → Dynamics bridge (systemic-
 * integration-audit slice 1). Verifies: real Observation input only, no
 * fabricated edges, stable ids, provenance preserved verbatim, persisted vs
 * derived stated explicitly, and that this module never writes anything.
 */
import { describe, expect, it } from "vitest";
import type { CanonEvent } from "../canonEvent";
import { InMemoryCanonEventStore } from "../canonEventStore";
import { projectCanonDynamics, projectCanonDynamicsUnscoped, observationVisibleTo, UNSCOPED } from "../projectCanonDynamics";
import type { Observation } from "../observation";

function baseObservation(overrides: Partial<Observation> = {}): Observation {
  return {
    subject: "person_roei",
    domain: "E",
    frame: "I",
    reference: "self_goal:baseline_energy",
    context: "evening_session",
    time: "2026-08-12T20:00:00Z",
    provenance: "self_reported",
    confidence: 0.7,
    expiry: "2026-09-12T20:00:00Z",
    level: -0.3,
    stability: 0.5,
    deficitType: "RELATIVE",
    ...overrides,
  };
}

function canonEvent(id: string, observation: Observation, recordedAt: string): CanonEvent {
  return {
    canon_event_id: id,
    canon_type: "observation",
    payload: observation,
    recorded_at: recordedAt,
  };
}

describe("projectCanonDynamics", () => {
  it("returns no nodes for an empty store — no fabrication", async () => {
    const store = new InMemoryCanonEventStore([]);
    const graph = await projectCanonDynamicsUnscoped(store);
    expect(graph.nodes).toEqual([]);
    expect(graph.summary.node_count).toBe(0);
  });

  it("projects a real Observation verbatim — subject/domain/frame/level/stability/context/reference", async () => {
    const obs = baseObservation({ subject: "person_x", domain: "E", frame: "I", level: -3, stability: 4 });
    const store = new InMemoryCanonEventStore([
      canonEvent("canon_evt_1", obs, "2026-08-14T15:00:00.000Z"),
    ]);
    const graph = await projectCanonDynamicsUnscoped(store);
    expect(graph.nodes).toHaveLength(1);
    const n = graph.nodes[0];
    expect(n.canon_event_id).toBe("canon_evt_1");
    expect(n.subject).toBe("person_x");
    expect(n.domain).toBe("E");
    expect(n.frame).toBe("I");
    expect(n.level).toBe(-3);
    expect(n.stability).toBe(4);
    expect(n.context).toBe(obs.context);
    expect(n.reference).toBe(obs.reference);
    expect(n.observed_at).toBe(obs.time);
    expect(n.recorded_at).toBe("2026-08-14T15:00:00.000Z");
  });

  it("stable id: the node id is the real canon_event_id, unchanged across two calls", async () => {
    const store = new InMemoryCanonEventStore([
      canonEvent("canon_evt_stable", baseObservation(), "2026-08-14T15:00:00.000Z"),
    ]);
    const g1 = await projectCanonDynamicsUnscoped(store);
    const g2 = await projectCanonDynamicsUnscoped(store);
    expect(g1.nodes[0].id).toBe("canon_evt_stable");
    expect(g1.nodes[0].id).toBe(g2.nodes[0].id);
  });

  it("provenance is preserved verbatim, never re-labeled as explicit/inferred", async () => {
    const store = new InMemoryCanonEventStore([
      canonEvent("canon_evt_2", baseObservation({ provenance: "self_reported" }), "2026-08-14T15:00:00.000Z"),
    ]);
    const graph = await projectCanonDynamicsUnscoped(store);
    expect(graph.nodes[0].provenance).toBe("self_reported");
  });

  it("persisted_or_derived is always 'persisted' — Observation is canon's one persisted primitive", async () => {
    const store = new InMemoryCanonEventStore([
      canonEvent("canon_evt_3", baseObservation(), "2026-08-14T15:00:00.000Z"),
    ]);
    const graph = await projectCanonDynamicsUnscoped(store);
    expect(graph.nodes[0].persisted_or_derived).toBe("persisted");
  });

  it("produces no edges field / no invented relationships — nodes only", async () => {
    const store = new InMemoryCanonEventStore([
      canonEvent("a", baseObservation({ subject: "person_1" }), "2026-08-14T15:00:00.000Z"),
      canonEvent("b", baseObservation({ subject: "person_1" }), "2026-08-14T15:05:00.000Z"),
    ]);
    const graph = await projectCanonDynamicsUnscoped(store);
    expect("edges" in graph).toBe(false);
  });

  it("deterministic order: observed_at ascending, tie-broken by canon_event_id", async () => {
    const store = new InMemoryCanonEventStore([
      canonEvent("z_later_id", baseObservation({ time: "2026-08-14T10:00:00Z" }), "2026-08-14T10:00:01Z"),
      canonEvent("a_earlier_id", baseObservation({ time: "2026-08-14T09:00:00Z" }), "2026-08-14T09:00:01Z"),
      canonEvent("b_same_time", baseObservation({ time: "2026-08-14T10:00:00Z" }), "2026-08-14T10:00:02Z"),
    ]);
    const graph = await projectCanonDynamicsUnscoped(store);
    expect(graph.nodes.map((n) => n.canon_event_id)).toEqual(["a_earlier_id", "b_same_time", "z_later_id"]);
  });

  it("domain summary counts real observations per canon domain, no fabricated totals", async () => {
    const store = new InMemoryCanonEventStore([
      canonEvent("g1", baseObservation({ domain: "G" }), "2026-08-14T10:00:00Z"),
      canonEvent("e1", baseObservation({ domain: "E" }), "2026-08-14T10:01:00Z"),
      canonEvent("e2", baseObservation({ domain: "E" }), "2026-08-14T10:02:00Z"),
    ]);
    const graph = await projectCanonDynamicsUnscoped(store);
    expect(graph.summary.domains).toEqual({ G: 1, E: 2, C: 0 });
    expect(graph.summary.node_count).toBe(3);
    expect(graph.summary.persisted_count).toBe(3);
  });

  it("never calls append — read-only, no write path", async () => {
    const store = new InMemoryCanonEventStore([
      canonEvent("x", baseObservation(), "2026-08-14T10:00:00Z"),
    ]);
    let appendCalled = false;
    const originalAppend = store.append.bind(store);
    store.append = async (events) => {
      appendCalled = true;
      return originalAppend(events);
    };
    await projectCanonDynamicsUnscoped(store);
    expect(appendCalled).toBe(false);
  });

  it("real Observation input only — a non-observation canon_type is never fabricated into a mark (defensive, closed union today)", async () => {
    const obs = baseObservation();
    const weird = { canon_event_id: "weird", canon_type: "not_observation", payload: obs, recorded_at: "2026-08-14T10:00:00Z" } as unknown as CanonEvent;
    const store = new InMemoryCanonEventStore([weird]);
    const graph = await projectCanonDynamicsUnscoped(store);
    expect(graph.nodes).toEqual([]);
  });
});

describe("viewer scope — the projection may not emit another person's observations", () => {
  it("emits nothing for a subject that is not the resolved viewer", async () => {
    // The test process resolves a LOCAL_DEV viewer, so the default call is
    // scoped rather than blind — an observation belonging to nobody in this
    // session produces no node at all, and its text never enters the graph.
    const store = new InMemoryCanonEventStore([
      canonEvent("c1", baseObservation({ subject: "person_someone_else", context: "טקסט פרטי" }), "2026-08-12T20:00:00Z"),
    ]);
    const graph = await projectCanonDynamics(store);
    expect(graph.nodes).toHaveLength(0);
    expect(JSON.stringify(graph)).not.toContain("טקסט פרטי");
  });

  it("emits nothing at all when the scope is explicitly absent", async () => {
    const store = new InMemoryCanonEventStore([
      canonEvent("c1", baseObservation({ subject: "person_roei" }), "2026-08-12T20:00:00Z"),
    ]);
    // An empty scope object matches no subject — the fail-closed direction.
    const graph = await projectCanonDynamics(store, {});
    expect(graph.nodes).toHaveLength(0);
  });

  it("emits only the viewer's own observations", async () => {
    const store = new InMemoryCanonEventStore([
      canonEvent("c1", baseObservation({ subject: "person_roei" }), "2026-08-12T20:00:00Z"),
      canonEvent("c2", baseObservation({ subject: "person_bet" }), "2026-08-12T21:00:00Z"),
    ]);
    const forBet = await projectCanonDynamics(store, { subject_id: "person_bet", person_id: "p_bet" });
    expect(forBet.nodes.map((n) => n.subject)).toEqual(["person_bet"]);
    // The other person's subject, label and tooltip are all absent — not
    // merely hidden downstream.
    expect(JSON.stringify(forBet)).not.toContain("person_roei");
  });

  it("the unscoped door is the only way to get everything", async () => {
    const store = new InMemoryCanonEventStore([
      canonEvent("c1", baseObservation({ subject: "person_roei" }), "2026-08-12T20:00:00Z"),
      canonEvent("c2", baseObservation({ subject: "person_bet" }), "2026-08-12T21:00:00Z"),
    ]);
    expect((await projectCanonDynamicsUnscoped(store)).nodes).toHaveLength(2);
  });

  it("the gate is pure and total", () => {
    expect(observationVisibleTo("person_roei", null)).toBe(false);
    expect(observationVisibleTo("person_roei", {})).toBe(false);
    expect(observationVisibleTo("person_roei", { subject_id: "person_bet" })).toBe(false);
    expect(observationVisibleTo("person_roei", { subject_id: "person_roei" })).toBe(true);
    expect(observationVisibleTo("p_you", { person_id: "p_you" })).toBe(true);
    expect(observationVisibleTo("anything", UNSCOPED)).toBe(true);
  });
});
