import { mayReadSubject, resolveViewerContext } from "@/app/lib/philos/identity/viewerContext";
import SurfaceEmptyState from "@/app/lib/philos/shell/SurfaceEmptyState";
import MarketMatchView from "./MarketMatchView";
import GroupSpineMarket from "./GroupSpineMarket";
import { loadValueGroupWorld } from "@/app/lib/philos/community/loadValueGroupWorld";
import { resolveViewerContextSemantics } from "@/app/lib/philos/context/resolveViewerContextSemantics";
import SignOutButton from "@/app/signin/SignOutButton";
import EntityChainFlow from "@/app/lib/philos/crossTerminal/EntityChainFlow";
import UnifiedEntitySurface from "@/app/lib/philos/crossTerminal/UnifiedEntitySurface";
import OperationalTraceFlow from "@/app/lib/philos/crossTerminal/OperationalTraceFlow";
import { loadSelectedEntity } from "@/app/lib/philos/crossTerminal/loadSelectedEntity";
import { buildViewerLinkRegistry } from "@/app/lib/philos/bridge/viewerLinkRegistry";
import { resolveViewerGroupView } from "@/app/lib/philos/community/viewerGroupView";
import path from "path";
import { readJsonStore } from "@/app/lib/json-store";
import type { Mission } from "@/app/lib/mission/schema";
import type { Gap } from "@/app/lib/gap/schema";
import type { Value } from "@/app/lib/value/schema";
import type { Capability } from "@/app/lib/capability/schema";
import type { ValueCapabilityRelation } from "@/app/lib/value-capability-relation/schema";
import type { Provider } from "@/app/lib/provider/schema";
import type { ProviderCapabilityRelation } from "@/app/lib/provider-capability-relation/schema";
import MarketplaceView from "./MarketplaceView";
import MarketplacePrototype from "./MarketplacePrototype";
import ActionSpacePanel from "./ActionSpacePanel";
import DemoMarketplaceFlow from "./DemoMarketplaceFlow";
import RealMarketplace from "./RealMarketplace";
import { findKnownResource, resolveSelectedContext, VALUE_DIMENSIONS } from "./resolveActionSpace";
import { parseSystemContextRef } from "@/app/lib/systemContext";
import { SystemShell } from "@/app/lib/philos/shell/SystemShell";
import DemoSimulationSection from "@/app/lib/philos/analysis/DemoSimulationSection";
import RealDataGapPanel, { factFromCount } from "@/app/lib/philos/day/RealDataGapPanel";
import { selectRealUnitReadings } from "@/app/lib/philos/analysis/realUnitReadings";
import { AuditHeading, AuditSection } from "@/app/lib/philos/shell/epistemics";
import { resolveShellIdentityLink } from "@/app/lib/philos/community/resolveShellIdentityLink";
import { loadNeeds } from "@/app/lib/philos/canon/needStoreAccessor";
import { loadOffers } from "@/app/lib/philos/canon/offerStoreAccessor";
import { loadActions } from "@/app/lib/philos/canon/actionStoreAccessor";
import { loadEffects } from "@/app/lib/philos/canon/effectStoreAccessor";
import { loadCanonEvents } from "@/app/lib/philos/canon/canonEventStoreAccessor";
import { resolvePersonRef } from "@/app/lib/philos/person/personRef";
import PersonFrameStrip from "@/app/lib/philos/shell/PersonFrameStrip";
import { resolvePersonFrame } from "@/app/lib/philos/person/personFrameAccessor";
import { resolvePersonContext } from "@/app/lib/philos/person/personContext";
import MatchActionFlow from "./MatchActionFlow";
import OpportunityCandidates from "./OpportunityCandidates";
import CreateEffectForm from "@/app/hub/CreateEffectForm";
import CreateLearningForm from "@/app/hub/CreateLearningForm";
import { loadPhilosEvents } from "@/app/lib/philos-event-store";
import { systemClock, todayIn } from "@/app/lib/philos/eventStore";
import { projectValueGroup, type ValueGroupView } from "@/app/lib/philos/projectValueGroup";
import { DEMO_COMMUNITIES } from "@/app/lib/philos/demoCommunities";
import CanonicalSlicePanel from "@/app/hub/CanonicalSlicePanel";
import { resolveValueGroups } from "@/app/lib/philos/valueSystem/groupResolver";
import { buildDefaultLinkRegistry } from "@/app/lib/philos/bridge/linkRegistry";
import { linksByRelation } from "@/app/lib/philos/bridge/entityLink";
import { buildCommunityTensions, sortTensions } from "@/app/lib/philos/tension";
import DayStatusStrip from "@/app/lib/philos/day/DayStatusStrip";
import { loadDaySession } from "@/app/lib/philos/day/loadDaySession";

