/**
 * The append boundary.
 *
 * These tests guard the half of the event-sourced spine that did not exist until
 * now. Every projection in `app/lib/philos` was already tested as a pure fold of
 * a fixed log; nothing tested what may ENTER that log, because nothing could.
 * The rules asserted here are what keep the log worth folding: ids are unique
 * and never reused, timestamps can be ordered, and a declared cause resolves.
 */

import { describe, expect, it } from "vitest";

import type { PhilosEvent } from "../events";
import {
  AppendRejectedError,
  InMemoryPhilosEventStore,
  checkAppend,
  createIdGenerator,
  fixedClock,
  fixedIdGenerator,
  systemClock,
  todayIn,
} from "../eventStore";
import { hasUnambiguousTimestamp } from "../eventCausality";

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

const codes = (check: ReturnType<typeof checkAppend>) =>
  check.ok ? [] : check.rejections.map((r) => r.code);

// ── what may enter the log ───────────────────────────────────────────────────

describe("checkAppend", () => {
  it("accepts a well-formed event", () => {
    expect(checkAppend([], [evt()])).toEqual({ ok: true });
  });

  it("refuses an empty append rather than silently succeeding", () => {
    expect(codes(checkAppend([], []))).toEqual(["empty_append"]);
  });

  it("refuses an id already in the log — the log is append-only", () => {
    const stored = [evt({ event_id: "e001" })];
    expect(codes(checkAppend(stored, [evt({ event_id: "e001" })]))).toContain(
      "event_id_already_stored",
    );
  });

  it("refuses the same id twice inside one append", () => {
    const check = checkAppend([], [evt({ event_id: "d" }), evt({ event_id: "d" })]);
    expect(codes(check)).toContain("duplicate_event_id");
  });

  it("refuses a timestamp with no timezone offset", () => {
    // An offsetless timestamp would be read in the host's local zone, making the
    // log's ordering depend on which machine wrote it.
    expect(codes(checkAppend([], [evt({ timestamp: "2026-08-01T10:00:00" })]))).toContain(
      "ambiguous_timestamp",
    );
  });

  it("refuses an unparseable timestamp", () => {
    expect(codes(checkAppend([], [evt({ timestamp: "yesterday" })]))).toContain(
      "ambiguous_timestamp",
    );
  });

  it("applies the same timestamp gate the causality validator applies", () => {
    // One reading of "usable timestamp", shared by writer and reader.
    expect(hasUnambiguousTimestamp("2026-08-01T10:00:00+03:00")).toBe(true);
    expect(hasUnambiguousTimestamp("2026-08-01T10:00:00")).toBe(false);
  });
});

// ── causality is checked strictly at the boundary ────────────────────────────

describe("causality at the write boundary", () => {
  it("accepts a caused_by that resolves to a stored event", () => {
    const stored = [evt({ event_id: "e001" })];
    const child = evt({
      event_id: "e002",
      timestamp: "2026-08-01T11:00:00+03:00",
      caused_by: ["e001"],
    });
    expect(checkAppend(stored, [child])).toEqual({ ok: true });
  });

  it("accepts a caused_by pointing at another event in the same append", () => {
    // A command emits a registration and the membership it enables together.
    const a = evt({ event_id: "a" });
    const b = evt({ event_id: "b", caused_by: ["a"] });
    expect(checkAppend([], [a, b])).toEqual({ ok: true });
  });

  it("refuses a dangling caused_by instead of admitting an unresolved claim", () => {
    // Lenient mode would call this a warning. At the write boundary the log is
    // closed, so the parent must exist — otherwise every reader renders the
    // dangling reference forever and no one can repair it.
    const check = checkAppend([], [evt({ caused_by: ["nope"] })]);
    expect(codes(check)).toContain("causality_invalid");
    if (!check.ok) {
      const causal = check.rejections.find((r) => r.code === "causality_invalid");
      expect(causal?.diagnostics?.[0]?.code).toBe("missing_parent");
      expect(causal?.diagnostics?.[0]?.severity).toBe("error");
    }
  });

  it("refuses a cause dated after its effect", () => {
    const parent = evt({ event_id: "p", timestamp: "2026-08-02T10:00:00+03:00" });
    const child = evt({
      event_id: "c",
      timestamp: "2026-08-01T10:00:00+03:00",
      caused_by: ["p"],
    });
    const check = checkAppend([parent], [child]);
    expect(codes(check)).toContain("causality_invalid");
    if (!check.ok) {
      expect(
        check.rejections.find((r) => r.code === "causality_invalid")?.diagnostics?.[0]?.code,
      ).toBe("parent_after_child");
    }
  });

  it("refuses an event that lists itself as its own cause", () => {
    expect(codes(checkAppend([], [evt({ event_id: "s", caused_by: ["s"] })]))).toContain(
      "causality_invalid",
    );
  });

  it("reports every reason, not just the first", () => {
    const stored = [evt({ event_id: "e001" })];
    const bad = evt({ event_id: "e001", timestamp: "nope", caused_by: ["ghost"] });
    expect(new Set(codes(checkAppend(stored, [bad])))).toEqual(
      new Set(["event_id_already_stored", "ambiguous_timestamp", "causality_invalid"]),
    );
  });

  it("is pure — it mutates neither argument", () => {
    const stored = [evt({ event_id: "e001" })];
    const incoming = [evt({ event_id: "e002" })];
    checkAppend(stored, incoming);
    expect(stored).toHaveLength(1);
    expect(incoming).toHaveLength(1);
  });
});

