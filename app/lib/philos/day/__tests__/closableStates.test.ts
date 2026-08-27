/**
 * A DAY MAY ONLY CLOSE ON A STATE IT ACTUALLY PRODUCED.
 *
 * `state_t1_refs` was free text hinting `obs_…` — the wrong prefix — so a
 * person following the hint typed a ref that could never resolve and the gate
 * stayed shut in silence.
 */
import { describe, expect, it } from "vitest";

import {
  isClosableState, selectClosableStates, resolveSubmittedClosingState,
} from "../closableStates";
import type { DomainStateRecord } from "../../canon/domainStateStore";

const SUBJ = "person_roei";
const ACT = "action_day_1", EFF = "effect_day_1";
const CHAIN = [ACT, EFF];

const st = (over: Record<string, unknown> = {}, stateOver: Record<string, unknown> = {}) => ({
  state_id: "dstate_t1", recorded_at: "2026-08-27T23:00:00.000Z",
  caused_by_ref: EFF,
  state: { subject: SUBJ, provenance: "REAL", domain_id: "human_temperament",
    parameter_id: "temperament_response_intensity", level: 1, confidence: 0.8,
    observed_at: "2026-08-27T23:00:00.000Z", ...stateOver },
  ...over,
}) as unknown as DomainStateRecord;

const resolve = (id: string, rs: DomainStateRecord[]) =>
  resolveSubmittedClosingState(id, rs, SUBJ, CHAIN);

describe("the eligible list", () => {
  it("a REAL, own, day-caused state is offered", () => {
    expect(isClosableState(st(), SUBJ, CHAIN)).toBe(true);
    expect(selectClosableStates({ records: [st()], subject_id: SUBJ, dayChainRefs: CHAIN }))
      .toHaveLength(1);
  });

  it("the t0 state — REAL and mine, but with NO cause — is NOT offered", () => {
    /* This is the precise difference from the opening: t0 needs no cause, t1
       does, and offering t0 here would let a day close on where it started. */
    const t0 = st({ state_id: "dstate_t0", caused_by_ref: undefined });
    expect(isClosableState(t0, SUBJ, CHAIN)).toBe(false);
    expect(selectClosableStates({ records: [t0], subject_id: SUBJ, dayChainRefs: CHAIN }))
      .toHaveLength(0);
  });

  it("a state caused by ANOTHER day's action is not offered", () => {
    expect(isClosableState(st({ caused_by_ref: "effect_other_day" }), SUBJ, CHAIN)).toBe(false);
  });

  it("DEMO and other-subject states are not offered", () => {
    expect(isClosableState(st({}, { provenance: "DEMO" }), SUBJ, CHAIN)).toBe(false);
    expect(isClosableState(st({}, { subject: "person_bet" }), SUBJ, CHAIN)).toBe(false);
  });

  it("newest first, ties broken deterministically", () => {
    const a = st({ state_id: "dstate_a", recorded_at: "2026-08-27T22:00:00.000Z" });
    const b = st({ state_id: "dstate_b", recorded_at: "2026-08-27T23:00:00.000Z" });
    expect(selectClosableStates({ records: [a, b], subject_id: SUBJ, dayChainRefs: CHAIN })
      .map((x) => x.state_id)).toEqual(["dstate_b", "dstate_a"]);
  });
});

describe("every refusal is named, and none falls back", () => {
  it("a forged id is NOT FOUND", () => {
    const r = resolve("dstate_forged", [st()]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("state_not_found");
  });

  it("another person's state is a SUBJECT MISMATCH, not a pretend-absence", () => {
    const r = resolve("dstate_t1", [st({}, { subject: "person_bet" })]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("state_subject_mismatch");
  });

  it("a DEMO state is refused on provenance", () => {
    const r = resolve("dstate_t1", [st({}, { provenance: "DEMO" })]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("state_not_real");
  });

  it("a state with no causal link is refused, and the message says why", () => {
    const r = resolve("dstate_t1", [st({ caused_by_ref: undefined })]);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("state_no_cause");
      expect(r.message).toContain("שדבר לא הוליד");
    }
  });

  it("a cause outside this day is refused separately from having no cause", () => {
    const r = resolve("dstate_t1", [st({ caused_by_ref: "effect_someone_elses" })]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("state_cause_outside_day");
  });

  it("a valid state resolves to its own id and nothing else", () => {
    const other = st({ state_id: "dstate_other" });
    const r = resolve("dstate_t1", [st(), other]);
    expect(r).toEqual({ ok: true, state_id: "dstate_t1" });
  });
});

describe("the server refuses a second closing, not just the UI", () => {
  it("recordDayClosingCore names the day as already closed", async () => {
    /* The UI stops offering the form once a day is closed, which is right —
       but the writer must refuse on its own, because a form is not a
       boundary. Asserted on the source so this cannot regress into relying on
       an opaque duplicate-id error from the store. */
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(join(process.cwd(), "app/lib/philos/day/dayActions.ts"), "utf8");
    expect(src).toContain("asDayClosingRecorded(e)?.payload.day_id === day_id");
    expect(src).toContain("כבר נסגר");
    /* And every cited t1 is re-resolved server-side before the append. */
    expect(src).toContain("resolveSubmittedClosingState(");
  });
});
