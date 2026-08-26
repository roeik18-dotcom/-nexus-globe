/**
 * THE VISIBLE OBSERVATION → DAY OPENING LINK.
 *
 * Two claims, tested together because they must never diverge: what the form
 * OFFERS and what the writer ACCEPTS are the same predicate. A record that
 * cannot appear in the list must also be refused when submitted directly, and
 * every refusal must happen BEFORE the append — the log is append-only, so a
 * bad record cannot be edited out afterwards.
 */
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { _setCanonEventStore } from "../../canon/canonEventStoreAccessor";
import { InMemoryCanonEventStore } from "../../canon/canonEventStore";
import { _setPhilosEventStore, FileSystemPhilosEventStore, loadPhilosEvents } from "@/app/lib/philos-event-store";
import type { CanonEvent } from "../../canon/canonEvent";
import type { Observation } from "../../canon/observation";
import type { RecordOrigin } from "../../recordOrigin";
import { REAL_CURRENT_SUBJECT } from "@/app/lib/philos/subjectRegistry";
import { openDayCore } from "../dayActions";
import {
  isLinkableObservation, resolveSubmittedObservationRef, selectLinkableObservations,
} from "../linkableObservations";
import { asDayOpened } from "../dayEvent";

const SUBJECT = REAL_CURRENT_SUBJECT;
const OTHER = "person_someone_else";

function obs(over: Partial<Observation> = {}): Observation {
  return {
    subject: SUBJECT, domain: "E", frame: "I", reference: "self_baseline",
    context: "נצפה בפועל", time: "2026-08-25T10:00:00+03:00",
    provenance: "self_reported", confidence: 0.8,
    expiry: "2026-09-25T10:00:00+03:00", level: -1, stability: 0,
    deficitType: "RELATIVE", analysis_unit_ids: ["time", "social", "systemic"], ...over,
  };
}

/** REAL by default — the only thing that is ever eligible. */
function ev(id: string, o: Observation = obs(), origin: RecordOrigin = "REAL",
            recorded_at = "2026-08-25T10:00:00Z"): CanonEvent {
  return { canon_event_id: id, canon_type: "observation", payload: o, recorded_at,
    record_origin: origin };
}

/** A record written before `record_origin` existed: the key is absent. */
function legacyEv(id: string, o: Observation = obs()): CanonEvent {
  return { canon_event_id: id, canon_type: "observation", payload: o,
    recorded_at: "2026-08-25T10:00:00Z" };
}

const ids = (events: readonly CanonEvent[]) =>
  selectLinkableObservations({ events, subject_id: SUBJECT }).map((o) => o.canon_event_id);

