/**
 * verifyEffectAction.ts — the independent-verification write path.
 *
 * FORGERY AND ACCEPTANCE, IN AN ISOLATED STORE. Every store here is an
 * InMemory twin injected through the accessor test-helpers; nothing in this
 * file touches a real data directory, and no REAL record is written.
 *
 * The central claim under test: a person cannot verify an outcome they
 * reported, an outcome about themselves, or an outcome of an action they
 * performed — and cannot get around that by choosing a different
 * `verifier_type`, by naming a different verifier in the form, or by leaving
 * the verifier unnamed.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

import { InMemoryActionStore } from "../actionStore";
import { _setActionStore } from "../actionStoreAccessor";
import { InMemoryEffectStore } from "../effectStore";
import { _setEffectStore } from "../effectStoreAccessor";
import { InMemoryVerificationStore } from "../outcomeVerificationStore";
import { _setVerificationStore } from "../outcomeVerificationStoreAccessor";
import { setViewerProvider, LOCAL_SINGLE_USER } from "../../identity/viewerContext";
import { verifyEffectCore, verifyEffectFormAction } from "../verifyEffectAction";
import type { Action } from "../action";
import type { Effect } from "../effect";

const NOW = new Date().toISOString();
const ACTOR = "person_actor";
const SUBJECT = "person_actor";
const OUTSIDER = "person_outsider";

function viewerIs(subject_id: string) {
  setViewerProvider({
    kind: "SESSION",
    resolve: async () => ({ viewer_id: subject_id, subject_id, person_id: subject_id, source: "SESSION" as const }),
  });
}

const action = (o: Partial<Action> = {}): Action => ({
  action_id: "action_1", type: "non_transfer", owner: ACTOR,
  mechanism_scope: "self_regulation", consent: true, inputs: [],
  reversibility: "reversible", time: NOW, provenance: "test", ...o,
});

const effect = (o: Partial<Effect> = {}): Effect => ({
  effect_id: "effect_1", action_ref: "action_1", subject: SUBJECT,
  concerns_subject_internal_state: false,
  claimed_outcome: { statement: "it happened", provenance: "self_reported", verifier_type: "self", confidence: 0.8, time: NOW, method: "self_report" },
  context: "test", time: NOW, provenance: "test", ...o,
});

const form = (fields: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
};
const VALID = {
  effect_id: "effect_1", verifier_type: "counterparty",
  statement: "I saw this happen", method: "direct_observation",
  provenance: "counterparty_report", confidence: "0.8",
};

describe("verifyEffectCore — verification is an act by someone else", () => {
  let effectStore: InMemoryEffectStore;
  let verificationStore: InMemoryVerificationStore;
  let actionStore: InMemoryActionStore;

  beforeEach(async () => {
    actionStore = new InMemoryActionStore();
    _setActionStore(actionStore);
    effectStore = new InMemoryEffectStore();
    _setEffectStore(effectStore);
    verificationStore = new InMemoryVerificationStore();
    _setVerificationStore(verificationStore);
    await actionStore.append([{ action: action(), recorded_at: NOW, record_origin: "REAL" }]);
    await effectStore.append([{ effect: effect(), recorded_at: NOW, record_origin: "REAL" }]);
    viewerIs(OUTSIDER);
  });
  afterEach(() => {
    _setActionStore(null); _setEffectStore(null); _setVerificationStore(null);
    setViewerProvider(LOCAL_SINGLE_USER);
  });

  it("accepts a genuine independent verification and stores it as its own record", async () => {
    const r = await verifyEffectCore(form(VALID));
    expect(r.ok).toBe(true);
    const stored = await verificationStore.load();
    expect(stored).toHaveLength(1);
    expect(stored[0].effect_id).toBe("effect_1");
    expect(stored[0].verification.verifier_id).toBe(OUTSIDER);
    expect(stored[0].record_origin).toBe("REAL");
  });

  it("leaves the Effect record itself untouched — verification is never written back into it", async () => {
    await verifyEffectCore(form(VALID));
    const [stored] = await effectStore.load();
    expect(stored.effect.verified_outcome).toBeUndefined();
  });

  // ── THE IDENTITY CHECKS ─────────────────────────────────────────────────

  it("refuses the actor verifying their own action's outcome", async () => {
    viewerIs(ACTOR);
    const r = await verifyEffectCore(form(VALID));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("verifier_is_subject"); // actor is also the subject here
    expect(await verificationStore.load()).toHaveLength(0);
  });

  it("refuses the actor when the Effect is about someone else — acting and checking stay separate", async () => {
    await effectStore.append([{ effect: effect({ effect_id: "effect_2", subject: "person_other" }), recorded_at: NOW, record_origin: "REAL" }]);
    viewerIs(ACTOR);
    const r = await verifyEffectCore(form({ ...VALID, effect_id: "effect_2" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("verifier_is_actor");
  });

  it("refuses the subject verifying an outcome about themselves", async () => {
    await actionStore.append([{ action: action({ action_id: "action_2", owner: "person_someone" }), recorded_at: NOW, record_origin: "REAL" }]);
    await effectStore.append([{ effect: effect({ effect_id: "effect_3", action_ref: "action_2", subject: OUTSIDER }), recorded_at: NOW, record_origin: "REAL" }]);
    const r = await verifyEffectCore(form({ ...VALID, effect_id: "effect_3" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("verifier_is_subject");
  });

  // FORGERY. `verifier_id` is derived from the session, so a form field
  // claiming to be someone else changes nothing about who is recorded.
  it("ignores a verifier_id submitted in the form — identity comes from the session only", async () => {
    const r = await verifyEffectCore(form({ ...VALID, verifier_id: "person_pretend" }));
    expect(r.ok).toBe(true);
    const [stored] = await verificationStore.load();
    expect(stored.verification.verifier_id).toBe(OUTSIDER);
  });

  // FORGERY. The actor picking `verifier_type: "third_party"` for themselves.
  it("refuses a self verifier_type outright", async () => {
    const r = await verifyEffectCore(form({ ...VALID, verifier_type: "self" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("verifier_type_self_not_independent");
  });

  it("refuses an unrecognised verifier_type rather than treating it as independent", async () => {
    const r = await verifyEffectCore(form({ ...VALID, verifier_type: "trust_me" }));
    expect(r.ok).toBe(false);
    expect(await verificationStore.load()).toHaveLength(0);
  });

  // ── CANON §17 ───────────────────────────────────────────────────────────

  it("refuses to verify an internal-state Effect without the subject's consent", async () => {
    await actionStore.append([{ action: action({ action_id: "action_3", owner: "person_someone" }), recorded_at: NOW, record_origin: "REAL" }]);
    await effectStore.append([{
      effect: effect({ effect_id: "effect_4", action_ref: "action_3", subject: "person_other", concerns_subject_internal_state: true }),
      recorded_at: NOW, record_origin: "REAL",
    }]);
    const r = await verifyEffectCore(form({ ...VALID, effect_id: "effect_4" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("internal_state_needs_subject_consent");
  });

  it("accepts an internal-state verification when the subject consented", async () => {
    await actionStore.append([{ action: action({ action_id: "action_3", owner: "person_someone" }), recorded_at: NOW, record_origin: "REAL" }]);
    await effectStore.append([{
      effect: effect({ effect_id: "effect_4", action_ref: "action_3", subject: "person_other", concerns_subject_internal_state: true }),
      recorded_at: NOW, record_origin: "REAL",
    }]);
    const r = await verifyEffectCore(form({ ...VALID, effect_id: "effect_4", subject_consent: "on" }));
    expect(r.ok).toBe(true);
  });

  // ── ONCE, AND ONLY ONCE ─────────────────────────────────────────────────

  it("refuses a second verification — a person cannot keep trying verifiers until one agrees", async () => {
    expect((await verifyEffectCore(form(VALID))).ok).toBe(true);
    viewerIs("person_yet_another");
    const r = await verifyEffectCore(form(VALID));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("already_verified");
    expect(await verificationStore.load()).toHaveLength(1);
  });

  // ── ADMISSIBILITY ───────────────────────────────────────────────────────

  it("refuses to verify an Effect that is not REAL", async () => {
    await effectStore.append([{ effect: effect({ effect_id: "effect_demo" }), recorded_at: NOW }]);
    const r = await verifyEffectCore(form({ ...VALID, effect_id: "effect_demo" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("effect_not_real");
  });

  it("refuses an effect_id that names nothing", async () => {
    const r = await verifyEffectCore(form({ ...VALID, effect_id: "effect_nope" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("effect_not_found");
  });

  /**
   * THE SILENT-FAILURE REGRESSION.
   *
   * The form was first bound to a CLIENT closure and its fields marked
   * `required`. Two consequences, both invisible: React disables such a form
   * until JavaScript hydrates, and a browser enforcing `required` refuses the
   * submission before any of our code runs. Pressing the button produced no
   * request, no record and no message — it simply did nothing.
   *
   * The fix moved validation to the server so a refusal is always rendered.
   * These tests hold that: every incomplete submission must come back with text
   * a person can read, and must write nothing.
   */
  describe("verifyEffectFormAction — an incomplete form is refused in words", () => {
    const form = (fields: Record<string, string>) => {
      const fd = new FormData();
      for (const [k, v] of Object.entries(fields)) fd.set(k, v);
      return fd;
    };

    it("names every missing field, in the words shown above it", async () => {
      const s = await verifyEffectFormAction({}, form({}));
      expect(s.ok).toBeUndefined();
      expect(s.reason).toBe("fields_incomplete");
      for (const label of ["מה מאושר", "איך ידעת", "מהיכן הידיעה", "סוג הבדיקה", "רמת הוודאות"]) {
        expect(s.error).toContain(label);
      }
      expect(await verificationStore.load()).toHaveLength(0);
    });

    it("names only the field that is actually missing", async () => {
      const s = await verifyEffectFormAction({}, form({
        effect_id: "effect_1", statement: "x", method: "y", provenance: "z", confidence: "0.8",
      }));
      expect(s.error).toContain("סוג הבדיקה");
      expect(s.error).not.toContain("איך ידעת");
    });

    it("refuses a confidence outside 0..1 rather than storing it", async () => {
      for (const bad of ["7", "-1", "abc", ""]) {
        const s = await verifyEffectFormAction({}, form({
          effect_id: "effect_1", statement: "x", method: "y", provenance: "z",
          verifier_type: "counterparty", confidence: bad,
        }));
        expect(s.ok).toBeUndefined();
        expect(s.error).toBeTruthy();
      }
      expect(await verificationStore.load()).toHaveLength(0);
    });

    it("passes a complete, independent submission through to a real record", async () => {
      const s = await verifyEffectFormAction({}, form({
        effect_id: "effect_1", statement: "I saw this happen", method: "direct_observation",
        provenance: "counterparty_report", verifier_type: "counterparty", confidence: "0.8",
      }));
      expect(s.ok).toBe(true);
      expect(s.verifier_id).toBe(OUTSIDER);
      expect(await verificationStore.load()).toHaveLength(1);
    });

    it("returns a server refusal as readable text, not a silent no-op", async () => {
      viewerIs(ACTOR);
      const s = await verifyEffectFormAction({}, form({
        effect_id: "effect_1", statement: "x", method: "y", provenance: "z",
        verifier_type: "counterparty", confidence: "0.8",
      }));
      expect(s.ok).toBeUndefined();
      expect(s.reason).toBe("verifier_is_subject");
      expect(s.error).toBeTruthy();
      expect(await verificationStore.load()).toHaveLength(0);
    });
  });
});
