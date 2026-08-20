/**
 * The ONE loader all three social surfaces use to build the chronology, so
 * Community, Globe and World cannot disagree about what happened. Each reads
 * the same stores through this function and then applies only its own zoom.
 *
 * Every load is defensive in the same way the surfaces already are: a store
 * that cannot be read yields [], never a fabricated entry.
 */
import { loadPhilosEvents } from "@/app/lib/philos-event-store";
import { loadNeeds } from "../canon/needStoreAccessor";
import { loadOffers } from "../canon/offerStoreAccessor";
import { loadActions } from "../canon/actionStoreAccessor";
import { loadEffects } from "../canon/effectStoreAccessor";
import { isEffectVerified } from "../canon/effect";
import { buildSocialChronology, type ChronoEntry } from "./socialChronology";

export async function loadSocialChronology(): Promise<ChronoEntry[]> {
  const [events, needs, offers, actions, effects] = await Promise.all([
    loadPhilosEvents().catch(() => []),
    loadNeeds().catch(() => []),
    loadOffers().catch(() => []),
    loadActions().catch(() => []),
    loadEffects().catch(() => []),
  ]);

  return buildSocialChronology({
    events,
    needs: needs.map((n) => ({
      need_id: n.need.need_id,
      desired_change: n.need.desired_change,
      recorded_at: n.recorded_at,
      origin_group_id: n.origin_group_id,
    })),
    offers: offers.map((o) => ({
      offer_id: o.offer.offer_id,
      available_resource: o.offer.available_resource,
      recorded_at: o.recorded_at,
    })),
    actions: actions.map((a) => ({
      action_id: a.action.action_id,
      inputs: a.action.inputs,
      recorded_at: a.recorded_at,
    })),
    effects: effects.map((e) => ({
      effect_id: e.effect.effect_id,
      action_ref: e.effect.action_ref,
      verified: isEffectVerified(e.effect),
      recorded_at: e.recorded_at,
    })),
    // Observations live in the canon event store and are already present in
    // `events` for the group log; canon Observations are added by the caller
    // only where a surface actually loads them, so nothing is double-counted.
    observations: [],
  });
}
