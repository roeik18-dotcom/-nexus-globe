/**
 * Canonical Cross-Entity Link Registry — construction.
 *
 * Every link built here is derived from data that already exists somewhere
 * else in the repo (the real Value-Group log's own projected membership, or
 * the already-approved DEMO fixtures) — this file adds no new fact, no new
 * store, and no new coordinate. Relations for which no real or DEMO data
 * exists (COMMUNITY_LOCATED_IN_REGION, VALUE_GROUP_PRESENT_IN_REGION,
 * PERSON_ASSOCIATED_WITH_VALUE_GROUP, PROJECT_BELONGS_TO_COMMUNITY — no
 * region/geography field, no Value-Group taxonomy, and no Project entity
 * exist anywhere in canon, the legacy log, or the corpus, per the §13 audit)
 * are deliberately NOT instantiated. Querying for them returns `[]`, which
 * IS the honest "unknown" state — see `entityLink.ts`'s note on why there is
 * no separate UNKNOWN provenance value.
 */
import { projectValueGroup, type ValueGroupView } from "../projectValueGroup";
import { GROUP_ID, VALUE_GROUP_EVENTS, SEED_TODAY } from "../valueGroupLog";
import { DEMO_COMMUNITIES } from "../demoCommunities";
import type { PhilosEvent } from "../events";
import {
  DEMO_EFFECT,
  DEMO_NEED,
  DEMO_OFFER,
  DEMO_SCENARIO_COMMUNITY_ID,
  DEMO_TRANSFER,
  buildDemoMatchResult,
} from "../canon/demoMarketplaceScenario";
import type { EntityLink, LinkProvenance } from "./entityLink";
import { buildCommunityRegionLink, buildDemoMarketplaceSpatialLinks } from "./spatialContext";

/**
 * PERSON_MEMBER_OF_COMMUNITY, one link per member, for a single already-
 * projected community view. Takes a `ValueGroupView` (the SAME real
 * projection Community/Planet/Dynamics already compute via
 * `projectValueGroup`) rather than re-reading the event log — no second
 * derivation of membership.
 */
export function buildMembershipLinks(group: ValueGroupView, provenance: LinkProvenance): EntityLink[] {
  return group.members.map((m) => ({
    link_id: `link_member_${m.person_id}_${group.group_id}`,
    relation: "PERSON_MEMBER_OF_COMMUNITY",
    source: { type: "person", canonical_id: m.person_id, source_system: "value_group_log", source_local_id: m.person_id },
    target: { type: "community", canonical_id: group.group_id, source_system: "value_group_log", source_local_id: group.group_id },
    provenance,
    confidence: 1,
  }));
}

/**
 * The DEMO marketplace scenario's own real internal object graph, read as
 * typed relations. All DEMO — this scenario is never written to a real
 * store (see `demoMarketplaceScenario.ts`'s own header).
 */
