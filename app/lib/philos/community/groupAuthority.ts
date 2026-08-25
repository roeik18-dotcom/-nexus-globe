/**
 * GROUP AUTHORITY — who may decide a match request for a given group.
 *
 * Not a new authority model. `LeaderView[]` and `projectValueGroup()` already
 * exist and are already how `page.tsx` (Marketplace, Community, Hub) reads a
 * group's leaders today. This factors that same lookup into one place that
 * accepts an arbitrary `group_id`, because `GroupSpineMarket` renders
 * candidates spanning every group, not just the viewer's own.
 *
 * ── THE SPLIT THIS FILE EXISTS TO ENFORCE ─────────────────────────────────
 *
 * There are TWO leadership questions, and they are not the same question:
 *
 *   1. "Who should I DISPLAY as this group's leaders?" — may fall back to
 *      `DEMO_COMMUNITIES`, because a demo group on screen showing its demo
 *      coordinators is the demo working correctly.
 *
 *   2. "Who may AUTHORIZE a write?" — must NEVER consult `DEMO_COMMUNITIES`.
 *      Demo bundles are fixtures compiled into the bundle: their `person_id`
 *      values are authored constants, not appointments anyone made. Letting
 *      one satisfy an authorization check would mean a `provenance: "REAL"`
 *      event could be written on the authority of a hard-coded demo record.
 *
 * Before this split there was ONE function serving both, and it fell back to
 * demo. `resolveRealGroupLeaders` is now the only function the write path
 * calls, and it has no import of `DEMO_COMMUNITIES` reachable from it — the
 * demo lookup lives exclusively in `resolveGroupLeadership`, which the write
 * path does not call.
 *
 * FAILS CLOSED. A group with no `group.opened` event in the REAL log returns
 * `[]` — "no such group", "group exists, no leaders appointed", and "group is
 * demo-only" are all real, distinct answers, and all three correctly leave the
 * decide gate shut.
 */
import { loadPhilosEvents } from "@/app/lib/philos-event-store";
import { systemClock, todayIn } from "../eventStore";
import { projectValueGroup, type LeaderView } from "../projectValueGroup";
import { DEMO_COMMUNITIES } from "../demoCommunities";

/** Where a leadership answer came from. `NONE` = no leaders from any source. */
export type LeadershipSource = "REAL" | "DEMO" | "NONE";

export interface GroupLeadership {
  leaders: LeaderView[];
  source: LeadershipSource;
}

/**
 * AUTHORIZATION SOURCE — real appointment events only.
 *
 * This is the ONLY leadership function the write path may call. It reads
 * `loadPhilosEvents()` (the real append-only log) and stops there; it does
 * not consult, import-use, or fall back to `DEMO_COMMUNITIES` under any
 * condition, including when the real projection is empty.
 */
export async function resolveRealGroupLeaders(group_id: string): Promise<LeaderView[]> {
  const today = todayIn(systemClock);
  const realEvents = await loadPhilosEvents();
  const real = projectValueGroup(realEvents, group_id, today);
  return real?.leaders ?? [];
}

/**
 * DISPLAY SOURCE — real if the real log has any, otherwise the demo bundle,
 * ALWAYS tagged with which one answered.
 *
 * Never use the returned `leaders` for an authorization decision. Callers
 * rendering a control should gate on `source === "REAL"` as well, so a demo
 * group does not display an Approve button that the server will refuse.
 */
export async function resolveGroupLeadership(group_id: string): Promise<GroupLeadership> {
  const real = await resolveRealGroupLeaders(group_id);
  if (real.length > 0) return { leaders: real, source: "REAL" };

  const demo = DEMO_COMMUNITIES.find((c) => c.group_id === group_id);
  if (!demo) return { leaders: [], source: "NONE" };
  const view = projectValueGroup(demo.events, demo.group_id, demo.today);
  const leaders = view?.leaders ?? [];
  return leaders.length > 0
    ? { leaders, source: "DEMO" }
    : { leaders: [], source: "NONE" };
}

/**
 * True iff `person_id` is a REAL appointed leader of `group_id`.
 *
 * Deliberately built on `resolveRealGroupLeaders`, never on
 * `resolveGroupLeadership` — a demo leader must answer `false` here.
 */
export async function isRealGroupLeader(group_id: string, person_id: string): Promise<boolean> {
  const leaders = await resolveRealGroupLeaders(group_id);
  return leaders.some((l) => l.person_id === person_id);
}
