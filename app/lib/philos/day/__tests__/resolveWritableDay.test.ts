/**
 * THE FORM CANNOT CHOOSE THE DAY.
 *
 * `day_ref` was read from FormData and checked only for non-emptiness, so a
 * submitted Action could name a day that was never opened, or one already
 * closed, and close its gates anyway.
 */
import { describe, expect, it } from "vitest";

import { resolveWritableDay } from "../resolveWritableDay";
import { DAY_CLOSING_RECORDED, DAY_OPENED } from "../dayEvent";
import type { PhilosEvent } from "../../events";

const SUBJ = "person_roei";
const D27 = "day_2026-08-27_person_roei";
const D28 = "day_2026-08-28_person_roei";

const opened = (day_id: string, subject_id = SUBJ) => ({
  event_id: `ev_open_${day_id}`, event_type: DAY_OPENED, actor_id: "p_you",
  payload: { day_id, subject_id },
}) as unknown as PhilosEvent;

const closed = (day_id: string) => ({
  event_id: `ev_close_${day_id}`, event_type: DAY_CLOSING_RECORDED, actor_id: "p_you",
  payload: { day_id },
}) as unknown as PhilosEvent;

const noise = () => ({
  event_id: "ev_other", event_type: "update.posted", actor_id: "p_you", payload: {},
}) as unknown as PhilosEvent;

describe("the correct active day is resolved", () => {
  it("one open day → that day, whatever the clock says", () => {
    const r = resolveWritableDay([noise(), opened(D27)], SUBJ);
    expect(r).toEqual({ ok: true, day_ref: D27 });
  });

  it("the day is NOT derived from the calendar — an unopened 'today' is not eligible", () => {
    /* The clock has rolled to the 28th; only the 27th was opened. The 27th
       is still the writable day, because a day is opened, not dated into
       existence. */
    const r = resolveWritableDay([opened(D27)], SUBJ);
    expect(r.ok && r.day_ref).toBe(D27);
  });
});

describe("every refusal fails closed", () => {
  it("no day was opened → refused", () => {
    const r = resolveWritableDay([noise()], SUBJ);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("no_open_day");
  });

  it("another person's day is not eligible", () => {
    const r = resolveWritableDay([opened("day_2026-08-27_person_bet", "person_bet")], SUBJ);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("no_open_day");
  });

  it("a day_id that looks like mine but was opened FOR someone else is rejected", () => {
    /* The id string is not the authority; the payload's subject is. */
    const r = resolveWritableDay([opened(D27, "person_bet")], SUBJ);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("no_open_day");
  });

  it("a closed day is refused, never appended to", () => {
    const r = resolveWritableDay([opened(D27), closed(D27)], SUBJ);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("day_already_closed");
      expect(r.candidates).toEqual([D27]);
    }
  });

  it("TWO open days refuse — the writer never picks latest", () => {
    const r = resolveWritableDay([opened(D27), opened(D28)], SUBJ);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("ambiguous_open_days");
      expect(r.candidates.sort()).toEqual([D27, D28]);
      /* The failure names both. It does not silently prefer the newer. */
      expect(r.message).not.toContain(D28.slice(-8));
    }
  });

  it("closing one of two makes the remaining one unambiguous", () => {
    const r = resolveWritableDay([opened(D27), opened(D28), closed(D28)], SUBJ);
    expect(r).toEqual({ ok: true, day_ref: D27 });
  });

  it("a closing for someone else's day cannot retire mine", () => {
    const r = resolveWritableDay(
      [opened(D27), closed("day_2026-08-27_person_bet")], SUBJ);
    expect(r).toEqual({ ok: true, day_ref: D27 });
  });
});

describe("the resolver is pure", () => {
  it("reads no clock — the same events give the same answer every time", () => {
    const events = [opened(D27)];
    const a = resolveWritableDay(events, SUBJ);
    const b = resolveWritableDay(events, SUBJ);
    expect(a).toEqual(b);
    expect(events).toHaveLength(1);
  });

  it("malformed openings are ignored, not crashed on", () => {
    const bad = { event_id: "x", event_type: DAY_OPENED, payload: {} } as unknown as PhilosEvent;
    const r = resolveWritableDay([bad, opened(D27)], SUBJ);
    expect(r).toEqual({ ok: true, day_ref: D27 });
  });
});
