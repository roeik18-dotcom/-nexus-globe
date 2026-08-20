import type { SocialSelection } from "@/app/lib/philos/social/socialSelection";
import type { SocialSystemState } from "@/app/lib/philos/social/loadSocialSystem";
import type { SocialScale } from "./scale";

import GroupScale from "./scales/GroupScale";
import NetworkScale from "./scales/NetworkScale";
import SystemScale from "./scales/SystemScale";

/**
 * Chooses the primary stage for the current scale.
 *
 * Each scale renders its OWN primary and nothing else — the shell, the frame
 * and the shared state come from above, so no scale can render a second
 * navigation or a second frame. That constraint is the whole point of the
 * merge: a scale is a camera, not a page.
 */
export default async function SocialScaleStage({
  scale, social, selection, params,
}: {
  scale: SocialScale;
  social: SocialSystemState;
  selection: SocialSelection;
  params: { [key: string]: string | string[] | undefined };
}) {
  if (scale === "network") return <NetworkScale social={social} selection={selection} params={params} />;
  if (scale === "system") return <SystemScale social={social} selection={selection} params={params} />;
  return <GroupScale social={social} selection={selection} params={params} />;
}
