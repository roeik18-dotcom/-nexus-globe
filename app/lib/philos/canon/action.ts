/**
 * Philos Canon — Action (PHILOS-MELTING-POT-CANON.md §13, schema closure).
 *
 * `Action = { action_id, type ∈ {transfer, non_transfer}, owner,
 * mechanism_scope ∈ {self_regulation, melting_pot}, consent, inputs,
 * effect_ref, reversibility, time, provenance }`.
 * "Transfer is one subtype of Action, not synonymous with it.
 * **non_transfer_action** must remain possible (removing a barrier, changing
 * a boundary, creating access, changing an information environment). A
 * `self_regulation` Action cannot create an interpersonal Transfer."
 *
 * **Transfer ⊂ Action** (§11) is modeled with real TypeScript structural
 * subtyping in `transfer.ts` (`interface Transfer extends Action`) — not a
 * separate, parallel type that merely resembles Action. A `Transfer` object
 * IS an `Action` object (with `type` narrowed to `"transfer"` and extra
 * fields), so `validateAction()` can be called on a `Transfer` directly and
 * checks exactly the same base fields it would for any other Action. See
 * `__tests__/transfer.test.ts`'s `TRANSFER_IS_ACTION_SUBTYPE`.
 *
 * `self_regulation` Action cannot create an interpersonal Transfer (§13,
 * §15): enforced in `transfer.ts::validateTransfer`, not here — this file
 * cannot enforce a Transfer-specific rule, since a plain Action carries no
 * information about being a Transfer at this level. The rule is real,
 * tested, and lives at the point where "transfer" and "self_regulation"
 * could actually collide.
 *
 * **Action does not imply Effect success, and does not update State' by
 * itself** (§17, §24: `... → Action → Effect → OutcomeVerification →
 * Learning → State'` — Action precedes Effect in the pipeline, is not
 * identical to it). `effect_ref` is therefore modeled as **optional**: an
 * Action can exist and be recorded before any Effect is measured against it
 * — the field names a link for when one exists, it does not assert one
 * always does. No function in this file writes to, mutates, or "resolves"
 * any state — enforced by absence (see `__tests__/action.test.ts`).
 *
 * `consent` is typed `boolean`, required `true` — the same choice already
 * made for Offer and Matching in this directory (canon §10's CONSENT is an
 * explicit hard boolean gate; Action, like Offer and Matching, describes an
 * operational/executing entity, not an aspirational one like Need/Target, so
 * the same gate-shaped treatment is used here for consistency, not invented
 * fresh for this file).
 *
 * `inputs`, `reversibility`, `provenance`: canon requires these fields but
 * gives none of them a closed vocabulary or fixed shape. `inputs` is typed as
 * `string[]` (reference ids/descriptions of what fed this Action — e.g. a
 * Need id, an Offer id, an Observation id); `reversibility`/`provenance` are
 * unconstrained non-empty strings — the same restraint already applied
 * throughout this directory to fields canon names but does not enumerate.
 *
 * SystemicChannel note (canon §18): "Any S-cell reference used by Tension,
 * Matching, Need, Offer, **Action**, or Transfer must identify its
 * SystemicChannel." Action IS named in that list — but canon's own §13
 * schema closure for Action has **no cell field at all** (unlike Need/Offer/
 * Matching, which explicitly reference a cell). The §18 rule is about an
 * "S-cell reference" — with no cell field on Action's own schema, there is
 * nothing for the rule to attach to here; it is not vacuously invented away,
 * it is genuinely inapplicable at this level. It becomes concretely
 * applicable on `Transfer` (which does have `source_cell`/`target_cell`) —
 * see `transfer.ts`.
 *
 * Anti-ranking scope note (canon §21), matching every other file in this
 * directory: no scoring, ranking, cumulative-contribution counter, or
 * cross-frame/cross-subject aggregation exists anywhere in this file.
 */
import { parseOffsetInstant } from "./observation";

export type ActionType = "transfer" | "non_transfer";
export type MechanismScope = "self_regulation" | "melting_pot";

/** canon §13. */
export interface Action {
  action_id: string;
  type: ActionType;
  owner: string;
  mechanism_scope: MechanismScope;
  /** Mandatory — must be `true`, not merely present. See module header. */
  consent: boolean;
  inputs: string[];
  /** Optional — an Action may exist before any Effect is measured (§24 pipeline order). */
  effect_ref?: string;
  reversibility: string;
  time: string;
  provenance: string;
}

export type ActionError =
  | { field: "action_id"; reason: "empty" }
  | { field: "type"; reason: "invalid" }
  | { field: "owner"; reason: "empty" }
  | { field: "mechanism_scope"; reason: "invalid" }
  | { field: "consent"; reason: "not_true" }
  | { field: "inputs"; reason: "not_an_array" }
  | { field: "effect_ref"; reason: "empty_if_present" }
  | { field: "reversibility"; reason: "empty" }
  | { field: "time"; reason: "invalid_or_no_offset" }
  | { field: "provenance"; reason: "empty" };

export interface ValidationResult {
  valid: boolean;
  errors: ActionError[];
}

const ACTION_TYPES: ActionType[] = ["transfer", "non_transfer"];
const MECHANISM_SCOPES: MechanismScope[] = ["self_regulation", "melting_pot"];

function nonEmpty(s: unknown): s is string {
  return typeof s === "string" && s.trim() !== "";
}

/**
 * Pure, deterministic validator over the base Action fields only. Called
 * directly by `transfer.ts::validateTransfer` as its first step, since
 * `Transfer` is structurally an `Action` — never duplicated.
 */
export function validateAction(a: Action): ValidationResult {
  const errors: ActionError[] = [];

  if (!nonEmpty(a.action_id)) errors.push({ field: "action_id", reason: "empty" });
  if (!ACTION_TYPES.includes(a.type)) errors.push({ field: "type", reason: "invalid" });
  if (!nonEmpty(a.owner)) errors.push({ field: "owner", reason: "empty" });

  if (!MECHANISM_SCOPES.includes(a.mechanism_scope)) {
    errors.push({ field: "mechanism_scope", reason: "invalid" });
  }

  if (a.consent !== true) errors.push({ field: "consent", reason: "not_true" });

  if (!Array.isArray(a.inputs)) errors.push({ field: "inputs", reason: "not_an_array" });

  if (a.effect_ref !== undefined && !nonEmpty(a.effect_ref)) {
    errors.push({ field: "effect_ref", reason: "empty_if_present" });
  }

  if (!nonEmpty(a.reversibility)) {
    errors.push({ field: "reversibility", reason: "empty" });
  }

  const timeMs = parseOffsetInstant(a.time);
  if (timeMs === null) errors.push({ field: "time", reason: "invalid_or_no_offset" });

  if (!nonEmpty(a.provenance)) errors.push({ field: "provenance", reason: "empty" });

  return { valid: errors.length === 0, errors };
}
