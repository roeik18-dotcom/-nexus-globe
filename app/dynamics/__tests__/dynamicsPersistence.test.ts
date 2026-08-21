/**
 * A real join reaches the Dynamics screen.
 *
 * `dynamicsHonesty.test.ts` pins what the route may draw; this file pins what it
 * must NOT miss. The route read `VALUE_GROUP_EVENTS` directly at first, so the
 * one screen whose subject is "how a change rolls through the system" could show
 * only the four causal declarations someone hand-wrote into the seed, and not a
 * single change anyone actually made.
 *
 * The write path here is the real one: the command produces the events, the
 * file-system store persists them, a SECOND store instance reads them back (a
 * restart), and the same pure pipeline the route uses folds the result.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { joinGroup } from "@/app/lib/philos/commands/joinGroup";
import { postUpdate } from "@/app/lib/philos/commands/postUpdate";
import { proposeAllocation } from "@/app/lib/philos/commands/proposeAllocation";
import { recordImpact } from "@/app/lib/philos/commands/recordImpact";
import { buildDynamicsView } from "@/app/lib/philos/dynamicsView";
import { fixedClock, fixedIdGenerator } from "@/app/lib/philos/eventStore";
import { projectDynamics } from "@/app/lib/philos/projectDynamics";
import { FileSystemPhilosEventStore } from "@/app/lib/philos-event-store";
import { SEED_GROUP_ID, SEED_TODAY, VALUE_GROUP_EVENTS } from "@/app/lib/philos/valueGroupLog";

let dataDir: string;

const freshStore = () => new FileSystemPhilosEventStore(dataDir);

/** Exactly what the route does, over whatever the store returns. */
const routeView = async () =>
  buildDynamicsView(projectDynamics({ events: await freshStore().load() }));

/** The real write path, through the command that owns the join. */
async function persistJoin() {
  const store = freshStore();
  const result = joinGroup(
    await store.load(),
    { group_id: SEED_GROUP_ID, person_id: "p_guest", display_name: "אורח/ת" },
    { clock: fixedClock(`${SEED_TODAY}T20:00:00+03:00`), ids: fixedIdGenerator() },
  );
  if (!result.ok) throw new Error(`join rejected: ${result.message}`);
  await store.append(result.events);
  const [registered, member] = result.events;
  return { registered, member };
}

/** Post an update that DECLARES what it reports on — a caller-supplied cause. */
async function persistUpdateAbout(parentIds: string[], idStart = 50) {
  const store = freshStore();
  const result = postUpdate(
    await store.load(),
    {
      group_id: SEED_GROUP_ID,
      person_id: "p_guest",
      text: "עדכון מהשטח",
      about_event_ids: parentIds,
    },
    {
      clock: fixedClock(`${SEED_TODAY}T21:00:00+03:00`),
      ids: fixedIdGenerator(idStart),
    },
  );
  if (!result.ok) throw new Error(`post rejected: ${result.message}`);
  await store.append(result.events);
  return result.events[0];
}

beforeEach(() => {
  dataDir = mkdtempSync(join(tmpdir(), "philos-dynamics-"));
});

afterEach(() => {
  rmSync(dataDir, { recursive: true, force: true });
});

describe("before anything is recorded", () => {
  it("draws the seeded log, so the route is not empty to begin with", async () => {
    const view = await routeView();
    expect(view.nodes).toHaveLength(VALUE_GROUP_EVENTS.length);
    expect(view.edges.length).toBeGreaterThan(0);
  });

  it("the seed's causality is fixed history — four declarations, and no more", async () => {
    // Pinned so a change to the seed has to be noticed here. The point of the
    // wiring is not that the seed lacks explicit edges (it has four) but that a
    // route reading the constant can only ever show these four: a screen about
    // how change propagates, frozen at the history someone typed by hand.
    const declaring = VALUE_GROUP_EVENTS.filter((e) => (e.caused_by?.length ?? 0) > 0);
    expect(declaring).toHaveLength(4);
    expect((await routeView()).hud.explicit_edges).toBe(4);
  });
});

