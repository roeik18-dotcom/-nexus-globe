/**
 * ONE ANSWER, NINE SURFACES: which Effects are evidence, and which carry a
 * Learning.
 *
 * The nine terminals each hardcoded `hasVerifiedEvidence: false` and
 * `hasLearning: false`. That was accurate at the time and dishonest as a
 * design — the pages were not reading anything, so the day they became true
 * nothing on screen would have changed. This loader is the single read, so
 * nine surfaces cannot answer the same question nine ways.
 *
 * It deliberately does NOT consult `effect.verified_outcome`. That field can
 * be written by the person reporting the outcome, so it records a claim, not a
 * check. Evidence is a separate verification record by a different signed-in
 * person, and `independentEvidence.ts` — the same rule the writers enforce —
 * decides whether it counts.
 */
import { loadActions } from "../canon/actionStoreAccessor";
import { loadEffects } from "../canon/effectStoreAccessor";
import { loadLearnings } from "../canon/learningStoreAccessor";
import { loadVerifications } from "../canon/outcomeVerificationStoreAccessor";
import { isIndependentlyVerified } from "../canon/independentEvidence";

export interface EvidenceAndLearningFacts {
  /** Effects an independent person actually verified. */
  verified_effect_ids: string[];
  /** Effects that have at least one recorded Learning. */
  learning_effect_ids: string[];
}

/** Plain arrays rather than Sets: these cross the server/client boundary. */
export async function loadEvidenceAndLearning(
  subject_id: string,
): Promise<EvidenceAndLearningFacts> {
  const [actions, effects, verifications, learnings] = await Promise.all([
    loadActions().catch(() => []),
    loadEffects().catch(() => []),
    loadVerifications().catch(() => []),
    loadLearnings().catch(() => []),
  ]);

  const ownerOf = new Map(actions.map((r) => [r.action?.action_id, r.action?.owner]));

  const verified_effect_ids: string[] = [];
  for (const r of effects) {
    const effect = r.effect;
    if (!effect || effect.subject !== subject_id) continue;
    if (isIndependentlyVerified(effect, ownerOf.get(effect.action_ref), verifications)) {
      verified_effect_ids.push(effect.effect_id);
    }
  }

  const learning_effect_ids = [
    ...new Set(learnings.map((l) => l.learning?.effect_ref).filter((x): x is string => !!x)),
  ];

  return { verified_effect_ids, learning_effect_ids };
}

/** The two booleans the nine terminals take, for one Effect. `null` — no
 *  Effect yet — is honestly `false` on both, never "unknown treated as true". */
export function chainEvidenceFlags(
  facts: EvidenceAndLearningFacts, effect_id: string | null | undefined,
): { hasVerifiedEvidence: boolean; hasLearning: boolean } {
  if (!effect_id) return { hasVerifiedEvidence: false, hasLearning: false };
  return {
    hasVerifiedEvidence: facts.verified_effect_ids.includes(effect_id),
    hasLearning: facts.learning_effect_ids.includes(effect_id),
  };
}
