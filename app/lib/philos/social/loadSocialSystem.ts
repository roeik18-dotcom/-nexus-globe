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
import { loadValueDeclarations } from "../community/valueDeclarationStoreAccessor";
import type { ValueDeclaration } from "../community/valueDeclaration";
import { buildDefaultLinkRegistry } from "../bridge/linkRegistry";
import type { EntityLink } from "../bridge/entityLink";
import { buildSocialChronology, type ChronoEntry } from "./socialChronology";
import { projectSocialSystem, type SocialObject, type Scale } from "./socialSystemProjection";
import { buildSocialFlow, type FlowStage } from "./socialFlowStages";
import { mayReadSubject, type ViewerContext } from "../identity/viewerContext";
// The two SOURCE counts come from the authoritative collections themselves,
// never from a literal. They were hardcoded as 110 and 4 — correct at the time
// and silently wrong the moment either collection changed, with nothing to
// catch it.
import { CONTRADICTION_MASTER } from "../valueSystem/contradictionMaster";
import { DIRECT_CONTRADICTION_VALUE_RELATIONS } from "../valueSystem/socialValueSpine";

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
  /** Materialized values. `null` counts mean UNKNOWN — never rendered as 0. */
  values: {
    all: ValueDeclaration[];
    personal: number | null;
    group: number | null;
    /** Verified subsets, so DECLARED is never shown as VERIFIED. */
    personalVerified: number;
    groupVerified: number;
  };
  /** The ten-stage flow, built once from the same numbers. */
  /** The ten-stage flow. `scale` is the ONLY thing a surface may vary — see
   *  the note on `flow` in the return value for why the two value-model
   *  counts stopped being overridable. */
  flow: (over?: { scale?: "GROUP" | "NETWORK" | "SYSTEM" }) => FlowStage[];
}

/**
 * SCOPED AUTHORITY. Takes the viewer and filters BEFORE projection.
 *
 * The unscoped version loaded every record for everyone and then analysed the
 * whole set — so the flow, roles, spine and chronology were all computed over
 * other people's data before anything was filtered. Filtering after analysis
 * is not filtering: the numbers are already contaminated.
 *
 * THE SCOPING RULE, applied to raw records before anything else runs:
 *   personal records  visible only to their own subject
 *   group records     visible to a viewer with a real membership in that group
 *   unowned records   group history with no personal owner; shared with anyone
 *                     who can see the group
 * Nothing is visible merely because it was already in memory.
 */
