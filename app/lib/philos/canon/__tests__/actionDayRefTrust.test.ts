/**
 * A FORGED `day_ref` IN FORMDATA MUST NOT REACH THE RECORD.
 *
 * These drive the real server action against isolated stores, so the thing
 * under test is the writer a browser actually posts to.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/* `revalidatePath` needs Next's per-request store and throws outside one. The
   writer's behaviour is what these tests are about, not cache invalidation. */
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { _setActionStore, loadActions } from "../actionStoreAccessor";
import { _setPhilosEventStore } from "@/app/lib/philos-event-store";

const SUBJ = "person_roei";
const REAL_DAY = "day_2026-08-27_person_roei";

let dir: string, prevCanon: string | undefined, prevData: string | undefined;

const openedEvent = (day_id: string, subject_id = SUBJ) => JSON.stringify({
  event_id: `ev_open_${day_id}`, actor_id: "p_you", entity_type: "person",
  entity_id: "p_you", event_type: "day.opened", value_tags: [],
  timestamp: "2026-08-27T06:00:00.000Z", visibility: "private", caused_by: [],
  payload: { day_id, subject_id, intention: "i", context: "c",
    state_t0_refs: [], carry_forward_refs: [], consent: true, sourceRefs: [] },
});

function seed(eventLines: string[]) {
  writeFileSync(join(dir, "philos-events.jsonl"), eventLines.join("\n") + "\n", "utf8");
  _setActionStore(null); _setPhilosEventStore(null);
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "philos-dayref-"));
  prevCanon = process.env.CANON_DATA_DIR; prevData = process.env.PHILOS_DATA_DIR;
  process.env.CANON_DATA_DIR = dir; process.env.PHILOS_DATA_DIR = dir;
  seed([openedEvent(REAL_DAY)]);
});
afterEach(() => {
  if (prevCanon === undefined) delete process.env.CANON_DATA_DIR; else process.env.CANON_DATA_DIR = prevCanon;
  if (prevData === undefined) delete process.env.PHILOS_DATA_DIR; else process.env.PHILOS_DATA_DIR = prevData;
  _setActionStore(null); _setPhilosEventStore(null);
  rmSync(dir, { recursive: true, force: true });
});

/** Exactly what the browser posts, plus whatever `day_ref` we want to forge. */
function fd(over: Record<string, string> = {}) {
  const f = new FormData();
  f.set("type", "non_transfer");
  f.set("mechanism_scope", "self_regulation");
  f.set("reversibility", "ניתנת לביטול");
  f.set("provenance", "טקסט חופשי של המשתמש");
  f.set("consent", "on");
  for (const [k, v] of Object.entries(over)) f.set(k, v);
  return f;
}

const submit = async (f: FormData) => {
  const { createActionForCurrentUser } = await import("../actionFormAction");
  return createActionForCurrentUser(f);
};

describe("a forged day_ref is overridden, never written", () => {
  it("a completely invented day_ref is replaced by the resolved one", async () => {
    const r = await submit(fd({ day_ref: "day_1999-01-01_person_bet" }));
    expect(r.ok).toBe(true);
    const stored = await loadActions();
    expect(stored).toHaveLength(1);
    expect((stored[0].action as { day_ref?: string }).day_ref).toBe(REAL_DAY);
  });

  it("another person's day_ref cannot be attached", async () => {
    await submit(fd({ day_ref: "day_2026-08-27_person_bet" }));
    const stored = await loadActions();
    expect((stored[0].action as { day_ref?: string }).day_ref).toBe(REAL_DAY);
    expect(stored[0].action.owner).toBe(SUBJ);
  });

  it("FormData with NO day_ref still succeeds — the server supplies it", async () => {
    const r = await submit(fd());
    expect(r.ok).toBe(true);
    const stored = await loadActions();
    expect((stored[0].action as { day_ref?: string }).day_ref).toBe(REAL_DAY);
  });

  it("record_origin and owner stay server-derived", async () => {
    await submit(fd({ day_ref: "forged", record_origin: "REAL", owner: "person_bet" }));
    const [rec] = await loadActions();
    expect(rec.record_origin).toBe("REAL");
    expect(rec.action.owner).toBe(SUBJ);
    expect((rec.action as { day_ref?: string }).day_ref).toBe(REAL_DAY);
  });
});

describe("refusals write nothing at all", () => {
  it("no open day → refused, and ZERO appends", async () => {
    seed([]);
    const r = await submit(fd({ day_ref: REAL_DAY }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain("לא נפתח יום");
    expect(await loadActions()).toHaveLength(0);
  });

  it("a closed day → refused, and ZERO appends", async () => {
    seed([openedEvent(REAL_DAY), JSON.stringify({
      event_id: "ev_close", actor_id: "p_you", entity_type: "person", entity_id: "p_you",
      event_type: "day.closing_recorded", value_tags: [], caused_by: [],
      timestamp: "2026-08-27T22:00:00.000Z", visibility: "private",
      payload: { day_id: REAL_DAY, subject_id: SUBJ } })]);
    const r = await submit(fd());
    expect(r.ok).toBe(false);
    expect(await loadActions()).toHaveLength(0);
  });

  it("two open days → refused, and ZERO appends — no latest-wins", async () => {
    seed([openedEvent(REAL_DAY), openedEvent("day_2026-08-28_person_roei")]);
    const r = await submit(fd());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain("יותר מיום פתוח אחד");
    expect(await loadActions()).toHaveLength(0);
  });

  it("consent remains mandatory, and refusing it writes nothing", async () => {
    const f = fd(); f.delete("consent");
    const r = await submit(f);
    expect(r.ok).toBe(false);
    expect(await loadActions()).toHaveLength(0);
  });
});

describe("exactly one append on success", () => {
  it("one submission produces one record, and provenance is verbatim", async () => {
    await submit(fd());
    const stored = await loadActions();
    expect(stored).toHaveLength(1);
    expect((stored[0].action as { provenance: string }).provenance)
      .toBe("טקסט חופשי של המשתמש");
  });
});
