/**
 * Generic Spatial Context model (canonical-correction pass).
 *
 * A real, typed schema for "where" — WITHOUT fabricating actual locations
 * for real entities. This module was first drafted with a hand-authored
 * DEMO region fixture, then corrected on the same pass: `ValueGroupView`
 * (`projectValueGroup.ts`) already carries a REAL `region` field, read from
 * the real `group.opened` event's own `payload.region` — the real seeded
 * community's region is genuinely `"תל אביב"`, and the DEMO communities'
 * own fixtures already state `"צפון הארץ"`/`"רמת גן"`. That field existed
 * before this pass and was simply never bridged to anything. Deriving
 * `SpatialContext`s from it is recovery, not invention — it is exactly the
 * "do not infer geography from names" boundary respected in the other
 * direction: this reads an EXPLICIT existing field, never guesses a
 * location from an unrelated string like a community's own name.
 *
 * No other real entity (Person, Need, Offer, Action, Effect) carries any
 * location field anywhere in this repo — confirmed again this pass. Those
 * only receive DEMO spatial links, via the DEMO marketplace scenario's own
 * object graph, placed in the same region as the DEMO community they
 * already belong to.
 */
import type { ValueGroupView } from "../projectValueGroup";
import type { EntityLink, EntityRef, LinkProvenance } from "./entityLink";
import { DEMO_GREEN_INNOVATION_ID } from "../demoCommunities";
import {
  DEMO_EFFECT,
  DEMO_NEED,
  DEMO_OFFER,
  DEMO_TRANSFER,
} from "../canon/demoMarketplaceScenario";

export type SpatialContextKind = "region" | "country" | "location";

export interface SpatialContext {
  id: string;
  kind: SpatialContextKind;
  label: string;
  /** A broader SpatialContext this one sits inside (region → country), when
   *  the fixture states one. Optional — never inferred. */
  parent_id?: string;
  provenance: LinkProvenance;
}

function slug(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "_")
    .replace(/^_+|_+$/g, "");
}

/** DEMO-only broader context, purely to exercise the optional hierarchy —
 *  never presented as the real country of a real region. Only ever set as
 *  the `parent_id` of a region derived from a DEMO community. */
export const DEMO_COUNTRY: SpatialContext = {
  id: "demo_country_context",
  kind: "country",
  label: "[DEMO] הקשר-על מדינתי",
  provenance: "DEMO",
};

/** A region SpatialContext derived directly from a `ValueGroupView`'s own
 *  real `region` field — same provenance as the community itself. Returns
 *  `undefined` when the field is genuinely empty (never a fabricated
 *  default region). */
export function spatialContextForCommunity(group: ValueGroupView, provenance: LinkProvenance): SpatialContext | undefined {
  if (!group.region) return undefined;
  return {
    id: `region_${slug(group.region)}`,
    kind: "region",
    label: group.region,
    parent_id: provenance === "DEMO" ? DEMO_COUNTRY.id : undefined,
    provenance,
  };
}

function spatialRef(ctx: SpatialContext): EntityRef {
  return {
    type: "world_entity",
    canonical_id: ctx.id,
    source_system: "value_group_log_region_field",
    source_local_id: ctx.id,
    world_entity_kind: ctx.kind === "location" ? "location" : "region",
  };
}

/**
 * COMMUNITY_LOCATED_IN_REGION, derived from the SAME `group.region` field
 * `CommunityCommandTerminal.tsx` already renders in its header — no second
 * region value invented here.
 */
export function buildCommunityRegionLink(group: ValueGroupView, provenance: LinkProvenance): EntityLink | undefined {
  const ctx = spatialContextForCommunity(group, provenance);
  if (!ctx) return undefined;
  return {
    link_id: `link_spatial_region_${group.group_id}`,
    relation: "COMMUNITY_LOCATED_IN_REGION",
    source: { type: "community", canonical_id: group.group_id, source_system: "value_group_log", source_local_id: group.group_id },
    target: spatialRef(ctx),
    provenance,
    confidence: 1,
    note: "group.region — the real field on this group's own group.opened event payload",
  };
}

/**
 * The DEMO marketplace scenario's own Need/Offer/Action/Effect objects,
 * placed in the SAME region as the DEMO community
 * (`demo_vg_green_innovation`) the scenario already belongs to — not a
 * second, disconnected DEMO geography.
 */
export function buildDemoMarketplaceSpatialLinks(greenInnovationGroup: ValueGroupView): EntityLink[] {
  const ctx = spatialContextForCommunity(greenInnovationGroup, "DEMO");
  if (!ctx) return [];
  const region = spatialRef(ctx);
  const note = "same region as demo_vg_green_innovation, the community this DEMO scenario belongs to";
  return [
    { link_id: "link_spatial_need_region", relation: "NEED_EXISTS_IN", source: { type: "need", canonical_id: DEMO_NEED.need_id, source_system: "demo_marketplace_scenario", source_local_id: DEMO_NEED.need_id }, target: region, provenance: "DEMO", confidence: 1, note },
    { link_id: "link_spatial_offer_region", relation: "RESOURCE_AVAILABLE_IN", source: { type: "offer", canonical_id: DEMO_OFFER.offer_id, source_system: "demo_marketplace_scenario", source_local_id: DEMO_OFFER.offer_id }, target: region, provenance: "DEMO", confidence: 1, note },
    { link_id: "link_spatial_action_region", relation: "ACTION_OCCURRED_IN", source: { type: "action", canonical_id: DEMO_TRANSFER.action_id, source_system: "demo_marketplace_scenario", source_local_id: DEMO_TRANSFER.action_id }, target: region, provenance: "DEMO", confidence: 1, note },
    { link_id: "link_spatial_effect_region", relation: "EFFECT_OBSERVED_IN", source: { type: "effect", canonical_id: DEMO_EFFECT.effect_id, source_system: "demo_marketplace_scenario", source_local_id: DEMO_EFFECT.effect_id }, target: region, provenance: "DEMO", confidence: 1, note },
  ];
}

export const DEMO_GREEN_INNOVATION_REFERENCE_ID = DEMO_GREEN_INNOVATION_ID;
