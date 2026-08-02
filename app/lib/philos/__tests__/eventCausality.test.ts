/**
 * Dynamics Layer — Step 1: the causality envelope, validated.
 *
 * PHILOS-DYNAMICS-LAYER.md §1–§2, §8. These tests pin the ONLY envelope
 * evolution the orchestration layer introduces: `caused_by` on PhilosEvent, and
 * the validator that guards it. No projection, no edges, no UI is exercised here
 * — those are Step 2. Written test-first (red before the module existed).
 *
 * The load-bearing distinctions under test:
 *   • absent caused_by  = UNKNOWN cause (never "no cause")
 *   • []                = explicitly no known cause
 *   • non-empty         = declared parents, cause → effect
 * and a `caused_by` link is a DECLARATION, never verified causation.
 */
import { describe, expect, it } from "vitest";

import {
  causalDeclaration,
  causalParents,
  validateCausality,
  validateEventCausality,
} from "../eventCausality";
import type { PhilosEvent } from "../events";
import { VALUE_GROUP_EVENTS } from "../valueGroupLog";

/** Minimal event factory — only the fields the validator reads need to be real. */
const ev = (over: Partial<PhilosEvent> & { event_id: string }): PhilosEvent => ({
  actor_id: "p_x",
  entity_type: "value_group",
  entity_id: "vg_a",
  event_type: "update.posted",
  value_tags: [],
  timestamp: "2026-07-01T10:00:00+03:00",
  visibility: "public",
  ...over,
});

const codesOf = (ds: { code: string }[]) => ds.map((d) => d.code);

// ── tri-state semantics (§2) ─────────────────────────────────────────────────

describe("caused_by tri-state (absent vs [] vs non-empty)", () => {
  it("absent reads as unknown, never as 'no cause'", () => {
    expect(causalDeclaration(ev({ event_id: "e1" }))).toBe("unknown");
  });
  it("explicit [] reads as declared_none", () => {
    expect(causalDeclaration(ev({ event_id: "e1", caused_by: [] }))).toBe("declared_none");
  });
  it("non-empty reads as declared, and parents are returned verbatim", () => {
    const e = ev({ event_id: "e2", caused_by: ["e1"] });
    expect(causalDeclaration(e)).toBe("declared");
    expect(causalParents(e)).toEqual(["e1"]);
  });
  it("causalParents never invents parents for an absent field", () => {
    expect(causalParents(ev({ event_id: "e1" }))).toEqual([]);
  });
});

// ── valid shapes (§8.4 T1–T4) ────────────────────────────────────────────────

describe("valid causal declarations", () => {
  it("T1 — a legacy event with no caused_by validates clean", () => {
    const r = validateCausality([ev({ event_id: "e1" })]);
    expect(r.ok).toBe(true);
    expect(r.diagnostics).toEqual([]);
  });

  it("T2 — an explicit empty caused_by validates clean", () => {
    const r = validateCausality([ev({ event_id: "e1", caused_by: [] })]);
    expect(r.ok).toBe(true);
    expect(r.diagnostics).toEqual([]);
  });

  it("T3 — a single existing, earlier parent is valid", () => {
    const parent = ev({ event_id: "e1", timestamp: "2026-07-01T09:00:00+03:00" });
    const child = ev({ event_id: "e2", timestamp: "2026-07-01T10:00:00+03:00", caused_by: ["e1"] });
    const r = validateCausality([parent, child]);
    expect(r.ok).toBe(true);
    expect(r.diagnostics).toEqual([]);
  });

  it("T4 — multiple distinct existing parents are valid", () => {
    const a = ev({ event_id: "a", timestamp: "2026-07-01T08:00:00+03:00" });
    const b = ev({ event_id: "b", timestamp: "2026-07-01T09:00:00+03:00" });
    const c = ev({ event_id: "c", timestamp: "2026-07-01T10:00:00+03:00", caused_by: ["a", "b"] });
    const r = validateCausality([a, b, c]);
    expect(r.ok).toBe(true);
    expect(r.diagnostics).toEqual([]);
  });
});

// ── structural rejections (§8.4 T4–T6, invalid_parent_id) ────────────────────

