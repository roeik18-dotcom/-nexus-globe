/**
 * Canonical Cross-Entity Link Registry — types.
 *
 * PHILOS has several real, independently-evolved identity spaces that do not
 * share a key: the legacy Value-Group event log uses `p_*`/`dg_*` person ids
 * and `vg_*`/`demo_vg_*` group ids; canon uses free-text `subject` strings
 * (observed so far as test/placeholder values like `person_e2e`); the DEMO
 * marketplace scenario reuses a legacy DEMO person id (`dg_lior`) as a canon
 * `Need.subject`, entirely within DEMO data. There is no shared primary key.
 *
 * This module defines a TRANSLATION layer, not a replacement: a typed
 * `EntityLink` records that a specific entity KNOWN under one source
 * system's local id refers to the same canonical thing as another entity
 * under a (possibly different) source system's local id. No local id is
 * ever rewritten, and no store is collapsed — see `linkRegistry.ts` for the
 * only place links are actually built, always from real or clearly-labeled
 * DEMO existing data, never fabricated to fill a gap.
 */

export type CanonicalEntityType =
  | "person"
  | "community"
  | "value_group"
  | "project"
  | "need"
  | "resource"
  | "provider"
  | "offer"
  | "action"
  | "effect"
  | "world_entity";

/** `world_entity` subtype — kept separate so a link can state which kind of
 *  spatial entity it is without inventing a twelfth top-level entity type. */
export type WorldEntityKind = "region" | "location";

export type RelationType =
  | "PERSON_MEMBER_OF_COMMUNITY"
  | "PERSON_ASSOCIATED_WITH_VALUE_GROUP"
  | "COMMUNITY_LOCATED_IN_REGION"
  | "COMMUNITY_USES_RESOURCE"
  | "COMMUNITY_HAS_NEED"
  | "NEED_MATCHED_TO_OFFER"
  | "PROVIDER_OFFERS_RESOURCE"
  | "ACTION_AFFECTS_COMMUNITY"
  | "EFFECT_AFFECTS_PERSON"
  | "EFFECT_AFFECTS_COMMUNITY"
  | "VALUE_GROUP_PRESENT_IN_REGION"
  | "PROJECT_BELONGS_TO_COMMUNITY"
  // Spatial foundation (canonical-correction pass): a generic
  // SpatialContext model (REGION/COUNTRY/LOCATION, see `spatialContext.ts`)
  // — `COMMUNITY_LOCATED_IN_REGION` above is kept as the one Community↔
  // Region relation; these cover every other entity type the spec named.
  | "ENTITY_LOCATED_IN"
  | "ENTITY_ACTIVE_IN"
  | "ENTITY_AFFECTS_REGION"
  | "ACTION_OCCURRED_IN"
  | "EFFECT_OBSERVED_IN"
  | "RESOURCE_AVAILABLE_IN"
  | "NEED_EXISTS_IN"
  | "COMMUNITY_ACTIVE_IN";

/** REAL — both ends come from a real, durable, non-DEMO source. DEMO — at
 *  least one end is clearly-labeled DEMO data. There is deliberately no
 *  UNKNOWN provenance value: a link either exists (REAL or DEMO, because it
 *  was actually derived from something) or it is not instantiated at all.
 *  "Unknown" is expressed by ABSENCE from the registry, queried via
 *  `linksForEntity` returning `[]` — never a fabricated placeholder link. */
export type LinkProvenance = "REAL" | "DEMO";

export interface EntityRef {
  type: CanonicalEntityType;
  /** The canonical id this bridge assigns — for every relation currently
   *  instantiated, this equals `source_local_id` (no id translation has
   *  been needed yet, since every real link so far connects two readings of
   *  the SAME legacy id). Kept as its own field so a future source with a
   *  genuinely different local id can be bridged without a shape change. */
  canonical_id: string;
  source_system: string;
  source_local_id: string;
  world_entity_kind?: WorldEntityKind;
}

export interface EntityLink {
  link_id: string;
  relation: RelationType;
  source: EntityRef;
  target: EntityRef;
  provenance: LinkProvenance;
  /** 1.0 for every link currently instantiated — all are exact id matches
   *  within a single fixture (real log or DEMO fixture), never fuzzy or
   *  inferred. A future probabilistic linkage would use a lower value. */
  confidence: number;
  /** ISO time range the relation is asserted to hold, when the source data
   *  states one (e.g. a membership event's timestamp). Absent means the
   *  source data does not carry a validity window — never guessed. */
  valid_from?: string;
  valid_to?: string;
  note?: string;
}

export function linksForEntity(
  registry: EntityLink[],
  type: CanonicalEntityType,
  canonicalId: string,
): EntityLink[] {
  return registry.filter(
    (l) =>
      (l.source.type === type && l.source.canonical_id === canonicalId) ||
      (l.target.type === type && l.target.canonical_id === canonicalId),
  );
}

export function linksByRelation(registry: EntityLink[], relation: RelationType): EntityLink[] {
  return registry.filter((l) => l.relation === relation);
}

/** The other end of a link, relative to a known entity — since a link is
 *  undirected for lookup purposes (either side may be the query subject). */
export function otherEnd(link: EntityLink, type: CanonicalEntityType, canonicalId: string): EntityRef {
  return link.source.type === type && link.source.canonical_id === canonicalId ? link.target : link.source;
}
