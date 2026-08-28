import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { _setActionStore } from "../actionStoreAccessor";
import { _setPhilosEventStore } from "@/app/lib/philos-event-store";
import { InMemoryActionStore } from "../actionStore";
import { createActionForCurrentUserCore } from "../actionFormAction";
import { REAL_CURRENT_SUBJECT } from "@/app/lib/philos/subjectRegistry";
import { issueMatchPermit } from "../matchPermit";

function formData(fields: Record<string, string | string[]>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    if (Array.isArray(v)) v.forEach((item) => fd.append(k, item));
    else fd.set(k, v);
  }
  return fd;
}

const VALID = {
  type: "non_transfer",
  mechanism_scope: "self_regulation",
  reversibility: "reversible — can be undone within 24h",
  provenance: "self-initiated via /marketplace",
};

/**
 * AN ACTION IS ONLY WRITABLE INTO AN OPEN DAY. The writer resolves the day
 * itself (`resolveWritableDay`) rather than trusting a `day_ref` from the
 * form, so every accepting case here has to open one — seeded as a real
 * `day.opened` event in an isolated temp directory, never a stub.
 */
const OPENED_DAY = JSON.stringify({
  event_id: "ev_open_day", actor_id: "p_you", entity_type: "person",
  entity_id: "p_you", event_type: "day.opened", value_tags: [],
  timestamp: "2026-08-27T06:00:00.000Z", visibility: "private", caused_by: [],
  payload: {
    day_id: `day_2026-08-27_${REAL_CURRENT_SUBJECT}`, subject_id: REAL_CURRENT_SUBJECT,
    intention: "i", context: "c",
    state_t0_refs: [], carry_forward_refs: [], consent: true, sourceRefs: [],
  },
});

describe("createActionForCurrentUserCore — real Action creation (LOOP 5)", () => {
  let store: InMemoryActionStore;
  let dir: string;
  let prevCanon: string | undefined, prevData: string | undefined;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "philos-actionform-"));
    prevCanon = process.env.CANON_DATA_DIR; prevData = process.env.PHILOS_DATA_DIR;
    process.env.CANON_DATA_DIR = dir; process.env.PHILOS_DATA_DIR = dir;
    writeFileSync(join(dir, "philos-events.jsonl"), OPENED_DAY + "\n", "utf8");
    _setPhilosEventStore(null);
    store = new InMemoryActionStore(); _setActionStore(store);
  });
  afterEach(() => {
    if (prevCanon === undefined) delete process.env.CANON_DATA_DIR; else process.env.CANON_DATA_DIR = prevCanon;
    if (prevData === undefined) delete process.env.PHILOS_DATA_DIR; else process.env.PHILOS_DATA_DIR = prevData;
    _setActionStore(null); _setPhilosEventStore(null);
    rmSync(dir, { recursive: true, force: true });
  });

  it("rejects when consent is not checked — the CONSENT gate is never fabricated true", async () => {
    const result = await createActionForCurrentUserCore(formData(VALID));
    expect(result.ok).toBe(false);
    expect(await store.load()).toHaveLength(0);
  });

  it("rejects an invalid type", async () => {
    const result = await createActionForCurrentUserCore(formData({ ...VALID, type: "bogus", consent: "on" }));
    expect(result.ok).toBe(false);
    expect(await store.load()).toHaveLength(0);
  });

  it("rejects an invalid mechanism_scope", async () => {
    const result = await createActionForCurrentUserCore(formData({ ...VALID, mechanism_scope: "bogus", consent: "on" }));
    expect(result.ok).toBe(false);
    expect(await store.load()).toHaveLength(0);
  });

  it("accepts a real submission, uses REAL_CURRENT_SUBJECT as owner, and persists real inputs that don't name a Need+Offer pair", async () => {
    const result = await createActionForCurrentUserCore(
      formData({ ...VALID, consent: "on", inputs: ["need_abc"] }),
    );
    expect(result.ok).toBe(true);
    const stored = await store.load();
    expect(stored).toHaveLength(1);
    expect(stored[0].action.owner).toBe(REAL_CURRENT_SUBJECT);
    expect(stored[0].action.consent).toBe(true);
    expect(stored[0].action.inputs).toEqual(["need_abc"]);
  });

  it("accepts a real submission with no inputs — inputs is honestly empty, never fabricated", async () => {
    const result = await createActionForCurrentUserCore(formData({ ...VALID, consent: "on" }));
    expect(result.ok).toBe(true);
    const stored = await store.load();
    expect(stored[0].action.inputs).toEqual([]);
  });

  // ── Match→Action integrity gate ─────────────────────────────────────
  describe("inputs naming both a real Need and a real Offer — Match→Action integrity gate", () => {
    it("rejects when inputs name a Need+Offer pair but no match_permit is supplied — the unresolved-match path", async () => {
      const result = await createActionForCurrentUserCore(
        formData({ ...VALID, consent: "on", inputs: ["need_abc", "offer_xyz"] }),
      );
      expect(result.ok).toBe(false);
      expect(await store.load()).toHaveLength(0);
    });

    it("rejects a forged/mismatched match_permit — the blocked/tampered-match path", async () => {
      const permit = issueMatchPermit("need_other", "offer_other", new Date().toISOString());
      const result = await createActionForCurrentUserCore(
        formData({ ...VALID, consent: "on", inputs: ["need_abc", "offer_xyz"], match_permit: JSON.stringify(permit) }),
      );
      expect(result.ok).toBe(false);
      expect(await store.load()).toHaveLength(0);
    });

    it("rejects an expired match_permit", async () => {
      const past = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const permit = issueMatchPermit("need_abc", "offer_xyz", past);
      const result = await createActionForCurrentUserCore(
        formData({ ...VALID, consent: "on", inputs: ["need_abc", "offer_xyz"], match_permit: JSON.stringify(permit) }),
      );
      expect(result.ok).toBe(false);
      expect(await store.load()).toHaveLength(0);
    });

    it("accepts when inputs name a Need+Offer pair AND a valid, matching match_permit is supplied — the permitted path", async () => {
      const permit = issueMatchPermit("need_abc", "offer_xyz", new Date().toISOString());
      const result = await createActionForCurrentUserCore(
        formData({ ...VALID, consent: "on", inputs: ["need_abc", "offer_xyz"], match_permit: JSON.stringify(permit) }),
      );
      expect(result.ok).toBe(true);
      const stored = await store.load();
      expect(stored).toHaveLength(1);
      expect(stored[0].action.inputs).toEqual(["need_abc", "offer_xyz"]);
      // Auditability — the Action's own real, persisted `provenance` field
      // records why it was allowed, without a separate history store.
      expect(stored[0].action.provenance).toContain("match_permit verified");
      expect(stored[0].action.provenance).toContain("need_abc");
      expect(stored[0].action.provenance).toContain("offer_xyz");
    });
  });
});