export function buildDemoMarketplaceLinks(): EntityLink[] {
  const match = buildDemoMatchResult();
  const links: EntityLink[] = [
    {
      link_id: "link_demo_need_community",
      relation: "COMMUNITY_HAS_NEED",
      source: { type: "community", canonical_id: DEMO_SCENARIO_COMMUNITY_ID, source_system: "demo_communities", source_local_id: DEMO_SCENARIO_COMMUNITY_ID },
      target: { type: "need", canonical_id: DEMO_NEED.need_id, source_system: "demo_marketplace_scenario", source_local_id: DEMO_NEED.need_id },
      provenance: "DEMO",
      confidence: 1,
      note: "same dg_lior subject as the community's own DEMO fixture — see demoMarketplaceScenario.ts header",
    },
    {
      link_id: "link_demo_provider_offer",
      relation: "PROVIDER_OFFERS_RESOURCE",
      source: { type: "provider", canonical_id: DEMO_OFFER.source, source_system: "demo_marketplace_scenario", source_local_id: DEMO_OFFER.source },
      target: { type: "offer", canonical_id: DEMO_OFFER.offer_id, source_system: "demo_marketplace_scenario", source_local_id: DEMO_OFFER.offer_id },
      provenance: "DEMO",
      confidence: 1,
    },
  ];

  if (match.decision === "permitted") {
    links.push({
      link_id: "link_demo_need_offer_match",
      relation: "NEED_MATCHED_TO_OFFER",
      source: { type: "need", canonical_id: DEMO_NEED.need_id, source_system: "demo_marketplace_scenario", source_local_id: DEMO_NEED.need_id },
      target: { type: "offer", canonical_id: DEMO_OFFER.offer_id, source_system: "demo_marketplace_scenario", source_local_id: DEMO_OFFER.offer_id },
      provenance: "DEMO",
      confidence: 1,
      note: `match.decision = ${match.decision}`,
    });
    links.push({
      link_id: "link_demo_action_community",
      relation: "ACTION_AFFECTS_COMMUNITY",
      source: { type: "action", canonical_id: DEMO_TRANSFER.action_id, source_system: "demo_marketplace_scenario", source_local_id: DEMO_TRANSFER.action_id },
      target: { type: "community", canonical_id: DEMO_SCENARIO_COMMUNITY_ID, source_system: "demo_communities", source_local_id: DEMO_SCENARIO_COMMUNITY_ID },
      provenance: "DEMO",
      confidence: 1,
      note: "DEMO_TRANSFER.inputs includes the same open allocation (demo_alloc_compost) the community's own log still shows unresolved",
    });
  }

  if (DEMO_EFFECT.subject) {
    links.push({
      link_id: "link_demo_effect_person",
      relation: "EFFECT_AFFECTS_PERSON",
      source: { type: "effect", canonical_id: DEMO_EFFECT.effect_id, source_system: "demo_marketplace_scenario", source_local_id: DEMO_EFFECT.effect_id },
      target: { type: "person", canonical_id: DEMO_EFFECT.subject, source_system: "demo_communities", source_local_id: DEMO_EFFECT.subject },
      provenance: "DEMO",
      confidence: 1,
    });
  }

  return links;
}

/**
 * COMMUNITY_HAS_NEED (REAL) — from an explicit write, not an inference.
 *
 * A Need whose STORE RECORD carries `origin_group_id` was declared by a
 * person who was standing in that group, and the write carried the group
 * explicitly (Community mounts the form with its active real group; the form
 * shows the user which group before they submit). That explicit statement is
 * the only thing that licenses this link, and it is why the link is REAL.
 *
 * Canon `Need` is untouched — the group lives on the record wrapper beside
 * `recorded_at`/`status`. `Need.subject` remains the sovereign subject-side
 * entry (§12): this link says the need was raised IN the group, never that
 * the group owns it.
 *
 * A Need without `origin_group_id` produces nothing. No backfill from
 * membership, value similarity, text or recency.
 */
export function buildRealNeedCommunityLinks(
  needs: { need_id: string; origin_group_id?: string; recorded_at?: string }[],
  knownCommunityIds: Set<string>,
  /**
   * Explicit declarations for Needs that carry no `origin_group_id` — the
   * only way a historical Need acquires a group. A declaration NEVER
   * overrides an origin group written at the time of the Need itself: what
   * the write recorded outranks what was said about it later.
   */
  declarations: Map<string, { group_id: string; link_id: string; created_at: string }> = new Map(),
): EntityLink[] {
  const out: EntityLink[] = [];
  for (const n of needs) {
    const declared = declarations.get(n.need_id);
    const gid = n.origin_group_id?.trim() || declared?.group_id?.trim();
    if (!gid) continue;
    const viaDeclaration = !n.origin_group_id?.trim() && !!declared;
    // The group must be one this registry actually knows. A reference to an
    // unknown group is dropped rather than materialising a phantom community.
    if (!knownCommunityIds.has(gid)) continue;
    out.push({
      link_id: `link_real_need_community_${n.need_id}_${gid}`,
      relation: "COMMUNITY_HAS_NEED",
      source: { type: "community", canonical_id: gid, source_system: "philos_event_log", source_local_id: gid },
      target: { type: "need", canonical_id: n.need_id, source_system: "canon_need_store", source_local_id: n.need_id },
      provenance: "REAL",
      confidence: 1,
      valid_from: viaDeclaration ? declared?.created_at : n.recorded_at,
      note: viaDeclaration
        ? `explicit declaration ${declared?.link_id} by the Need's own subject — a stated attachment, not a backfill and not inferred from the Need's text, values, timing or memberships`
        : "explicit origin_group_id on the Need store record — the write itself named this group; not inferred from membership, value or text",
    });
  }
  return out;
}

