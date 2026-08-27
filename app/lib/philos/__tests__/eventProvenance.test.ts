/**
 * SEED EVENTS MAY NOT BE COUNTED AS REAL.
 *
 * `philos-event-store.load()` returns `[...bootstrap, ...appended]`, and every
 * projection downstream received that union as one log. The Community terminal
 * reported "9 members · ILS 13,400" on a REAL screen from a compiled bundle.
 */
import { describe, expect, it } from "vitest";

import {
  BOOTSTRAP_LABEL, countByOrigin, isBootstrapEvent, isRealEvent, splitByOrigin,
} from "../eventProvenance";
import { VALUE_GROUP_EVENTS } from "../valueGroupLog";
import type { PhilosEvent } from "../events";

const appended = (id: string) => ({ event_id: id }) as PhilosEvent;

describe("origin classification", () => {
  it("every compiled seed event is classified as bootstrap, none as real", () => {
    expect(VALUE_GROUP_EVENTS.length).toBeGreaterThan(0);
    for (const e of VALUE_GROUP_EVENTS) {
      expect(isBootstrapEvent(e)).toBe(true);
      expect(isRealEvent(e)).toBe(false);
    }
  });

  it("an appended record is real — a stored id can never collide with a seed id", () => {
    const e = appended("dayev_opened_6414379eaf4107db669bba2f74312dbe");
    expect(isBootstrapEvent(e)).toBe(false);
    expect(isRealEvent(e)).toBe(true);
  });

  it("the union is split, never averaged", () => {
    const log = [...VALUE_GROUP_EVENTS, appended("real_1"), appended("real_2")];
    const { real, bootstrap } = splitByOrigin(log);
    expect(real.map((e) => e.event_id)).toEqual(["real_1", "real_2"]);
    expect(bootstrap.length).toBe(VALUE_GROUP_EVENTS.length);
    /* The whole defect in one assertion: the total is not the real count. */
    expect(real.length).not.toBe(log.length);
  });

  it("a figure with no real backing is flagged, so a screen cannot imply one", () => {
    expect(countByOrigin(VALUE_GROUP_EVENTS).bootstrapOnly).toBe(true);
    expect(countByOrigin([appended("r")]).bootstrapOnly).toBe(false);
    expect(countByOrigin([]).bootstrapOnly).toBe(false);
  });

  it("the visible label never says REAL", () => {
    expect(BOOTSTRAP_LABEL).toContain("לא נתון REAL");
    expect(BOOTSTRAP_LABEL).not.toMatch(/^REAL/);
  });

  it("the seeded roster is what inflated the member figure", () => {
    /* Named explicitly so a future change to the bundle shows up here rather
       than as a silently different number on a REAL screen. */
    const joins = VALUE_GROUP_EVENTS.filter((e) => e.event_type === "member.joined");
    expect(joins.length).toBe(5);
    expect(countByOrigin(joins)).toEqual({ real: 0, bootstrap: 5, bootstrapOnly: true });
  });
});
