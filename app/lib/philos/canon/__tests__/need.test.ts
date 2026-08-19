/**
 * Philos Canon — Need, validated (PHILOS-MELTING-POT-CANON.md §12).
 *
 * Named assertions requested for this pass: NEED_VALID, NEED_WITHOUT_DEFICIT_VALID,
 * DEFICIT_DOES_NOT_CREATE_NEED, NEED_EXPIRY_REQUIRED, NEED_PROVENANCE_ENFORCED,
 * NO_PERSON_SCORE, NO_CROSS_FRAME_AGGREGATION.
 */
import { describe, expect, it } from "vitest";
import { type CellState, validateCellState } from "../cellState";
import * as needModule from "../need";
import { type Need, type NeedCellRef, validateNeed } from "../need";
import * as targetModule from "../target";

function baseNeed(overrides: Partial<Need> = {}): Need {
  return {
    need_id: "need_001",
    subject: "person_roei",
    desired_change: "more uninterrupted creative time",
    scope: { kind: "cells", cells: [{ domain: "G", frame: "I" }] },
    provenance: "self_reported",
    context: "studio_week",
    time: "2026-08-12T20:00:00Z",
    expiry: "2026-09-12T20:00:00Z",
    consent_scope: "visible_to_self_only",
    ...overrides,
  };
}