/**
 * ACTION_AFFECTS_COMMUNITY (REAL) — composed from recorded references only.
 *
 * Canon `Action.inputs[]` is a caller-supplied id array; when a person builds
 * an Action from a Need, the need_id is in there. If that Need's record names
 * an origin group, then the chain
 *
 *   Action.inputs -> need_id -> NeedRecord.origin_group_id -> group
 *
 * is three recorded references end to end. Nothing is inferred: the person
 * chose the input, and a different person chose the Need's group.
 *
 * This does NOT claim the group owns or performed the Action — `Action.owner`
 * is the person and stays so. It claims the Action acts on a Need that was
 * raised in that group, which is exactly what the relation name says.
 */
export function buildRealActionCommunityLinks(
  actions: { action_id: string; inputs: string[] }[],
  needGroupById: Map<string, string>,
): EntityLink[] {
  const out: EntityLink[] = [];
  for (const a of actions) {
    const seen = new Set<string>();
    for (const input of a.inputs) {
      const gid = needGroupById.get(input);
      if (!gid || seen.has(gid)) continue;
      seen.add(gid);
      out.push({
        link_id: `link_real_action_community_${a.action_id}_${gid}`,
        relation: "ACTION_AFFECTS_COMMUNITY",
        source: { type: "action", canonical_id: a.action_id, source_system: "canon_action_store", source_local_id: a.action_id },
        target: { type: "community", canonical_id: gid, source_system: "philos_event_log", source_local_id: gid },
        provenance: "REAL",
        confidence: 1,
        note: `Action.inputs names ${input}, whose Need record carries origin_group_id=${gid}. Composed from two explicit writes; no inference.`,
      });
    }
  }
  return out;
}

/**
 * EFFECT_AFFECTS_COMMUNITY — derived, never inferred.
 *
 * The relation type was declared in `entityLink.ts` from the start and was
 * the one type never instantiated. It is derivable WITHOUT any schema change
 * and without a single inference, from the conjunction of two records that
 * already exist:
 *
 *   1. an ACTION_AFFECTS_COMMUNITY link that is already in this registry
 *   2. `Effect.action_ref` — canon §17's own pointer from Effect to Action
 *
 * If Action A affects Community C, and Effect E records itself as the effect
 * OF A, then E affects C. Both halves are recorded; the composition adds no
 * claim beyond them.
 *
 * WHAT IS DELIBERATELY NOT DONE HERE. The community is never taken from
 * `Effect.subject`, from the subject's memberships, from value similarity,
 * from `context` text, from chronology, or from a shared need/resource. If
 * no Action↔Community link exists for `action_ref`, NO link is produced —
 * absence, not a placeholder.
 *
 * PROVENANCE IS INHERITED, NOT ASSERTED. The derived link carries exactly the
 * provenance of the Action link it came from. Today every ACTION_AFFECTS_
 * COMMUNITY link is DEMO, so every derived Effect link is DEMO too — it does
 * not become REAL by being computed. If a REAL Action↔Community link is ever
 * recorded, the derived Effect link becomes REAL automatically, by the same
 * rule and with no code change.
 *
 * `confidence` is likewise inherited rather than invented, and the validity
 * window is not synthesised: an Effect's own time is not the Action link's
 * window, so no `valid_from`/`valid_to` is asserted.
 */
