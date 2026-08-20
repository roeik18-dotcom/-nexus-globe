import { resolveViewerContext } from "@/app/lib/philos/identity/viewerContext";
import { resolveViewerContextSemantics } from "@/app/lib/philos/context/resolveViewerContextSemantics";
import SignOutButton from "@/app/signin/SignOutButton";
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
import { GROUP_ID as COMMUNITY_GROUP_ID } from "@/app/lib/philos/valueGroupLog";
import { DEMO_COMMUNITIES } from "@/app/lib/philos/demoCommunities";
import CanonicalSlicePanel from "@/app/hub/CanonicalSlicePanel";
import { resolveValueGroups } from "@/app/lib/philos/valueSystem/groupResolver";
import { buildDefaultLinkRegistry } from "@/app/lib/philos/bridge/linkRegistry";
import { linksByRelation } from "@/app/lib/philos/bridge/entityLink";
import { buildCommunityTensions, sortTensions } from "@/app/lib/philos/tension";

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
  const personRef = resolvePersonRef(await resolveViewerContext(), params.subject);
  /* THE ONE semantic context — hoisted to the component scope so BOTH render
     branches use the same result rather than one branch resolving its own. */
  const semanticContext = await resolveViewerContextSemantics(await resolveViewerContext());
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

  // Marketplace visual checkpoint — `?view=prototype` renders a card/
  // connector layout over the SAME real Need/Offer records already
  // loaded above (scoped to personRef.person_id, same filter
  // `EvaluateMatchForm`/`OpportunityCandidates` below already use). No
  // store/lifecycle logic touched; production render below is
  // untouched when this param is absent.
  if (params.view === "prototype") {
    const myNeeds = needs.filter((n) => n.need.subject === personRef.person_id)
      .map((n) => ({ need_id: n.need.need_id, desired_change: n.need.desired_change, domain: n.need.scope.kind === "domain" ? n.need.scope.domain : "—", subject: n.need.subject }));
    const myOffers = offers.filter((o) => o.offer.source === personRef.person_id)
      .map((o) => ({ offer_id: o.offer.offer_id, available_resource: o.offer.available_resource, resource_type: o.offer.resource_type, amount_or_capacity: o.offer.amount_or_capacity, source: o.offer.source }));
  return (
      <MarketplacePrototype
        needs={myNeeds} offers={myOffers} actionsCount={actions.length} effectsCount={effects.length}
        identityLinked={identityLink.status === "VERIFIED_SAME_PERSON"}
        realGroupName={philosGroupsRealView?.name}
        realGroupCentralValue={philosGroupsRealView?.central_value}
      />
    );
  }

  return (
    // One page-level surface: the blocks below each paint their own
    // background, so the area under the last one fell through to the white
    // body. Same fix Hub already carries.
    <div style={{ background: "#0b0f1a", minHeight: "100vh" }}>
      <div style={{ padding: "20px 20px 0", background: "#0b0f1a" }}>
        <SystemShell
          signOut={<SignOutButton />}
          viewerContext={semanticContext}
          surface="marketplace"
          purpose="מה אני צריך? מי יכול לעזור? למה אפשר או אי אפשר לפעול כרגע?"
          selected={selected}
          subject={personRef.person_id}
          identityLink={identityLink}
        />
      </div>

      {/* PRIMARY — real PHILOS canonical graph (Marketplace Legacy
          Convergence pass). Leads every normal visit, `?ctx=` or not. */}
      {personFrame ? <PersonFrameStrip frame={personFrame} compact /> : null}
      <RealMarketplace
        needs={needs} offers={offers} actions={actions} effects={effects} identityLink={identityLink}
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
          needs={needs.filter((n) => n.need.subject === personRef.person_id)}
          offers={offers.filter((o) => o.offer.source === personRef.person_id)}
        />
      </div>

      {/* LOOP 4/5 + Match→Action integrity gate — `MatchActionFlow` composes
          the SAME real EvaluateMatchForm/CreateActionForm, now sharing the
          real MatchPermit a permitted evaluation returns. Options are
          scoped to personRef.person_id only — never every subject in the
          store — since this judges a specific person's own match. */}
      <MatchActionFlow
        needOptions={needs
          .filter((n) => n.need.subject === personRef.person_id)
          .map((n) => ({ need_id: n.need.need_id, label: `${n.need.desired_change} (${n.need.need_id.slice(0, 8)}…)` }))}
        offerOptions={offers
          .filter((o) => o.offer.source === personRef.person_id)
          .map((o) => ({ offer_id: o.offer.offer_id, label: `${o.offer.available_resource} (${o.offer.offer_id.slice(0, 8)}…)` }))}
        inputOptions={[
          ...needs
            .filter((n) => n.need.subject === personRef.person_id)
            .map((n) => ({ id: n.need.need_id, label: `need: ${n.need.desired_change}` })),
          ...offers
            .filter((o) => o.offer.source === personRef.person_id)
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

      {/* DEMO — the existing, already-labeled compost lifecycle. Explicit
          secondary section, never primary. */}
      <div dir="rtl" style={{ margin: "8px 20px 0" }}>
        <div style={{ fontSize: 9.5, letterSpacing: 1, color: "#5a76a3", marginBottom: 5 }}>דוגמה · DEMO FLOW</div>
      </div>
      <DemoMarketplaceFlow />

      {/* LEGACY / AUDIT — the PUDM/Fashion catalog, collapsed always
          (never primary regardless of `?ctx=`), plus the classification
          note above. */}
      <div dir="rtl" style={{ padding: "0 20px 24px" }}>
        {missions.length === 0 ? (
          <div style={{ fontSize: 11, color: "#5a76a3" }}>No PUDM/legacy mission data on disk.</div>
        ) : (
          <details>
            <summary style={{ cursor: "pointer", fontSize: 10, letterSpacing: 1.5, color: "#5a76a3" }}>
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
    </div>
  );
}
