/**
 * The globe route.
 *
 * PHILOS-SYSTEM-BLUEPRINT §13 — "no line exists until it represents a real
 * event" — and the header rule extends that to every node, metric and status.
 *
 * This route used to render two populations at once: arcs projected from the
 * canonical event log, and ~61 ontology entities read from `data/*.json` whose
 * coordinates came from hashing an id and whose counts were reported in the HUD.
 * The second population could not name an event, so half the screen failed the
 * traceability rule while sitting beside the half that passed it — the "chain is
 * not yet exclusive" debt recorded in §0.
 *
 * The ontology read is gone. `projectGlobeGraph` is now the only source that
 * reaches this page: what the globe draws is exactly what the projection
 * returns, and every node and line on it names the event behind it.
 *
 * The events it folds come from the durable store rather than the seed constant,
 * so the globe reflects what the product has actually recorded — a membership
 * joined on the value-group screen appears here as a node and an arc, drawn from
 * its own event like every other mark.
 *
 * **Selected System Context (semantic-unity slice):** resolved through
 * `sharedContext.ts::resolveSharedContext` — the SAME resolver Dynamics and
 * Marketplace call, replacing this route's former OWN resolver (which
 * matched only against `arcs` and had no subject/timestamp/priorState/
 * relationships). Globe's SPATIAL layout is unaffected: `nodes`/`arcs` above
 * are still `projectGlobeGraph`'s own real entity population, drawn exactly
 * as before. No point for a canon Observation is added to the sphere's
 * `fibSphere` layout — that would extend the existing entity population's
 * positions with items that were never part of it. Canon context surfaces
 * in the inspector drawer only (`WorldGlobe.tsx`), with spatial location
 * stated as UNKNOWN rather than plotted.
 */

import { scopeToViewer, ACTION_OWNER, EFFECT_OWNER, NEED_OWNER, OFFER_OWNER } from "@/app/lib/philos/canon/viewerScopedCanon";
import WorldExplorer from "./WorldExplorer";
import EntityChainFlow from "@/app/lib/philos/crossTerminal/EntityChainFlow";
import UnifiedEntitySurface from "@/app/lib/philos/crossTerminal/UnifiedEntitySurface";
import TerminalPage, { type TerminalSection } from "@/app/lib/philos/shell/TerminalPage";
import { loadSelectedEntity } from "@/app/lib/philos/crossTerminal/loadSelectedEntity";
import NetworkPositionMap from "./NetworkPositionMap";
import { loadWorldView } from "@/app/lib/philos/geo/loadWorldView";
import { SELECTED_GROUP_PARAM } from "@/app/lib/philos/community/selectedGroupContext";
import { connection } from "next/server";
import { SystemShell } from "@/app/lib/philos/shell/SystemShell";
import PersonEventOrientationHeader from "@/app/lib/philos/analysis/PersonEventOrientationHeader";
import SignOutButton from "@/app/signin/SignOutButton";
import { resolveViewerContextSemantics } from "@/app/lib/philos/context/resolveViewerContextSemantics";
import { resolveViewerGroupView } from "@/app/lib/philos/community/viewerGroupView";

