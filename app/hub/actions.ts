"use server";

/**
 * Server actions for the Philos hub — the network edge of the write path.
 *
 * The shape is deliberately thin: read the log, run the command, append what it
 * returns, revalidate the screens that project it. All the judgement lives in
 * `commands/joinGroup.ts` and all the integrity rules in `eventStore.ts`; this
 * module only carries them across the client/server boundary.
 *
 * ── Identity, and what is NOT here ─────────────────────────────────────────
 * Next's own guidance is that a server function is reachable by direct POST and
 * must verify authentication and authorization itself. Philos has neither yet
 * (§6 Person: missing, §16 Privacy: missing), so rather than pretend, the action
 * takes **no person parameter at all**: who joins is read server-side through
 * `resolveViewer()`, the same seam the screens resolve identity with. A caller
 * can therefore trigger the single local user's join, and cannot forge a
 * different one. When that seam grows a session, this file needs no change.
 *
 * ── Rejections are returned, not thrown ────────────────────────────────────
 * "You are already a member" is an ordinary fact about the world that the screen
 * has to show. It comes back as a value. Only a genuinely broken append — a
 * violated log invariant — throws, because that is a defect rather than a state.
 */

import { revalidatePath } from "next/cache";

import type { PhilosEvent } from "@/app/lib/philos/events";
import { joinGroup } from "@/app/lib/philos/commands/joinGroup";
import { postUpdate } from "@/app/lib/philos/commands/postUpdate";
import { proposeAllocation } from "@/app/lib/philos/commands/proposeAllocation";
import { recordImpact } from "@/app/lib/philos/commands/recordImpact";
import { createIdGenerator, systemClock } from "@/app/lib/philos/eventStore";
import { loadPhilosEvents, philosEventStore } from "@/app/lib/philos-event-store";
import { resolveViewer } from "@/app/lib/philos-viewer";

export type CommandActionResult =
  | { ok: true; event_ids: string[] }
  | { ok: false; message: string };

/** Kept for the call sites that named it before there was more than one command. */
export type JoinGroupActionResult = CommandActionResult;

/**
 * Every screen that projects the log. All four must re-read after a write —
 * `/dynamics` included, which was missed when that route was wired and meant a
 * recorded act could sit in the log while the causal graph still showed the
 * state before it.
 */
const PROJECTING_ROUTES = ["/hub", "/hub/community", "/planet", "/dynamics"] as const;

/**
 * Append the events a command produced and invalidate every projecting screen.
 *
 * The one place a write reaches disk from the web edge, so the revalidation set
 * cannot drift per action: adding a command cannot forget a screen.
 */
async function commit(events: readonly PhilosEvent[]): Promise<CommandActionResult> {
  await philosEventStore().append(events);
  for (const route of PROJECTING_ROUTES) revalidatePath(route);
  return { ok: true, event_ids: events.map((e) => e.event_id) };
}

export async function joinGroupAction(groupId: string): Promise<CommandActionResult> {
  const stored = await loadPhilosEvents();
  const viewer = await resolveViewer();

  const result = joinGroup(
    stored,
    {
      group_id: groupId,
      person_id: viewer.person_id,
      display_name: viewer.display_name,
    },
    { clock: systemClock, ids: createIdGenerator() },
  );

  if (!result.ok) return { ok: false, message: result.message };
  return commit(result.events);
}

/**
 * Post an update to a group.
 *
 * `aboutEventIds` is what the member says this update reports on. It is passed
 * through to the command, which refuses any id that is not in the log — a caller
 * cannot invent a causal parent, and an unchecked one is never written.
 */
export async function postUpdateAction(
  groupId: string,
  text: string,
  aboutEventIds?: string[] | null,
): Promise<CommandActionResult> {
  const stored = await loadPhilosEvents();
  const viewer = await resolveViewer();

  const result = postUpdate(
    stored,
    {
      group_id: groupId,
      person_id: viewer.person_id,
      text,
      ...(aboutEventIds && aboutEventIds.length > 0 ? { about_event_ids: aboutEventIds } : {}),
    },
    { clock: systemClock, ids: createIdGenerator() },
  );

  if (!result.ok) return { ok: false, message: result.message };
  return commit(result.events);
}

/**
 * Propose an allocation of the group's resources.
 *
 * `votesRequired` is optional and passed straight through: omitted, the command
 * inherits the group's standing quorum, and refuses if the group has never set
 * one. This action does not supply a default, because a default here would be an
 * invented threshold rendered as the group's rule.
 */
export async function proposeAllocationAction(
  groupId: string,
  title: string,
  amount: number,
  peopleAffectedEstimate: number,
  votesRequired?: number | null,
  aboutEventIds?: string[] | null,
): Promise<CommandActionResult> {
  const stored = await loadPhilosEvents();
  const viewer = await resolveViewer();

  const result = proposeAllocation(
    stored,
    {
      group_id: groupId,
      person_id: viewer.person_id,
      title,
      amount,
      people_affected_estimate: peopleAffectedEstimate,
      // `null` and `undefined` both mean "not stated". A positional call over
      // the wire cannot express `undefined`, so a client omitting the quorum
      // necessarily sends `null` — reading that as an explicitly invalid value
      // would refuse every proposal that meant to inherit the group's practice.
      ...(votesRequired !== undefined && votesRequired !== null
        ? { votes_required: votesRequired }
        : {}),
      ...(aboutEventIds && aboutEventIds.length > 0 ? { about_event_ids: aboutEventIds } : {}),
    },
    { clock: systemClock, ids: createIdGenerator() },
  );

  if (!result.ok) return { ok: false, message: result.message };
  return commit(result.events);
}

/**
 * Record what changed in the world.
 *
 * No verification rung is passed from the client: the command derives `claim` or
 * `self_report` from whether evidence was attached, and refuses any verified rung
 * outright. A reporter cannot mark their own claim verified through this edge,
 * which is §10's rule enforced at the boundary rather than repaired on read.
 */
export async function recordImpactAction(
  groupId: string,
  statement: string,
  peopleAffected: number,
  resourcesInvested: number,
  evidence?: string[] | null,
  allocationId?: string | null,
  aboutEventIds?: string[] | null,
): Promise<CommandActionResult> {
  const stored = await loadPhilosEvents();
  const viewer = await resolveViewer();

  const result = recordImpact(
    stored,
    {
      group_id: groupId,
      person_id: viewer.person_id,
      statement,
      people_affected: peopleAffected,
      resources_invested: resourcesInvested,
      ...(evidence && evidence.length > 0 ? { evidence } : {}),
      ...(allocationId ? { allocation_id: allocationId } : {}),
      ...(aboutEventIds && aboutEventIds.length > 0 ? { about_event_ids: aboutEventIds } : {}),
    },
    { clock: systemClock, ids: createIdGenerator() },
  );

  if (!result.ok) return { ok: false, message: result.message };
  return commit(result.events);
}
