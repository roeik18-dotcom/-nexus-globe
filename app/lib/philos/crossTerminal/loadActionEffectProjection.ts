/**
 * THE ONE SERVER-SIDE READ every terminal calls to get the pairs.
 *
 * A single loader, so seven surfaces cannot each decide differently which
 * records count. Group attribution comes from the SAME bridge registry the
 * community surfaces already use — never invented here, and `[]` when the
 * registry establishes nothing.
 */
import { loadActions } from "../canon/actionStoreAccessor";
import { loadEffects } from "../canon/effectStoreAccessor";
import { projectActionEffects, type ActionEffectProjection } from "./actionEffectProjection";

export async function loadActionEffectProjection(
  subject_id: string,
  opts?: { groupLinkedActionIds?: readonly string[]; networkRelationCount?: number },
): Promise<ActionEffectProjection> {
  const [actions, effects] = await Promise.all([
    loadActions().catch(() => []),
    loadEffects().catch(() => []),
  ]);
  return projectActionEffects({
    actions, effects, subject_id,
    groupLinkedActionIds: opts?.groupLinkedActionIds ?? [],
    networkRelationCount: opts?.networkRelationCount ?? 0,
  });
}