describe("which Observations the form may offer", () => {
  it("1. an eligible same-subject REAL Observation appears", () => {
    const list = selectLinkableObservations({ events: [ev("ce_real")], subject_id: SUBJECT });
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      canon_event_id: "ce_real",
      observed_at: "2026-08-25T10:00:00+03:00",
      context: "נצפה בפועל",
      classifiedUnitCount: 3,
    });
  });

  /* 2–6: excluded by ORIGIN, every one naming the viewer's own subject — so a
     subject test could not have caught any of them. */
  for (const origin of ["DEMO", "DERIVED", "IMPORTED", "UNKNOWN"] as const) {
    it(`same-subject ${origin} is excluded`, () => {
      expect(ids([ev(`ce_${origin}`, obs(), origin)])).toEqual([]);
    });
  }

  it("6. a same-subject record with NO record_origin is excluded", () => {
    expect(ids([legacyEv("ce_legacy")])).toEqual([]);
  });

  it("7. another subject's REAL Observation is excluded", () => {
    expect(ids([ev("ce_other", obs({ subject: OTHER }))])).toEqual([]);
  });

  it("a non-observation canon record is excluded", () => {
    const notObs = { ...ev("ce_effect"), canon_type: "effect" } as unknown as CanonEvent;
    expect(ids([notObs])).toEqual([]);
  });

  it("an invalid Observation payload is excluded — it could never resolve", () => {
    expect(ids([ev("ce_bad", obs({ confidence: 5 }))])).toEqual([]);
  });

  it("8. ordering is newest-first by recorded_at, ties broken deterministically", () => {
    const events = [
      ev("ce_old", obs(), "REAL", "2026-08-20T09:00:00Z"),
      ev("ce_new", obs(), "REAL", "2026-08-26T09:00:00Z"),
      ev("ce_mid", obs(), "REAL", "2026-08-23T09:00:00Z"),
    ];
    expect(ids(events)).toEqual(["ce_new", "ce_mid", "ce_old"]);
    /* Same instant: still a total order, and the same one every render. */
    const tied = [
      ev("ce_aaa", obs(), "REAL", "2026-08-26T09:00:00Z"),
      ev("ce_zzz", obs(), "REAL", "2026-08-26T09:00:00Z"),
    ];
    expect(ids(tied)).toEqual(ids([...tied].reverse()));
  });

  it("only the REAL one survives a mixed store", () => {
    expect(ids([
      ev("ce_demo2", obs(), "DEMO"),
      legacyEv("ce_legacy2"),
      ev("ce_keep"),
      ev("ce_other2", obs({ subject: OTHER })),
      ev("ce_imported2", obs(), "IMPORTED"),
    ])).toEqual(["ce_keep"]);
  });

  it("20. the selector mutates no CanonEvent", () => {
    const events = [ev("ce_a"), ev("ce_b", obs(), "DEMO")];
    const before = JSON.stringify(events);
    selectLinkableObservations({ events, subject_id: SUBJECT });
    expect(JSON.stringify(events)).toBe(before);
  });

  it("the offered predicate and the single-record predicate agree", () => {
    const cases: CanonEvent[] = [
      ev("a"), ev("b", obs(), "DEMO"), ev("c", obs(), "DERIVED"),
      ev("d", obs(), "IMPORTED"), ev("e", obs(), "UNKNOWN"),
      legacyEv("f"), ev("g", obs({ subject: OTHER })), ev("h", obs({ confidence: 5 })),
    ];
    for (const c of cases) {
      expect(isLinkableObservation(c, SUBJECT), c.canon_event_id)
        .toBe(ids([c]).length === 1);
    }
  });
});

describe("resolving a SUBMITTED ref — untrusted input", () => {
  const store = [ev("ce_ok"), ev("ce_demo", obs(), "DEMO"),
    legacyEv("ce_legacy"), ev("ce_other", obs({ subject: OTHER })),
    ev("ce_invalid", obs({ confidence: 5 }))];

  it("accepts the eligible one and returns the id to write", () => {
    expect(resolveSubmittedObservationRef("ce_ok", store, SUBJECT))
      .toEqual({ ok: true, canon_event_id: "ce_ok" });
  });

  it("a forged id is observation_not_found", () => {
    const r = resolveSubmittedObservationRef("ce_does_not_exist", store, SUBJECT);
    expect(r).toMatchObject({ ok: false, reason: "observation_not_found" });
  });

  it("another subject's record is a SUBJECT MISMATCH, not 'not found'", () => {
    const r = resolveSubmittedObservationRef("ce_other", store, SUBJECT);
    expect(r).toMatchObject({ ok: false, reason: "observation_subject_mismatch" });
  });

  it("a non-REAL record is observation_not_real", () => {
    for (const id of ["ce_demo", "ce_legacy"]) {
      expect(resolveSubmittedObservationRef(id, store, SUBJECT), id)
        .toMatchObject({ ok: false, reason: "observation_not_real" });
    }
  });

  it("an invalid payload is observation_invalid", () => {
    expect(resolveSubmittedObservationRef("ce_invalid", store, SUBJECT))
      .toMatchObject({ ok: false, reason: "observation_invalid" });
  });
});

/**
 * THE WRITE PATH. Every refusal below must leave the PhilosEvent log empty —
 * proven by reading the log back, not by trusting the returned message.
 */
