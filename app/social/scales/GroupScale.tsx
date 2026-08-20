import CommunityPage from "@/app/hub/community/page";
import type { ScaleProps } from "./types";

/**
 * GROUP scale — the operational community board.
 *
 * STEP 1 OF THE MERGE, and the limit is stated rather than hidden: this
 * delegates to the existing Community implementation instead of duplicating
 * 684 lines of loading logic. The route is unified NOW — one URL, one title,
 * one entry — and the shared shell/frame each scale already renders keeps the
 * result visually identical.
 *
 * What is NOT yet unified: the page still resolves its own viewer and loads
 * its own social state, so the shared state this route already computed is
 * currently loaded twice for this scale. That is the next hoist, and it is a
 * performance defect rather than a correctness one — both loads go through the
 * same scoped authority and return the same records.
 */
export default async function GroupScale({ params }: ScaleProps) {
  return <CommunityPage searchParams={Promise.resolve(params)} />;
}