describe("NEED_VALID", () => {
  it("accepts a complete, canon-shaped Need with a cells scope", () => {
    const result = validateNeed(baseNeed());
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("accepts a complete Need with a bare-domain scope", () => {
    const result = validateNeed(baseNeed({ scope: { kind: "domain", domain: "C" } }));
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("accepts endorsed provenance as well as self_reported", () => {
    const result = validateNeed(baseNeed({ provenance: "endorsed" }));
    expect(result.valid).toBe(true);
  });
});

describe("NEED_WITHOUT_DEFICIT_VALID", () => {
  it("a Need validates fully on its own subject-declared fields — no CellState, Observation, or deficit reading is required anywhere in its shape or its validator", () => {
    const need = baseNeed();
    // The Need type and validateNeed() take no CellState/Observation parameter
    // at all — there is nothing to "not require," structurally: a Need is
    // self-contained per canon §12.
    const result = validateNeed(need);
    expect(result.valid).toBe(true);
    expect(validateNeed.length).toBe(1); // single Need parameter, nothing else
  });
});

describe("DEFICIT_DOES_NOT_CREATE_NEED", () => {
  it("this module exports no function that derives or infers a Need from a CellState/deficit reading", () => {
    const mod = needModule as unknown as Record<string, unknown>;
    for (const name of [
      "deriveNeedFromCellState",
      "deriveNeedFromDeficit",
      "inferNeed",
      "needFromDeficit",
      "autoNeed",
    ]) {
      expect(mod[name]).toBeUndefined();
    }
  });

  it("a severe CellState deficit reading, on its own, produces nothing — Need still requires its own explicit fields", () => {
    // canon §12: "a Deficit may exist without a Need" — represented here by a
    // CellState whose Level reads a deep, unambiguous deficit.
    const severeDeficit: CellState = { domain: "G", frame: "I", level: -50, stability: 0.05 };
    expect(validateCellState(severeDeficit).valid).toBe(true); // the deficit itself is valid, real
    // No path exists from `severeDeficit` to a Need object anywhere in this
    // module; the only way to obtain a valid Need is to supply every one of
    // its own canon §12 fields directly (proven by NEED_VALID above).
    expect(Object.keys(needModule)).not.toContain("deriveNeedFromCellState");
  });
});

describe("NEED_EXPIRY_REQUIRED", () => {
  it("rejects a missing/unparseable expiry", () => {
    const result = validateNeed(baseNeed({ expiry: "not-a-date" }));
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      field: "expiry",
      reason: "invalid_or_no_offset",
    });
  });

  it("rejects an offsetless expiry (host-timezone non-determinism)", () => {
    const result = validateNeed(baseNeed({ expiry: "2026-09-12T20:00:00" }));
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      field: "expiry",
      reason: "invalid_or_no_offset",
    });
  });

  it("rejects an expiry at or before time", () => {
    const result = validateNeed(
      baseNeed({ time: "2026-08-12T20:00:00Z", expiry: "2026-08-12T20:00:00Z" }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({ field: "expiry", reason: "not_after_time" });
  });
});

describe("NEED_PROVENANCE_ENFORCED", () => {
  it("rejects a provenance outside {self_reported, endorsed} — canon §12's closed vocabulary", () => {
    const result = validateNeed(
      baseNeed({ provenance: "inferred" as unknown as Need["provenance"] }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({ field: "provenance", reason: "invalid" });
  });

  it("'inferred' is deliberately rejected here even though it is a valid Observation.provenance value — Need's vocabulary is narrower by canon design (subject-declared or subject-endorsed only)", () => {
    const result = validateNeed(
      baseNeed({ provenance: "third_party" as unknown as Need["provenance"] }),
    );
    expect(result.valid).toBe(false);
  });
});

describe("Need — SystemicChannel on S-frame cells (canon §18, Need IS named)", () => {
  it("requires systemicChannel on a cells-scope S-frame reference", () => {
    const cells: NeedCellRef[] = [{ domain: "G", frame: "S" }];
    const result = validateNeed(baseNeed({ scope: { kind: "cells", cells } }));
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      field: "scope.cells",
      reason: "systemic_channel_required_for_S",
      index: 0,
    });
  });

  it("accepts an S-frame cell once systemicChannel is supplied", () => {
    const cells: NeedCellRef[] = [
      { domain: "G", frame: "S", systemicChannel: "institutional" },
    ];
    const result = validateNeed(baseNeed({ scope: { kind: "cells", cells } }));
    expect(result.valid).toBe(true);
  });

  it("does not require systemicChannel on non-S cells", () => {
    const cells: NeedCellRef[] = [{ domain: "G", frame: "I" }, { domain: "E", frame: "R" }];
    const result = validateNeed(baseNeed({ scope: { kind: "cells", cells } }));
    expect(result.valid).toBe(true);
  });

  it("a bare-domain scope has no frame, so the S-cell rule does not apply (nothing invented to fill the gap)", () => {
    const result = validateNeed(baseNeed({ scope: { kind: "domain", domain: "G" } }));
    expect(result.valid).toBe(true);
  });
});

describe("NO_PERSON_SCORE", () => {
  it("neither need.ts nor target.ts export any scoring/ranking/priority function", () => {
    const needMod = needModule as unknown as Record<string, unknown>;
    const targetMod = targetModule as unknown as Record<string, unknown>;
    for (const name of [
      "score",
      "rank",
      "rankNeeds",
      "rankTargets",
      "personScore",
      "priority",
      "sortByUrgency",
      "urgencyScore",
    ]) {
      expect(needMod[name]).toBeUndefined();
      expect(targetMod[name]).toBeUndefined();
    }
  });
});

describe("NO_CROSS_FRAME_AGGREGATION", () => {
  it("neither need.ts nor target.ts export any function that combines multiple Need/Target/CellState instances across frames or subjects", () => {
    const needMod = needModule as unknown as Record<string, unknown>;
    const targetMod = targetModule as unknown as Record<string, unknown>;
    for (const name of [
      "aggregate",
      "aggregateAcrossFrames",
      "combine",
      "merge",
      "sum",
      "totalNeeds",
      "crossFrameSummary",
    ]) {
      expect(needMod[name]).toBeUndefined();
      expect(targetMod[name]).toBeUndefined();
    }
  });
});

describe("Need — determinism and purity", () => {
  it("never throws on malformed input", () => {
    expect(() => validateNeed({} as unknown as Need)).not.toThrow();
  });

  it("is deterministic — same input, same output", () => {
    const input = baseNeed();
    expect(validateNeed(input)).toEqual(validateNeed(input));
  });

  it("reports all applicable errors at once, not short-circuited", () => {
    const result = validateNeed(
      baseNeed({
        need_id: "",
        subject: "",
        provenance: "guessed" as unknown as Need["provenance"],
      }),
    );
    const fields = result.errors.map((e) => e.field).sort();
    expect(fields).toEqual(["need_id", "provenance", "subject"]);
  });
});
