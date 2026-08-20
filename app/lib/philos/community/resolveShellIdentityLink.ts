/**
 * The one shared read every surface uses to fill `SystemShell`'s
 * `identityLink` prop — a single real resolution of the person_roei ↔
 * p_you triple, never re-derived per page.
 */
import { resolveViewerContext } from "@/app/lib/philos/identity/viewerContext";
import { loadPhilosEvents } from "@/app/lib/philos-event-store";
import { resolveGroupContext } from "./groupContext";
import { resolveRealPersonCommunityLink } from "./personCommunityLinkStoreAccessor";
import type { ShellIdentityLink } from "../shell/SystemShell";

export async function resolveShellIdentityLink(): Promise<ShellIdentityLink> {
  const viewer = await resolveViewerContext();
  /* The READ side of the identity link still named the constant while the
     WRITE side had already moved to the viewer's own group context — so a
     link written against one group would be looked up against another. */
  const events = await loadPhilosEvents();
  const ctx = resolveGroupContext(viewer, events);
  if (ctx.status !== "resolved") {
    // No group context is NOT_LINKED — there is no group to be linked TO.
    // Stated through the existing status vocabulary rather than by inventing
    // a sixth one this prop's consumers would not know how to render.
    return { status: "NOT_LINKED", person_id: viewer.subject_id, community_member_id: viewer.person_id };
  }
  const resolved = await resolveRealPersonCommunityLink(viewer.subject_id, viewer.person_id, ctx.group_id);
  return {
    status: resolved.link_status,
    person_id: viewer.subject_id,
    community_member_id: viewer.person_id,
  };
}
