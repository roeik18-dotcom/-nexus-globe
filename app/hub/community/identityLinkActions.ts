"use server";

/**
 * Server actions for the real Person↔Community-Member identity link
 * (`app/lib/philos/community/personCommunityLink.ts`). The one real
 * triple this product has today: `REAL_CURRENT_SUBJECT` (person_roei,
 * subjectRegistry.ts) ↔ `resolveViewer().person_id` (p_you, viewer.ts) ↔
 * `GROUP_ID` (the one real Value Group). Neither id is a parameter here,
 * same reasoning `app/hub/actions.ts` already documents for
 * `joinGroupAction`: both ids are resolved server-side through the exact
 * seams the rest of the product already trusts, so a caller cannot forge
 * a link for an identity it does not own.
 *
 * Two-step flow, matching `personCommunityLink.ts`'s own real mechanism:
 * `declareSamePersonAction` requires the current resolved status to be
 * `NOT_LINKED` or `UNVERIFIED`; `confirmSamePersonAction` requires it to
 * be `DECLARED_SAME_PERSON` with a real declaration to point back at.
 * Both reject (return a value) rather than throw when the precondition
 * does not hold — same "ordinary fact about the world" posture
 * `app/hub/actions.ts` already uses for "you are already a member."
 */

import { resolveViewerContext } from "@/app/lib/philos/identity/viewerContext";
import { revalidatePath } from "next/cache";

import { resolveGroupContext } from "@/app/lib/philos/community/groupContext";
import { loadPhilosEvents } from "@/app/lib/philos-event-store";
import { createIdGenerator, systemClock } from "@/app/lib/philos/eventStore";
import { resolveViewer } from "@/app/lib/philos-viewer";
import {
  confirmSamePerson,
  declareSamePerson,
  resolvePersonCommunityLink,
} from "@/app/lib/philos/community/personCommunityLink";
import {
  loadPersonCommunityLinks,
  personCommunityLinkStore,
} from "@/app/lib/philos/community/personCommunityLinkStoreAccessor";

export type IdentityLinkActionResult =
  | { ok: true; link_status: "DECLARED_SAME_PERSON" | "VERIFIED_SAME_PERSON" }
  | { ok: false; message: string };

/**
 * Every screen that renders the identity-link status (via `SystemShell`'s
 * `identityLink` prop) or reads the linked identity for propagation. Must
 * be re-read after a write, same discipline `app/hub/actions.ts`'s
 * `PROJECTING_ROUTES` already established for the Value Group log.
 */
const PROJECTING_ROUTES = [
  "/hub",
  "/hub/community",
  "/hub/human-config",
  "/brain",
  "/dynamics",
  "/planet",
  "/marketplace",
] as const;


/**
 * The group this identity link is being written against.
 *
 * This was the module constant `GROUP_ID`, so ANY viewer declaring an identity
 * link was bound to Roei's group — a write authored by the right person into
 * the wrong context. The group must come from the viewer's own recorded
 * membership; with none, the action refuses rather than inventing one.
 */
async function resolveWriteGroup(viewer: Awaited<ReturnType<typeof resolveViewerContext>>) {
  const events = await loadPhilosEvents();
  return resolveGroupContext(viewer, events);
}

function revalidateAll() {
  for (const route of PROJECTING_ROUTES) revalidatePath(route);
}

export async function declareSamePersonAction(): Promise<IdentityLinkActionResult> {
  const viewer = await resolveViewerContext();
  const group = await resolveWriteGroup(viewer);
  if (group.status !== "resolved") {
    return { ok: false, message: `no group context for this viewer — ${group.status === "forbidden" ? group.because : group.because}` };
  }
  const existing = await loadPersonCommunityLinks();
  const resolved = resolvePersonCommunityLink(existing, viewer.subject_id, viewer.person_id, group.group_id);

  if (resolved.link_status !== "NOT_LINKED") {
    return { ok: false, message: `link_status is already "${resolved.link_status}" — declare is only valid from NOT_LINKED` };
  }

  const ids = createIdGenerator();
  const record = declareSamePerson({
    link_id: ids.next("link"),
    person_id: viewer.subject_id,
    community_member_id: viewer.person_id,
    community_id: group.group_id,
    evidence: `explicit self-declaration by the single local viewer via the /hub/community identity-link UI`,
    provenance: "REAL",
    now: systemClock.now(),
  });

  await personCommunityLinkStore().append([record]);
  revalidateAll();
  return { ok: true, link_status: "DECLARED_SAME_PERSON" };
}

export async function confirmSamePersonAction(): Promise<IdentityLinkActionResult> {
  const viewer = await resolveViewerContext();
  const group = await resolveWriteGroup(viewer);
  if (group.status !== "resolved") {
    return { ok: false, message: `no group context for this viewer — ${group.status === "forbidden" ? group.because : group.because}` };
  }
  const existing = await loadPersonCommunityLinks();
  const resolved = resolvePersonCommunityLink(existing, viewer.subject_id, viewer.person_id, group.group_id);

  if (resolved.link_status !== "DECLARED_SAME_PERSON" || !resolved.latest) {
    return { ok: false, message: `link_status is "${resolved.link_status}" — confirm requires a prior DECLARED_SAME_PERSON record` };
  }

  const ids = createIdGenerator(1);
  const record = confirmSamePerson({
    link_id: ids.next("link"),
    declaration: resolved.latest,
    evidence: `explicit second-step self-confirmation by the same local viewer via the /hub/community identity-link UI`,
    now: systemClock.now(),
  });

  await personCommunityLinkStore().append([record]);
  revalidateAll();
  return { ok: true, link_status: "VERIFIED_SAME_PERSON" };
}
