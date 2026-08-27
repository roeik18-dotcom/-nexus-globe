/**
 * A LEGACY RECORD MAY NOT HIDE A REAL ONE.
 *
 * `factFromRecords` returned UNRESOLVED as soon as ANY record lacked an
 * origin — before it had counted the REAL ones. A person who had just written
 * a real Action saw their own record reported as unresolvable, because one old
 * row beside it had no origin. Both facts are true at once and both must show.
 */
import { describe, expect, it } from "vitest";

import { factFromRecords, factFromCount, provenanceFromOrigin } from "../RealDataGapPanel";
import { actionOriginOf } from "../../canon/actionStore";
import { effectOriginOf } from "../../canon/effectStore";
import type { ActionRecord } from "../../canon/actionStore";
import type { EffectRecord } from "../../canon/effectStore";

const A = (o?: string) => ({ action: { provenance: "prose" }, recorded_at: "t",
  ...(o ? { record_origin: o } : {}) }) as unknown as ActionRecord;
const E = (o?: string) => ({ effect: { provenance: "prose" }, recorded_at: "t",
  ...(o ? { record_origin: o } : {}) }) as unknown as EffectRecord;

const actionFact = (rs: ActionRecord[]) =>
  factFromRecords("Action", "s", rs, (r) => provenanceFromOrigin(actionOriginOf(r)), "none");
const effectFact = (rs: EffectRecord[]) =>
  factFromRecords("Effect", "s", rs, (r) => provenanceFromOrigin(effectOriginOf(r)), "none");

describe("Action — the four cases", () => {
  it("REAL only → PRESENT REAL", () => {
    const f = actionFact([A("REAL")]);
    expect(f.status).toBe("PRESENT");
    expect(f.provenance).toBe("REAL");
    expect(f.value).toBe(1);
  });

  it("legacy only → UNKNOWN / UNRESOLVED", () => {
    const f = actionFact([A()]);
    expect(f.status).toBe("UNRESOLVED");
    expect(f.provenance).toBe("UNKNOWN");
  });

  it("REAL + legacy → PRESENT, 1 REAL, and the legacy split is stated", () => {
    const f = actionFact([A("REAL"), A()]);
    expect(f.status).toBe("PRESENT");
    expect(f.provenance).toBe("REAL");
    /* The REAL record is counted in full and remains visible. */
    expect(f.value).toBe(1);
    /* And the legacy one is not silently absorbed. */
    expect(f.breakdown).toMatchObject({ REAL: 1, UNKNOWN_LEGACY: 1 });
    expect(f.unsupported_reason).toContain("1 REAL");
    expect(f.unsupported_reason).toContain("מעורב");
    /* The exact regression: it must not read as absent. */
    expect(f.status).not.toBe("UNRESOLVED");
    expect(f.status).not.toBe("EMPTY");
  });

  it("empty → EMPTY, never REAL", () => {
    const f = actionFact([]);
    expect(f.status).toBe("EMPTY");
    expect(f.provenance).not.toBe("REAL");
  });
});

describe("Effect — the identical four cases", () => {
  it("REAL only → PRESENT REAL", () => {
    expect(effectFact([E("REAL")])).toMatchObject({ status: "PRESENT", provenance: "REAL", value: 1 });
  });
  it("legacy only → UNRESOLVED", () => {
    expect(effectFact([E()]).status).toBe("UNRESOLVED");
  });
  it("REAL + legacy → PRESENT 1 REAL + 1 legacy", () => {
    const f = effectFact([E("REAL"), E()]);
    expect(f).toMatchObject({ status: "PRESENT", provenance: "REAL", value: 1 });
    expect(f.breakdown).toMatchObject({ REAL: 1, UNKNOWN_LEGACY: 1 });
  });
  it("empty → EMPTY", () => {
    expect(effectFact([]).status).toBe("EMPTY");
  });
});

describe("non-REAL origins cannot contribute to a REAL count", () => {
  it("DEMO, DERIVED and IMPORTED never produce provenance REAL", () => {
    for (const o of ["DEMO", "IMPORTED"]) {
      const f = actionFact([A(o)]);
      expect(f.provenance, o).not.toBe("REAL");
    }
    /* DERIVED is admissible as DERIVED, which is explicitly not REAL. */
    expect(actionFact([A("DERIVED")]).provenance).toBe("DERIVED");
  });

  it("a DEMO record beside a REAL one does not inflate the REAL count", () => {
    const f = actionFact([A("REAL"), A("DEMO")]);
    expect(f.value).toBe(1);
    expect(f.breakdown).toMatchObject({ REAL: 1, DEMO: 1 });
  });
});

describe("a count-only consumer may not claim provenance", () => {
  it("factFromCount always reports UNKNOWN and says why", () => {
    const c = factFromCount("X", "s", 7, "none");
    expect(c.provenance).toBe("UNKNOWN");
    expect(c.unsupported_reason).toBeTruthy();
  });
});