describe("structural rejections (single-event, always errors)", () => {
  it("T5 — rejects an event that names itself as a cause", () => {
    const e = ev({ event_id: "e1", caused_by: ["e1"] });
    expect(validateEventCausality(e).map((d) => d.code)).toEqual(["self_reference"]);
    const r = validateCausality([e]);
    expect(r.ok).toBe(false);
    expect(codesOf(r.errors)).toContain("self_reference");
  });

  it("T6 — rejects a duplicated parent id", () => {
    const p = ev({ event_id: "p", timestamp: "2026-07-01T08:00:00+03:00" });
    const e = ev({ event_id: "e1", caused_by: ["p", "p"] });
    const r = validateCausality([p, e]);
    expect(r.ok).toBe(false);
    expect(codesOf(r.errors)).toContain("duplicate_parent");
  });

  it("rejects an empty-string parent id (invalid_parent_id)", () => {
    const r = validateCausality([ev({ event_id: "e1", caused_by: [""] })]);
    expect(r.ok).toBe(false);
    expect(codesOf(r.errors)).toContain("invalid_parent_id");
  });
});

// ── missing parent: lenient vs strict (§8.4 T5-lenient/strict) ───────────────

describe("missing parent — mode-dependent severity", () => {
  it("T7 — missing parent is a WARNING in lenient mode (log may be partial)", () => {
    const r = validateCausality([ev({ event_id: "e1", caused_by: ["ghost"] })]);
    expect(r.mode).toBe("lenient");
    expect(r.ok).toBe(true);
    expect(codesOf(r.warnings)).toContain("missing_parent");
    expect(r.errors).toEqual([]);
  });

  it("T8 — missing parent is an ERROR in strict closed-log mode", () => {
    const r = validateCausality([ev({ event_id: "e1", caused_by: ["ghost"] })], "strict");
    expect(r.ok).toBe(false);
    expect(codesOf(r.errors)).toContain("missing_parent");
  });
});

// ── temporal (§1.4, §8.4 T7) — MUST be instant-aware, not string-compare ─────

describe("temporal ordering (cause must not be after effect)", () => {
  it("T9 — rejects a cause whose instant is after the effect", () => {
    const parent = ev({ event_id: "p", timestamp: "2026-07-02T10:00:00+03:00" });
    const child = ev({ event_id: "c", timestamp: "2026-07-01T10:00:00+03:00", caused_by: ["p"] });
    const r = validateCausality([parent, child]);
    expect(r.ok).toBe(false);
    expect(codesOf(r.errors)).toContain("parent_after_child");
  });

  it("allows a cause with an equal timestamp (not 'after')", () => {
    const parent = ev({ event_id: "p", timestamp: "2026-07-01T10:00:00+03:00" });
    const child = ev({ event_id: "c", timestamp: "2026-07-01T10:00:00+03:00", caused_by: ["p"] });
    const r = validateCausality([parent, child]);
    expect(r.diagnostics.filter((d) => d.code === "parent_after_child")).toEqual([]);
  });

  it("compares by INSTANT, not raw string — offset-aware", () => {
    // parent string is EARLIER ("09") but its instant (09:00Z) is LATER than the
    // child's instant (11:00+03 = 08:00Z). A naive string compare would miss this.
    const parent = ev({ event_id: "p", timestamp: "2026-07-01T09:00:00+00:00" });
    const child = ev({ event_id: "c", timestamp: "2026-07-01T11:00:00+03:00", caused_by: ["p"] });
    const r = validateCausality([parent, child]);
    expect(codesOf(r.errors)).toContain("parent_after_child");
  });
});

// ── cycles (§1.4, §8.4 T6 direct + multi) ────────────────────────────────────

describe("cycle detection (the traced graph must be a DAG)", () => {
  it("T10 — rejects a direct A↔B cycle", () => {
    const t = "2026-07-01T10:00:00+03:00";
    const a = ev({ event_id: "a", timestamp: t, caused_by: ["b"] });
    const b = ev({ event_id: "b", timestamp: t, caused_by: ["a"] });
    const r = validateCausality([a, b]);
    expect(r.ok).toBe(false);
    const cyc = r.errors.find((d) => d.code === "causal_cycle");
    expect(cyc).toBeTruthy();
    expect(new Set(cyc!.cycle)).toEqual(new Set(["a", "b"]));
  });

  it("T11 — rejects a multi-node A→B→C→A cycle", () => {
    const t = "2026-07-01T10:00:00+03:00";
    const a = ev({ event_id: "a", timestamp: t, caused_by: ["c"] });
    const b = ev({ event_id: "b", timestamp: t, caused_by: ["a"] });
    const c = ev({ event_id: "c", timestamp: t, caused_by: ["b"] });
    const r = validateCausality([a, b, c]);
    expect(r.ok).toBe(false);
    const cyc = r.errors.find((d) => d.code === "causal_cycle");
    expect(cyc).toBeTruthy();
    expect(new Set(cyc!.cycle)).toEqual(new Set(["a", "b", "c"]));
  });

  it("reports each distinct cycle once, not once per traversal", () => {
    const t = "2026-07-01T10:00:00+03:00";
    const a = ev({ event_id: "a", timestamp: t, caused_by: ["b"] });
    const b = ev({ event_id: "b", timestamp: t, caused_by: ["a"] });
    const r = validateCausality([a, b]);
    expect(r.errors.filter((d) => d.code === "causal_cycle")).toHaveLength(1);
  });
});