import { projectGlobeGraph } from "@/app/lib/philos/projectGlobeGraph";
import { loadPhilosEvents } from "@/app/lib/philos-event-store";
import { resolveSharedContext } from "@/app/lib/philos/sharedContext";
import { parseSystemContextRef } from "@/app/lib/systemContext";
import { systemClock, todayIn } from "@/app/lib/philos/eventStore";
import { buildDefaultLinkRegistry } from "@/app/lib/philos/bridge/linkRegistry";
import { resolveShellIdentityLink } from "@/app/lib/philos/community/resolveShellIdentityLink";
import { loadActions } from "@/app/lib/philos/canon/actionStoreAccessor";
import { loadEffects } from "@/app/lib/philos/canon/effectStoreAccessor";
import { loadNeeds } from "@/app/lib/philos/canon/needStoreAccessor";
import { loadNeedGroupLinks } from "@/app/lib/philos/community/needGroupLinkStoreAccessor";
import { loadOffers } from "@/app/lib/philos/canon/offerStoreAccessor";
import { resolvePersonRef } from "@/app/lib/philos/person/personRef";
import PersonFrameStrip from "@/app/lib/philos/shell/PersonFrameStrip";
import SocialSourceSpinePanel from "@/app/lib/philos/shell/SocialSourceSpinePanel";
import SocialValueSpinePanel from "@/app/lib/philos/shell/SocialValueSpinePanel";
import SocialRoleStrip from "@/app/lib/philos/shell/SocialRoleStrip";
import { loadSocialSystem } from "@/app/lib/philos/social/loadSocialSystem";
import { resolveViewerContext } from "@/app/lib/philos/identity/viewerContext";
import { ABSENCE_TEXT } from "@/app/lib/philos/social/socialSystemProjection";
import { roleTouchOf } from "@/app/lib/philos/social/roleTouch";
import { buildSocialFlow } from "@/app/lib/philos/social/socialFlowStages";
import VerifiedRelationInventory from "@/app/lib/philos/shell/VerifiedRelationInventory";
import { COLOR, FS, RADIUS, TYPE } from "@/app/lib/philos/shell/designTokens";
import SocialFrame from "@/app/lib/philos/shell/SocialFrame";
import { buildSocialValueSpine } from "@/app/lib/philos/valueSystem/socialValueSpine";
import SocialChronologyPanel from "@/app/lib/philos/shell/SocialChronologyPanel";
import { buildNetworkAccounting, RELATION_CLASS } from "@/app/lib/philos/social/networkAccounting";
import { buildSocialChronology } from "@/app/lib/philos/social/socialChronology";
import { isEffectVerified } from "@/app/lib/philos/canon/effect";
import { resolvePersonFrame } from "@/app/lib/philos/person/personFrameAccessor";
import { resolvePersonContext } from "@/app/lib/philos/person/personContext";
import CanonicalSlicePanel from "@/app/hub/CanonicalSlicePanel";
import ObservationReadingPanel from "@/app/lib/philos/shell/ObservationReadingPanel";
import { projectCanonDynamics } from "@/app/lib/philos/canon/projectCanonDynamics";
import { deriveObservationReading } from "@/app/lib/philos/canon/observationReading";
import { RAW_FAMILIES, SUBVALUES } from "@/app/lib/philos/community/valueUniverse328";
import { resolveValueGroups } from "@/app/lib/philos/valueSystem/groupResolver";
import { linksByRelation } from "@/app/lib/philos/bridge/entityLink";
import { VERIFIED_STATUSES } from "@/app/lib/philos/events";
import { projectValueGroup } from "@/app/lib/philos/projectValueGroup";
import WorldGlobe, { CanonActivityPanel, RegionLayerPanel } from "./WorldGlobe";
import DayStatusStrip from "@/app/lib/philos/day/DayStatusStrip";
import { loadDaySession } from "@/app/lib/philos/day/loadDaySession";

export const metadata = { title: "Philos — Globe" };

