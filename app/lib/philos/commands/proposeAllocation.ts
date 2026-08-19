/**
 * Command: a member proposes an allocation of the group's resources.
 *
 * §4's ⑤ RESOURCES terminal asks "where is power, and how is it distributed",
 * and §9 makes every movement of money a proposal before it is a transfer. This
 * is the first half of that: asking. Approving and transferring are separate
 * events and are not built here.
 *
 * ── Where the quorum comes from, and why it is not 5 ───────────────────────
 * `projectValueGroup` falls back to `votes_required: 5` when a proposal does not
 * carry one, so a command that simply omitted the field would put an invented
 * threshold on screen — a number no one decided, rendered as the rule. So the
 * quorum is either **stated by the proposer** or **derived from the group's own
 * most recent proposal** (its standing practice, which is event-backed). When the
 * log offers neither, the command REFUSES rather than picking a number. A group
 * making its first proposal must say what its quorum is; that is a decision, and
 * decisions belong in events.
 *
 * ── Why there is no budget ceiling ─────────────────────────────────────────
 * A proposal is a request, not a withdrawal. `budget.committed` counts only
 * APPROVED allocations, so proposing beyond the available balance cannot corrupt
 * any figure the screens show. Refusing it here would be this module inventing a
 * policy the blueprint does not state — §9 gates spending at approval tiers, not
 * at the asking. When `allocation.approved` is built, that is where the balance
 * check belongs.
 */

import type { PhilosEvent } from "../events";
import type { Clock, IdGenerator } from "../eventStore";
import { inOrder } from "../events";
import {
  requireGroup,
  requireMember,
  requireUsableTime,
  resolveCausalParents,
  type Refusal,
  type SharedRejectionCode,
} from "./preconditions";

export const PROPOSE_ALLOCATION_REJECTION_CODES = [
  "empty_person_id",
  "empty_title",
  "invalid_amount",
  "invalid_people_estimate",
  "invalid_quorum",
  "quorum_unspecified",
] as const;

export type ProposeAllocationRejectionCode =
  | (typeof PROPOSE_ALLOCATION_REJECTION_CODES)[number]
  | SharedRejectionCode;

export interface ProposeAllocationInput {
  group_id: string;
  person_id: string;
  /** What the money is for. Shown as the allocation's name. */
  title: string;
  /** Positive amount in the group's currency. */
  amount: number;
  /** How many people the proposer expects this to reach. An ESTIMATE, never shown as verified. */
  people_affected_estimate: number;
  /**
   * Votes needed to approve. Omit to inherit the group's most recent proposal;
   * when the group has none, the command refuses rather than inventing one.
   */
  votes_required?: number;
  /** The value this allocation serves. Defaults to the group's own tags. */
  value_tag?: string;
  /** Events this proposal directly arises from. Each must resolve in the log. */
  about_event_ids?: string[];
}

export interface ProposeAllocationDeps {
  clock: Clock;
  ids: IdGenerator;
}

export type ProposeAllocationResult =
  | { ok: true; events: PhilosEvent[]; allocation_id: string }
  | Refusal<ProposeAllocationRejectionCode>;

export const MAX_ALLOCATION_TITLE = 200;

const isPositiveInt = (n: unknown): n is number =>
  typeof n === "number" && Number.isInteger(n) && n > 0;

const isNonNegativeInt = (n: unknown): n is number =>
  typeof n === "number" && Number.isInteger(n) && n >= 0;

/**
 * The group's standing quorum: the `votes_required` on its most recent proposal.
 * Undefined when the group has never proposed anything — a fact, not a default.
 */
export function standingQuorum(
  stored: readonly PhilosEvent[],
  group_id: string,
): number | undefined {
  // Proposals carry the allocation as their entity, not the group, so they are
  // tied back through the votes/approvals that share the group's activity. The
  // group is identified by the proposals whose actor is a member of it — but the
  // simpler and exact link is the one the log already gives: an allocation
  // belongs to the group whose members proposed and voted on it. For the single
  // -group runtime this reduces to "every proposal in the log", and it is written
  // to read the group id explicitly so it stays correct when a second group lands.
  const proposals = inOrder(stored).filter(
    (e) =>
      e.event_type === "allocation.proposed" &&
      (e.payload?.group_id === undefined || e.payload.group_id === group_id),
  );
  const latest = proposals[proposals.length - 1];
  if (!latest) return undefined;
  const q = latest.payload?.votes_required;
  return isPositiveInt(q) ? q : undefined;
}

export function proposeAllocation(
  stored: readonly PhilosEvent[],
  input: ProposeAllocationInput,
  deps: ProposeAllocationDeps,
): ProposeAllocationResult {
  const person_id = input.person_id.trim();
  const group_id = input.group_id.trim();
  const title = input.title.trim();

  if (!person_id) {
    return { ok: false, code: "empty_person_id", message: "person_id is required" };
  }
  if (!title) {
    return {
      ok: false,
      code: "empty_title",
      message: "an allocation must say what the money is for",
    };
  }
  if (!isPositiveInt(input.amount)) {
    // Zero, negative, fractional and NaN all render as an amount on the
    // RESOURCES terminal and feed the committed/available arithmetic.
    return {
      ok: false,
      code: "invalid_amount",
      message: `amount must be a positive whole number; got ${String(input.amount)}`,
    };
  }
  if (!isNonNegativeInt(input.people_affected_estimate)) {
    return {
      ok: false,
      code: "invalid_people_estimate",
      message: `people_affected_estimate must be a whole number of people; got ${String(
        input.people_affected_estimate,
      )}`,
    };
  }

  const group = requireGroup(stored, group_id);
  if (!group.ok) return group;

  const time = requireUsableTime(deps.clock.now(), group.opened);
  if (!time.ok) return time;

  const member = requireMember(stored, group_id, person_id);
  if (!member.ok) return member;

  let votes_required: number;
  if (input.votes_required !== undefined) {
    if (!isPositiveInt(input.votes_required)) {
      return {
        ok: false,
        code: "invalid_quorum",
        message: `votes_required must be a positive whole number; got ${String(
          input.votes_required,
        )}`,
      };
    }
    votes_required = input.votes_required;
  } else {
    const standing = standingQuorum(stored, group_id);
    if (standing === undefined) {
      return {
        ok: false,
        code: "quorum_unspecified",
        message:
          `${group_id} has no earlier proposal to inherit a quorum from, and none was given. ` +
          `State votes_required — the screen must not show a threshold nobody decided`,
      };
    }
    votes_required = standing;
  }

  const causes = resolveCausalParents(stored, input.about_event_ids, time.timestamp);
  if (!causes.ok) return causes;

  const allocation_id = deps.ids.next("alloc");
  const value_tag = input.value_tag?.trim();

  return {
    ok: true,
    allocation_id,
    events: [
      {
        event_id: deps.ids.next("ev"),
        actor_id: person_id,
        entity_type: "allocation",
        entity_id: allocation_id,
        event_type: "allocation.proposed",
        // A proposal may serve a value other than the group's central one — the
        // seed's medical-kit proposal is tagged ביטחון inside an אחריות group.
        value_tags: value_tag ? [value_tag] : [...group.opened.value_tags],
        timestamp: time.timestamp,
        visibility: "public",
        payload: {
          // Recorded explicitly so an allocation names its group. The seed's
          // proposals do not, which is why `standingQuorum` tolerates its absence.
          group_id,
          title: title.slice(0, MAX_ALLOCATION_TITLE),
          amount: input.amount,
          people_affected_estimate: input.people_affected_estimate,
          votes_required,
        },
        caused_by: causes.caused_by,
      },
    ],
  };
}
