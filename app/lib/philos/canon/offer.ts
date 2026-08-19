/**
 * Philos Canon — Offer (PHILOS-MELTING-POT-CANON.md §11, donor-side schema
 * closure).
 *
 * "Offer (schema closure, donor-side): `Offer = { offer_id, source,
 * source_cell, systemic_channel_if_S, available_resource, resource_type,
 * amount_or_capacity, competence, willingness, consent, availability, cost,
 * constraints, expiry, provenance }`. Offer is **ephemeral / per-match** —
 * never a permanent donor-capacity or contribution/reputation profile."
 *
 * Field-name note: `systemic_channel_if_S` is canon's OWN literal field name
 * for this entity (not `systemicChannel` as used elsewhere in this
 * directory) — kept verbatim rather than normalized, since the name itself
 * documents the conditionality canon states.
 *
 * Field-list note: canon's Offer schema closure does **not** include a
 * `time` field (unlike Observation §6, Need §12, Target §8, all of which do).
 * This is preserved exactly — no `time` field is added here, and `expiry` is
 * therefore validated as a well-formed instant on its own, with no
 * "expiry-after-time" comparison (there is nothing canon-cited to compare it
 * against).
 *
 * **Offer ≠ Capacity** (§11): "a Capacity (a cell surplus-state) becomes a
 * Resource only through an explicit conversion mechanism — never
 * automatically." `amount_or_capacity` here is the DONOR'S OFFER — already
 * asserted as available by the source — not a raw CellState surplus reading
 * and not itself a Resource. No conversion-mechanism function is defined in
 * this file; building one is separate, future, explicitly-approved work.
 *
 * **Offer does not imply Matching, Transfer, or Need** — enforced structurally
 * by absence: this file exports no function that takes an Offer and produces
 * a match, a Transfer, a Need, or an "intervention" of any kind. See
 * `__tests__/offer.test.ts`'s OFFER_DOES_NOT_CREATE_MATCH /
 * OFFER_DOES_NOT_CREATE_TRANSFER / OFFER_DOES_NOT_CREATE_NEED for the
 * assertions that prove it, matching the same discipline `need.ts` already
 * established for Need ≠ Deficit.
 *
 * **Consent and willingness are mandatory** (this pass's explicit
 * requirement, and consistent with canon §10's own boolean-gate philosophy:
 * `Permitted(edge) ⇔ CAN ∧ WANTS ∧ ALLOWED ∧ APPROPRIATE ∧ AVAILABLE ∧
 * CONSENT` — CONSENT is one of §10's own ANDed boolean gates, never a soft
 * cost; WANTS is the same shape as willingness). Both fields are typed
 * `boolean` here and required to be `true`, not merely present — "mandatory"
 * is read as "must affirmatively hold," matching how canon treats CONSENT
 * elsewhere, not invented fresh for this file.
 *
 * `resource_type` note: canon's own list — "ResourceType ∈ {consumable,
 * renewable, replicable, non-rival, time, attention, knowledge,
 * emotional/social, ...}" — ends in an explicit ellipsis. Canon itself leaves
 * this open-ended. `resource_type` is therefore typed `string`, not a closed
 * union — closing it here would invent a restriction canon deliberately did
 * not state. `RESOURCE_TYPE_EXAMPLES` below is exported only as a reference
 * list of canon-named values, never used to reject an unlisted one.
 *
 * `competence`, `availability`, `cost`, `provenance`: canon requires these
 * fields but gives none of them a closed vocabulary or numeric scale. All are
 * typed `string`, required non-empty, with no invented range/enum — same
 * restraint already applied to `stability` (cellState.ts) and Target's
 * `provenance`/`consent_status` (target.ts).
 *
 * SystemicChannel note (canon §18): "Any S-cell reference used by Tension,
 * Matching, Need, **Offer**, Action, or Transfer must identify its
 * SystemicChannel." Offer IS named — enforced below exactly like Need's
 * cell-level requirement, unlike Target (not named, not enforced there).
 *
 * Anti-ranking / permanence scope note (canon §21 + this pass's explicit
 * invariants): no scoring, ranking, cumulative-contribution counter, or
 * reputation/social-credit field exists anywhere in this file. No store, no
 * "all of a source's offers" aggregate, no persistence beyond one record with
 * its own `expiry` — matching "ephemeral / per-match," not a profile.
 */
import {
  type Domain,
  type Frame,
  parseOffsetInstant,
  type SystemicChannel,
  SYSTEMIC_CHANNELS,
} from "./observation";

/**
 * Reference examples only, taken verbatim from canon §11's own list — NOT a
 * closed set. `resource_type` accepts any non-empty string; this array exists
 * for documentation/autocomplete, never for validation.
 */
export const RESOURCE_TYPE_EXAMPLES = [
  "consumable",
  "renewable",
  "replicable",
  "non-rival",
  "time",
  "attention",
  "knowledge",
  "emotional/social",
] as const;

