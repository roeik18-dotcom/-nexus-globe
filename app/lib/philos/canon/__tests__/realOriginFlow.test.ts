/**
 * AN ACTION AND AN EFFECT WRITTEN THE WAY THE FORM WRITES THEM, IN AN ISOLATED
 * STORE, MUST READ AS REAL EVERYWHERE — never as UNKNOWN.
 *
 * This is the end-to-end shape of the defect that stopped the REAL write: the
 * gates would have closed while every consuming panel showed the new records
 * as unattributable.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { recordAuthenticatedAction, recordAuthenticatedEffect, recordAction } from "../actionLifecycle";
import { actionOriginOf, isActionAdmissible } from "../actionStore";
import { effectOriginOf, isEffectAdmissible } from "../effectStore";
import { _setActionStore, loadActions } from "../actionStoreAccessor";
import { _setEffectStore, loadEffects } from "../effectStoreAccessor";
import { provenanceFromOrigin } from "../../day/RealDataGapPanel";

let dir: string, prev: (string | undefined)[];
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "philos-origin-"));
  prev = [process.env.CANON_DATA_DIR];
  process.env.CANON_DATA_DIR = dir;
  _setActionStore(null); _setEffectStore(null);
});
afterEach(() => {
  if (prev[0] === undefined) delete process.env.CANON_DATA_DIR;
  else process.env.CANON_DATA_DIR = prev[0];
  _setActionStore(null); _setEffectStore(null);
  rmSync(dir, { recursive: true, force: true });
});

const now = "2026-08-27T12:00:00.000Z";

/* The exact shape `actionFormAction` builds, prose provenance included. */
const anAction = (id: string) => ({
  action_id: id, type: "non_transfer", owner: "person_roei",
  mechanism_scope: "self_regulation", consent: true, inputs: [],
  reversibility: "ניתנת לביטול חלקית", time: now,
  provenance: "יזמתי בעצמי אחרי שראיתי שהמערכת ריקה",
  day_ref: "day_2026-08-27_person_roei",
}) as never;

const anEffect = (id: string, actionRef: string) => ({
  effect_id: id, action_ref: actionRef, subject: "person_roei",
  concerns_subject_internal_state: false,
  claimed_outcome: { statement: "s", provenance: "p", verifier_type: "self", confidence: 0.7, time: now, method: "m" },
  verified_outcome: undefined,
  context: "c", time: now, provenance: "דיווח עצמי",
}) as never;

describe("the authenticated flow produces REAL records", () => {
  it("Action: prose preserved verbatim, origin REAL, admissible", async () => {
    const stored = await recordAuthenticatedAction(anAction("action_flow_1"), now);
    expect(stored.record_origin).toBe("REAL");
    expect((stored.action as unknown as { provenance: string }).provenance)
      .toBe("יזמתי בעצמי אחרי שראיתי שהמערכת ריקה");

    const [fromDisk] = await loadActions();
    expect(actionOriginOf(fromDisk)).toBe("REAL");
    expect(isActionAdmissible(fromDisk)).toBe(true);
    /* The panel reading that every terminal shares. */
    expect(provenanceFromOrigin(actionOriginOf(fromDisk))).toBe("REAL");
  });

  it("Effect linked to that Action is REAL, and evidence stays absent", async () => {
    await recordAuthenticatedAction(anAction("action_flow_2"), now);
    const stored = await recordAuthenticatedEffect(anEffect("effect_flow_2", "action_flow_2"), now);
    expect(stored.record_origin).toBe("REAL");
    expect(stored.effect.verified_outcome).toBeUndefined();

    const [fromDisk] = await loadEffects();
    expect(effectOriginOf(fromDisk)).toBe("REAL");
    expect(isEffectAdmissible(fromDisk)).toBe(true);
    expect(fromDisk.effect.action_ref).toBe("action_flow_2");
  });

  it("the untrusted writer confers nothing — origin stays UNKNOWN", async () => {
    await recordAction(anAction("action_flow_3"), now);
    const [fromDisk] = await loadActions();
    expect(actionOriginOf(fromDisk)).toBe("UNKNOWN");
    expect(isActionAdmissible(fromDisk)).toBe(false);
  });

  it("exactly one record is appended per authenticated write — no double append", async () => {
    await recordAuthenticatedAction(anAction("action_flow_4"), now);
    await recordAuthenticatedEffect(anEffect("effect_flow_4", "action_flow_4"), now);
    expect((await loadActions()).length).toBe(1);
    expect((await loadEffects()).length).toBe(1);
  });
});
