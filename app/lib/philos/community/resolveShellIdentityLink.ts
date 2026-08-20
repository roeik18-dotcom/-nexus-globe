/**
 * The one shared read every surface uses to fill `SystemShell`'s
 * `identityLink` prop — a single real resolution of the person_roei ↔
 * p_you triple, never re-derived per page.
 */
import { resolveViewerContext } from "@/app/lib/philos/identity/viewerContext";
import { GROUP_ID } from "../valueGroupLog";
import { resolveViewer } from "@/app/lib/philos-viewer";
import { resolveRealPersonCommunityLink } from "./personCommunityLinkStoreAccessor";
import type { ShellIdentityLink } from "../shell/SystemShell";

export async function resolveShellIdentityLink(): Promise<ShellIdentityLink> {
  const viewer = await resolveViewerContext();
  const resolved = await resolveRealPersonCommunityLink(viewer.subject_id, viewer.person_id, GROUP_ID);
  return {
    status: resolved.link_status,
    person_id: viewer.subject_id,
    community_member_id: viewer.person_id,
  };
}