export const metadata = { title: "Marketplace — Philos" };

const DATA = path.join(process.cwd(), "data");

/**
 * PUDM_CLASSIFICATION (Marketplace Legacy Convergence pass, real audit —
 * see ledger for the full writeup). Nothing in `data/*.json` is deleted;
 * this is a real, checked reclassification of what it IS, not a rewrite
 * of the files themselves:
 *
 *   missions.json / gaps.json           → LEGACY — real PUDM Candidate-
 *     grade node data (couples therapy, scholarship funding, small-
 *     business financing, municipality safety, NGO volunteers, a fashion
 *     brand), structurally disconnected from any real PHILOS Person/Need
 *     (`resolveActionSpace.ts`'s own audited finding: no subject-scoping
 *     field exists on these schemas at all).
 *   values.json / capabilities.json     → MIGRATABLE — the VALUE/
 *     CAPABILITY concepts themselves are real and reusable (§36's
 *     VALUE_DOMAIN_MASTER audit already confirmed CAPABILITY is
 *     FOUND_IN_SOURCE-compatible); the 15 specific real-world example
 *     records are not migrated automatically — would require real
 *     canonical-id mapping, separate future work.
 *   providers.json (Y Combinator/Antler/Flexport/Beehiiv/Pentagram,
 *     tied to the one Fashion mission)  → UNRELATED — real companies, but
 *     anchored to a mission with no real PHILOS connection whatsoever.
 *   providers.json (Psychology Today/Open Path/SBA/SCORE/Fastweb/Going
 *     Merry/Mobileye/NACTO/VolunteerMatch/Galaxy Digital)
 *                                        → LEGACY — real, potentially
 *     reusable reference organizations for a FUTURE real Gap↔Provider
 *     bridge, not migrated this pass.
 *   value-capability-relations.json /
 *   provider-capability-relations.json  → MIGRATABLE (schema pattern) /
 *     LEGACY (the specific data) — the Relation-Entity discipline itself
 *     ("Relations own cross-references, Nodes don't", PUDM §2.2/§3.1) is
 *     exactly the pattern this pass's own `Need`/`Offer` split already
 *     follows; the recorded VCR/PCR rows stay tied to the legacy ids
 *     above.
 *
 * REAL: none of this dataset — every REAL Need/Offer/Action/Effect below
 * comes from canon's own stores, never `data/*.json`.
 */

