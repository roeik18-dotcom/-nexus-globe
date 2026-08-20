/**
 * THE VIEWER'S LINK REGISTRY — personal tier.
 *
 * `buildDefaultLinkRegistry(events, today)` builds links for the historical
 * single group AND for every DEMO community. That is correct for a reference
 * or audit surface and wrong everywhere a link becomes part of one person's
 * analysis: it is how a viewer with no memberships still received 25 demo
 * links, and how `DayCycle` — which produces RECOMMENDATIONS — was fed
 * fixtures alongside real records.
 *
 * This is the personal-tier call: the viewer's OWN recorded groups, and no
 * DEMO. Reference surfaces keep calling `buildDefaultLinkRegistry` directly
 * and are labelled as such; the difference between the two is now a choice a
 * reader can see at the call site rather than a default nobody stated.
 */
import { loadPhilosEvents } from "@/app/lib/philos-event-store";
import { systemClock, todayIn } from "../eventStore";
import type { PhilosEvent } from "../events";
import { buildDefaultLinkRegistry } from "./linkRegistry";
import type { EntityLink } from "./entityLink";
import { recordedMembershipsOf } from "../community/groupContext";
import { resolveViewerContext } from "../identity/viewerContext";

export async function buildViewerLinkRegistry(opts?: {
  events?: readonly PhilosEvent[];
  today?: string;
  effects?: readonly { effect_id: string; action_ref: string }[];
  canon?: Parameters<typeof buildDefaultLinkRegistry>[3];
}): Promise<EntityLink[]> {
  const viewer = await resolveViewerContext();
  const events = opts?.events ?? (await loadPhilosEvents());
  const today = opts?.today ?? todayIn(systemClock);
  return buildDefaultLinkRegistry([...events], today, [...(opts?.effects ?? [])], {
    ...opts?.canon,
    realGroupIds: recordedMembershipsOf(viewer, events),
    includeDemo: false,
  });
}
