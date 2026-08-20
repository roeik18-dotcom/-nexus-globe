import { Suspense } from "react";

import { resolveViewerContext } from "@/app/lib/philos/identity/viewerContext";
import { loadSocialSystem } from "@/app/lib/philos/social/loadSocialSystem";
import { resolveSocialSelection } from "@/app/lib/philos/social/socialSelection";
import { COLOR, FS } from "@/app/lib/philos/shell/designTokens";
import { parseScale, SCALE_META } from "./scale";
import SocialScaleStage from "./SocialScaleStage";

export const dynamic = "force-dynamic";

/**
 * THE SOCIAL TERMINAL — one route, three scales.
 *
 * The shared social state is loaded ONCE here, by the one scoped authority,
 * and the scale decides only which primary stage renders. Each scale's own
 * heavy data (the group board, the sphere, the mission map) is loaded inside
 * its stage rather than here, so switching scale does not pay for the two
 * scales nobody is looking at.
 *
 * Suspense is per-stage for the same reason: the shell and the frame paint
 * immediately from the shared state, and the primary fills in. That is what
 * makes a scale change read as a camera move rather than a page load.
 */
export default async function SocialPage({ searchParams }: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = (await searchParams) ?? {};
  const scale = parseScale(params.scale);

  const viewer = await resolveViewerContext();
  const social = await loadSocialSystem(viewer);
  const selection = resolveSocialSelection(params.sel, social.objects);

  return (
    <div style={{ background: COLOR.bg, minHeight: "100vh" }}>
      <Suspense fallback={<StageLoading scale={scale} />}>
        <SocialScaleStage
          scale={scale}
          social={social}
          selection={selection}
          params={params}
        />
      </Suspense>
    </div>
  );
}

/** Shown only while a scale's own primary data loads. Deliberately states
 *  which scale is arriving rather than showing a generic spinner. */
function StageLoading({ scale }: { scale: ReturnType<typeof parseScale> }) {
  return (
    <div dir="rtl" style={{ padding: "20px", fontSize: FS.meta, color: COLOR.textFaint }}>
      טוען {SCALE_META[scale].label} · {SCALE_META[scale].level}…
    </div>
  );
}

export async function generateMetadata({ searchParams }: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = (await searchParams) ?? {};
  return { title: SCALE_META[parseScale(params.scale)].title };
}
