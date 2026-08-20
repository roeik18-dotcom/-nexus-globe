import { describe, expect, it } from "vitest";

import { validateValueDeclaration, personalValuesOf, groupValuesOf, type ValueDeclaration } from "../valueDeclaration";
import { checkValueDeclarationAppend, InMemoryValueDeclarationStore } from "../valueDeclarationStore";

const v = (o: Partial<ValueDeclaration> = {}): ValueDeclaration => ({
  value_id: "value_1", scope: "PERSONAL", label: "אחריות",
  holder_id: "person_roei", declared_by: "person_roei",
  evidence: "כי זה מה שמנחה אותי", status: "DECLARED",
  created_at: "2026-08-20T12:00:00+03:00", ...o,
});

describe("value materialization — authority", () => {
  it("a personal value must be declared by its own holder", () => {
    expect(validateValueDeclaration(v()).valid).toBe(true);
    const other = validateValueDeclaration(v({ declared_by: "someone_else" }));
    expect(other.valid).toBe(false);
    expect(other.errors).toContainEqual({ field: "declared_by", reason: "must_be_holder_for_personal" });
  });

  it("a group value REQUIRES a stated authority — membership is not agreement", () => {
    const noAuth = validateValueDeclaration(v({ scope: "GROUP", holder_id: "vg_1" }));
    expect(noAuth.valid).toBe(false);
    expect(noAuth.errors).toContainEqual({ field: "authorized_by", reason: "required_for_group" });

    expect(validateValueDeclaration(v({ scope: "GROUP", holder_id: "vg_1", authorized_by: "vote e047" })).valid).toBe(true);
  });

  it("the label and the reason are both required — an unworded value is an inference", () => {
    expect(validateValueDeclaration(v({ label: "" })).valid).toBe(false);
    expect(validateValueDeclaration(v({ evidence: "  " })).valid).toBe(false);
  });
});

describe("value materialization — scopes stay separate", () => {
  const all = [
    v({ value_id: "p1", scope: "PERSONAL", holder_id: "person_roei" }),
    v({ value_id: "g1", scope: "GROUP", holder_id: "vg_1", authorized_by: "vote" }),
  ];

  it("a personal value never appears as a group value", () => {
    expect(personalValuesOf(all, "person_roei").map((x) => x.value_id)).toEqual(["p1"]);
    expect(groupValuesOf(all, "vg_1").map((x) => x.value_id)).toEqual(["g1"]);
    expect(groupValuesOf(all, "person_roei")).toEqual([]);
  });
});

describe("value materialization — store discipline", () => {
  it("enters as DECLARED, never VERIFIED", () => {
    expect(v().status).toBe("DECLARED");
  });

  it("rejects a duplicate id rather than ignoring it", async () => {
    const store = new InMemoryValueDeclarationStore([v()]);
    await expect(store.append([v()])).rejects.toThrow(/already stored/);
  });

  it("rejects an empty append", () => {
    expect(checkValueDeclarationAppend([], []).ok).toBe(false);
  });

  it("rejects an invalid scope", () => {
    expect(validateValueDeclaration(v({ scope: "TEAM" as never })).valid).toBe(false);
  });
});
