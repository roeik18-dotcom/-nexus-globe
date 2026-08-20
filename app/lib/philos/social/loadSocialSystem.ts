/**
 * THE ONE SOCIAL LOADER — a single authority for every fact the three scales
 * display.
 *
 * WHY THIS EXISTS. Community, Globe and World each assembled the social state
 * themselves by calling the same shared builders with DIFFERENT arguments.
 * Every builder was correct; the inputs were not, and the surfaces disagreed
 * about plain facts:
 *
 *   - World passed `needGroups: new Map()`, so it reported NETWORK = 10 while
 *     Community and Globe reported 11. Same projection, different input.
 *   - Community built its link registry without `needs` or `actions`, so the
 *     registry produced NO real links there. The flow rail (fed separately)
 *     said NEED 1 / ACTION 1 / EFFECT 1 REAL, while the group card in the same
 *     viewport said "no Need↔group link" and "0 linked Action". Two counters
 *     for one fact, disagreeing on screen.
 *
 * A shared builder is not a shared authority. As long as three call sites can
 * pass three argument sets, there are three answers. This module removes the
 * choice: every surface calls `loadSocialSystem()` and renders what it
 * returns. Nothing else assembles social state.
 *
 * Loads are parallel where independent, and each store is read ONCE.
 */
import { loadPhilosEvents } from "@/app/lib/philos-event-store";
import { systemClock, todayIn } from "../eventStore";
import { loadNeeds } from "../canon/needStoreAccessor";
import { loadOffers } from "../canon/offerStoreAccessor";
import { loadActions } from "../canon/actionStoreAccessor";
import { loadEffects } from "../canon/effectStoreAccessor";
import { isEffectVerified } from "../canon/effect";
import { loadNeedGroupLinks } from "../community/needGroupLinkStoreAccessor";
import { loadCanonEvents } from "../canon/canonEventStoreAccessor";
import { buildDefaultLinkRegistry } from "../bridge/linkRegistry";
import type { EntityLink } from "../bridge/entityLink";
import { buildSocialChronology, type ChronoEntry } from "./socialChronology";
import { projectSocialSystem, type SocialObject, type Scale } from "./socialSystemProjection";
import { buildSocialFlow, type FlowStage } from "./socialFlowStages";

export interface SocialSystemState {
  chronology: ChronoEntry[];
  objects: SocialObject[];
  bridgeLinks: EntityLink[];
  /** need_id -> group_id, from explicit writes and explicit declarations. */
  needGroups: Map<string, string>;
  /** Scale counts, derived from `objects` — the only place they are computed. */
  counts: Record<Scale, number>;
  /** Canon totals, so no surface counts records for itself. */
  totals: { needs: number; offers: number; actions: number; effects: number; verifiedEffects: number };
  /** The ten-stage flow, built once from the same numbers. */
  flow: (over?: { valueGroups?: number | null; memberships?: number | null }) => FlowStage[];
}

export async function loadSocialSystem(): Promise<SocialSystemState> {
  const today = todayIn(systemClock);

  const [events, needs, offers, actions, effects, declarations, canonEvents] = await Promise.all([
    loadPhilosEvents().catch(() => []),
    loadNeeds().catch(() => []),
    loadOffers().catch(() => []),
    loadActions().catch(() => []),
    loadEffects().catch(() => []),
    loadNeedGroupLinks().catch(() => []),
    // Canon Observations. The chronology passed `observations: []` from the
    // day it was written, so five real recorded Observations existed on disk
    // and reached no surface at all — not a gap in the data, a gap in the
    // wiring.
    loadCanonEvents().catch(() => []),
  ]);

  const chronology = buildSocialChronology({
    events,
    needs: needs.map((n) => ({
      need_id: n.need.need_id, desired_change: n.need.desired_change,
      recorded_at: n.recorded_at, origin_group_id: n.origin_group_id,
    })),
    offers: offers.map((o) => ({
      offer_id: o.offer.offer_id, available_resource: o.offer.available_resource, recorded_at: o.recorded_at,
    })),
    actions: actions.map((a) => ({
      action_id: a.action.action_id, inputs: a.action.inputs, recorded_at: a.recorded_at,
    })),
    effects: effects.map((e) => ({
      effect_id: e.effect.effect_id, action_ref: e.effect.action_ref,
      verified: isEffectVerified(e.effect), recorded_at: e.recorded_at,
    })),
    observations: canonEvents
      .filter((e) => e.canon_type === "observation")
      .map((e) => ({ canon_event_id: e.canon_event_id, at: e.recorded_at })),
  });

  // Need -> group from BOTH sources, in one map, so no surface can see only
  // half of them. `origin_group_id` (written at creation) outranks a later
  // declaration, exactly as the registry rules it.
  const needGroups = new Map<string, string>();
  for (const d of declarations) needGroups.set(d.need_id, d.group_id);
  for (const n of needs) if (n.origin_group_id) needGroups.set(n.need.need_id, n.origin_group_id);

  const objects = projectSocialSystem({ chronology, needGroups });

  // The registry gets the FULL canon input every time. Community used to omit
  // needs and actions here, which is why its cards showed no links.
  const bridgeLinks = buildDefaultLinkRegistry(
    events,
    today,
    effects.map((e) => ({ effect_id: e.effect.effect_id, action_ref: e.effect.action_ref })),
    {
      needs: needs.map((n) => ({
        need_id: n.need.need_id, origin_group_id: n.origin_group_id, recorded_at: n.recorded_at,
      })),
      actions: actions.map((a) => ({ action_id: a.action.action_id, inputs: a.action.inputs })),
      needGroupDeclarations: declarations.map((d) => ({
        need_id: d.need_id, group_id: d.group_id, link_id: d.link_id, created_at: d.created_at,
      })),
    },
  );

  const counts: Record<Scale, number> = {
    GROUP: objects.filter((o) => o.scales.GROUP.present).length,
    NETWORK: objects.filter((o) => o.scales.NETWORK.present).length,
    SYSTEM: objects.filter((o) => o.scales.SYSTEM.present).length,
  };

  const verifiedEffects = effects.filter((e) => isEffectVerified(e.effect)).length;
  const totals = {
    needs: needs.length, offers: offers.length, actions: actions.length,
    effects: effects.length, verifiedEffects,
  };

  return {
    chronology, objects, bridgeLinks, needGroups, counts, totals,
    // Only the two value-model stages differ by scale (a scale may see no
    // groups); every canon stage comes from the SAME totals everywhere.
    flow: (over) => buildSocialFlow({
      contradictions: 110,
      emergentValues: 4,
      personalValues: null,
      groupValues: null,
      valueGroups: over?.valueGroups ?? null,
      memberships: over?.memberships ?? null,
      needs: totals.needs || null,
      actions: totals.actions || null,
      effects: totals.effects || null,
      evidence: totals.verifiedEffects || null,
    }),
  };
}
