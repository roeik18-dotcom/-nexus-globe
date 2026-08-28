/**
 * CLOSING FOLLOWS THE OPEN DAY, NOT THE CLOCK — AND NOT THE FORM.
 *
 * `recordDayClosingCore` derived the day from `formData.get("date")`, falling
 * back to `todayIn(systemClock)` — UTC. A person who opened a day at 22:00
 * local found it read-only at 01:00: the day rolled over in a timezone they do
 * not live in, on a day they had not finished. The same field also let a
 * client name any day at all.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));

import { _setPhilosEventStore, loadPhilosEvents } from "@/app/lib/philos-event-store";

const SUBJ = "person_roei";
const D27 = "day_2026-08-27_person_roei";
const D26 = "day_2026-08-26_person_roei";

let dir: string, prev: string | undefined;

const opened = (day_id: string, subject_id = SUBJ) => JSON.stringify({
  event_id: `ev_open_${day_id}`, actor_id: "p_you", entity_type: "person",
  entity_id: "p_you", event_type: "day.opened", value_tags: [],
  timestamp: "2026-08-27T06:00:00.000Z", visibility: "private", caused_by: [],
  payload: { day_id, subject_id, intention: "i", context: "c",
    state_t0_refs: [], carry_forward_refs: [], consent: true, sourceRefs: [] },
});
const closed = (day_id: string) => JSON.stringify({
  event_id: `ev_close_${day_id}`, actor_id: "p_you", entity_type: "person",
  entity_id: "p_you", event_type: "day.closing_recorded", value_tags: [], caused_by: [],
  timestamp: "2026-08-27T22:00:00.000Z", visibility: "private",
  payload: { day_id, subject_id: SUBJ, state_t1_refs: [], action_refs: [],
    effect_refs: [], evidence_refs: [], learning_refs: [], open_loop_refs: [],
    consent: true, sourceRefs: [] },
});

function seed(lines: string[]) {
  writeFileSync(join(dir, "philos-events.jsonl"), lines.join("\n") + (lines.length ? "\n" : ""), "utf8");
  _setPhilosEventStore(null);
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "philos-close-"));
  prev = process.env.PHILOS_DATA_DIR; process.env.PHILOS_DATA_DIR = dir;
  seed([opened(D27)]);
});
afterEach(() => {
  if (prev === undefined) delete process.env.PHILOS_DATA_DIR; else process.env.PHILOS_DATA_DIR = prev;
  _setPhilosEventStore(null);
  rmSync(dir, { recursive: true, force: true });
});

function fd(over: Record<string, string> = {}) {
  const f = new FormData();
  f.set("consent", "on");
  for (const [k, v] of Object.entries(over)) f.set(k, v);
  return f;
}
const close = async (f: FormData) => {
  const { recordDayClosingCore } = await import("../dayActions");
  return recordDayClosingCore(f);
};
const closings = async () =>
  (await loadPhilosEvents()).filter((e) => e.event_type === "day.closing_recorded").length;

describe("the day survives the UTC rollover", () => {
  it("a day opened yesterday is still closable today", async () => {
    /* No clock is consulted, so the calendar cannot retire an unfinished day. */
    const r = await close(fd());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.day_id).toBe(D27);
  });

  it("a forged date in FormData cannot redirect the closing", async () => {
    const r = await close(fd({ date: "2026-01-01" }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.day_id).toBe(D27);
  });
});

describe("refusals write nothing", () => {
  it("no open day → refused", async () => {
    seed([]);
    const r = await close(fd({ date: "2026-08-27" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain("לא נפתח יום");
    expect(await closings()).toBe(0);
  });

  it("already closed → refused, and no second closing is appended", async () => {
    seed([opened(D27), closed(D27)]);
    const r = await close(fd());
    expect(r.ok).toBe(false);
    expect(await closings()).toBe(1);
  });

  it("TWO open days → refused, and neither is chosen", async () => {
    seed([opened(D26), opened(D27)]);
    const r = await close(fd());
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.message).toContain("יותר מיום פתוח אחד");
      expect(r.message).toContain(D26);
      expect(r.message).toContain(D27);
    }
    expect(await closings()).toBe(0);
  });

  it("another person's open day is not closable by this viewer", async () => {
    seed([opened("day_2026-08-27_person_bet", "person_bet")]);
    const r = await close(fd());
    expect(r.ok).toBe(false);
    expect(await closings()).toBe(0);
  });

  it("consent stays mandatory", async () => {
    const f = fd(); f.delete("consent");
    const r = await close(f);
    expect(r.ok).toBe(false);
    expect(await closings()).toBe(0);
  });
});

describe("opening and closing now agree on what a day is", () => {
  it("both use resolveWritableDay for the ACTIVE day; opening still takes a date", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(join(process.cwd(), "app/lib/philos/day/dayActions.ts"), "utf8");
    const closingBody = src.slice(src.indexOf("export async function recordDayClosingCore"));
    /* The closing must not read a date at all. */
    expect(closingBody).not.toMatch(/formData\.get\(\s*["']date["']\s*\)/);
    expect(closingBody).toContain("resolveWritableDay(");
    /* Opening legitimately still creates a day for a given date. */
    const openingBody = src.slice(src.indexOf("export async function openDayCore"),
      src.indexOf("export async function recordDayClosingCore"));
    expect(openingBody).toMatch(/formData\.get\(\s*["']date["']\s*\)/);
  });
});