describe("openDayCore — the day.opened write", () => {
  let canon: InMemoryCanonEventStore;
  let dir: string;

  const fd = (fields: Record<string, string>) => {
    const f = new FormData();
    for (const [k, v] of Object.entries(fields)) f.set(k, v);
    return f;
  };
  const base = { intention: "כוונה", context: "הקשר", consent: "on" };

  beforeEach(async () => {
    canon = new InMemoryCanonEventStore();
    await canon.append([ev("ce_ok"), ev("ce_demo", obs(), "DEMO"),
      legacyEv("ce_legacy"), ev("ce_other", obs({ subject: OTHER }))]);
    _setCanonEventStore(canon);
    dir = mkdtempSync(join(tmpdir(), "day-link-"));
    _setPhilosEventStore(new FileSystemPhilosEventStore(dir));
  });
  afterEach(() => {
    _setCanonEventStore(null);
    _setPhilosEventStore(null);
    rmSync(dir, { recursive: true, force: true });
  });

  /** The day.opened records actually in the log, ignoring the bootstrap seed. */
  const openings = async () =>
    (await loadPhilosEvents()).map(asDayOpened).filter((d) => d !== null);

  it("9. a valid REAL selection writes both refs equal to the canon_event_id", async () => {
    const r = await openDayCore(fd({ ...base, observation_ref: "ce_ok" }));
    expect(r.ok).toBe(true);
    const [opened] = await openings();
    expect(opened!.payload.event_ref).toBe("ce_ok");
    expect(opened!.payload.observation_ref).toBe("ce_ok");
    expect(opened!.payload.event_ref).toBe(opened!.payload.observation_ref);
  });

  it("10. a forged id is rejected BEFORE append — nothing is written", async () => {
    const r = await openDayCore(fd({ ...base, observation_ref: "ce_forged" }));
    expect(r.ok).toBe(false);
    expect((r as { message: string }).message).toContain("observation_not_found");
    expect(await openings()).toHaveLength(0);
  });

  it("11. another subject's id is rejected before append", async () => {
    const r = await openDayCore(fd({ ...base, observation_ref: "ce_other" }));
    expect(r.ok).toBe(false);
    expect((r as { message: string }).message).toContain("observation_subject_mismatch");
    expect(await openings()).toHaveLength(0);
  });

  it("12. a non-REAL id is rejected before append", async () => {
    for (const id of ["ce_demo", "ce_legacy"]) {
      const r = await openDayCore(fd({ ...base, observation_ref: id }));
      expect(r.ok, id).toBe(false);
      expect((r as { message: string }).message).toContain("observation_not_real");
    }
    expect(await openings()).toHaveLength(0);
  });

  it("13. an invalid Observation payload is rejected before append", async () => {
    /* `checkCanonAppend` refuses to STORE an invalid record, so this state can
       only arise from a line that reached the log another way — a hand-edited
       or externally-written JSONL. The store is stubbed to return exactly
       that, because the refusal has to hold for records the append path never
       vetted; those are precisely the ones worth refusing. */
    const broken = ev("ce_broken", obs({ confidence: 5 }));
    _setCanonEventStore({
      load: async () => [broken],
      append: async () => { throw new Error("not used"); },
    });
    const r = await openDayCore(fd({ ...base, observation_ref: "ce_broken" }));
    expect(r.ok).toBe(false);
    expect((r as { message: string }).message).toContain("observation_invalid");
    expect(await openings()).toHaveLength(0);
  });

  it("14. a client-supplied event_ref is IGNORED — the server derives it", async () => {
    const r = await openDayCore(fd({
      ...base, observation_ref: "ce_ok", event_ref: "ce_other",
    }));
    expect(r.ok).toBe(true);
    const [opened] = await openings();
    /* Not "ce_other". The submitted event_ref reached no code path at all. */
    expect(opened!.payload.event_ref).toBe("ce_ok");
    expect(opened!.payload.observation_ref).toBe("ce_ok");
  });

  it("15. client-supplied subject_id / person_id / record_origin cannot alter authority", async () => {
    const r = await openDayCore(fd({
      ...base, observation_ref: "ce_ok",
      subject_id: OTHER, person_id: OTHER, record_origin: "REAL",
    }));
    expect(r.ok).toBe(true);
    const [opened] = await openings();
    /* The server-resolved viewer won, not the submitted strings. */
    expect(opened!.payload.subject_id).toBe(SUBJECT);
    expect(opened!.payload.day_id).toContain(SUBJECT);
  });

  it("a forged subject cannot borrow another person's REAL observation", async () => {
    const r = await openDayCore(fd({
      ...base, observation_ref: "ce_other", subject_id: OTHER,
    }));
    expect(r.ok).toBe(false);
    expect(await openings()).toHaveLength(0);
  });

  it("16. no selection opens the day with NO refs and leaves the gate unresolved", async () => {
    const r = await openDayCore(fd(base));
    expect(r.ok).toBe(true);
    const [opened] = await openings();
    expect(opened!.payload.event_ref).toBeUndefined();
    expect(opened!.payload.observation_ref).toBeUndefined();
  });

  it("an empty-string selection is the same as no selection", async () => {
    const r = await openDayCore(fd({ ...base, observation_ref: "" }));
    expect(r.ok).toBe(true);
    expect((await openings())[0]!.payload.observation_ref).toBeUndefined();
  });

  it("17. replay does not create a second opening", async () => {
    const first = await openDayCore(fd({ ...base, observation_ref: "ce_ok" }));
    expect(first.ok).toBe(true);
    const second = await openDayCore(fd({ ...base, observation_ref: "ce_ok" }));
    expect(second.ok).toBe(false);
    expect((second as { message: string }).message).toContain("כבר נפתח");
    expect(await openings()).toHaveLength(1);
  });

  it("consent is still genuinely required — a refusal writes nothing", async () => {
    const r = await openDayCore(fd({ intention: "כ", context: "ה", observation_ref: "ce_ok" }));
    expect(r.ok).toBe(false);
    expect(await openings()).toHaveLength(0);
  });

  it("19. the write leaves every stored CanonEvent byte-identical", async () => {
    const before = JSON.stringify(await canon.load());
    await openDayCore(fd({ ...base, observation_ref: "ce_ok" }));
    expect(JSON.stringify(await canon.load())).toBe(before);
  });

  it("the day.opened payload carries no record_origin of its own", async () => {
    await openDayCore(fd({ ...base, observation_ref: "ce_ok", record_origin: "REAL" }));
    const [opened] = await openings();
    expect((opened!.payload as unknown as Record<string, unknown>).record_origin).toBeUndefined();
  });
});

