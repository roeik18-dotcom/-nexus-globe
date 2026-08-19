/**
 * Command: a member records what actually changed in the world.
 *
 * §4's ⑥ IMPACT terminal asks the question the whole system exists for — "what
 * actually changed" — and §10 is the rule that makes the answer worth anything:
 * six evidence levels that must never collapse into each other, and inferred
 * impact never shown as verified fact.
 *
 * ── A claim cannot verify itself ───────────────────────────────────────────
 * This is the one place a write path could quietly destroy the ladder. A reporter
 * saying "10 people were helped, community_verified" would be conferring
 * verification on their own claim. `projectValueGroup` already defends against
 * it — a verified status on a report is downgraded to `self_report` on read —
 * but a silent downgrade is the wrong answer at the WRITE boundary: it stores
 * one thing and shows another, and the reporter never learns their claim was not
 * accepted as written. So the command REFUSES a verified rung by name. Only an
 * `impact.verified` event, written by a second party, can lift a claim's rung.
 *
 * ── The rung this command may write ────────────────────────────────────────
 * `claim` when nothing is attached, `self_report` when the reporter attaches
 * evidence — the rung the seed's own impact report uses. A reporter may state
 * either explicitly, plus `evidence`; anything above that is refused.
 */

import type { ImpactClaim, PhilosEvent, VerificationStatus } from "../events";
import { isVerified } from "../events";
import type { Clock, IdGenerator } from "../eventStore";
import {
  requireGroup,
  requireMember,
  requireUsableTime,
  resolveCausalParents,
  type Refusal,
  type SharedRejectionCode,
} from "./preconditions";

export const RECORD_IMPACT_REJECTION_CODES = [
  "empty_person_id",
  "empty_statement",
  "invalid_people_affected",
  "invalid_resources_invested",
  "invalid_confidence",
  "invalid_period",
  "self_verification",
  "unknown_allocation",
] as const;

export type RecordImpactRejectionCode =
  | (typeof RECORD_IMPACT_REJECTION_CODES)[number]
  | SharedRejectionCode;

/** The only rungs a REPORT may sit on. Everything above needs a second party. */
export const REPORTABLE_STATUSES: readonly VerificationStatus[] = [
  "claim",
  "self_report",
  "evidence",
];

export interface RecordImpactInput {
  group_id: string;
  person_id: string;
  /** What changed, in the reporter's own words. */
  statement: string;
  people_affected: number;
  resources_invested: number;
  /** References to whatever backs the claim — a visit log, a receipt, a photo set. */
  evidence?: string[];
  /** 0..1. Omit when the report asserts nothing probabilistic. */
  confidence?: number;
  /** The allocation this impact came out of, if any. Must exist in the log. */
  allocation_id?: string;
  /** [from, to] dates the impact covers. */
  period?: [string, string];
  /** The rung the reporter claims. Refused if it is a verified one. */
  reported_status?: VerificationStatus;
  about_event_ids?: string[];
}

export interface RecordImpactDeps {
  clock: Clock;
  ids: IdGenerator;
}

export type RecordImpactResult =
  | { ok: true; events: PhilosEvent[]; impact_id: string }
  | Refusal<RecordImpactRejectionCode>;

export const MAX_IMPACT_STATEMENT = 1000;

const isNonNegativeInt = (n: unknown): n is number =>
  typeof n === "number" && Number.isInteger(n) && n >= 0;

const isDate = (s: unknown): s is string =>
  typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