export async function loadSocialSystem(viewer: ViewerContext): Promise<SocialSystemState> {
  const today = todayIn(systemClock);

  const [events, needs, offers, actions, effects, declarations, canonEvents, valueDeclarations] = await Promise.all([
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
    // Materialized values — the only source for the spine's middle two links.
    loadValueDeclarations().catch(() => []),
  ]);

  // Groups this viewer legitimately belongs to — from real membership records,
  // never from a default constant.
  const viewerGroups = new Set(
    events
      .filter((e) => e.event_type === "member.joined" && (e.actor_id === viewer.person_id || e.actor_id === viewer.subject_id))
      .map((e) => e.entity_id),
  );

  const ownsCanon = <T,>(rec: T, subject: string | undefined) => mayReadSubject(viewer, subject);

  // SCOPED BEFORE PROJECTION. Each store is filtered to what this viewer may
  // read, and everything downstream — chronology, flow, roles, registry — is
  // built from the filtered set only.
  const visibleNeeds = needs.filter((n) => ownsCanon(n, n.need.subject));
  const visibleOffers = offers.filter((o) => ownsCanon(o, o.offer.source));
  const visibleActions = actions.filter((a) => ownsCanon(a, a.action.owner));
  const visibleEffects = effects.filter((e) => ownsCanon(e, e.effect.subject));
  const visibleValues = valueDeclarations.filter(
    (v) => (v.scope === "PERSONAL" && mayReadSubject(viewer, v.holder_id))
        || (v.scope === "GROUP" && viewerGroups.has(v.holder_id)),
  );
  // Group log events: visible for groups the viewer belongs to. A viewer with
  // no membership sees no group history, which is the correct default for a
  // second user rather than an empty-state bug.
  /* Group-log scoping, properly.
     This read `entity_type !== "value_group" || viewerGroups.has(entity_id)`,
     which let EVERY non-group event through for everyone — so a viewer who
     belongs to nothing still received all 27 `person.registered` records, a
     complete roster of the system's people. "It isn't a value_group event"
     is not the same question as "may this viewer see it".

     A group-log event is visible when it is the viewer's OWN, or when it
     belongs to a group the viewer has a recorded membership in. People are
     visible through a SHARED GROUP, never globally: co-membership is a real
     recorded relation, and it is the only thing that makes another person's
     registration a fact this viewer is party to. */
  const coMembers = new Set<string>();
  for (const e of events) {
    if (e.event_type === "member.joined" && viewerGroups.has(e.entity_id)) coMembers.add(e.actor_id);
  }
  const isOwn = (id: string) => id === viewer.person_id || id === viewer.subject_id;
  const visibleEvents = events.filter((e) => {
    if (isOwn(e.actor_id) || isOwn(e.entity_id)) return true;
    if (e.entity_type === "value_group") return viewerGroups.has(e.entity_id);
    // A person record: visible only through a shared group.
    if (e.entity_type === "person") return coMembers.has(e.entity_id) || coMembers.has(e.actor_id);
    // Anything else is visible only when its actor shares a group with the
    // viewer — an unclassified event is not public by default.
    return coMembers.has(e.actor_id);
  });

  /* SCOPED BEFORE PROJECTION — for real this time.
     The `visible*` arrays above were computed correctly and then NOT USED: the
     chronology was built from the unfiltered `needs` / `offers` / `actions` /
     `effects`, and observations were not filtered at all. Only `events` used
     its scoped version. Everything downstream — objects, scale counts,
     relations, the whole social projection — is derived from the chronology,
     so a second user would have seen every one of the first user's canon
     records while the scoping code sat one line above, looking correct.
     Scoping that is computed but not applied is worse than no scoping: it
     reads as done. */
  const chronology = buildSocialChronology({
    events: visibleEvents,
    needs: visibleNeeds.map((n) => ({
      need_id: n.need.need_id, desired_change: n.need.desired_change,
      recorded_at: n.recorded_at, origin_group_id: n.origin_group_id, subject: n.need.subject,
    })),
    offers: visibleOffers.map((o) => ({
      offer_id: o.offer.offer_id, available_resource: o.offer.available_resource, recorded_at: o.recorded_at, source: o.offer.source,
    })),
    actions: visibleActions.map((a) => ({
      action_id: a.action.action_id, inputs: a.action.inputs, recorded_at: a.recorded_at, owner: a.action.owner,
    })),
    effects: visibleEffects.map((e) => ({
      effect_id: e.effect.effect_id, action_ref: e.effect.action_ref,
      verified: isEffectVerified(e.effect), recorded_at: e.recorded_at, subject: e.effect.subject,
    })),
    observations: canonEvents
      // The Observation's own subject lives on the payload, not the envelope.
      .filter((e) => e.canon_type === "observation" && mayReadSubject(viewer, e.payload.subject))
      .map((e) => ({ canon_event_id: e.canon_event_id, at: e.recorded_at })),
  });

  // Need -> group from BOTH sources, in one map, so no surface can see only
  // half of them. `origin_group_id` (written at creation) outranks a later
  // declaration, exactly as the registry rules it.
  const needGroups = new Map<string, string>();
  const visibleNeedIds = new Set(visibleNeeds.map((n) => n.need.need_id));
  for (const d of declarations) if (visibleNeedIds.has(d.need_id)) needGroups.set(d.need_id, d.group_id);
  for (const n of visibleNeeds) if (n.origin_group_id) needGroups.set(n.need.need_id, n.origin_group_id);

  const objects = projectSocialSystem({ chronology, needGroups });

  // The registry gets the FULL canon input every time. Community used to omit
  // needs and actions here, which is why its cards showed no links.
  const bridgeLinks = buildDefaultLinkRegistry(
    visibleEvents,
    today,
    visibleEffects.map((e) => ({ effect_id: e.effect.effect_id, action_ref: e.effect.action_ref })),
    {
      needs: visibleNeeds.map((n) => ({
        need_id: n.need.need_id, origin_group_id: n.origin_group_id, recorded_at: n.recorded_at,
      })),
      actions: visibleActions.map((a) => ({ action_id: a.action.action_id, inputs: a.action.inputs })),
      needGroupDeclarations: declarations.filter((d) => visibleNeedIds.has(d.need_id)).map((d) => ({
        need_id: d.need_id, group_id: d.group_id, link_id: d.link_id, created_at: d.created_at,
      })),
      /* PERSONAL ANALYSIS. The registry built links for `GROUP_ID` regardless
         of viewer, and always included the DEMO communities — so a viewer who
         owns nothing still received 25 demo links inside their own social
         state. Both are now the caller's choice, and this caller is the
         personal one, so it passes the viewer's OWN groups.

         `includeDemo: false` is deliberately NOT set here, and the parameter
         exists so the choice is visible rather than absent. Setting it moved
         DEMO_RELATIONS from 25 to 5 in the stage's PROVENANCE cell — and 25
         is a figure Roei ratified as baseline, on a cell that is explicitly
         labelled `· כל המאגר` (registry-wide), not personal analysis. What the
         DEMO ruling actually protects is already true and asserted: DEMO
         enters chronology 0, objects 0 and values 0 for both viewers. Flipping
         this flag is a baseline decision, not an implementation detail. */
      realGroupIds: [...viewerGroups],
    },
  );

  const counts: Record<Scale, number> = {
    GROUP: objects.filter((o) => o.scales.GROUP.present).length,
    NETWORK: objects.filter((o) => o.scales.NETWORK.present).length,
    SYSTEM: objects.filter((o) => o.scales.SYSTEM.present).length,
  };

  // Personal and Group values are counted SEPARATELY and never merged: one
  // person's value is not the group's, and the spine shows them as two links
  // precisely because they are two different facts.
  const personalDecls = visibleValues.filter((v) => v.scope === "PERSONAL");
  const groupDecls = visibleValues.filter((v) => v.scope === "GROUP");
  const values = {
    all: visibleValues,
    // UNKNOWN until one exists — an empty store means nobody has declared,
    // which is not the same as "zero values exist".
    personal: personalDecls.length > 0 ? personalDecls.length : null,
    group: groupDecls.length > 0 ? groupDecls.length : null,
    personalVerified: personalDecls.filter((v) => v.status === "VERIFIED").length,
    groupVerified: groupDecls.filter((v) => v.status === "VERIFIED").length,
  };

  const verifiedEffects = visibleEffects.filter((e) => isEffectVerified(e.effect)).length;
  const totals = {
    needs: visibleNeeds.length, offers: visibleOffers.length, actions: visibleActions.length,
    effects: visibleEffects.length, verifiedEffects,
  };

  /* VALUE GROUPS and MEMBERSHIPS, counted ONCE.
     These were `over?.valueGroups` / `over?.memberships` — an override hole
     that made this module a shared BUILDER while leaving three call sites
     free to be three AUTHORITIES. They were, and they disagreed on screen:
     Community counted REAL value groups and the members on their rosters and
     showed 1 / 9; Globe counted value_group NODES and member.joined ARCS and
     showed 1 / 6; World passed nothing at all and showed UNKNOWN / UNKNOWN.
     One set of records, three answers, all three visible at once.

     MEMBERSHIP counts RECORDED MEMBERSHIP EVENTS, which is what the stage's
     own basis line has always claimed it counts ("חברות מתועדת"). A group's
     ROSTER is a different, also-real number and is still shown on the group
     card as "N חברים" — a roster of 9 and 6 recorded joins are both true, and
     collapsing them was how 9 came to appear under a label that means 6. */
  const valueGroupCount = new Set(
    chronology.filter((e) => e.kind === "group.opened" && e.provenance === "REAL").map((e) => e.record_id),
  ).size;
  const membershipCount = chronology.filter((e) => e.kind === "member.joined").length;

  return {
    chronology, objects, bridgeLinks, needGroups, counts, totals, values,
    // Only the two value-model stages differ by scale (a scale may see no
    // groups); every canon stage comes from the SAME totals everywhere.
    flow: (over) => buildSocialFlow({
      contradictions: CONTRADICTION_MASTER.length,
      emergentValues: DIRECT_CONTRADICTION_VALUE_RELATIONS.length,
      personalValues: values.personal,
      groupValues: values.group,
      valueGroups: valueGroupCount || null,
      memberships: membershipCount || null,
      needs: totals.needs || null,
      actions: totals.actions || null,
      effects: totals.effects || null,
      evidence: totals.verifiedEffects || null,
    }, { scale: over?.scale ?? "GROUP" }),
  };
}