export default async function MarketplacePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  /* THE SHARED OPERATIONAL DAY — one projection, seven terminals. Loaded
     here rather than assembled per-page so every terminal shows the same
     day_id, the same identity pair and the same derived gate results. */
  const daySession = await loadDaySession();
  const missions     = readJsonStore<Mission>                    (path.join(DATA, "missions.json"));
  const gaps         = readJsonStore<Gap>                        (path.join(DATA, "gaps.json"));
  const values       = readJsonStore<Value>                      (path.join(DATA, "values.json"));
  const capabilities = readJsonStore<Capability>                 (path.join(DATA, "capabilities.json"));
  const vcRelations  = readJsonStore<ValueCapabilityRelation>   (path.join(DATA, "value-capability-relations.json"));
  const providers    = readJsonStore<Provider>                   (path.join(DATA, "providers.json"));
  const pcRelations  = readJsonStore<ProviderCapabilityRelation>(path.join(DATA, "provider-capability-relations.json"));

  // Mission B, B6 — "WHICH GROUP NEEDS IT?": the same real central_value
  // name-join Brain's L6 (`ValueContext`) already established, reused
  // here rather than re-derived. Honest today: 0 matches for every PUDM
  // value (English labels vs Hebrew central_values) — never forced.
  const marketplacePhilosEvents = await loadPhilosEvents();
  const marketplaceToday = todayIn(systemClock);
  const philosGroupsRealView = (await resolveViewerGroupView({ events: marketplacePhilosEvents, today: marketplaceToday })).view;
  const communityDemoViews = DEMO_COMMUNITIES
    .map((c) => projectValueGroup(c.events, c.group_id, c.today))
    .filter((v): v is ValueGroupView => v !== null);
  const communityGroups: { name: string; central_value: string; status: "REAL" | "DEMO" }[] = [
    ...(philosGroupsRealView ? [{ name: philosGroupsRealView.name, central_value: philosGroupsRealView.central_value, status: "REAL" as const }] : []),
    ...communityDemoViews.map((v) => ({ name: v.name, central_value: v.central_value, status: "DEMO" as const })),
  ];
  const communityGroupsByValueId: Record<string, { group_name: string; status: "REAL" | "DEMO" }[]> = {};
  for (const v of values) {
    const matches = communityGroups.filter((g) => g.central_value === v.context.label);
    if (matches.length > 0) communityGroupsByValueId[v.id] = matches.map((g) => ({ group_name: g.name, status: g.status }));
  }

  // Action Space (Marketplace slice, additive): resolves the SAME
  // SystemContextRef Dynamics/Globe already use, against real canon/legacy
  // data, then performs a REAL (never skipped) check against the real
  // provider list. No fake offers/requests/providers are ever rendered.
  const params = await searchParams;
  // STEP 1 — the ONE shared identity reference.
  /* ONE viewer resolution for this render — the scoping below and the
     semantic context both read it, rather than each resolving their own. */
  const viewer = await resolveViewerContext();
  const personRef = resolvePersonRef(viewer, params.subject);
  /* REAL unit readings — one shared selector, never a per-page derivation. */
  const realUnitReadings = selectRealUnitReadings({
    events: await loadCanonEvents(),
    subject_id: personRef.person_id,
  });
  /* THE ONE semantic context — hoisted to the component scope so BOTH render
     branches use the same result rather than one branch resolving its own. */
  const semanticContext = await resolveViewerContextSemantics(viewer);
  // STEP 2 — the frame this screen's readings are relative to (canon §19).
  const personContext = resolvePersonContext({ person: personRef, asOf: systemClock.now() });
  // SAME shared accessor as Hub/Brain — this surface resolves no
  // frame of its own and cannot redefine Human Base / Value / Domain.
  const personFrame = await resolvePersonFrame({
    subject: personRef.person_id, asOf: systemClock.now(),
  }).catch(() => null);
  const ctxRaw = typeof params.ctx === "string" ? params.ctx : undefined;
  const selected = await resolveSelectedContext(parseSystemContextRef(ctxRaw));
  const subject = selected.status === "found" ? selected.subject : undefined;
  const knownResource = findKnownResource(subject, providers);
  const identityLink = await resolveShellIdentityLink();

  // The real PHILOS canonical spine — Need/Offer/Action/Effect, whole
  // store, never the PUDM/Fashion dataset above. Each degrades to []
  // honestly on a real store-side failure, never breaking the rest of
  // the page.
  const [needs, offers, actions, effects, canonEvents] = await Promise.all([
    loadNeeds().catch(() => []),
    loadOffers().catch(() => []),
    loadActions().catch(() => []),
    loadEffects().catch(() => []),
    loadCanonEvents().catch(() => []),
  ]);

  /* ── VIEWER SCOPING, APPLIED ONCE, BEFORE ANYTHING RENDERS ───────────
     `loadNeeds()` / `loadOffers()` / `loadActions()` / `loadEffects()` return
     EVERY subject's canon records. Individual call sites below filtered them
     — `myNeeds`, `MatchActionFlow`, `OpportunityCandidates` all do — but
     `<RealMarketplace>`, which is the primary content of this page, received
     the raw arrays. Measured with a real User B session: `person_roei` on
     screen 9 times, `אחריות קהילתית` 5 times, on a viewer who owns nothing.

     Same shape as the `loadSocialSystem` leak: scoping that is written at
     some call sites and skipped at the one that matters. It is done ONCE
     here now, and the unscoped arrays are not passed anywhere. */
  const mineNeeds = needs.filter((n) => mayReadSubject(viewer, n.need.subject));
  const mineOffers = offers.filter((o) => mayReadSubject(viewer, o.offer.source));
  const mineActions = actions.filter((a) => mayReadSubject(viewer, a.action.owner));
  const mineEffects = effects.filter((e) => mayReadSubject(viewer, e.effect.subject));

  // Marketplace visual checkpoint — `?view=prototype` renders a card/
  // connector layout over the SAME real Need/Offer records already
  // loaded above (scoped to personRef.person_id, same filter
  // `EvaluateMatchForm`/`OpportunityCandidates` below already use). No
  /* THE SAME SELECTED ENTITY, in the possibility lens. Marketplace was a
     subject-scoped surface — "my needs, my offers" — which is a different
     question from "what can this GROUP match". Both are real; only the second
     belongs to the connected system, and it is the one that was missing. */
  const entity = await loadSelectedEntity();

  // store/lifecycle logic touched; production render below is
  // untouched when this param is absent.
  if (params.view === "prototype") {
    const myNeeds = mineNeeds
      .map((n) => ({ need_id: n.need.need_id, desired_change: n.need.desired_change, domain: n.need.scope.kind === "domain" ? n.need.scope.domain : "—", subject: n.need.subject }));
    const myOffers = mineOffers
      .map((o) => ({ offer_id: o.offer.offer_id, available_resource: o.offer.available_resource, resource_type: o.offer.resource_type, amount_or_capacity: o.offer.amount_or_capacity, source: o.offer.source }));
  return (
      <>
      {/* THE DEMO SECTION IS NOT OPTIONAL ON ANY MARKETPLACE PATH, but it is
          no longer FIRST on either. This early return is the
          `?view=prototype` visual checkpoint; it is mutually exclusive with
          the default route below (that route is only reached when this guard
          does not fire), so each route mounts exactly one section — neither
          is a duplicate of the other. */}
      <MarketplacePrototype
        needs={myNeeds} offers={myOffers} actionsCount={mineActions.length} effectsCount={mineEffects.length}
        identityLinked={identityLink.status === "VERIFIED_SAME_PERSON"}
        realGroupName={philosGroupsRealView?.name}
        realGroupCentralValue={philosGroupsRealView?.central_value}
      />
      <DemoSimulationSection terminal="marketplace" />
      </>
    );
  }

  /* The group operational spine. Read-only here: Marketplace consumes the
     canonical objects, it does not re-derive what a group needs. */
  const spineWorld = await loadValueGroupWorld({ requestedGroup: undefined });
  const spineStates = [...spineWorld.operational.values()];
  const spineMarket = {
    needs: spineStates.flatMap((st) => st.needs),
    resources: spineStates.flatMap((st) => st.resources),
    candidates: [...spineWorld.candidateMatches],
    accepted: spineStates.flatMap((st) => st.matches.filter((m) => m.status === "ACCEPTED")),
    actions: spineStates.flatMap((st) => st.actions),
    groupsWithEvents: spineStates.filter((st) => st.counts.events > 0).length,
    totalGroups: spineWorld.registry.entries.length,
    // Match→authority gate (Marketplace visual-acceptance follow-up): a real
    // MATCH_PROPOSED with no decision yet, and a real MATCH_REJECTED — the
    // two states `accepted` above doesn't already cover. Same `matches` array,
    // no second derivation.
    pendingRequests: spineStates.flatMap((st) => st.matches.filter((m) => m.status === "CANDIDATE")),
    rejectedRequests: spineStates.flatMap((st) => st.matches.filter((m) => m.status === "REJECTED")),
  };

  return (
    // One page-level surface: the blocks below each paint their own
    // background, so the area under the last one fell through to the white
    // body. Same fix Hub already carries.
    <div style={{ background: "#0b0f1a", minHeight: "100vh" }}>
      <div style={{ padding: "20px 20px 0", background: "#0b0f1a" }}>
        <SystemShell
          dense
          signOut={<SignOutButton />}
          viewerContext={semanticContext}
          surface="marketplace"
          selectedGroup={entity?.projection.groupId}
          purpose="מה אני צריך? מי יכול לעזור? למה אפשר או אי אפשר לפעול כרגע?"
          selected={selected}
          subject={personRef.person_id}
          identityLink={identityLink}
        />
        <DayStatusStrip session={daySession} />
        <RealDataGapPanel session={daySession} realUnits={realUnitReadings} terminal="marketplace" facts={[
          /* Arrays this page already loaded and already renders. */
          factFromCount("Need", "findNeedsForSubject → mineNeeds", mineNeeds.length,
            "אין צורך רשום — לא נמצאה רשומה ב־needStore"),
          factFromCount("Offer", "findOffersForSource → mineOffers", mineOffers.length,
            "אין הצעה רשומה — לא נמצאה רשומה ב־offerStore"),
          factFromCount("Action", "loadActions → mineActions", mineActions.length,
            "אין פעולה רשומה — לא נמצאה רשומה ב־actionStore"),
          factFromCount("Effect", "loadEffects → mineEffects", mineEffects.length,
            "אין תוצאה רשומה — לא נמצאה רשומה ב־effectStore"),
        ]} />
      </div>

      {/* ── PRIMARY LIVING SURFACE · THE POSSIBILITY LENS ────────────────
          The operational trace first, then the shared spine with NEED /
          RESOURCE / MATCH / ACTION brought forward. Same components and same
          objects as Community, Globe and World: Marketplace is a lens on the
          selected entity, not a seventh dashboard about the viewer. */}
      {entity ? (
        <div style={{ padding: "0 20px", display: "flex", flexDirection: "column",
          gap: 10, minBlockSize: "70vh" }}>
          <OperationalTraceFlow trace={entity.trace} emphasis="marketplace"
            title="מה נדרש, מה קיים, ומה באמת ניתן להתאים"
            subtitle="כל חוליה נוקבת במנגנון הצירוף שלה — איזה שדה על איזו רשומה נושא איזה מזהה. חברוּת אינה צירוף, ודמיון בין טקסטים אינו התאמה." />
          <UnifiedEntitySurface projection={entity.projection} trace={entity.trace} />
        </div>
      ) : null}

      {/* SECONDARY — real PHILOS canonical graph (Marketplace Legacy
          Convergence pass), subject-scoped. */}
      {personFrame ? (
        /* REFERENCE FRAME, DEMOTED to the context tier on this surface.
           It is the same three cards every terminal shows, and on a surface
           whose primary content is a causal drawing it was ~200px of
           mostly-UNKNOWN chrome sitting above the thing the reader came for.
           Unchanged and one click away. */
        <details style={{ background: "rgba(0,0,0,0.2)", borderRadius: 10, padding: "6px 12px", margin: "0 20px 12px", opacity: 0.85 }}>
          <summary style={{ cursor: "pointer", fontSize: 13, letterSpacing: 1, color: "#6c86b5" }}>
            מסגרת אדם · ערך · דומיין — REFERENCE FRAME
          </summary>
          <div style={{ marginTop: 10 }}><PersonFrameStrip frame={personFrame} compact /></div>
        </details>
      ) : null}
      {/* ── PRIMARY · the match model ───────────────────────────────────
          Replaces a seven-card equal-width row for a pipeline whose point is
          asymmetry. `RealMarketplace` stays below it, unchanged, holding the
          forms and the detail; it is no longer what the surface leads with. */}
      <div dir="rtl" style={{ padding: "0 20px 24px" }}>
        {mineNeeds.length + mineOffers.length + mineActions.length === 0 ? (
          <SurfaceEmptyState
            surface="שוק"
            does="מחבר בין מה שאתה צריך למה שזמין: צורך ↔ הצעה → התאמה → פעולה → אפקט → ראיה."
            why="אין לך עדיין צורך או הצעה רשומים. התאמה נוצרת רק מהיתר של המעריך הקנוני על צמד אמיתי — קיומו של צמד אינו התאמה, ושום התאמה לא נוצרת מדמיון בין טקסטים."
            fills={[
              "צורך — מה נדרש, ובאיזה היקף",
              "הצעה — משאב שאתה יכול להעמיד",
              "הערכת התאמה — נותנת היתר לצמד מסוים",
              "פעולה שה-inputs שלה נושאים את הצמד המאושר",
            ]}
          />
        ) : (
        <MarketMatchView input={{
          needs: mineNeeds.map((n) => ({ id: n.need.need_id, text: n.need.desired_change, at: n.recorded_at })),
          offers: mineOffers.map((o) => ({ id: o.offer.offer_id, text: o.offer.available_resource, at: o.recorded_at })),
          /* A match is EXECUTED only when an Action's inputs name both a Need
             and an Offer. A pair existing is not a match, and this is the one
             place that distinction is computed. */
          executedMatches: mineActions.filter((a) =>
            a.action.inputs.some((x) => mineNeeds.some((n) => n.need.need_id === x)) &&
            a.action.inputs.some((x) => mineOffers.some((o) => o.offer.offer_id === x))).length,
          actions: mineActions.map((a) => ({ id: a.action.action_id, text: a.action.mechanism_scope, at: a.recorded_at, type: a.action.type })),
          effects: mineEffects.map((e) => ({ id: e.effect.effect_id, text: e.effect.context, at: e.recorded_at, verified: !!e.effect.verified_outcome })),
          group: philosGroupsRealView ? {
            name: philosGroupsRealView.name,
            central_value: philosGroupsRealView.central_value,
            members: philosGroupsRealView.members.length,
          } : null,
        }} />
        )}

        {/* GROUP SCALE. The chain above is the viewer's PERSONAL canon slice;
            this is the same market at group scale, read from the one
            operational projection Community reads. Two scales, one model —
            not two marketplaces. */}
        <GroupSpineMarket input={spineMarket} />
      </div>

      <RealMarketplace
        needs={mineNeeds} offers={mineOffers} actions={mineActions} effects={mineEffects} identityLink={identityLink}
        realGroup={philosGroupsRealView ? { name: philosGroupsRealView.name, central_value: philosGroupsRealView.central_value } : undefined}
        realGroupOps={philosGroupsRealView ? {
          group_id: philosGroupsRealView.group_id,
          members: philosGroupsRealView.members.length,
          verifiedEffects: philosGroupsRealView.impact.filter((i) => i.verified).length,
          bridgeActions: linksByRelation(await buildViewerLinkRegistry({ events: marketplacePhilosEvents, today: marketplaceToday }), "ACTION_AFFECTS_COMMUNITY")
            .filter((l) => l.target.canonical_id === philosGroupsRealView.group_id).length,
          opened_at: philosGroupsRealView.opened_at,
        } : undefined}
        groupRelations={await (async () => {
          // The ONE shared Value Group resolver — person-level relations
          // for the REAL operational group, projected into the flow header.
          if (!philosGroupsRealView || identityLink.status !== "VERIFIED_SAME_PERSON") return [];
          const bridge = await buildViewerLinkRegistry({ events: marketplacePhilosEvents, today: marketplaceToday });
          const res = resolveValueGroups({
            familyMatches: [], generalValueMatches: [], baseValueMatches: [],
            groups: [{
              group_id: philosGroupsRealView.group_id,
              name: philosGroupsRealView.name,
              central_value: philosGroupsRealView.central_value,
              provenance: "REAL",
              member_ids: philosGroupsRealView.members.map((m) => m.person_id),
              transfers: philosGroupsRealView.transfers.filter((t) => t.state === "completed").map((t) => ({ transfer_id: t.transfer_id, recipient: t.recipient })),
              effects: philosGroupsRealView.impact.map((i) => ({ id: i.impact_id, verified: i.verified })),
              tension_ids: sortTensions(buildCommunityTensions(philosGroupsRealView, "REAL")).map((t) => t.id),
              bridge_action_ids: linksByRelation(bridge, "ACTION_AFFECTS_COMMUNITY")
                .filter((l) => l.target.canonical_id === philosGroupsRealView.group_id).map((l) => l.source.canonical_id),
              bridge_effect_ids: linksByRelation(bridge, "EFFECT_AFFECTS_PERSON")
                .filter((l) => l.target.canonical_id === identityLink.community_member_id).map((l) => l.source.canonical_id),
            }],
            viewer: { linked: true, community_member_id: identityLink.community_member_id },
          });
          return res.groups[0]?.subject_relations.map((r) => `${r.relation_type} (${r.provenance})`) ?? [];
        })()}
      />

      {/* BATCH 11 — Opportunity Engine, smallest honest slice: every real
          (Need, Offer) pair for person_roei, surfaced so the match
          evaluator below is discoverable without already knowing which
          pair to pick. */}
      <div dir="rtl" style={{ padding: "0 20px" }}>
        <OpportunityCandidates
          needs={mineNeeds}
          offers={mineOffers}
        />
      </div>

      {/* LOOP 4/5 + Match→Action integrity gate — `MatchActionFlow` composes
          the SAME real EvaluateMatchForm/CreateActionForm, now sharing the
          real MatchPermit a permitted evaluation returns. Options are
          scoped to personRef.person_id only — never every subject in the
          store — since this judges a specific person's own match. */}
      <MatchActionFlow
        dayRef={daySession.opened_at.value !== null ? daySession.day_id : undefined}
        actingSubject={viewer.subject_id}
        needOptions={mineNeeds
          .map((n) => ({ need_id: n.need.need_id, label: `${n.need.desired_change} (${n.need.need_id.slice(0, 8)}…)` }))}
        offerOptions={mineOffers
          .map((o) => ({ offer_id: o.offer.offer_id, label: `${o.offer.available_resource} (${o.offer.offer_id.slice(0, 8)}…)` }))}
        inputOptions={[
          ...mineNeeds
            .map((n) => ({ id: n.need.need_id, label: `need: ${n.need.desired_change}` })),
          ...mineOffers
            .map((o) => ({ id: o.offer.offer_id, label: `offer: ${o.offer.available_resource}` })),
          // FORWARD LINKAGE: real Observations are offered as Action inputs.
          //
          // `Action.inputs` is a free-form id array that already accepts a
          // `canon_event_id`, and `CausalChainFlow` already resolves the
          // causal chain by reading one out of it. The only reason the
          // historical Action carries none is that this list never offered
          // an Observation to select — the field and its consumer both
          // existed, the choice did not.
          //
          // Offered, never inferred: the person picks the Observation their
          // Action actually came from. Nothing here selects one by recency,
          // and an Action with no originating Observation simply carries
          // none — which is why the historical record stays UNLINKED.
          ...canonEvents
            .filter((ev) => ev.canon_type === "observation" && ev.payload.subject === personRef.person_id)
            .map((ev) => ({
              id: ev.canon_event_id,
              label: `observation: ${ev.payload.domain}/${ev.payload.frame} · level ${ev.payload.level} · ${ev.payload.time.slice(0, 10)}`,
            })),
        ]}
      />

      {/* LOOP 6 — real Effect and Learning creation for person_roei. Every
          option list is scoped to personRef.person_id's own real records. */}
      <div dir="rtl" style={{ padding: "0 20px" }}>
        <CreateEffectForm
          observationOptions={canonEvents
            .filter((ev) => ev.canon_type === "observation" && ev.payload.subject === personRef.person_id)
            .map((ev) => ({ canon_event_id: ev.canon_event_id, label: `${ev.payload.domain}/${ev.payload.frame} · level ${ev.payload.level} · ${ev.payload.time.slice(0, 10)}` }))}
          actionOptions={actions
            .filter((a) => a.action.owner === personRef.person_id)
            .map((a) => ({ action_id: a.action.action_id, label: `${a.action.type} · ${a.action.reversibility} (${a.action.action_id.slice(0, 8)}…)` }))}
        />
        <CreateLearningForm
          effectOptions={effects
            .filter((e) => e.effect.subject === personRef.person_id)
            .map((e) => ({ effect_id: e.effect.effect_id, label: `${e.effect.claimed_outcome.statement} (${e.effect.effect_id.slice(0, 8)}…)` }))}
          observationOptions={canonEvents
            .filter((ev) => ev.canon_type === "observation" && ev.payload.subject === personRef.person_id)
            .map((ev) => ({ canon_event_id: ev.canon_event_id, label: `${ev.payload.domain}/${ev.payload.frame} · level ${ev.payload.level} (${ev.canon_event_id.slice(0, 8)}…)` }))}
        />
      </div>

      {selected.status === "found" ? <ActionSpacePanel selected={selected} knownResource={knownResource} valueDimensions={VALUE_DIMENSIONS} /> : null}

      {/* Phase 6A — the SAME shared Person/Value runtime state Hub/
          Dynamics/Brain/Community already render (`CanonicalSlicePanel`,
          unmodified). Real canon Action/Effect/Evidence for
          personRef.person_id already lead this page above
          (`RealMarketplace`/`MatchActionFlow`/`CreateEffectForm`); this adds
          the Phase 4 Human/Music/Color source_refs + current_state/history/
          evidence layer. Collapsed — not primary flow content. */}
      {/* STEP 5/6 — Marketplace's PRIMARY is the Need→Offer→Match→Action→
          Effect→Evidence flow above. Shared person/value state is audit. */}
      <div dir="rtl" style={{ margin: "8px 20px 0" }}>
        <AuditHeading accent="#fb923c" />
        <AuditSection title="מצב אדם / ערך · PERSON / VALUE STATE" note="Phase 4 · CANON — זהה לכל שאר המסופים">
          <CanonicalSlicePanel subject={personRef.person_id} asOf={systemClock.now()} />
        </AuditSection>
      </div>

      {/* DEMO — the existing, already-labeled compost lifecycle. It carried a
          DEMO badge and a caption, but rendered OPEN, so `/marketplace` was
          the one default route still painting DEMO strings
          ("[DEMO] קרן חדשנות ירוקה") without a disclosure. Collapsing it is a
          presentation change only: the component, its data and its selectors
          are untouched. */}
      <div dir="rtl" style={{ margin: "8px 20px 0" }}>
        <details>
          <summary style={{ fontSize: 12, letterSpacing: 1, color: "#6c86b5", marginBottom: 5, cursor: "pointer" }}>
            דוגמה · DEMO FLOW — כלי בדיקה, אינו נתון המשתמש
          </summary>
          <DemoMarketplaceFlow />
        </details>
      </div>

      {/* LEGACY / AUDIT — the PUDM/Fashion catalog, collapsed always
          (never primary regardless of `?ctx=`), plus the classification
          note above. */}
      <div dir="rtl" style={{ padding: "0 20px 24px" }}>
        {missions.length === 0 ? (
          <div style={{ fontSize: 13, color: "#6c86b5" }}>No PUDM/legacy mission data on disk.</div>
        ) : (
          <details>
            <summary style={{ cursor: "pointer", fontSize: 12, letterSpacing: 1.5, color: "#6c86b5" }}>
              LEGACY / AUDIT — קטלוג PUDM (משימות / פערים / יכולות / ספקים, ראה סיווג מלא בקוד הדף)
            </summary>
            <div style={{ marginTop: 10 }}>
              <MarketplaceView
                missions={missions}
                gaps={gaps}
                values={values}
                capabilities={capabilities}
                providers={providers}
                vcRelations={vcRelations}
                pcRelations={pcRelations}
                communityGroupsByValueId={communityGroupsByValueId}
              />
            </div>
          </details>
        )}
      </div>
      {/* Below all REAL marketplace content, collapsed. The prototype route
          above mounts its own; the two routes are mutually exclusive. */}
      <div style={{ padding: "0 20px 20px" }}>
        <DemoSimulationSection terminal="marketplace" />
      </div>
    </div>
  );
}