export function buildEffectCommunityLinks(
  existing: EntityLink[],
  effects: { effect_id: string; action_ref: string }[],
): EntityLink[] {
  const actionLinks = existing.filter((l) => l.relation === "ACTION_AFFECTS_COMMUNITY");
  if (actionLinks.length === 0) return [];

  const out: EntityLink[] = [];
  for (const e of effects) {
    if (!e.action_ref) continue;
    for (const al of actionLinks) {
      // The action end of the link — either side may hold it.
      const actionEnd = al.source.type === "action" ? al.source : al.target.type === "action" ? al.target : undefined;
      const communityEnd = al.source.type === "community" ? al.source : al.target.type === "community" ? al.target : undefined;
      if (!actionEnd || !communityEnd) continue;
      if (actionEnd.canonical_id !== e.action_ref) continue;

      out.push({
        link_id: `link_effect_community_${e.effect_id}_${communityEnd.canonical_id}`,
        relation: "EFFECT_AFFECTS_COMMUNITY",
        source: { type: "effect", canonical_id: e.effect_id, source_system: "canon_effect_store", source_local_id: e.effect_id },
        target: communityEnd,
        // Inherited from the Action link — a derived link is never more
        // trustworthy than the link it was derived from.
        provenance: al.provenance,
        confidence: al.confidence,
        note: `derived: Effect.action_ref = ${e.action_ref}, and ${al.link_id} records that action affecting this community. No inference from subject, membership, value or text.`,
      });
    }
  }
  return out;
}

/**
 * Full registry: real membership links for every supplied community view,
 * plus the DEMO marketplace scenario's own links. Callers pass in the
 * SAME `ValueGroupView`s they already computed (real + DEMO communities) —
 * this function performs no I/O and does no event-log reading of its own.
 */
export function buildEntityLinkRegistry(
  communities: { group: ValueGroupView; provenance: LinkProvenance }[],
): EntityLink[] {
  const regionLinks = communities
    .map((c) => buildCommunityRegionLink(c.group, c.provenance))
    .filter((l): l is EntityLink => l !== undefined);
  const greenInnovation = communities.find((c) => c.group.group_id === DEMO_SCENARIO_COMMUNITY_ID)?.group;
  return [
    ...communities.flatMap((c) => buildMembershipLinks(c.group, c.provenance)),
    ...buildDemoMarketplaceLinks(),
    ...regionLinks,
    ...(greenInnovation ? buildDemoMarketplaceSpatialLinks(greenInnovation) : []),
  ];
}

/**
 * The one registry every surface (Planet, Community, Marketplace, Dynamics,
 * Brain, shared context) should build from, so no two surfaces compute a
 * different bridge over the same data. Takes the real durable event log as
 * its only real-data input (the SAME store `loadPhilosEvents()` already
 * reads elsewhere) — DEMO communities and the DEMO marketplace scenario are
 * fixed fixtures, not re-read from anywhere per call.
 */