/** canon §11, donor-side schema closure — field order matches canon's text. */
export interface Offer {
  offer_id: string;
  source: string;
  source_cell: { domain: Domain; frame: Frame };
  /** Canon's own field name. Required iff source_cell.frame === "S" (§18). */
  systemic_channel_if_S?: SystemicChannel;
  available_resource: string;
  /** Open-ended per canon's own "..." — not a closed union. See module header. */
  resource_type: string;
  amount_or_capacity: string | number;
  competence: string;
  /** Mandatory — must be `true`, not merely present. See module header. */
  willingness: boolean;
  /** Mandatory — must be `true`, not merely present. Canon §10's CONSENT gate. */
  consent: boolean;
  availability: string;
  cost: string;
  constraints: string[];
  /** ISO 8601 with explicit offset. No `time` field exists on Offer (canon). */
  expiry: string;
  provenance: string;
}

export type OfferError =
  | { field: "offer_id"; reason: "empty" }
  | { field: "source"; reason: "empty" }
  | { field: "source_cell"; reason: "invalid" }
  | { field: "systemic_channel_if_S"; reason: "required_when_frame_is_S" }
  | { field: "systemic_channel_if_S"; reason: "invalid" }
  | { field: "available_resource"; reason: "empty" }
  | { field: "resource_type"; reason: "empty" }
  | { field: "amount_or_capacity"; reason: "empty_or_not_finite" }
  | { field: "competence"; reason: "empty" }
  | { field: "willingness"; reason: "not_true" }
  | { field: "consent"; reason: "not_true" }
  | { field: "availability"; reason: "empty" }
  | { field: "cost"; reason: "empty" }
  | { field: "constraints"; reason: "not_an_array" }
  | { field: "expiry"; reason: "invalid_or_no_offset" }
  | { field: "provenance"; reason: "empty" };

export interface ValidationResult {
  valid: boolean;
  errors: OfferError[];
}

const DOMAINS: Domain[] = ["G", "E", "C"];
const FRAMES: Frame[] = ["I", "R", "S"];

function nonEmpty(s: unknown): s is string {
  return typeof s === "string" && s.trim() !== "";
}

/**
 * Pure, deterministic validator. No I/O, never throws, all applicable checks
 * run without short-circuiting — same discipline as the rest of this
 * directory (observation.ts, cellState.ts, need.ts, target.ts).
 */
export function validateOffer(o: Offer): ValidationResult {
  const errors: OfferError[] = [];

  if (!nonEmpty(o.offer_id)) errors.push({ field: "offer_id", reason: "empty" });
  if (!nonEmpty(o.source)) errors.push({ field: "source", reason: "empty" });

  const cellOk =
    !!o.source_cell &&
    DOMAINS.includes(o.source_cell.domain) &&
    FRAMES.includes(o.source_cell.frame);
  if (!cellOk) errors.push({ field: "source_cell", reason: "invalid" });

  if (cellOk && o.source_cell.frame === "S") {
    if (
      o.systemic_channel_if_S === undefined ||
      !SYSTEMIC_CHANNELS.includes(o.systemic_channel_if_S)
    ) {
      errors.push({ field: "systemic_channel_if_S", reason: "required_when_frame_is_S" });
    }
  } else if (
    o.systemic_channel_if_S !== undefined &&
    !SYSTEMIC_CHANNELS.includes(o.systemic_channel_if_S)
  ) {
    // Not required outside frame=S (canon ties it to S specifically), but if
    // supplied anyway it must still be one of the six declared values.
    errors.push({ field: "systemic_channel_if_S", reason: "invalid" });
  }

  if (!nonEmpty(o.available_resource)) {
    errors.push({ field: "available_resource", reason: "empty" });
  }

  if (!nonEmpty(o.resource_type)) {
    // Required, but never restricted to RESOURCE_TYPE_EXAMPLES — canon's list
    // is open-ended.
    errors.push({ field: "resource_type", reason: "empty" });
  }

  const amountOk =
    (typeof o.amount_or_capacity === "string" && o.amount_or_capacity.trim() !== "") ||
    (typeof o.amount_or_capacity === "number" && Number.isFinite(o.amount_or_capacity));
  if (!amountOk) {
    errors.push({ field: "amount_or_capacity", reason: "empty_or_not_finite" });
  }

  if (!nonEmpty(o.competence)) errors.push({ field: "competence", reason: "empty" });

  if (o.willingness !== true) errors.push({ field: "willingness", reason: "not_true" });
  if (o.consent !== true) errors.push({ field: "consent", reason: "not_true" });

  if (!nonEmpty(o.availability)) errors.push({ field: "availability", reason: "empty" });
  if (!nonEmpty(o.cost)) errors.push({ field: "cost", reason: "empty" });

  if (!Array.isArray(o.constraints)) {
    errors.push({ field: "constraints", reason: "not_an_array" });
  }

  const expiryMs = parseOffsetInstant(o.expiry);
  if (expiryMs === null) {
    errors.push({ field: "expiry", reason: "invalid_or_no_offset" });
  }

  if (!nonEmpty(o.provenance)) errors.push({ field: "provenance", reason: "empty" });

  return { valid: errors.length === 0, errors };
}