// ── cross-group is allowed (§1.4) ────────────────────────────────────────────

describe("cross-group causality", () => {
  it("T12 — a parent in another group is allowed (no group-based rejection)", () => {
    const parentA = ev({ event_id: "pa", entity_id: "vg_a", timestamp: "2026-07-01T09:00:00+03:00" });
    const childB = ev({
      event_id: "cb",
      entity_id: "vg_b",
      timestamp: "2026-07-01T10:00:00+03:00",
      caused_by: ["pa"],
    });
    const r = validateCausality([parentA, childB]);
    expect(r.ok).toBe(true);
    expect(r.diagnostics).toEqual([]);
  });
});

// ── serialization (§2, §8.4 T13) ─────────────────────────────────────────────

describe("serialization preserves omission vs explicit []", () => {
  it("T13a — an absent caused_by is not emitted and round-trips as unknown", () => {
    const json = JSON.stringify(ev({ event_id: "e1" }));
    expect(json).not.toContain("caused_by");
    const back = JSON.parse(json) as PhilosEvent;
    expect("caused_by" in back).toBe(false);
    expect(causalDeclaration(back)).toBe("unknown");
  });

  it("T13b — an explicit [] round-trips as declared_none", () => {
    const json = JSON.stringify(ev({ event_id: "e1", caused_by: [] }));
    expect(json).toContain('"caused_by":[]');
    const back = JSON.parse(json) as PhilosEvent;
    expect(back.caused_by).toEqual([]);
    expect(causalDeclaration(back)).toBe("declared_none");
  });
});

// ── backward compatibility on the REAL seed (§2) ─────────────────────────────

describe("backward compatibility — the real seed log", () => {
  it("the seed (no caused_by anywhere) validates clean in lenient mode", () => {
    const r = validateCausality(VALUE_GROUP_EVENTS);
    expect(r.ok).toBe(true);
    expect(r.diagnostics).toEqual([]);
  });

  it("the seed validates clean in strict mode too — nothing to resolve", () => {
    expect(validateCausality(VALUE_GROUP_EVENTS, "strict").ok).toBe(true);
  });
});

// ── robustness on malformed / out-of-type caused_by (the parsed-JSON guard) ──

describe("malformed caused_by never crashes the validator", () => {
  // Inject values the string[] type forbids, as a real parsed-JSON payload would.
  const withRawCausedBy = (raw: unknown): PhilosEvent =>
    ({ ...ev({ event_id: "e1" }), caused_by: raw }) as unknown as PhilosEvent;

  it("a non-string parent id (42) is invalid_parent_id, not silently accepted", () => {
    const r = validateCausality([withRawCausedBy([42])]);
    expect(r.ok).toBe(false);
    expect(codesOf(r.errors)).toContain("invalid_parent_id");
  });

  it("caused_by: null is rejected as invalid_parent_id, without throwing", () => {
    expect(() => validateCausality([withRawCausedBy(null)])).not.toThrow();
    const r = validateCausality([withRawCausedBy(null)]);
    expect(r.ok).toBe(false);
    expect(codesOf(r.errors)).toEqual(["invalid_parent_id"]);
  });

  it("a bare-string caused_by does not iterate code-points into missing_parent", () => {
    const r = validateCausality([withRawCausedBy("e12")]);
    expect(codesOf(r.diagnostics)).toEqual(["invalid_parent_id"]);
    expect(codesOf(r.diagnostics)).not.toContain("missing_parent");
  });

  it("the tri-state helpers agree on a malformed (null) caused_by — neither throws", () => {
    const bad = withRawCausedBy(null);
    expect(() => causalDeclaration(bad)).not.toThrow();
    expect(causalDeclaration(bad)).toBe("unknown");
    expect(causalParents(bad)).toEqual([]);
  });
});

// ── determinism (contract §3) ────────────────────────────────────────────────

describe("determinism", () => {
  it("same input yields a deep-equal report", () => {
    const t = "2026-07-01T10:00:00+03:00";
    const a = ev({ event_id: "a", timestamp: t, caused_by: ["b"] });
    const b = ev({ event_id: "b", timestamp: t, caused_by: ["a"] });
    expect(validateCausality([a, b])).toEqual(validateCausality([a, b]));
  });
});
