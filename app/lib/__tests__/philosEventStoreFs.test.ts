/**
 * The durable log — the milestone's actual claim.
 *
 * Every other test in `app/lib/philos` runs on arrays in memory, which is where
 * the product's "join" already worked before this change: it worked, in a
 * variable, until the page reloaded. The invariant that matters is therefore the
 * one asserted here — a second store instance over the same directory, standing
 * in for a restart, sees what the first one wrote.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { PhilosEvent } from "../philos/events";
import { AppendRejectedError, fixedClock, fixedIdGenerator } from "../philos/eventStore";
import { joinGroup } from "../philos/commands/joinGroup";
import { projectValueGroup } from "../philos/projectValueGroup";
import { projectGlobeGraph } from "../philos/projectGlobeGraph";
import { GROUP_ID, SEED_TODAY, VALUE_GROUP_EVENTS } from "../philos/valueGroupLog";
import {
  FileSystemPhilosEventStore,
  PHILOS_LOG_FILENAME,
  PhilosLogCorruptError,
} from "../philos-event-store";

let dataDir: string;

const freshStore = (bootstrap?: readonly PhilosEvent[]) =>
  new FileSystemPhilosEventStore(dataDir, bootstrap);

const logPath = () => join(dataDir, PHILOS_LOG_FILENAME);

const AT = `${SEED_TODAY}T20:00:00+03:00`;

/** The real write path: the command produces the events, the store stores them. */
const guestJoinEvents = (stored: readonly PhilosEvent[]) => {
  const result = joinGroup(
    stored,
    { group_id: GROUP_ID, person_id: "p_guest", display_name: "אורח/ת" },
    { clock: fixedClock(AT), ids: fixedIdGenerator() },
  );
  if (!result.ok) throw new Error(`join rejected: ${result.message}`);
  return result.events;
};

const evt = (over: Partial<PhilosEvent> = {}): PhilosEvent => ({
  event_id: "x1",
  actor_id: "p_a",
  entity_type: "person",
  entity_id: "p_a",
  event_type: "person.registered",
  value_tags: [],
  timestamp: "2026-08-01T10:00:00+03:00",
  visibility: "public",
  ...over,
});

beforeEach(() => {
  dataDir = mkdtempSync(join(tmpdir(), "philos-log-"));
});

afterEach(() => {
  rmSync(dataDir, { recursive: true, force: true });
});

// ── bootstrap + appended = one log ───────────────────────────────────────────

describe("the log a caller sees", () => {
  it("is the seed before anything has been written", async () => {
    const store = freshStore();
    expect(await store.load()).toHaveLength(VALUE_GROUP_EVENTS.length);
  });

  it("creates no file until something is appended", async () => {
    freshStore();
    expect(() => readFileSync(logPath())).toThrow();
  });

  it("returns bootstrap and appended events in one canonical order", async () => {
    const store = freshStore([evt({ event_id: "b", timestamp: "2026-08-02T10:00:00+03:00" })]);
    await store.append([evt({ event_id: "a", timestamp: "2026-08-01T10:00:00+03:00" })]);
    expect((await store.load()).map((e) => e.event_id)).toEqual(["a", "b"]);
  });

  it("writes one JSON object per line", async () => {
    const store = freshStore([]);
    await store.append([evt({ event_id: "a" })]);
    await store.append([evt({ event_id: "b", timestamp: "2026-08-02T10:00:00+03:00" })]);
    const lines = readFileSync(logPath(), "utf-8").trim().split("\n");
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]).event_id).toBe("a");
  });
});

// ── the restart invariant ────────────────────────────────────────────────────

