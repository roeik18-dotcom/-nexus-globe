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

import { connection } from "next/server";

import { projectGlobeGraph } from "@/app/lib/philos/projectGlobeGraph";
import { GROUP_ID } from "@/app/lib/philos/valueGroupLog";
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
import { projectSocialSystem } from "@/app/lib/philos/social/socialSystemProjection";
import { resolveSocialSelection } from "@/app/lib/philos/social/socialSelection";
import { ABSENCE_TEXT } from "@/app/lib/philos/social/socialSystemProjection";
import { roleTouchOf } from "@/app/lib/philos/social/roleTouch";
import SocialFrame from "@/app/lib/philos/shell/SocialFrame";
import { buildSocialValueSpine } from "@/app/lib/philos/valueSystem/socialValueSpine";
import SocialChronologyPanel from "@/app/lib/philos/shell/SocialChronologyPanel";
import { runNetworkTruthGate, type EdgeCandidate } from "@/app/lib/philos/social/networkTruthGate";
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
import WorldGlobe from "./WorldGlobe";

export const metadata = { title: "Philos — Globe" };

export default async function PlanetPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // The events now arrive from the store rather than a constant, so a join
  // recorded on the value-group screen draws its node and arc here too.
  await connection();
  const events = await loadPhilosEvents();
  const { nodes, arcs } = projectGlobeGraph(events, GROUP_ID);

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
  const [needGroupDeclarations, canonActions, canonEffects, canonNeeds, canonOffers] = await Promise.all([
    loadNeedGroupLinks().catch(() => []),
    loadActions().catch(() => []),
    loadEffects().catch(() => []),
    loadNeeds().catch(() => []),
    loadOffers().catch(() => []),
  ]);

  // The chronology is built from the records ALREADY loaded above rather than
  // by `loadSocialChronology()`, which would re-read needs, offers, actions
  // and effects a second time. Same projection, same result, four fewer store
  // reads per request.
  const chronology = buildSocialChronology({
    events,
    needs: canonNeeds.map((n) => ({
      need_id: n.need.need_id, desired_change: n.need.desired_change,
      recorded_at: n.recorded_at, origin_group_id: n.origin_group_id,
    })),
    offers: canonOffers.map((o) => ({
      offer_id: o.offer.offer_id, available_resource: o.offer.available_resource, recorded_at: o.recorded_at,
    })),
    actions: canonActions.map((a) => ({
      action_id: a.action.action_id, inputs: a.action.inputs, recorded_at: a.recorded_at,
    })),
    effects: canonEffects.map((e) => ({
      effect_id: e.effect.effect_id, action_ref: e.effect.action_ref,
      verified: isEffectVerified(e.effect), recorded_at: e.recorded_at,
    })),
    observations: [],
  });

  const socialObjects = projectSocialSystem({
    chronology,
    needGroups: new Map(needGroupDeclarations.map((d) => [d.need_id, d.group_id] as const)),
  });

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
  const personRef = resolvePersonRef(params.subject);
  // STEP 2 — the frame this screen's readings are relative to (canon §19).
  const personContext = resolvePersonContext({ person: personRef, asOf: systemClock.now() });
  // SAME shared accessor as every other surface.
  const personFrame = await resolvePersonFrame({ subject: personRef.person_id, asOf: systemClock.now() }).catch(() => null);
  const ctxRaw = typeof params.ctx === "string" ? params.ctx : undefined;
  const selected = await resolveSharedContext(parseSystemContextRef(ctxRaw));

  // An empty projection means the log holds nothing placeable. Saying so is the
  // honest state: the previous fallback ("No world data.") described the
  // ontology files, which this route no longer reads.
  if (nodes.length === 0) {
    return (
      <div style={{ padding: 40, fontFamily: "system-ui" }}>
        No event-backed entities to draw.
      </div>
    );
  }

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
      const realView = projectValueGroup(events, GROUP_ID, todayIn(systemClock));
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
        <div key="observation-strip" style={{ marginBottom: 6, padding: "7px 10px", borderRadius: 10, border: "1px solid rgba(167,139,250,0.35)", background: "rgba(11,15,26,0.85)", fontSize: 10.5, color: "#cfe0f5", lineHeight: 1.6 }}>
          <div key="obs1" style={{ fontWeight: 800, color: "#a78bfa", fontSize: 9.5, letterSpacing: 0.8 }}>תצפית אחרונה · LATEST OBSERVATION (CANON)</div>
          <div key="obs2" style={{ direction: "ltr", textAlign: "right", fontFamily: "ui-monospace, monospace", fontSize: 9 }}>{latest.canon_event_id.slice(0, 14)}… · {latest.domain}/{latest.frame} · {latest.observed_at.slice(0, 10)}</div>
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

  return (
    <WorldGlobe
      nodes={nodes}
      arcs={arcs}
      selected={selected}
      registry={registry}
      gate={(() => {
        // EVERY candidate edge — drawn arcs and bridge links alike — is run
        // through the gate. Nothing reaches the sphere on the strength of
        // "it was already there".
        const candidates: EdgeCandidate[] = [
          ...arcs.map((a) => ({
            from_entity_id: a.source_id,
            to_entity_id: a.target_id,
            relation_type: a.relation,
            source_record_id: a.event_id,
            provenance: "REAL" as const,
            // Status is read from the record, never assumed. VERIFIED_STATUSES
            // is the codebase's own definition of verified.
            epistemic_status: (a.verification_status && VERIFIED_STATUSES.includes(a.verification_status)
              ? "VERIFIED" : a.verification_status ? "CLAIMED" : "UNKNOWN") as "VERIFIED" | "CLAIMED" | "UNKNOWN",
            // A membership arc is backed by exactly one thing: the membership.
            backed_only_by_membership: a.relation === "member.joined",
          })),
          ...registry
            .filter((l) => l.relation === "ACTION_AFFECTS_COMMUNITY" || l.relation === "EFFECT_AFFECTS_COMMUNITY" || l.relation === "COMMUNITY_HAS_NEED")
            .map((l) => ({
              from_entity_id: l.source.canonical_id,
              to_entity_id: l.target.canonical_id,
              relation_type: l.relation,
              source_record_id: l.link_id,
              provenance: (l.relation === "EFFECT_AFFECTS_COMMUNITY" ? "DERIVED_REAL" : l.provenance) as EdgeCandidate["provenance"],
              epistemic_status: "CLAIMED" as const,
              derivation_steps: l.relation === "EFFECT_AFFECTS_COMMUNITY"
                ? [{ rule: "Effect.action_ref", backed_by: l.link_id },
                   { rule: "ACTION_AFFECTS_COMMUNITY", backed_by: l.link_id }]
                : undefined,
            })),
        ];
        const rep = runNetworkTruthGate(candidates);
        return {
          candidates: rep.candidates,
          passed: rep.passed.length,
          rejected: rep.rejected.length,
          real: rep.byProvenance.REAL,
          derived: rep.byProvenance.DERIVED_REAL,
          demo: rep.byProvenance.DEMO,
          verified: rep.byStatus.VERIFIED,
          claimed: rep.byStatus.CLAIMED,
          unknown: rep.byStatus.UNKNOWN,
          reasons: Object.entries(rep.byReason).map(([reason, count]) => ({ reason, count })),
        };
      })()}
      socialSelection={(() => {
        const sel = resolveSocialSelection(params.sel, socialObjects);
        if (sel.status !== "resolved") return undefined;
        const o = sel.object;
        const net = o.scales.NETWORK;
        return {
          record_id: o.record_id, kind: o.kind, at: o.at,
          verification: o.verification, provenance: o.provenance,
          network_present: net.present,
          absent_reason: net.absent_because ? ABSENCE_TEXT[net.absent_because] : undefined,
          roles: roleTouchOf(o.kind, o.verification),
          source_record_ids: o.source_record_ids,
        };
      })()}
      bridgeLinks={registry
        .filter((l) => l.relation === "ACTION_AFFECTS_COMMUNITY" || l.relation === "EFFECT_AFFECTS_COMMUNITY" || l.relation === "COMMUNITY_HAS_NEED")
        .map((l) => ({
          relation: l.relation,
          link_id: l.link_id,
          provenance: l.provenance,
          // Only EFFECT_AFFECTS_COMMUNITY is composed rather than recorded.
          derived: l.relation === "EFFECT_AFFECTS_COMMUNITY",
        }))}
      identityLink={identityLink}
      personContext={personContext}
      canonActions={canonActions}
      canonEffects={canonEffects}
      canonNeeds={canonNeeds}
      canonOffers={canonOffers}
      personFrameSlot={
        <>
          {personFrame ? <PersonFrameStrip frame={personFrame} compact /> : null}
          {/* Globe's own zoom position. It sits INSIDE the collapsed frame
              disclosure rather than in the open band: the band is capped at
              34vh over the canvas, and Globe is the one surface whose primary
              content is the sphere itself. The nav capsule already shows Globe
              as the active family member above the fold. */}
          {/* Same frame as Community and World. On Globe it lives inside the
              collapsed disclosure, because here the sphere is the primary
              content and the frame is reference. */}
          <SocialFrame
            surface="globe"
            spine={buildSocialValueSpine({ valueGroups: nodes.filter((n) => n.type === "value_group").length }).links}
            roles={{
              action: canonActions.length,
              evidence: canonEffects.filter((e) => !!e.effect.verified_outcome).length,
              relations: arcs.length,
              meaning: nodes.filter((n) => n.type === "value").length,
            }}
            chronology={chronology}
            objects={socialObjects}
            selection={resolveSocialSelection(params.sel, socialObjects)}
            chronoLimit={5}
            audit={<SocialSourceSpinePanel surface="globe" limit={4} />}
          />
        </>
      }
      observationStrip={observationStrip}
      canonicalSlice={
        <>
          {/* 7-terminal propagation — the SAME shared Observation reading;
              on Globe only the Value/Value-Group relation matters, and the
              record has no coordinate — no geography is invented for it. */}
          <div dir="rtl"><ObservationReadingPanel subject={personRef.person_id} surface="GLOBE" /></div>
          <CanonicalSlicePanel subject={personRef.person_id} asOf={systemClock.now()} />
        </>
      }
    />
  );
}
