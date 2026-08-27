/**
 * ORIGIN IS A FACT ABOUT THE WRITER, NOT A SENTENCE THE PERSON TYPED.
 *
 * `action.provenance` is free prose the person authors ("self-initiated via
 * Marketplace…"), and thirteen projections compared it to the string "REAL".
 * Every genuine record therefore rendered UNKNOWN while its gates passed —
 * a screen that said a record both existed and could not be trusted.
 */
import { describe, expect, it } from "vitest";

import { actionOriginOf, isActionAdmissible, type ActionRecord } from "../actionStore";
import { effectOriginOf, isEffectAdmissible, type EffectRecord } from "../effectStore";
import { provenanceFromOrigin } from "../../day/RealDataGapPanel";
import { RECORD_ORIGINS } from "../../recordOrigin";

const action = (over: Partial<ActionRecord> = {}) =>
  ({ action: { provenance: "כל טקסט חופשי שהאדם כתב" }, recorded_at: "2026-08-27T00:00:00.000Z",
     ...over }) as unknown as ActionRecord;
const effect = (over: Partial<EffectRecord> = {}) =>
  ({ effect: { provenance: "self-reported, direct observation" },
     recorded_at: "2026-08-27T00:00:00.000Z", ...over }) as unknown as EffectRecord;

describe("human provenance is preserved and is never the origin", () => {
  it("arbitrary prose does NOT make a record UNKNOWN when the origin is REAL", () => {
    const r = action({ record_origin: "REAL" });
    expect((r.action as unknown as { provenance: string }).provenance)
      .toBe("כל טקסט חופשי שהאדם כתב");
    expect(actionOriginOf(r)).toBe("REAL");
    expect(isActionAdmissible(r)).toBe(true);
  });

  it("prose reading exactly \"REAL\" does not confer admissibility on its own", () => {
    const r = action({ action: { provenance: "REAL" } } as Partial<ActionRecord>);
    expect(actionOriginOf(r)).toBe("UNKNOWN");
    expect(isActionAdmissible(r)).toBe(false);
  });
});

describe("a client cannot forge an origin", () => {
  it("an unrecognised value is UNKNOWN, never trusted", () => {
    for (const forged of ["real", "REAL ", "TRUE", 1, true, null, {}, ["REAL"]]) {
      const r = action({ record_origin: forged as never });
      expect(actionOriginOf(r), String(forged)).toBe("UNKNOWN");
      expect(isActionAdmissible(r)).toBe(false);
    }
  });

  it("the trusted writers take no origin parameter at all", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(join(process.cwd(), "app/lib/philos/canon/actionLifecycle.ts"), "utf8");
    /* The private boundary is the ONLY place origin is an argument. */
    expect(src).toContain("async function writeActionRecord");
    expect(src).toMatch(/export async function recordAuthenticatedAction\(\s*action: Action, recordedAt: string,\s*\)/);
    expect(src).toMatch(/export async function recordAuthenticatedEffect\(\s*effect: Effect, recordedAt: string,\s*\)/);
    /* And it must not be a server-action module, or the REAL writer would be
       a client-callable endpoint. */
    expect(src.slice(0, 200)).not.toContain("use server");
  });
});

describe("legacy and non-REAL origins", () => {
  it("a stored record with no origin stays UNKNOWN — no migration", () => {
    expect(actionOriginOf(action())).toBe("UNKNOWN");
    expect(effectOriginOf(effect())).toBe("UNKNOWN");
    expect(isActionAdmissible(action())).toBe(false);
  });

  it("DEMO, DERIVED, IMPORTED and UNKNOWN are all inadmissible", () => {
    for (const o of RECORD_ORIGINS.filter((x) => x !== "REAL")) {
      expect(isActionAdmissible(action({ record_origin: o })), o).toBe(false);
      expect(isEffectAdmissible(effect({ record_origin: o })), o).toBe(false);
    }
  });

  it("Effect carries the identical protections as Action", () => {
    expect(effectOriginOf(effect({ record_origin: "REAL" }))).toBe("REAL");
    expect(isEffectAdmissible(effect({ record_origin: "REAL" }))).toBe(true);
    expect(effectOriginOf(effect({ record_origin: "nope" as never }))).toBe("UNKNOWN");
  });
});

describe("the panel vocabulary mapping is total and explicit", () => {
  it("every origin has a defined meaning, and UNKNOWN maps to absent", () => {
    expect(provenanceFromOrigin("REAL")).toBe("REAL");
    expect(provenanceFromOrigin("DEMO")).toBe("DEMO");
    expect(provenanceFromOrigin("DERIVED")).toBe("DERIVED_REAL");
    expect(provenanceFromOrigin("IMPORTED")).toBe("REFERENCE");
    expect(provenanceFromOrigin("UNKNOWN")).toBeUndefined();
  });

  it("a REAL record therefore projects as REAL, not UNKNOWN", () => {
    expect(provenanceFromOrigin(actionOriginOf(action({ record_origin: "REAL" })))).toBe("REAL");
  });
});

describe("forged FormData cannot override the server origin", () => {
  it("the form action never reads record_origin from the submitted data", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    for (const f of ["actionFormAction.ts", "effectFormAction.ts"]) {
      const src = readFileSync(join(process.cwd(), "app/lib/philos/canon", f), "utf8");
      /* If it never pulls the field out of FormData, a client cannot set it. */
      expect(src, f).not.toMatch(/formData\.get\(\s*["']record_origin["']\s*\)/);
      expect(src, f).not.toMatch(/record_origin\s*:/);
      /* And it must call the trusted writer, not the origin-less one. */
      expect(src, f).toMatch(/recordAuthenticated(Action|Effect)\(/);
    }
  });

  it("the consuming terminals read origin, not the human provenance string", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    for (const f of ["marketplace/page.tsx", "dynamics/page.tsx"]) {
      const src = readFileSync(join(process.cwd(), "app", f), "utf8");
      expect(src, f).toContain("actionOriginOf");
      expect(src, f).toContain("effectOriginOf");
      /* The old shape: a bare length handed to a count-only fact. */
      expect(src, f).not.toMatch(/factFromCount\("Action"/);
      expect(src, f).not.toMatch(/factFromCount\("Effect"/);
    }
  });
});