describe("survives a restart", () => {
  it("a second instance over the same directory sees the first one's writes", async () => {
    const first = freshStore();
    const events = guestJoinEvents(await first.load());
    await first.append(events);

    // A new instance is what a page reload gets: no shared memory, same disk.
    const second = freshStore();
    const ids = (await second.load()).map((e) => e.event_id);
    for (const e of events) expect(ids).toContain(e.event_id);
  });

  it("the membership is still on the value-group screen after the restart", async () => {
    const first = freshStore();
    await first.append(guestJoinEvents(await first.load()));

    const view = projectValueGroup(await freshStore().load(), GROUP_ID, SEED_TODAY);
    expect(view?.members.some((m) => m.person_id === "p_guest")).toBe(true);
    // This is the sentence the milestone is judged by: the count moved, and it
    // moved because of an event on disk.
    const seeded = projectValueGroup(VALUE_GROUP_EVENTS, GROUP_ID, SEED_TODAY);
    expect(view?.members.length).toBe((seeded?.members.length ?? 0) + 1);
  });

  it("the new member is drawn on the globe, from their own event", async () => {
    const first = freshStore();
    await first.append(guestJoinEvents(await first.load()));

    const before = projectGlobeGraph(VALUE_GROUP_EVENTS, GROUP_ID);
    const after = projectGlobeGraph(await freshStore().load(), GROUP_ID);
    expect(after.nodes).toHaveLength(before.nodes.length + 1);
    expect(after.arcs).toHaveLength(before.arcs.length + 1);
    expect(after.nodes.some((n) => n.id === "p_guest")).toBe(true);
  });

  it("every figure the screen shows still names its source events", async () => {
    const store = freshStore();
    await store.append(guestJoinEvents(await store.load()));
    const view = projectValueGroup(await freshStore().load(), GROUP_ID, SEED_TODAY);
    const provenances = [
      view!.budget.provenance,
      ...view!.allocations.map((a) => a.provenance),
      ...view!.transfers.map((t) => t.provenance),
      ...view!.impact.map((i) => i.provenance),
    ];
    for (const p of provenances) expect(p.source_events.length).toBeGreaterThan(0);
  });

  it("the event count on screen includes what was written", async () => {
    const store = freshStore();
    const events = guestJoinEvents(await store.load());
    await store.append(events);
    const view = projectValueGroup(await freshStore().load(), GROUP_ID, SEED_TODAY);
    expect(view?.event_count).toBe(VALUE_GROUP_EVENTS.length + events.length);
  });
});

// ── the append rules hold across the disk boundary ───────────────────────────

describe("append rules", () => {
  it("refuses to reuse a seed event's id", async () => {
    const store = freshStore();
    await expect(store.append([evt({ event_id: "e001" })])).rejects.toThrow(AppendRejectedError);
  });

  it("refuses an id written by an earlier instance", async () => {
    await freshStore([]).append([evt({ event_id: "a" })]);
    await expect(freshStore([]).append([evt({ event_id: "a" })])).rejects.toThrow(
      AppendRejectedError,
    );
  });

  it("a rejected append leaves the file untouched", async () => {
    const store = freshStore([]);
    await store.append([evt({ event_id: "a" })]);
    const before = readFileSync(logPath(), "utf-8");
    await store.append([evt({ event_id: "a" })]).catch(() => undefined);
    expect(readFileSync(logPath(), "utf-8")).toBe(before);
  });

  it("accepts a caused_by that resolves into the bootstrap seed", async () => {
    // The join's membership names the seed's group.opened as a cause; if the
    // store checked only the file it would reject every real join.
    const store = freshStore();
    const events = guestJoinEvents(await store.load());
    expect(events.at(-1)?.caused_by).toContain("e010");
    await expect(store.append(events)).resolves.toHaveLength(events.length);
  });
});

// ── corruption is stated, never skipped ──────────────────────────────────────

describe("a damaged log", () => {
  it("throws rather than silently reading a partial log", async () => {
    const store = freshStore([]);
    await store.append([evt({ event_id: "a" })]);
    appendFileSync(logPath(), "{not json\n", "utf-8");
    await expect(freshStore([]).load()).rejects.toThrow(PhilosLogCorruptError);
  });

  it("names the line, so the damage can be found", async () => {
    writeFileSync(logPath(), `${JSON.stringify(evt())}\n{oops\n`, "utf-8");
    await expect(freshStore([]).load()).rejects.toMatchObject({ line_number: 2 });
  });

  it("ignores blank lines, which are not damage", async () => {
    writeFileSync(logPath(), `\n${JSON.stringify(evt())}\n\n`, "utf-8");
    expect(await freshStore([]).load()).toHaveLength(1);
  });
});
