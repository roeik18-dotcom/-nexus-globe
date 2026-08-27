/**
 * THE STATE(t0) ANCHOR — offered, and accepted, by the same predicate.
 *
 * `state_t0_refs` was free text with an `obs_…` placeholder that pointed at
 * the wrong id space entirely. A person following it opened a day whose
 * State(t0) named nothing — and because the opening is the only writer of
 * that field and a second opening is refused, the gate stayed shut forever
 * with no way back.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { _setDomainStateStore } from "../../canon/domainStateStoreAccessor";
import { InMemoryDomainStateStore } from "../../canon/domainStateStore";
import type { DomainStateRecord } from "../../canon/domainStateStore";
import { _setPhilosEventStore, FileSystemPhilosEventStore, loadPhilosEvents } from "@/app/lib/philos-event-store";
import { _setCanonEventStore } from "../../canon/canonEventStoreAccessor";
import { InMemoryCanonEventStore } from "../../canon/canonEventStore";
import type { CanonEvent } from "../../canon/canonEvent";
import type { Observation } from "../../canon/observation";
import { REAL_CURRENT_SUBJECT } from "@/app/lib/philos/subjectRegistry";
import { openDayCore } from "../dayActions";
import { asDayOpened } from "../dayEvent";
import {
  isLinkableState, resolveSubmittedStateRef, selectLinkableStates,
} from "../linkableStates";

const SUBJECT = REAL_CURRENT_SUBJECT;
const OTHER = "person_someone_else";

function st(over: Partial<DomainStateRecord> = {}, sOver: Partial<DomainStateRecord["state"]> = {}): DomainStateRecord {
  return {
    state_id: "dstate_1", recorded_at: "2026-08-27T08:00:00Z",
    state: {
      domain_id: "HUMAN", parameter_id: "energy", subject: SUBJECT,
      level: -1, confidence: 0.8, observed_at: "2026-08-27T08:00:00Z",
      provenance: "REAL", ...sOver,
    },
    ...over,
  };
}
const ids = (records: DomainStateRecord[]) =>
  selectLinkableStates({ records, subject_id: SUBJECT }).map((x) => x.state_id);

describe("which State(t0) records may be offered", () => {
  it("1. a same-subject REAL state appears", () => {
    const [only] = selectLinkableStates({ records: [st()], subject_id: SUBJECT });
    expect(only).toMatchObject({
      state_id: "dstate_1", domain_id: "HUMAN", parameter_id: "energy",
      level: -1, declaresCause: false,
    });
  });

  it("2. a same-subject DEMO state is excluded", () => {
    expect(ids([st({}, { provenance: "DEMO" })])).toEqual([]);
  });

  it("7. another subject's REAL state is excluded", () => {
    expect(ids([st({}, { subject: OTHER })])).toEqual([]);
  });

  it("10. a malformed record is excluded", () => {
    expect(ids([st({ state_id: "  " })])).toEqual([]);
    expect(ids([st({}, { level: Number.NaN })])).toEqual([]);
    expect(ids([{ state_id: "dstate_x", recorded_at: "x" } as unknown as DomainStateRecord])).toEqual([]);
  });

  it("a state that declares a cause is still offered — the code imposes no t0 ban", () => {
    /* `daySession` resolves t0 WITHOUT `causedBy`; only t1 demands one. No
       executable rule forbids a t0 that declares a cause, so none is invented
       — the fact is surfaced on the option instead. */
    const [only] = selectLinkableStates({
      records: [st({ caused_by_ref: "effect_1" })], subject_id: SUBJECT });
    expect(only.declaresCause).toBe(true);
  });

  it("newest-first, ties broken deterministically", () => {
    const recs = [
      st({ state_id: "dstate_old", recorded_at: "2026-08-20T08:00:00Z" }),
      st({ state_id: "dstate_new", recorded_at: "2026-08-27T08:00:00Z" }),
    ];
    expect(ids(recs)).toEqual(["dstate_new", "dstate_old"]);
    const tied = [
      st({ state_id: "dstate_aaa" }), st({ state_id: "dstate_zzz" }),
    ];
    expect(ids(tied)).toEqual(ids([...tied].reverse()));
  });

  it("15. selecting mutates nothing", () => {
    const recs = [st(), st({ state_id: "dstate_2" }, { provenance: "DEMO" })];
    const before = JSON.stringify(recs);
    selectLinkableStates({ records: recs, subject_id: SUBJECT });
    expect(JSON.stringify(recs)).toBe(before);
  });

  it("the offered predicate and the single-record predicate agree", () => {
    const cases = [st(), st({}, { provenance: "DEMO" }), st({}, { subject: OTHER }), st({ state_id: "" })];
    for (const c of cases) {
      expect(isLinkableState(c, SUBJECT), c.state_id).toBe(ids([c]).length === 1);
    }
  });
});

describe("resolving a SUBMITTED state ref", () => {
  const store = [st(), st({ state_id: "dstate_demo" }, { provenance: "DEMO" }),
    st({ state_id: "dstate_other" }, { subject: OTHER })];

  it("accepts the eligible one", () => {
    expect(resolveSubmittedStateRef("dstate_1", store, SUBJECT))
      .toEqual({ ok: true, state_id: "dstate_1" });
  });

  it("8. a forged id is state_not_found", () => {
    expect(resolveSubmittedStateRef("dstate_nope", store, SUBJECT))
      .toMatchObject({ ok: false, reason: "state_not_found" });
  });

  it("another subject's state is a SUBJECT MISMATCH, not 'not found'", () => {
    expect(resolveSubmittedStateRef("dstate_other", store, SUBJECT))
      .toMatchObject({ ok: false, reason: "state_subject_mismatch" });
  });

  it("a DEMO state is state_not_real", () => {
    expect(resolveSubmittedStateRef("dstate_demo", store, SUBJECT))
      .toMatchObject({ ok: false, reason: "state_not_real" });
  });
});

