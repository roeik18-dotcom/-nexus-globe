/**
 * THE PERSON SUPPLIES THE READING; THE SERVER SUPPLIES THE PROVENANCE.
 *
 * The only prior path to a State(t1) was the `level + 1` rule the screen
 * itself calls experimental — a day closed on arithmetic rather than on
 * something a person observed.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));

import { _setActionStore } from "../actionStoreAccessor";
import { _setEffectStore } from "../effectStoreAccessor";
import { _setDomainStateStore, loadDomainStates } from "../domainStateStoreAccessor";

const SUBJ = "person_roei";
const ACT = "action_day_1", EFF = "effect_day_1";

let dir: string, prev: string | undefined;

const action = (id = ACT, owner = SUBJ, origin: string | null = "REAL") => JSON.stringify({
  action: { action_id: id, owner, type: "non_transfer", mechanism_scope: "self_regulation",
    consent: true, inputs: [], reversibility: "r", provenance: "p",
    time: "2026-08-27T20:00:00.000Z", day_ref: "day_2026-08-27_person_roei" },
  recorded_at: "2026-08-27T20:00:00.000Z", ...(origin ? { record_origin: origin } : {}),
});
const effect = (id = EFF, actionRef = ACT, subject = SUBJ, origin: string | null = "REAL") =>
  JSON.stringify({
    effect: { effect_id: id, action_ref: actionRef, subject,
      concerns_subject_internal_state: false, context: "c", time: "2026-08-27T21:00:00.000Z",
      provenance: "p", claimed_outcome: { statement: "s", provenance: "p",
        verifier_type: "self", confidence: 0.9, time: "2026-08-27T21:00:00.000Z", method: "m" } },
    recorded_at: "2026-08-27T21:00:00.000Z", ...(origin ? { record_origin: origin } : {}),
  });

function seed(actions: string[], effects: string[]) {
  writeFileSync(join(dir, "actions.jsonl"), actions.join("\n") + (actions.length ? "\n" : ""), "utf8");
  writeFileSync(join(dir, "effects.jsonl"), effects.join("\n") + (effects.length ? "\n" : ""), "utf8");
  _setActionStore(null); _setEffectStore(null); _setDomainStateStore(null);
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "philos-t1-"));
  prev = process.env.CANON_DATA_DIR; process.env.CANON_DATA_DIR = dir;
  seed([action()], [effect()]);
});
afterEach(() => {
  if (prev === undefined) delete process.env.CANON_DATA_DIR; else process.env.CANON_DATA_DIR = prev;
  _setActionStore(null); _setEffectStore(null); _setDomainStateStore(null);
  rmSync(dir, { recursive: true, force: true });
});

function fd(over: Record<string, string> = {}) {
  const f = new FormData();
  f.set("domain_id", "human_temperament");
  f.set("parameter_id", "temperament_response_intensity");
  f.set("level", "1");
  f.set("confidence", "0.8");
  f.set("evidence", "מה שראיתי בפועל בסוף היום");
  f.set("action_id", ACT);
  f.set("effect_id", EFF);
  for (const [k, v] of Object.entries(over)) f.set(k, v);
  return f;
}
const write = async (f: FormData) => {
  const { recordClosingStateCore } = await import("../closingStateAction");
  return recordClosingStateCore(f);
};

describe("the split between the person's values and the server's", () => {
  it("writes the person's level/confidence/evidence and derives the rest", async () => {
    const r = await write(fd());
    expect(r.ok).toBe(true);
    const [rec] = await loadDomainStates();
    expect(rec.state.level).toBe(1);
    expect(rec.state.confidence).toBe(0.8);
    expect((rec.state as { evidence?: string }).evidence).toBe("מה שראיתי בפועל בסוף היום");
    /* Server-derived, and unreachable from the form. */
    expect(rec.state.subject).toBe(SUBJ);
    expect(rec.state.provenance).toBe("REAL");
    expect(rec.caused_by_ref).toBe(EFF);
  });

  it("a client cannot supply subject, provenance or caused_by_ref", async () => {
    await write(fd({ subject: "person_bet", provenance: "DEMO", caused_by_ref: "forged" }));
    const [rec] = await loadDomainStates();
    expect(rec.state.subject).toBe(SUBJ);
    expect(rec.state.provenance).toBe("REAL");
    expect(rec.caused_by_ref).toBe(EFF);
  });

  it("no arithmetic: the level is never derived from a previous state", async () => {
    const r = await write(fd({ level: "-3" }));
    expect(r.ok).toBe(true);
    expect((await loadDomainStates())[0].state.level).toBe(-3);
  });
});

describe("refusals write nothing", () => {
  const zero = async () => expect(await loadDomainStates()).toHaveLength(0);

  it("a forged action id is refused", async () => {
    expect((await write(fd({ action_id: "action_forged" }))).ok).toBe(false);
    await zero();
  });
  it("another person's action is refused", async () => {
    seed([action(ACT, "person_bet")], [effect()]);
    expect((await write(fd())).ok).toBe(false);
    await zero();
  });
  it("a DEMO action is refused", async () => {
    seed([action(ACT, SUBJ, "DEMO")], [effect()]);
    expect((await write(fd())).ok).toBe(false);
    await zero();
  });
  it("an action with no origin at all is refused", async () => {
    seed([action(ACT, SUBJ, null)], [effect()]);
    expect((await write(fd())).ok).toBe(false);
    await zero();
  });
  it("another person's effect is refused", async () => {
    seed([action()], [effect(EFF, ACT, "person_bet")]);
    expect((await write(fd())).ok).toBe(false);
    await zero();
  });
  it("an effect that does not link to the chosen action is refused", async () => {
    seed([action()], [effect(EFF, "action_other")]);
    const r = await write(fd());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain("אינה מקושרת");
    await zero();
  });
  it("missing level, confidence or evidence each refuse", async () => {
    for (const k of ["level", "confidence", "evidence"]) {
      expect((await write(fd({ [k]: "" }))).ok, k).toBe(false);
      await zero();
    }
  });
  it("a confidence outside 0..1 is refused", async () => {
    expect((await write(fd({ confidence: "1.5" }))).ok).toBe(false);
    await zero();
  });
});
