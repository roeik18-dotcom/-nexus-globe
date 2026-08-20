/**
 * MATERIALIZED VALUES — Personal Value and Group Value as real entities.
 *
 * The value spine's middle two links rendered `—` because nothing in the
 * system instantiated them. They were not missing data; there was no way to
 * create them. This is that way.
 *
 * FOUR DIFFERENT THINGS, kept apart because collapsing any two is the failure
 * mode this whole model guards against:
 *
 *   CONTRADICTION / VALUE EMERGENCE  source material. An inventory of what
 *                                    the corpus contains. Not entities.
 *   PERSONAL VALUE                   a person said "this is a value of mine".
 *   GROUP VALUE                      a group adopted a value, with a record
 *                                    of who authorized that.
 *   VALUE FAMILY                     classification hung on an instantiated
 *                                    value — reference, never the value.
 *
 * MATERIALIZATION REQUIRES AN EXPLICIT AUTHORITATIVE PATH. A value is never
 * derived from contradiction similarity, from a mention, from membership,
 * from frequency, from the nearest value family, or from the source
 * inventory. Every one of those is a resemblance, and a resemblance is not a
 * declaration.
 *
 * ONE PERSON'S VALUE IS NOT THE GROUP'S. Group membership does not imply
 * value agreement, so a Group Value carries `authorized_by` — the record of
 * WHO adopted it on the group's behalf. A personal declaration can never be
 * promoted into a group one; the store rejects it structurally by requiring a
 * different scope and a different authority field.
 *
 * DECLARED != VERIFIED. Every declaration enters as DECLARED. Verification is
 * a separate later record, and until one exists the value is a stated
 * position, not a confirmed fact.
 */

export type ValueScope = "PERSONAL" | "GROUP";
export type ValueStatus = "DECLARED" | "VERIFIED";

export interface ValueDeclaration {
  value_id: string;
  scope: ValueScope;
  /** The value as the declarer worded it. Never generated. */
  label: string;
  /** PERSONAL: the person. GROUP: the group id. */
  holder_id: string;
  /** Who made the declaration. For PERSONAL this MUST equal `holder_id`. */
  declared_by: string;
  /**
   * GROUP only, and required: what authorized adoption for the group — a role,
   * a vote event id, a meeting. Absent is not allowed, because "the group
   * holds this value" with no stated authority is exactly the inference this
   * model forbids.
   */
  authorized_by?: string;
  /** Free text, required. The reason IS the evidence for a declaration. */
  evidence: string;
  status: ValueStatus;
  /** Optional reference classification. Never the value itself. */
  value_family_ref?: string;
  created_at: string;
}

export type ValueDeclarationError =
  | { field: "value_id" | "label" | "holder_id" | "declared_by" | "evidence" | "created_at"; reason: "empty" }
  | { field: "scope"; reason: "invalid" }
  | { field: "declared_by"; reason: "must_be_holder_for_personal" }
  | { field: "authorized_by"; reason: "required_for_group" };

export interface ValueDeclarationValidation {
  valid: boolean;
  errors: ValueDeclarationError[];
}

function nonEmpty(s: unknown): s is string {
  return typeof s === "string" && s.trim() !== "";
}

export function validateValueDeclaration(v: ValueDeclaration): ValueDeclarationValidation {
  const errors: ValueDeclarationError[] = [];
  for (const f of ["value_id", "label", "holder_id", "declared_by", "evidence", "created_at"] as const) {
    if (!nonEmpty(v?.[f])) errors.push({ field: f, reason: "empty" });
  }
  if (v?.scope !== "PERSONAL" && v?.scope !== "GROUP") {
    errors.push({ field: "scope", reason: "invalid" });
  }

  // A personal value is the holder's own statement about themselves. Anyone
  // declaring on someone else's behalf is asserting for them.
  if (v?.scope === "PERSONAL" && nonEmpty(v.holder_id) && nonEmpty(v.declared_by) && v.holder_id !== v.declared_by) {
    errors.push({ field: "declared_by", reason: "must_be_holder_for_personal" });
  }

  // A group value with no stated authority is an inference wearing a record's
  // clothes. Refused here rather than filtered downstream.
  if (v?.scope === "GROUP" && !nonEmpty(v.authorized_by)) {
    errors.push({ field: "authorized_by", reason: "required_for_group" });
  }

  return { valid: errors.length === 0, errors };
}

export function personalValuesOf(all: readonly ValueDeclaration[], personId: string): ValueDeclaration[] {
  return all.filter((v) => v.scope === "PERSONAL" && v.holder_id === personId);
}

export function groupValuesOf(all: readonly ValueDeclaration[], groupId: string): ValueDeclaration[] {
  return all.filter((v) => v.scope === "GROUP" && v.holder_id === groupId);
}
