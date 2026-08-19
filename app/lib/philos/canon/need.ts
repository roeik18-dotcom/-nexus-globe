/**
 * Philos Canon — Need (PHILOS-MELTING-POT-CANON.md §12).
 *
 * `Need = subject-declared or subject-endorsed desired change.`
 * `Need = { need_id, subject, desired_change, cells_or_domain, provenance ∈
 * {self_reported, endorsed}, context, time, expiry, consent_scope }`.
 *
 * **Need ≠ Deficit** (§12, locked): a Deficit may exist without a Need, and a
 * Need may exist without an inferred Deficit. **Need is the sovereign
 * subject-side entry into Matching.** An inferred Deficit without a
 * corresponding Need cannot automatically trigger intervention. This module
 * enforces that boundary structurally: it defines and exports NOTHING that
 * accepts a `CellState` (or any deficit-shaped reading) and produces a `Need`.
 * There is no `deriveNeedFromCellState`, `deriveNeedFromDeficit`, or `inferNeed`
 * function anywhere in this file — that absence is the enforcement mechanism,
 * not an oversight (see `__tests__/need.test.ts`'s `DEFICIT_DOES_NOT_CREATE_NEED`
 * for the assertion that proves it).
 *
 * **Need must never become a permanent person profile** (canon §21,
 * `NO_PERMANENT_DEFICIT_PROFILE`-adjacent): a `Need` here is one record with
 * its own `time`/`expiry` — this module provides no store, no accumulation, no
 * "all of a person's needs" aggregate. Persistence, if ever built, is separate,
 * future, explicitly-approved work.
 *
 * Anti-ranking scope note (canon §21), matching observation.ts/cellState.ts:
 * no scoring, ranking, priority-ordering, or cross-subject/cross-frame
 * aggregation of any kind is defined here.
 *
 * SystemicChannel note (canon §18): "Any S-cell reference used by Tension,
 * Matching, **Need**, Offer, Action, or Transfer must identify its
 * SystemicChannel." Need IS named in that list — so an S-frame cell reference
 * inside a Need's scope requires a SystemicChannel, enforced below. (Contrast
 * `target.ts`, which canon's §18 list does NOT name — see that file for why no
 * such requirement is invented there.)
 */
import {
  type Domain,
  type Frame,
  parseOffsetInstant,
  type SystemicChannel,
  SYSTEMIC_CHANNELS,
} from "./observation";

export type NeedProvenance = "self_reported" | "endorsed";

/**
 * A single cell reference inside a Need's scope. `systemicChannel` is required
 * only when `frame === "S"` (canon §18) — enforced in `validateNeed`, not in
 * the type, so a malformed input can still be represented and reported rather
 * than rejected at the type layer alone.
 */
export interface NeedCellRef {
  domain: Domain;
  frame: Frame;
  systemicChannel?: SystemicChannel;
}

/**
 * canon's `cells_or_domain` field, made an explicit discriminated union rather
 * than a loosely-typed "either shape" — a representation choice, not a
 * semantic addition: canon states the field may be specific cells OR a bare
 * domain; the `kind` tag just makes that "or" mechanically checkable instead
 * of ambiguous.
 */
export type NeedScope =
  | { kind: "cells"; cells: NeedCellRef[] }
  | { kind: "domain"; domain: Domain };

/** canon §12. */
export interface Need {
  need_id: string;
  subject: string;
  desired_change: string;
  scope: NeedScope; // cells_or_domain
  provenance: NeedProvenance;
  context: string;
  time: string;
  expiry: string;
  consent_scope: string;
}

export type NeedError =
  | { field: "need_id"; reason: "empty" }
  | { field: "subject"; reason: "empty" }
  | { field: "desired_change"; reason: "empty" }
  | { field: "scope"; reason: "invalid" }
  | { field: "scope"; reason: "empty_cells" }
  | { field: "scope.cells"; reason: "invalid_cell"; index: number }
  | { field: "scope.cells"; reason: "systemic_channel_required_for_S"; index: number }
  | { field: "scope.domain"; reason: "invalid" }
  | { field: "provenance"; reason: "invalid" }
  | { field: "context"; reason: "empty" }
  | { field: "time"; reason: "invalid_or_no_offset" }
  | { field: "expiry"; reason: "invalid_or_no_offset" }
  | { field: "expiry"; reason: "not_after_time" }
  | { field: "consent_scope"; reason: "empty" };

export interface ValidationResult {
  valid: boolean;
  errors: NeedError[];
}

const DOMAINS: Domain[] = ["G", "E", "C"];
const FRAMES: Frame[] = ["I", "R", "S"];
const PROVENANCES: NeedProvenance[] = ["self_reported", "endorsed"];

function nonEmpty(s: unknown): s is string {
  return typeof s === "string" && s.trim() !== "";
}

/**
 * Pure, deterministic validator. No I/O, never throws, all applicable checks
 * run without short-circuiting — same discipline as validateObservation() and
 * validateCellState().
 */
export function validateNeed(n: Need): ValidationResult {
  const errors: NeedError[] = [];

  if (!nonEmpty(n.need_id)) errors.push({ field: "need_id", reason: "empty" });
  if (!nonEmpty(n.subject)) errors.push({ field: "subject", reason: "empty" });
  if (!nonEmpty(n.desired_change)) {
    errors.push({ field: "desired_change", reason: "empty" });
  }

  if (!n.scope || (n.scope.kind !== "cells" && n.scope.kind !== "domain")) {
    errors.push({ field: "scope", reason: "invalid" });
  } else if (n.scope.kind === "cells") {
    if (!Array.isArray(n.scope.cells) || n.scope.cells.length === 0) {
      errors.push({ field: "scope", reason: "empty_cells" });
    } else {
      n.scope.cells.forEach((cell, index) => {
        const domainOk = DOMAINS.includes(cell?.domain);
        const frameOk = FRAMES.includes(cell?.frame);
        if (!domainOk || !frameOk) {
          errors.push({ field: "scope.cells", reason: "invalid_cell", index });
          return;
        }
        // canon §18: Need is explicitly named as requiring SystemicChannel on
        // any S-cell reference.
        if (
          cell.frame === "S" &&
          (cell.systemicChannel === undefined ||
            !SYSTEMIC_CHANNELS.includes(cell.systemicChannel))
        ) {
          errors.push({
            field: "scope.cells",
            reason: "systemic_channel_required_for_S",
            index,
          });
        }
      });
    }
  } else if (n.scope.kind === "domain") {
    if (!DOMAINS.includes(n.scope.domain)) {
      errors.push({ field: "scope.domain", reason: "invalid" });
    }
    // A bare-domain scope carries no frame, so the S-cell SystemicChannel rule
    // (which is keyed on frame === "S") does not apply — nothing to check here,
    // and nothing invented to fill the gap.
  }

  if (!PROVENANCES.includes(n.provenance)) {
    errors.push({ field: "provenance", reason: "invalid" });
  }

  if (!nonEmpty(n.context)) errors.push({ field: "context", reason: "empty" });

  const timeMs = parseOffsetInstant(n.time);
  if (timeMs === null) errors.push({ field: "time", reason: "invalid_or_no_offset" });

  const expiryMs = parseOffsetInstant(n.expiry);
  if (expiryMs === null) {
    errors.push({ field: "expiry", reason: "invalid_or_no_offset" });
  } else if (timeMs !== null && expiryMs <= timeMs) {
    errors.push({ field: "expiry", reason: "not_after_time" });
  }

  if (!nonEmpty(n.consent_scope)) {
    errors.push({ field: "consent_scope", reason: "empty" });
  }

  return { valid: errors.length === 0, errors };
}