/** The write path: every refusal must leave the PhilosEvent log empty. */
describe("openDayCore — the State(t0) anchor", () => {
  let dir: string;
  const fd = (fields: Record<string, string>) => {
    const f = new FormData();
    for (const [k, v] of Object.entries(fields)) f.set(k, v);
    return f;
  };
  const base = { intention: "כוונה", context: "הקשר", consent: "on" };

  function obs(): Observation {
    return {
      subject: SUBJECT, domain: "E", frame: "I", reference: "self_baseline",
      context: "נצפה", time: "2026-08-27T08:00:00Z", provenance: "self_reported",
      confidence: 0.8, expiry: "2026-09-27T08:00:00Z", level: -1, stability: 0,
      deficitType: "RELATIVE", analysis_unit_ids: ["time"],
    };
  }
  const ev = (id: string): CanonEvent => ({
    canon_event_id: id, canon_type: "observation", payload: obs(),
    recorded_at: "2026-08-27T08:00:00Z", record_origin: "REAL",
  });

  beforeEach(async () => {
    const states = new InMemoryDomainStateStore();
    await states.append([st(), st({ state_id: "dstate_demo" }, { provenance: "DEMO" }),
      st({ state_id: "dstate_other" }, { subject: OTHER })]);
    _setDomainStateStore(states);
    const canon = new InMemoryCanonEventStore();
    await canon.append([ev("ce_ok")]);
    _setCanonEventStore(canon);
    dir = mkdtempSync(join(tmpdir(), "day-state-"));
    _setPhilosEventStore(new FileSystemPhilosEventStore(dir));
  });
  afterEach(() => {
    _setDomainStateStore(null); _setCanonEventStore(null); _setPhilosEventStore(null);
    rmSync(dir, { recursive: true, force: true });
  });

  const openings = async () =>
    (await loadPhilosEvents()).map(asDayOpened).filter((d) => d !== null);

  it("1. a valid REAL state is written into state_t0_refs", async () => {
    const r = await openDayCore(fd({ ...base, state_t0_refs: "dstate_1", observation_ref: "ce_ok" }));
    expect(r.ok).toBe(true);
    const [opened] = await openings();
    expect(opened!.payload.state_t0_refs).toEqual(["dstate_1"]);
    /* One append closes all three gates' prerequisites at once. */
    expect(opened!.payload.event_ref).toBe("ce_ok");
    expect(opened!.payload.observation_ref).toBe("ce_ok");
  });

  it("8. a forged state id is refused BEFORE append", async () => {
    const r = await openDayCore(fd({ ...base, state_t0_refs: "dstate_forged" }));
    expect(r.ok).toBe(false);
    expect((r as { message: string }).message).toContain("state_not_found");
    expect(await openings()).toHaveLength(0);
  });

  it("7. another subject's state is refused before append", async () => {
    const r = await openDayCore(fd({ ...base, state_t0_refs: "dstate_other" }));
    expect(r.ok).toBe(false);
    expect((r as { message: string }).message).toContain("state_subject_mismatch");
    expect(await openings()).toHaveLength(0);
  });

  it("2. a DEMO state is refused before append", async () => {
    const r = await openDayCore(fd({ ...base, state_t0_refs: "dstate_demo" }));
    expect(r.ok).toBe(false);
    expect((r as { message: string }).message).toContain("state_not_real");
    expect(await openings()).toHaveLength(0);
  });

  it("9. client-supplied subject/person/provenance cannot alter authority", async () => {
    const r = await openDayCore(fd({
      ...base, state_t0_refs: "dstate_1",
      subject_id: OTHER, person_id: OTHER, provenance: "REAL",
    }));
    expect(r.ok).toBe(true);
    const [opened] = await openings();
    expect(opened!.payload.subject_id).toBe(SUBJECT);
  });

  it("11. no selection opens a PARTIAL day with empty refs", async () => {
    const r = await openDayCore(fd(base));
    expect(r.ok).toBe(true);
    const [opened] = await openings();
    expect(opened!.payload.state_t0_refs).toEqual([]);
    expect(opened!.payload.observation_ref).toBeUndefined();
  });

  it("12. replay refuses a second opening — no duplicate", async () => {
    expect((await openDayCore(fd({ ...base, state_t0_refs: "dstate_1" }))).ok).toBe(true);
    const second = await openDayCore(fd({ ...base, state_t0_refs: "dstate_1" }));
    expect(second.ok).toBe(false);
    expect(await openings()).toHaveLength(1);
  });

  it("20. a refused opening writes zero records", async () => {
    for (const bad of ["dstate_forged", "dstate_demo", "dstate_other"]) {
      await openDayCore(fd({ ...base, date: `2026-09-0${bad.length % 9 + 1}`, state_t0_refs: bad }));
    }
    expect(await openings()).toHaveLength(0);
  });

  it("14. the domain-state store is never mutated by opening", async () => {
    const { loadDomainStates } = await import("../../canon/domainStateStoreAccessor");
    const before = JSON.stringify(await loadDomainStates());
    await openDayCore(fd({ ...base, state_t0_refs: "dstate_1" }));
    expect(JSON.stringify(await loadDomainStates())).toBe(before);
  });
});