export function recordImpact(
  stored: readonly PhilosEvent[],
  input: RecordImpactInput,
  deps: RecordImpactDeps,
): RecordImpactResult {
  const person_id = input.person_id.trim();
  const group_id = input.group_id.trim();
  const statement = input.statement.trim();

  if (!person_id) {
    return { ok: false, code: "empty_person_id", message: "person_id is required" };
  }
  if (!statement) {
    // An impact row with a people-count and no statement is a number with no
    // claim attached — unreadable, and unfalsifiable.
    return {
      ok: false,
      code: "empty_statement",
      message: "an impact record must say what changed",
    };
  }
  if (!isNonNegativeInt(input.people_affected)) {
    return {
      ok: false,
      code: "invalid_people_affected",
      message: `people_affected must be a whole number of people; got ${String(
        input.people_affected,
      )}`,
    };
  }
  if (!isNonNegativeInt(input.resources_invested)) {
    return {
      ok: false,
      code: "invalid_resources_invested",
      message: `resources_invested must be a non-negative whole number; got ${String(
        input.resources_invested,
      )}`,
    };
  }
  if (input.confidence !== undefined) {
    if (
      typeof input.confidence !== "number" ||
      Number.isNaN(input.confidence) ||
      input.confidence < 0 ||
      input.confidence > 1
    ) {
      return {
        ok: false,
        code: "invalid_confidence",
        message: `confidence must be between 0 and 1; got ${String(input.confidence)}`,
      };
    }
  }
  if (input.period !== undefined) {
    const [from, to] = input.period;
    if (!isDate(from) || !isDate(to) || Date.parse(from) > Date.parse(to)) {
      return {
        ok: false,
        code: "invalid_period",
        message: `period must be [from, to] as YYYY-MM-DD with from ≤ to; got ${JSON.stringify(
          input.period,
        )}`,
      };
    }
  }

  const reported_status: VerificationStatus = input.reported_status
    ?? ((input.evidence?.length ?? 0) > 0 ? "self_report" : "claim");

  if (isVerified(reported_status) || !REPORTABLE_STATUSES.includes(reported_status)) {
    // Refused, not silently downgraded: storing `self_report` while the reporter
    // asked for `community_verified` would show them something they did not
    // write, and they would never learn the claim was not accepted as stated.
    return {
      ok: false,
      code: "self_verification",
      message:
        `a report cannot place itself on "${reported_status}" — a claim cannot verify itself. ` +
        `Reportable rungs are ${REPORTABLE_STATUSES.join(", ")}; anything above needs an impact.verified event`,
    };
  }

  const group = requireGroup(stored, group_id);
  if (!group.ok) return group;

  const time = requireUsableTime(deps.clock.now(), group.opened);
  if (!time.ok) return time;

  const member = requireMember(stored, group_id, person_id);
  if (!member.ok) return member;

  if (input.allocation_id !== undefined) {
    const exists = stored.some(
      (e) => e.event_type === "allocation.proposed" && e.entity_id === input.allocation_id,
    );
    if (!exists) {
      // `payload.allocation_id` is a join key `projectDynamics` infers edges
      // from. An id pointing nowhere would produce an unresolved claim on the
      // causal graph for every reader, forever.
      return {
        ok: false,
        code: "unknown_allocation",
        message: `allocation ${input.allocation_id} is not in the log`,
      };
    }
  }

  const causes = resolveCausalParents(stored, input.about_event_ids, time.timestamp);
  if (!causes.ok) return causes;

  const impact_id = deps.ids.next("imp");
  const impact_claim: ImpactClaim = {
    people_affected: input.people_affected,
    statement: statement.slice(0, MAX_IMPACT_STATEMENT),
    resources_invested: input.resources_invested,
  };

  return {
    ok: true,
    impact_id,
    events: [
      {
        event_id: deps.ids.next("ev"),
        actor_id: person_id,
        entity_type: "impact",
        entity_id: impact_id,
        event_type: "impact.recorded",
        value_tags: [...group.opened.value_tags],
        timestamp: time.timestamp,
        visibility: "public",
        payload: {
          group_id,
          ...(input.allocation_id !== undefined ? { allocation_id: input.allocation_id } : {}),
          ...(input.period !== undefined ? { period: input.period } : {}),
        },
        impact_claim,
        ...(input.evidence && input.evidence.length > 0 ? { evidence: [...input.evidence] } : {}),
        ...(input.confidence !== undefined ? { confidence: input.confidence } : {}),
        verification_status: reported_status,
        caused_by: causes.caused_by,
      },
    ],
  };
}