// ── the in-memory store ──────────────────────────────────────────────────────

describe("InMemoryPhilosEventStore", () => {
  it("returns the bootstrap log in canonical order", async () => {
    const store = new InMemoryPhilosEventStore([
      evt({ event_id: "b", timestamp: "2026-08-02T10:00:00+03:00" }),
      evt({ event_id: "a", timestamp: "2026-08-01T10:00:00+03:00" }),
    ]);
    expect((await store.load()).map((e) => e.event_id)).toEqual(["a", "b"]);
  });

  it("append makes the event visible to the next load", async () => {
    const store = new InMemoryPhilosEventStore([evt({ event_id: "a" })]);
    await store.append([evt({ event_id: "b", timestamp: "2026-08-02T10:00:00+03:00" })]);
    expect((await store.load()).map((e) => e.event_id)).toEqual(["a", "b"]);
  });

  it("throws AppendRejectedError, carrying every rejection", async () => {
    const store = new InMemoryPhilosEventStore([evt({ event_id: "a" })]);
    await expect(store.append([evt({ event_id: "a" })])).rejects.toThrow(AppendRejectedError);
  });

  it("a rejected append writes nothing", async () => {
    const store = new InMemoryPhilosEventStore([evt({ event_id: "a" })]);
    await store.append([evt({ event_id: "b", timestamp: "2026-08-02T10:00:00+03:00" })])
      .catch(() => undefined);
    await store.append([evt({ event_id: "bad", caused_by: ["ghost"] })]).catch(() => undefined);
    expect((await store.load()).map((e) => e.event_id)).toEqual(["a", "b"]);
  });
});

// ── ids and clocks ───────────────────────────────────────────────────────────

describe("id generation", () => {
  it("mints ids that sort in creation order", () => {
    // `inOrder` breaks timestamp ties with localeCompare, and a command emits
    // several events at one instant. Zero-padding is what makes lexicographic
    // order agree with creation order.
    const ids = createIdGenerator();
    const minted = [ids.next("ev"), ids.next("ev"), ids.next("ev")];
    expect([...minted].sort()).toEqual(minted);
  });

  it("keeps sorting correctly past the width of a single digit", () => {
    const ids = fixedIdGenerator(8);
    const minted = Array.from({ length: 4 }, () => ids.next("ev"));
    expect(minted).toEqual(["ev_000009", "ev_000010", "ev_000011", "ev_000012"]);
    expect([...minted].sort()).toEqual(minted);
  });

  it("does not repeat an id within a generator", () => {
    const ids = createIdGenerator();
    const minted = Array.from({ length: 50 }, () => ids.next("ev"));
    expect(new Set(minted).size).toBe(50);
  });
});

describe("clock", () => {
  it("systemClock emits a timestamp the validator accepts", () => {
    expect(hasUnambiguousTimestamp(systemClock.now())).toBe(true);
  });

  it("today is derived from the same clock that stamps events", () => {
    // Both sides read one source, so an event is always findable under the date
    // the screen calls today.
    const clock = fixedClock("2026-08-03T21:30:00Z");
    expect(todayIn(clock)).toBe("2026-08-03");
    expect(clock.now().startsWith(todayIn(clock))).toBe(true);
  });
});