export default async function PlanetPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // The events now arrive from the store rather than a constant, so a join
  // recorded on the value-group screen draws its node and arc here too.
  await connection();
  /* THE SHARED OPERATIONAL DAY — one projection, seven terminals. Loaded
     here rather than assembled per-page so every terminal shows the same
     day_id, the same identity pair and the same derived gate results. */
  const daySession = await loadDaySession();
  const events = await loadPhilosEvents();
  /* The sphere's nodes and arcs came from `GROUP_ID`, so every viewer's globe
     drew Roei's group. It draws the viewer's own group, or nothing — an empty
     sphere is the honest picture for someone with no memberships. */
  const globeCtx = await resolveViewerGroupView({ events });
  const { nodes, arcs } = globeCtx.context.status === "resolved"
    ? projectGlobeGraph(events, globeCtx.context.group_id)
    : { nodes: [], arcs: [] };

  // Canonical Cross-Entity Link Registry (bridge layer): the SAME registry
  // Community/Marketplace build, over the SAME real event log this route
  // already reads above — Planet's nodes are real legacy person/group ids
  // (`projectGlobeGraph`'s own `GlobeNode.id`), which is exactly the id
  // space `PERSON_MEMBER_OF_COMMUNITY` links use, so no id translation is
  // needed here. Passed to the inspector drawer only — the sphere's own
  // node population and layout (`nodes`/`arcs` above) are unchanged.

  // These six stores are INDEPENDENT of each other. They were awaited one
  // after another, so the route paid the sum of six round trips before it
  // could render — measured as ~1s to a visible canvas. Loading them together
  // pays the slowest, not the total.
  const [needGroupDeclarations, allActions, allEffects, allNeeds, allOffers] = await Promise.all([
    loadNeedGroupLinks().catch(() => []),
    loadActions().catch(() => []),
    loadEffects().catch(() => []),
    loadNeeds().catch(() => []),
    loadOffers().catch(() => []),
  ]);

  /* SCOPED AT THE BOUNDARY, before anything downstream can read them. These
     four stores are PERSON-OWNED canon; loaded whole, their distinct
     owner/subject/source set is exactly what `CanonActivityPanel` prints as
     RELATED PEOPLE — which is how `person_roei` reached User B's Globe. Fail
     closed: no viewer, no records. Same rule `projectCanonDynamics` applies to
     Observations. */
  const canonViewer = await resolveViewerContext();
  const canonScope = { subject_id: canonViewer.subject_id, person_id: canonViewer.person_id };
  const canonActions = scopeToViewer(allActions, ACTION_OWNER, canonScope);
  const canonEffects = scopeToViewer(allEffects, EFFECT_OWNER, canonScope);
  const canonNeeds = scopeToViewer(allNeeds, NEED_OWNER, canonScope);
  const canonOffers = scopeToViewer(allOffers, OFFER_OWNER, canonScope);


  // ONE authority, same as Community and World.
  const viewer = await resolveViewerContext();
  const social = await loadSocialSystem(viewer);
  const chronology = social.chronology;
  const socialObjects = social.objects;

  // Effects are loaded BEFORE the registry so EFFECT_AFFECTS_COMMUNITY can be
  // derived from (existing ACTION_AFFECTS_COMMUNITY link) + Effect.action_ref.
  // Nothing else about the load order matters; `registry` is first read far
  // below. The derivation composes existing links only — it cannot introduce
  // a community, and it inherits the Action link's provenance rather than
  // asserting REAL.
  const registry = buildDefaultLinkRegistry(
    events,
    todayIn(systemClock),
    canonEffects.map((e) => ({ effect_id: e.effect.effect_id, action_ref: e.effect.action_ref })),
    {
      needs: canonNeeds.map((n) => ({
        need_id: n.need.need_id,
        origin_group_id: n.origin_group_id,
        recorded_at: n.recorded_at,
      })),
      actions: canonActions.map((a) => ({ action_id: a.action.action_id, inputs: a.action.inputs })),
      needGroupDeclarations: needGroupDeclarations.map((d) => ({
        need_id: d.need_id, group_id: d.group_id, link_id: d.link_id, created_at: d.created_at,
      })),
    },
  );

  // Selected System Context (semantic-unity slice): resolved through the ONE
  // shared projection (`sharedContext.ts`) every surface now uses — no more
  // Globe-only resolver matching only against `arcs`. `arcs`/`nodes` above
  // stay exactly what they were: the real data this route draws the sphere
  // from, untouched by context resolution.
  const params = await searchParams;
  // STEP 1 — the ONE shared identity reference.
  const personRef = resolvePersonRef(viewer, params.subject);
  /* THE ONE semantic context — at component scope so every render branch of
     this surface uses the same result. Resolved server-side and passed into
     the client component; a client may never resolve context of its own. */
  const semanticContext = await resolveViewerContextSemantics(viewer);
  // STEP 2 — the frame this screen's readings are relative to (canon §19).
  const personContext = resolvePersonContext({ person: personRef, asOf: systemClock.now() });
  // SAME shared accessor as every other surface.
  const personFrame = await resolvePersonFrame({ subject: personRef.person_id, asOf: systemClock.now() }).catch(() => null);
  const ctxRaw = typeof params.ctx === "string" ? params.ctx : undefined;
  const selected = await resolveSharedContext(parseSystemContextRef(ctxRaw));

  // An empty projection means the log holds nothing placeable. Saying so is the
  // honest state: the previous fallback ("No world data.") described the
  // ontology files, which this route no longer reads.
  /* THE EARLY RETURN IS GONE. A viewer with no recorded relations returned
     here, before `WorldExplorer` existed further down — so the person with
     nothing of their own was the one person who could not reach the map of
     everything else. The empty-state text below is preserved and now renders
     as a NOTE inside the normal page instead of replacing it. */
  const emptyNodeNote = nodes.length === 0;


  const identityLink = await resolveShellIdentityLink();

  // LOOP 0053 — real canon Action/Effect stores for the default (no `?ctx=`)
  // Globe activity summary. Never merged into `nodes`/`arcs` (the sphere's
  // own real entity population, unchanged above) and never given a
  // coordinate — see `WorldGlobe.tsx::CanonActivityPanel`.

  // 7-terminal propagation — compact HUD strip for the latest real
  // Observation, from the SAME shared derivation every terminal uses.
  // The record has no coordinate; this is text on the HUD, never a node.
  let observationStrip: React.ReactNode = null;
  try {
    const canon = await projectCanonDynamics();
    const latest = canon.nodes
      .filter((n) => n.subject === personRef.person_id)
      .sort((a, b) => b.observed_at.localeCompare(a.observed_at))[0];
    if (latest) {
      // The ONE shared Value Group resolver — person↔group relations for
      // the REAL group, shown on the HUD strip (relations, not geography).
      const realView = (await resolveViewerGroupView({ events })).view;
      let relationsLine = "אין קבוצה תפעולית";
      if (realView && identityLink.status === "VERIFIED_SAME_PERSON") {
        const res = resolveValueGroups({
          familyMatches: [], generalValueMatches: [], baseValueMatches: [],
          groups: [{
            group_id: realView.group_id, name: realView.name, central_value: realView.central_value, provenance: "REAL",
            member_ids: realView.members.map((m) => m.person_id),
            transfers: realView.transfers.filter((t) => t.state === "completed").map((t) => ({ transfer_id: t.transfer_id, recipient: t.recipient })),
            effects: realView.impact.map((i) => ({ id: i.impact_id, verified: i.verified })),
            tension_ids: [],
            bridge_action_ids: linksByRelation(registry, "ACTION_AFFECTS_COMMUNITY")
              .filter((l) => l.target.canonical_id === realView.group_id).map((l) => l.source.canonical_id),
            bridge_effect_ids: [],
          }],
          viewer: { linked: true, community_member_id: identityLink.community_member_id },
        });
        const rels = res.groups[0]?.subject_relations.map((r) => r.relation_type) ?? [];
        relationsLine = rels.length > 0 ? `${realView.name}: ${rels.join(" · ")} (${res.groups[0].subject_state})` : `${realView.name}: אין קשר אמיתי`;
      }
      const reading = deriveObservationReading(latest, { subvalues: SUBVALUES, families: RAW_FAMILIES });
      const valueLabel = reading.general_value?.matched_family
        ? `ערך: "${reading.general_value.claimed_phrase}" → ${reading.general_value.matched_family.family_id} ${reading.general_value.matched_family.name_he}`
        : reading.general_value
          ? `ערך: "${reading.general_value.claimed_phrase}" — ללא התאמה ביקום הערכים`
          : "לא הוצהר ערך בתצפית";
      // Explicit keys are required here, not optional style: this JSX is
      // built in a Server Component and handed to the CLIENT `WorldGlobe` as
      // the `observationStrip` prop. Crossing that boundary serializes these
      // sibling elements as an array, so React demands keys — the exact
      // `app/planet/page.tsx (158:9)` warning this route carried.
      observationStrip = (
        <div key="observation-strip" style={{ marginBottom: 6, padding: "7px 10px", borderRadius: 10, border: "1px solid rgba(167,139,250,0.35)", background: "rgba(11,15,26,0.85)", fontSize: 13, color: "#cfe0f5", lineHeight: 1.6 }}>
          <div key="obs1" style={{ fontWeight: 800, color: "#a78bfa", fontSize: FS.tag, letterSpacing: 0.8 }}>תצפית אחרונה · LATEST OBSERVATION (CANON)</div>
          <div key="obs2" style={{ direction: "ltr", textAlign: "right", fontFamily: "ui-monospace, monospace", fontSize: FS.tag }}>{latest.canon_event_id.slice(0, 14)}… · {latest.domain}/{latest.frame} · {latest.observed_at.slice(0, 10)}</div>
          <div key="obs3">{valueLabel}</div>
          <div key="obs4" style={{ color: "#6fe3b4" }}>אדם↔קבוצה · PERSON↔GROUP (לא קשור לתצפית): {relationsLine}</div>
          <div key="obs5" style={{ color: "#8fa3c9" }}>טופולוגיה אמיתית · TOPOLOGY: {nodes.length} nodes · {arcs.length} arcs מאירועים אמיתיים — שכבת קשרים בלבד, ללא גיאוגרפיה מומצאת</div>
          <div key="obs6" style={{ color: "#8798b8" }}>תצפית↔קבוצה · OBSERVATION↔GROUP: UNRESOLVED אלא אם קיים join ערכי אמיתי — ראה הפאנל המלא</div>
          <div key="obs7" style={{ color: "#8798b8", fontStyle: "italic" }}>ערך התצפית מול קבוצות: UNRESOLVED אלא אם קיים join אמיתי — ראה הפאנל המלא. אין קואורדינטה — לא מצויר על הגלובוס.</div>
        </div>
      );
    }
  } catch {
    observationStrip = null;
  }

  // Hoisted out of the JSX so the SHARED audit lane and the globe props read
  // the same objects. Computed inline they were two evaluations of the same
  // thing, which is exactly the pattern that produced the stale counters.
  // Presentation filter, applied AFTER gating: the SOCIAL class is what this
  // surface is about. Spatial/context and marketplace links were gated and
  // counted; they are simply not listed here.
  const bridgeRows = registry
    .filter((l) => RELATION_CLASS[l.relation] === "SOCIAL")
    .map((l) => ({
      relation: l.relation,
      link_id: l.link_id,
      provenance: l.provenance,
      derived: l.relation === "EFFECT_AFFECTS_COMMUNITY",
    }));

  // ALL EntityLink types go through the gate. The previous code filtered to
  // three relation types BEFORE gating, so 7 real links were never evaluated
  // and the inventory claimed a completeness it did not have. Presentation may
  // filter; truth accounting may not.
  const accounting = buildNetworkAccounting(registry, arcs);
  const gateReport = {
    candidates: accounting.gate.candidates,
    passed: accounting.gate.passed.length,
    rejected: accounting.gate.rejected.length,
    real: accounting.totals.real_relations,
    derived: accounting.totals.derived_relations,
    demo: accounting.totals.demo_relations,
    verified: accounting.gate.byStatus.VERIFIED,
    claimed: accounting.gate.byStatus.CLAIMED,
    unknown: accounting.gate.byStatus.UNKNOWN,
    reasons: Object.entries(accounting.gate.byReason).map(([reason, count]) => ({ reason, count })),
  };

  /* SHARED PRIMARY CONTEXT — the SAME builder GROUP and SYSTEM call, with the
     same inputs from the same loader. Globe supplies only its title, the arcs
     IT draws, and its audit node. The hand-rolled `socialSelection` object
     below stays because `WorldGlobe` still resolves it against real geometry
     (that is a NETWORK-only question), but it is no longer the source of the
     OBJECT / STATUS / ROLES / PROVENANCE readout — the stage is, identically
     to the other two scales. */
  /* THE THREE PANELS BELOW WERE BEING BUILT AND THROWN AWAY.
     They lived in `buildSocialPrimaryContext({ audit: … })`, and when the
     shared stage stopped being rendered on this route the context object kept
     being constructed — so `CanonActivityPanel`, `RegionLayerPanel` and
     `VerifiedRelationInventory` were computed on every request and mounted
     nowhere. That is content loss with no diff to point at, which is the worst
     kind. They are rendered directly now, and the dead context builder is
     gone. Each is UNIQUE to Globe: canon activity at network scale, the
     bridge's region layer, and the network truth gate. */
  const networkAudit = (
    <>
      <VerifiedRelationInventory arcs={arcs} bridgeLinks={bridgeRows} gate={gateReport} />
      <div style={{ marginTop: 8 }}>
        <CanonActivityPanel canonActions={canonActions} canonEffects={canonEffects}
                            canonNeeds={canonNeeds} canonOffers={canonOffers} />
      </div>
      <div style={{ marginTop: 8 }}>
        <RegionLayerPanel registry={registry} />
      </div>
      {personFrame ? (
        <div style={{ marginTop: 8 }}><PersonFrameStrip frame={personFrame} compact /></div>
      ) : null}
    </>
  );

  /* The world view: 177 reference countries, the resolved-geography model,
     four statistical levels and the search index. Server-side because it reads
     the reference dataset and the registry; the polygons themselves are
     fetched by the client from /public so they never enter this render. */
  const world = await loadWorldView({ requestedGroup: params[SELECTED_GROUP_PARAM] });

  /* THE SHARED CROSS-TERMINAL OBJECT — same function, same stores, same result
     as Community and World. Both already-loaded inputs are handed over, so the
     group is joined by id once and no store is read twice on this route. */
  const entity = await loadSelectedEntity({ social, operational: world.group.operational });
  const selectedEntity = entity?.projection ?? null;


  /* TWO WEBGL GLOBES ON ONE PAGE FIGHT. `WorldGlobe` already owns a
     react-globe.gl instance inside its own scene container; mounting the
     explorer's globe as a slot INSIDE it left one canvas alive and the other
     black. The explorer is a SIBLING above it instead — its own container, its
     own instance, no shared scene. */
  /* /planet IS the geographic World Explorer now: app shell, then one
     surface. The header, KPI rail and audit drawer live INSIDE the explorer
     so the page is a single composition rather than a stack of sections. */
  /* ── TIERED COMPOSITION ────────────────────────────────────────────────
     GLOBE'S PRIMARY IS ONE WORKSPACE WITH TWO VIEWS OF THE SAME QUESTION.
     "Where is this entity, and what relationships matter" has a relational
     answer and a spatial answer, and they were stacked: the network map at
     y=222 and the sphere at y=822, so the terminal's namesake view never
     appeared above the fold and 722px of near-empty canvas (measured
     information density 0.07) sat under a dense one. Side by side they stop
     competing — the reader sees both at once and reads them as one place
     rather than two screens. Neither is demoted and neither is hidden: the
     globe keeps its full explorer, controls and drawer. */
  const secondary: TerminalSection[] = [
    {
      id: "network-audit",
      title: "שער אמת רשתי · פעילות קנונית · שכבת מרחב · מסגרת אדם",
      summary: "NETWORK AUDIT — קשרים מאומתים, כיסוי הרזולבר ומסגרת האדם",
      children: (
        <div style={{ position: "relative" }}>{networkAudit}</div>
      ),
    },
  ];

  return (
    <TerminalPage
      background="#0a0e17"
      nav={
        <><SystemShell
                  signOut={<SignOutButton />}
                  viewerContext={semanticContext}
                  surface="globe"
                  selectedGroup={selectedEntity?.groupId}
                  dense
                  purpose="מפת הערכים, הקבוצות והגאוגרפיה של PHILOS."
                  subject={personRef.person_id}
                  identityLink={identityLink}
                /><PersonEventOrientationHeader terminal="planet" /><DayStatusStrip session={daySession} /></>
      }
      entity={selectedEntity ? (
        <UnifiedEntitySurface projection={entity!.projection} trace={entity!.trace} compact />
      ) : undefined}
      primary={
        <div style={{
          display: "grid",
          /* The spatial view gets marginally the larger share — a sphere needs
             the room to read as one; the relational view is a fixed-height
             diagram and does not. Both columns are `minmax(0, …)` so neither
             can be pushed past the viewport by its own content. */
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.08fr)",
          gap: 12, alignItems: "start",
        }}>
          <NetworkPositionMap
                    nodes={nodes}
                    arcs={arcs}
                    centerId={selectedEntity?.groupId ?? null}
                    reach={{
                      countriesWithPresence: world.global.countries_with_presence,
                      totalCountries: world.global.countries_in_reference,
                      groupsLocated: world.global.groups,
                      membersLocated: world.global.members,
                      plottable: world.global.groups_plottable,
                      precision: selectedEntity?.location.precision ?? null,
                      countryName: selectedEntity?.location.country_name ?? null,
                    }}
                  />
          <WorldExplorer
                    global={world.global}
                    byContinent={world.byContinent}
                    byCountry={world.byCountry}
                    searchIndex={world.search}
                    resolver={world.resolverCoverage}
                    initialGroup={world.group.selected.status === "selected" ? world.group.selected.group_id
                      : selectedEntity?.groupId ?? null}
                    /* THE RESOLVED AREA, NEVER A POINT. `selectedEntity.location` is a
                       CITY-precision DERIVED resolution with `plottable === false` — no
                       coordinate was ever recorded. The globe therefore opens on the
                       country POLYGON, and a marker is not drawn under any circumstance:
                       `country_code` is passed, latitude/longitude are not, and there is
                       no path from here to one. */
                    initialCountry={selectedEntity && !selectedEntity.plottable
                      ? selectedEntity.location.country_code ?? null : null}
                    emptyNodeNote={emptyNodeNote}
                    groups={world.located.map((g) => ({
                      group_id: g.entry.group.group_id,
                      name: g.entry.group.name,
                      provenance: g.entry.group.provenance,
                      mine: (world.group.overlay.relationOf(g.entry.group.group_id) ?? "NONE") !== "NONE",
                      members: g.state && g.state.channels.members === "MEASURED"
                        ? g.state.members.filter((m) => m.active).length
                        : g.entry.group.members.length,
                      precision: g.geo.precision,
                      raw_label: g.geo.raw_label,
                      country_code: g.geo.country_code,
                      country_name: g.geo.country_name,
                      continent: g.geo.continent,
                      resolver: g.geo.resolver,
                      confidence: g.geo.confidence,
                      because: g.geo.because,
                    }))}
                  />
        </div>
      }
      secondary={secondary}
    />
  );
}