/**
 * 18. A historical date renders no write control. Asserted against the panel's
 * own source rather than a DOM render: the rule is a branch that returns a
 * read-only section before any <form> exists, and that is what must not regress.
 */
describe("historical dates stay read-only", () => {
  it("18. the read-only branch precedes every form in the opening panel", () => {
    const src = readFileSync(
      join(__dirname, "..", "..", "..", "..", "hub", "DayPanels.tsx"), "utf-8");
    const readOnlyBranch = src.indexOf("if (readOnly && !alreadyOpen)");
    const firstForm = src.indexOf("<form");
    expect(readOnlyBranch).toBeGreaterThan(-1);
    expect(readOnlyBranch).toBeLessThan(firstForm);
    expect(src).toContain("פתיחה זמינה רק ליום הנוכחי");
  });

  it("the selector is inside the form, so the read-only branch excludes it too", () => {
    const src = readFileSync(
      join(__dirname, "..", "..", "..", "..", "hub", "DayPanels.tsx"), "utf-8");
    expect(src.indexOf("<form")).toBeLessThan(src.indexOf("data-observation-link"));
  });

  it("no free-text event_ref or observation_ref input exists anywhere in the panel", () => {
    const src = readFileSync(
      join(__dirname, "..", "..", "..", "..", "hub", "DayPanels.tsx"), "utf-8");
    expect(src).not.toMatch(/<input[^>]*name="event_ref"/);
    expect(src).not.toMatch(/<input[^>]*name="observation_ref"/);
    expect(src).toMatch(/<select name="observation_ref"/);
  });
});