describe("after a join is persisted and the process restarts", () => {
  it("the membership event is a node on the screen", async () => {
    const { member } = await persistJoin();
    const view = await routeView(); // a new store instance — nothing shared in memory
    expect(view.nodes.map((n) => n.event_id)).toContain(member.event_id);
  });

  it("the node lands in the People domain, from its own event type", async () => {
    const { member } = await persistJoin();
    const view = await routeView();
    expect(view.nodes.find((n) => n.event_id === member.event_id)?.domain).toBe("people");
  });

  it("the join's declared cause renders as the screen's first EXPLICIT edge", async () => {
    // The layer's whole point: a traced edge, not a guess. The command declared
    // `caused_by`, so this line is solid and reads `self_report`.
    const { member } = await persistJoin();
    const view = await routeView();

    const declared = view.edges.filter((e) => e.target_event_id === member.event_id);
    expect(declared.length).toBeGreaterThan(0);
    for (const edge of declared) {
      expect(edge.origin).toBe("explicit");
      expect(edge.dashed).toBe(false);
      expect(edge.evidence_word).toBe("self_report");
      // §3: an explicit edge carries no join_key — it was not inferred from one.
      expect(edge.join_key_label).toBeUndefined();
    }
    expect(declared.some((e) => e.source_event_id === "e010")).toBe(true);
  });

  it("the edge names who declared it, from the event's own actor", async () => {
    const { member } = await persistJoin();
    const view = await routeView();
    const edge = view.edges.find((e) => e.target_event_id === member.event_id);
    expect(edge?.popover).toContain("p_guest");
    expect(edge?.popover).toContain(member.timestamp);
  });

  it("the HUD counts the explicit edges it drew, and nothing it did not", async () => {
    const before = (await routeView()).hud;
    const { member, registered } = await persistJoin();
    const after = await routeView();

    expect(after.hud.nodes).toBe(before.nodes + 2); // registration + membership
    expect(after.hud.nodes).toBe(after.nodes.length);
    expect(after.hud.edges).toBe(after.edges.length);
    expect(after.hud.explicit_edges).toBeGreaterThan(before.explicit_edges);
    expect(after.nodes.map((n) => n.event_id)).toContain(registered.event_id);
    expect(after.nodes.map((n) => n.event_id)).toContain(member.event_id);
  });

  it("the viewer gate is on and costs nothing, because every event is public", async () => {
    // The route now passes a viewer, so the §5 gate operates server-side. Every
    // seeded and recorded event is `visibility: "public"`, so the scoped graph
    // must equal the unscoped one — turning the gate on must not quietly shrink
    // the screen. If a future event is made private, this fails and the withheld
    // count becomes a real, stated number rather than a silent omission.
    await persistJoin();
    const events = await freshStore().load();
    const open = buildDynamicsView(projectDynamics({ events }));
    const scoped = buildDynamicsView(projectDynamics({ events, viewer: "p_guest" }));

    expect(scoped.hud.nodes).toBe(open.hud.nodes);
    expect(scoped.hud.edges).toBe(open.hud.edges);
    expect(scoped.hud.withheld).toBe(0);
    expect(scoped.withheld.text).toBe("");
  });

  it("an update posted about the join extends the chain across two domains", async () => {
    // The point of the command layer: a real, multi-step causal chain that
    // nobody hand-wrote. group.opened → member.joined → update.posted, each link
    // a declaration made by the actor who made the change.
    const { member } = await persistJoin();
    const update = await persistUpdateAbout([member.event_id]);

    const view = await routeView(); // fresh store instance — read from disk
    expect(view.nodes.map((n) => n.event_id)).toContain(update.event_id);

    const edge = view.edges.find(
      (e) => e.source_event_id === member.event_id && e.target_event_id === update.event_id,
    );
    expect(edge).toBeDefined();
    expect(edge?.origin).toBe("explicit");
    expect(edge?.evidence_word).toBe("self_report");
    expect(edge?.domain_transition).toEqual(["people", "activity"]);

    // …and the earlier link is still there, so the chain is walkable end to end.
    expect(
      view.edges.some(
        (e) => e.source_event_id === "e010" && e.target_event_id === member.event_id,
      ),
    ).toBe(true);
  });

  it("an update about nothing declares no cause and invents no edge", async () => {
    const { member } = await persistJoin();
    const before = await routeView();
    const update = await persistUpdateAbout([], 90);
    const after = await routeView();

    expect(after.nodes.map((n) => n.event_id)).toContain(update.event_id);
    // No explicit edge may appear for an update that declared no parent.
    expect(
      after.edges.some((e) => e.target_event_id === update.event_id && e.origin === "explicit"),
    ).toBe(false);
    expect(after.hud.explicit_edges).toBe(before.hud.explicit_edges);
    expect(member.event_id).toBeDefined();
  });

  it("all four commands form one walkable chain across four domains", async () => {
    // The whole point of the command layer, in one assertion: a causal chain
    // nobody hand-wrote, spanning community → people → activity → resources →
    // impact, every link declared by the actor who caused the change, and read
    // back from disk by a process that did not write it.
    const { member } = await persistJoin();
    const update = await persistUpdateAbout([member.event_id]);

    const store = freshStore();
    const proposed = proposeAllocation(
      await store.load(),
      {
        group_id: SEED_GROUP_ID,
        person_id: "p_guest",
        title: "ערכות חורף",
        amount: 2500,
        people_affected_estimate: 12,
        about_event_ids: [update.event_id],
      },
      { clock: fixedClock(`${SEED_TODAY}T22:00:00+03:00`), ids: fixedIdGenerator(200) },
    );
    if (!proposed.ok) throw new Error(proposed.message);
    await store.append(proposed.events);

    const store2 = freshStore();
    const recorded = recordImpact(
      await store2.load(),
      {
        group_id: SEED_GROUP_ID,
        person_id: "p_guest",
        statement: "12 משפחות קיבלו ערכות",
        people_affected: 12,
        resources_invested: 2500,
        allocation_id: proposed.allocation_id,
        evidence: ["photo_set:ps_01"],
        about_event_ids: [proposed.events[0].event_id],
      },
      { clock: fixedClock(`${SEED_TODAY}T23:00:00+03:00`), ids: fixedIdGenerator(300) },
    );
    if (!recorded.ok) throw new Error(recorded.message);
    await store2.append(recorded.events);

    const view = await routeView(); // a fourth instance — everything from disk
    const chain = [
      "e010",
      member.event_id,
      update.event_id,
      proposed.events[0].event_id,
      recorded.events[0].event_id,
    ];
    for (const id of chain) expect(view.nodes.map((n) => n.event_id)).toContain(id);

    // Every consecutive pair is an explicit, declared edge — no inference needed.
    for (let i = 0; i < chain.length - 1; i++) {
      const edge = view.edges.find(
        (e) => e.source_event_id === chain[i] && e.target_event_id === chain[i + 1],
      );
      expect(edge, `${chain[i]} → ${chain[i + 1]}`).toBeDefined();
      expect(edge?.origin).toBe("explicit");
      expect(edge?.evidence_word).toBe("self_report");
    }

    const domains = chain.map((id) => view.nodes.find((n) => n.event_id === id)?.domain);
    expect(domains).toEqual(["community", "people", "activity", "resources", "impact"]);
    expect(view.unresolved).toHaveLength(0);
  });

  it("declares no unresolved claim — the join's causes all resolve in the log", async () => {
    // The append boundary refuses a dangling `caused_by`, so a persisted join can
    // never leave the crown layer pointing at an event that is not there.
    await persistJoin();
    const view = await routeView();
    expect(view.unresolved).toHaveLength(0);
    expect(view.hud.unresolved).toBe(0);
  });
});