export function buildDefaultLinkRegistry(
  realEvents: PhilosEvent[],
  today: string,
  /** Canon Effects to derive EFFECT_AFFECTS_COMMUNITY from. Optional so every
   *  existing caller keeps working unchanged; omitting it simply produces no
   *  derived Effect links, exactly as before. */
  effects?: { effect_id: string; action_ref: string }[],
  /** Canon Needs (store records) and Actions, for the REAL chain:
   *  Need(origin_group_id) -> COMMUNITY_HAS_NEED -> Action.inputs ->
   *  ACTION_AFFECTS_COMMUNITY -> Effect.action_ref -> EFFECT_AFFECTS_COMMUNITY.
   *  Optional so every existing caller keeps working unchanged. */
  canon?: {
    needs?: { need_id: string; origin_group_id?: string; recorded_at?: string }[];
    actions?: { action_id: string; inputs: string[] }[];
    /** Explicit Need->group declarations, latest per need_id. */
    needGroupDeclarations?: { need_id: string; group_id: string; link_id: string; created_at: string }[];
    /** The REAL groups to build links for. Omitted = the historical single
     *  group, for reference/audit surfaces that are not viewer-scoped. */
    realGroupIds?: readonly string[];
    /** `false` excludes DEMO communities — personal analysis passes this. */
    includeDemo?: boolean;
  },
): EntityLink[] {
  /* WHICH REAL GROUPS. `GROUP_ID` was hardcoded here, so the registry built
     the same real-group links for every viewer. `realGroupIds` lets the
     PERSONAL-ANALYSIS caller (`loadSocialSystem`) pass the viewer's own
     recorded memberships; reference and audit surfaces that pass nothing keep
     the historical single-group behaviour and are labelled as reference tier.
     The constant is now a documented default for those, not an assumption
     buried in a projection call. */
  const groupIds = canon?.realGroupIds ?? [GROUP_ID];
  const communities: { group: ValueGroupView; provenance: LinkProvenance }[] = [];
  for (const gid of groupIds) {
    const realGroup = projectValueGroup(realEvents, gid, today);
    if (realGroup) communities.push({ group: realGroup, provenance: "REAL" });
  }
  /* DEMO communities are REFERENCE fixtures: every link they produce names
     only `demo_*` / `dg_*` / `region_*` entities, never a real person. They
     are excluded when the caller asks for personal analysis. */
  for (const c of (canon?.includeDemo === false ? [] : DEMO_COMMUNITIES)) {
    const demoGroup = projectValueGroup(c.events, c.group_id, c.today);
    if (demoGroup) communities.push({ group: demoGroup, provenance: "DEMO" });
  }
  const base = buildEntityLinkRegistry(communities);

  // The REAL chain, built in dependency order. Each stage can only compose
  // what the stage before it produced, so nothing downstream can invent a
  // community that no explicit write named.
  const knownCommunityIds = new Set(communities.map((c) => c.group.group_id));
  const declarationsByNeed = new Map<string, { group_id: string; link_id: string; created_at: string }>();
  for (const d of canon?.needGroupDeclarations ?? []) {
    // Append-only log: a later record for the same Need is a correction, so
    // last write wins. Nothing is mutated to achieve that.
    declarationsByNeed.set(d.need_id, { group_id: d.group_id, link_id: d.link_id, created_at: d.created_at });
  }
  const needLinks = buildRealNeedCommunityLinks(canon?.needs ?? [], knownCommunityIds, declarationsByNeed);

  // need_id -> origin group, for the Action stage. Only needs that actually
  // carry an origin group and resolved to a known community appear here.
  const needGroupById = new Map<string, string>();
  for (const l of needLinks) {
    const needEnd = l.source.type === "need" ? l.source : l.target;
    const communityEnd = l.source.type === "community" ? l.source : l.target;
    if (needEnd.type === "need" && communityEnd.type === "community") {
      needGroupById.set(needEnd.canonical_id, communityEnd.canonical_id);
    }
  }
  const actionLinks = buildRealActionCommunityLinks(canon?.actions ?? [], needGroupById);

  // Effects compose off the FULL action set — DEMO links included — and each
  // inherits its own source link's provenance, so a REAL effect link appears
  // only behind a REAL action link.
  const withActions = [...base, ...needLinks, ...actionLinks];
  const effectLinks = effects && effects.length > 0
    ? buildEffectCommunityLinks(withActions, effects)
    : [];

  return [...withActions, ...effectLinks];
}

/** A registry built purely from the real seed fixture — for tests and any
 *  caller that has not loaded the durable event log. */
export function buildSeedLinkRegistry(): EntityLink[] {
  return buildDefaultLinkRegistry(VALUE_GROUP_EVENTS, SEED_TODAY);
}
