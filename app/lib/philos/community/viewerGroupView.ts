/**
 * THE VIEWER'S GROUP — one accessor, replacing eleven `projectValueGroup(
 * events, GROUP_ID, today)` calls.
 *
 * Those eleven sites each asked "the group", meaning `vg_ahrayut_kehilatit`,
 * because with one group and one human the two were the same thing. They are
 * not the same thing. A viewer who belongs to no group was shown Roei's group
 * as though it were theirs, on Hub, Brain, Globe, World, Marketplace and
 * Community at once.
 *
 * The three cases from the ruling are the three states of the return value,
 * and none of them is a constant:
 *
 *   0 groups  -> `none`   — an explicit empty state, stated with its reason
 *   1 group   -> `resolved`
 *   >1 groups -> `choose`  — an explicit selection is required, because
 *                            picking one would invent a preference the log
 *                            does not record
 *
 * WHAT THIS IS NOT. It is not an authorisation check for a group's PUBLIC
 * facts. A value group's name, central value and roster are group facts; two
 * members may both legitimately see them. This answers the narrower question
 * of which group is THIS VIEWER'S context.
 */
import { loadPhilosEvents } from "@/app/lib/philos-event-store";
import { systemClock, todayIn } from "../eventStore";
import { projectValueGroup, type ValueGroupView } from "../projectValueGroup";
import type { PhilosEvent } from "../events";
import { resolveViewerContext } from "../identity/viewerContext";
import { resolveGroupContext, type GroupContext } from "./groupContext";

export interface ViewerGroupView {
  /** Mirrors `GroupContext.status`, plus the projected view when resolved. */
  context: GroupContext;
  /** The projection, or null. Null is an ANSWER — see `context.because`. */
  view: ValueGroupView | null;
}

export async function resolveViewerGroupView(opts?: {
  /** Reuse an already-loaded log rather than reading it twice. */
  events?: readonly PhilosEvent[];
  /** An explicit `?community=` selection, raw. Validated, never trusted. */
  requested?: unknown;
  today?: string;
}): Promise<ViewerGroupView> {
  const viewer = await resolveViewerContext();
  const events = opts?.events ?? (await loadPhilosEvents());
  const today = opts?.today ?? todayIn(systemClock);
  const context = resolveGroupContext(viewer, events, opts?.requested);
  if (context.status !== "resolved") return { context, view: null };
  return { context, view: projectValueGroup(events, context.group_id, today) };
}
