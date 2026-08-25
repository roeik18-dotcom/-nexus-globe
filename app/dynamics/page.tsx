/**
 * The Dynamics route.
 *
 * PHILOS-DYNAMICS-UI-CONTRACT.md — renders the cross-domain causal graph from the
 * ONE event log, through the pure `projectDynamics → buildDynamicsView` pipeline.
 * `DynamicsView` is a pure function of that output, so what the screen draws is
 * exactly what the projection returned — nothing invented, nothing hidden shown.
 *
 * It reads the durable log through `loadPhilosEvents()` — the seeded history plus
 * everything the product has actually recorded — which is the same source the join
 * flow writes to and the other three screens project. Reading the seed constant
 * directly, as this route first did, would have shown a causal graph that could
 * never contain a real user's act: the one screen whose subject is "how a change
 * rolls through the system", blind to every change.
 *
 * The pipeline below is unchanged and still pure; only where the events come from
 * moved. The view remains a deterministic function of the log it is given.
 *
 * **Canon layer (systemic-integration-audit slice 1, additive):** alongside the
 * legacy pipeline above, this route also projects the real, persisted canon
 * Observation log (`projectCanonDynamics`) and passes it to `DynamicsView` as a
 * SEPARATE prop — never merged into `view`. See `projectCanonDynamics.ts`'s own
 * header for why the two graphs stay separate types rather than one taxonomy.
 * Read-only: no canon write path is reached from this route. A canon read
 * failure degrades to an empty canon layer rather than breaking the (unrelated)
 * legacy graph — same "don't let one honest layer's failure hide another"
 * posture as the rest of this codebase's canon integration points.
 *
 * **Selected System Context (unified-system-context, first real slice):** an
 * optional `?ctx=canon:<canon_event_id>` or `?ctx=event:<event_id>` query
 * param, parsed by `app/lib/systemContext.ts` (a pure, no-I/O parser — mints
 * no id, guesses no kind for an unrecognized string) and resolved HERE,
 * against the exact same `canon`/`view` data already computed above for the
 * page's own render. No second store, no second fetch: resolving a context
 * is a lookup into data this route was already going to load.
 *
 * **State+time / relationship-types (investigation-surface slice, tonight):**
 * two real primitives already implied by the existing schemas, not new ones:
 *   - canon Observations already carry a real `subject` and a real `time` —
 *     "the most recent PRIOR Observation for the SAME subject" is a query
 *     over data already in the store, never a fabricated t0/t1. It is
 *     explicitly NOT a causal claim (chronological only), and `priorState`/
 *     `delta` are `null` — not omitted — when genuinely none exists.
 *   - legacy `view.edges` already has real `source_event_id`/`target_event_id`
 *     direction; the OLD `resolveContext` collapsed both directions into one
 *     flattened string. `relationships[]` now lists every real edge touching
 *     the selected event, each labeled incoming/outgoing with its real
 *     `origin`/`evidence_word` — still zero fabrication, just not flattened.
 * Canon has no edges at all (unchanged fact) — `relationships: []` states
 * that explicitly, rendered as "UNRESOLVED — no verified relationship".
 */
import { resolveViewerContext } from "@/app/lib/philos/identity/viewerContext";
import { resolveViewerContextSemantics } from "@/app/lib/philos/context/resolveViewerContextSemantics";
import { resolveViewerGroupView } from "@/app/lib/philos/community/viewerGroupView";
import { connection } from "next/server";

import { projectCanonDynamics, type CanonDynamicsGraph } from "@/app/lib/philos/canon/projectCanonDynamics";
import { buildDynamicsView } from "@/app/lib/philos/dynamicsView";
import { projectDynamics } from "@/app/lib/philos/projectDynamics";
import { loadPhilosEvents } from "@/app/lib/philos-event-store";
import { resolveViewer } from "@/app/lib/philos-viewer";
import GroupTrajectory from "./GroupTrajectory";
import { resolveCoreContext, resolveSharedContext } from "@/app/lib/philos/sharedContext";
import { systemClock, todayIn } from "@/app/lib/philos/eventStore";
import { parseSystemContextRef } from "@/app/lib/systemContext";
import { buildCapitalTimeline, buildMembershipTimeline, projectValueGroup } from "@/app/lib/philos/projectValueGroup";
import { DEMO_COMMUNITIES } from "@/app/lib/philos/demoCommunities";
import { buildCommunityTensions, sortTensions } from "@/app/lib/philos/tension";
import { buildDefaultLinkRegistry } from "@/app/lib/philos/bridge/linkRegistry";
import { linksByRelation } from "@/app/lib/philos/bridge/entityLink";
import EntityChainFlow from "@/app/lib/philos/crossTerminal/EntityChainFlow";
import UnifiedEntitySurface from "@/app/lib/philos/crossTerminal/UnifiedEntitySurface";
import OperationalTraceFlow from "@/app/lib/philos/crossTerminal/OperationalTraceFlow";
import { loadSelectedEntity } from "@/app/lib/philos/crossTerminal/loadSelectedEntity";
import { resolveShellIdentityLink } from "@/app/lib/philos/community/resolveShellIdentityLink";
import { buildActionLifecycleSummary } from "@/app/lib/philos/canon/actionLifecycle";
import { resolvePersonRef } from "@/app/lib/philos/person/personRef";
import PersonFrameStrip from "@/app/lib/philos/shell/PersonFrameStrip";
import SystemTracePanel from "@/app/lib/philos/shell/SystemTracePanel";
import { buildSystemTrace } from "@/app/lib/philos/systemTrace";
import { resolvePersonFrame } from "@/app/lib/philos/person/personFrameAccessor";
import { resolvePersonContext } from "@/app/lib/philos/person/personContext";
import { findDomainStatesForSubject } from "@/app/lib/philos/canon/domainStateStoreAccessor";
import PersonEventOrientationHeader from "@/app/lib/philos/analysis/PersonEventOrientationHeader";
import DynamicsView, { type CommunityCapitalContext, type SelectedContext, type TimeRangeSummary } from "./DynamicsView";

/**
 * Real time-range counts over the real canon Observation log — computed
 * HERE (the server component, which already has a clock via `systemClock`,
 * same source `todayIn` elsewhere in this codebase reads from), never
 * inside `DynamicsView.tsx` itself, which stays clock-free/pure per its own
 * "no clock, no random" contract (`__tests__/dynamicsHonesty.test.ts`
 * enforces this by scanning the component source for `Date.now`). `asOf` is
 * passed down so the view can state exactly what "now" meant for these
 * counts, rather than silently assuming a viewer-side clock.
 */
function buildTimeRangeSummary(canon: CanonDynamicsGraph, asOf: string): TimeRangeSummary {
  const nowMs = Date.parse(asOf);
  const DAY_MS = 24 * 60 * 60 * 1000;
  const withinDays = (observedAt: string, days: number): boolean => {
    const t = Date.parse(observedAt);
    return !Number.isNaN(t) && t <= nowMs && nowMs - t <= days * DAY_MS;
  };
  const today = asOf.slice(0, 10);
  return {
    asOf,
    today: canon.nodes.filter((n) => n.observed_at.slice(0, 10) === today).length,
    last7: canon.nodes.filter((n) => withinDays(n.observed_at, 7)).length,
    last30: canon.nodes.filter((n) => withinDays(n.observed_at, 30)).length,
    allTime: canon.nodes.length,
  };
}

/**
 * Re-exported for `__tests__/resolveContext.test.ts` — the pure resolution
 * logic moved verbatim to `sharedContext.ts::resolveCoreContext` (semantic-
 * unity slice) so Dynamics, Globe, and Marketplace share one implementation
 * instead of three. Behavior here is unchanged.
 */
export const resolveContext = resolveCoreContext;

export const metadata = { title: "Philos — Dynamics" };

const EMPTY_CANON_GRAPH: CanonDynamicsGraph = {
  source: "canon",
  nodes: [],
  summary: { node_count: 0, persisted_count: 0, domains: { G: 0, E: 0, C: 0 } },
};

async function loadCanonGraphSafely(): Promise<CanonDynamicsGraph> {
  try {
    return await projectCanonDynamics();
  } catch {
    // Never let a canon-side read failure (e.g. a corrupt canon log) take down
    // the legacy Dynamics graph, which has nothing to do with it.
    return EMPTY_CANON_GRAPH;
  }
}

export default async function DynamicsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // The log changes between requests, so this render must wait for one rather
  // than be captured at build time — the pattern the other three routes use.
  await connection();

  // The projection is viewer-scoped and nothing was passing a viewer, so the
  // gate in the UI contract (§5) was declared but never exercised. Passing it
  // makes the gate operate server-side: a non-public event the viewer does not
  // own is absent from the graph, and `withheld` states how many links that cost.
  // Every seeded event is public, so today this hides nothing — which is the
  // point of turning it on before there is anything to hide.
  const viewer = await resolveViewer();
  const view = buildDynamicsView(
    projectDynamics({ events: await loadPhilosEvents(), viewer: viewer.person_id }),
  );
  const canon = await loadCanonGraphSafely();

  const params = await searchParams;
  // STEP 1 — the ONE shared identity reference.
  const personRef = resolvePersonRef(await resolveViewerContext(), params.subject);
  /* THE ONE semantic context — at component scope so every render branch of
     this surface uses the same result. Resolved server-side and passed into
     the client component; a client may never resolve context of its own. */
  const semanticContext = await resolveViewerContextSemantics(await resolveViewerContext());
  // STEP 2 — the frame this screen's readings are relative to (canon §19).
  const personContext = resolvePersonContext({ person: personRef, asOf: systemClock.now() });
  // SAME shared accessor as every other surface.
  const personFrame = await resolvePersonFrame({ subject: personRef.person_id, asOf: systemClock.now() }).catch(() => null);
  const ctxRaw = typeof params.ctx === "string" ? params.ctx : undefined;
  const selected = await resolveSharedContext(parseSystemContextRef(ctxRaw), { viewerId: viewer.person_id });

  if (view.nodes.length === 0 && canon.nodes.length === 0) {
    return (
      <div style={{ padding: 40, fontFamily: "system-ui" }}>No event-backed causality to draw.</div>
    );
  }

  const timeRange = buildTimeRangeSummary(canon, systemClock.now());

  // Dynamics ↔ Community capital wiring (System-Wide Build, Pass 3): a real
  // `?community=` carried from `/hub/community` (same param, same real/DEMO
  // resolution logic that page already uses) resolves the SAME
  // `ValueGroupView` — never a second money model, never merged into the
  // canon/legacy graphs above. Absent when no community is selected.
  const requestedCommunity = typeof params.community === "string" ? params.community : undefined;
  let community: CommunityCapitalContext | undefined;
  if (requestedCommunity) {
    const demoMatch = DEMO_COMMUNITIES.find((c) => c.group_id === requestedCommunity);
    const events = demoMatch ? demoMatch.events : await loadPhilosEvents();
    const today = demoMatch ? demoMatch.today : todayIn(systemClock);
    /* A non-demo `?community=` was accepted only when it equalled the
       constant, which made "is this a real group" and "is this Roei's group"
       the same test. It is now the viewer's own group context: a real
       selection resolves, anything else stays undefined and renders nothing
       rather than falling through to a group the viewer has no relation to. */
    const realCtx = demoMatch ? null : await resolveViewerGroupView({ events, today, requested: requestedCommunity });
    const groupId = demoMatch
      ? demoMatch.group_id
      : realCtx?.context.status === "resolved" ? realCtx.context.group_id : undefined;
    const group = groupId ? projectValueGroup(events, groupId, today) : null;
    if (group) {
      const provenance = demoMatch ? "DEMO" : "REAL";
      // buildDefaultLinkRegistry already covers both the real group and
      // every DEMO_COMMUNITIES entry internally — always pass the real
      // durable log, regardless of which community is currently selected.
      const bridgeLinks = buildDefaultLinkRegistry(await loadPhilosEvents(), todayIn(systemClock));
      const bridgeActionCount = linksByRelation(bridgeLinks, "ACTION_AFFECTS_COMMUNITY").filter((l) => l.target.canonical_id === groupId).length;
      community = { group, capital: buildCapitalTimeline(events), membership: buildMembershipTimeline(events), tensions: sortTensions(buildCommunityTensions(group, provenance)), provenance, bridgeActionCount };
    }
  }

  /* Recorded tensions from the group operational spine. Read-only: Dynamics
     consumes the one projection rather than rebuilding group state. */
  const spineTensions: { label: string; status: string; detail: string }[] = await (async () => {
    try {
      const { loadGroupEvents } = await import("@/app/lib/philos/community/groupEventStore");
      const { projectAllGroupStates } = await import("@/app/lib/philos/community/groupOperationalState");
      const states = projectAllGroupStates(loadGroupEvents().events);
      return [...states.values()].flatMap((st) =>
        st.tensions.map((t) => ({
          label: t.description ?? t.tension_id,
          status: t.pole_a && t.pole_b ? "CONFLICT" : "OBSERVED",
          detail: `${st.group_id} · ${t.source}`,
        })));
    } catch { return []; }
  })();

  const identityLink = await resolveShellIdentityLink();

  // Real Action/Effect/Learning lifecycle for the resolved PersonRef, computed
  // unconditionally (not gated on `?ctx=`) so the Day Closing section never
  // shows a false-empty lifecycle while real records exist. Same read
  // `resolveSharedContext`'s canon bridge already performs when a `?ctx=` IS
  // selected — this is only the honest default when none is.
  const defaultLifecycle = await buildActionLifecycleSummary(personRef.person_id).catch(() => undefined);

  // DomainState backbone wiring (P0 fix) — the SAME subject resolution
  // `DynamicsDayClosingSection`'s own JSX call already uses (real
  // `?ctx=`-selected canon subject when present, the PersonRef subject
  // otherwise), so the fetched history always matches the subject the
  // section actually renders for. Read-only: `findDomainStatesForSubject`
  // is the same accessor `/hub` and `/hub/human-config` already use.
  const dynamicsSubject = selected?.status === "found" && selected.system === "canon" && selected.subject ? selected.subject : personRef.person_id;
  const domainStates = await findDomainStatesForSubject(dynamicsSubject).catch(() => []);

  // SYSTEM TRACE — AUDIT tier, Dynamics only (never also on Hub). Built from
  // the real stores so it can report where the chain genuinely breaks.
  /* Counts and window for the causal reading, captured from the SAME
     viewer-scoped records the trace is built from — so the drawing and the
     table underneath it can never disagree. */
  let causalCounts: { observations: number; needs: number; offers: number; actions: number; effects: number; verifiedEffects: number; learnings: number | null } | null = null;
  let causalWindow: { from: string; to: string } | null = null;
  const traceEdges = await (async () => {
    try {
      const { canonEventStore } = await import("@/app/lib/philos/canon/canonEventStoreAccessor");
      const { loadActions } = await import("@/app/lib/philos/canon/actionStoreAccessor");
      const { loadEffects } = await import("@/app/lib/philos/canon/effectStoreAccessor");
      const { findNeedsForSubject } = await import("@/app/lib/philos/canon/needStoreAccessor");
      const subj = personRef.person_id;
      const evs = (await canonEventStore().load()).filter(
        (e) => e.canon_type === "observation" && e.payload.subject === subj);
      const acts = (await loadActions()).filter((a) => a.action.owner === subj);
      const effs = (await loadEffects()).filter((e) => e.effect.subject === subj);
      const nds = await findNeedsForSubject(subj).catch(() => []);
      const { findOffersForSource } = await import("@/app/lib/philos/canon/offerStoreAccessor");
      const ofs = await findOffersForSource(subj).catch(() => []);
      causalCounts = {
        observations: evs.length, needs: nds.length, offers: ofs.length,
        actions: acts.length, effects: effs.length,
        verifiedEffects: effs.filter((e) => !!e.effect.verified_outcome).length,
        /* No learning store exists yet. `null` = UNKNOWN, which is not the
           same as zero learnings and must not render as one. */
        learnings: null as number | null,
      };
      causalWindow = evs.length > 0
        ? { from: evs.map((e) => e.payload.time).sort()[0].slice(0, 10),
            to: evs.map((e) => e.payload.time).sort().slice(-1)[0].slice(0, 10) }
        : null;
      return buildSystemTrace({
        observationIds: evs.map((e) => e.canon_event_id),
        observationTimes: evs.map((e) => e.payload.time),
        needIds: nds.map((n) => n.need.need_id),
        offerIds: ofs.map((o) => o.offer.offer_id),
        actionIds: acts.map((a) => a.action.action_id),
        actionReferencesObservation: acts.some((a) =>
          a.action.inputs.some((x) => evs.some((e) => e.canon_event_id === x))),
        effectIds: effs.map((e) => e.effect.effect_id),
        effectHasVerifiedOutcome: effs.some((e) => !!e.effect.verified_outcome),
        effectHasObservedInRef: effs.some((e) => !!e.effect.observed_in_ref),
        verifiedMemberships: identityLink.status === "VERIFIED_SAME_PERSON" ? 1 : 0,
        learningCount: 0,
      });
    } catch { return null; }
  })();

  /* REAL TIME SERIES for the INSPECTED group. Two aligned panels on one shared
     x axis — never a dual y-axis, because people and shekels do not share a
     magnitude.
     Which group: the cross-terminal `?group=` selection, resolved through the
     same registry Community uses, so a group selected there is still the
     subject here. It was previously gated on the legacy `?community=` param,
     which meant the chart existed but never rendered. Falls back to the
     viewer's OWN group only — never to a constant, and never to a group the
     selection did not name. */
  const trajectorySelection = await (async () => {
    try {
      const { loadValueGroupWorld } = await import("@/app/lib/philos/community/loadValueGroupWorld");
      const { SELECTED_GROUP_PARAM } = await import("@/app/lib/philos/community/selectedGroupContext");
      const world = await loadValueGroupWorld({ requestedGroup: params[SELECTED_GROUP_PARAM] });
      const id = world.selected.status === "selected" ? world.selected.group_id : community?.group.group_id;
      if (!id) return null;
      const evs = await loadPhilosEvents();
      const view = projectValueGroup(evs, id, todayIn(systemClock));
      if (!view) return null;
      return {
        name: view.name,
        currency: view.budget.currency,
        capital: buildCapitalTimeline(evs),
        membership: buildMembershipTimeline(evs),
      };
    } catch { return null; }
  })();

  const trajectory = trajectorySelection ? (
    <div dir="rtl" style={{ margin: "0 0 12px" }}>
      <GroupTrajectory
        title={`מסלול הקבוצה — ${trajectorySelection.name}`}
        series={[
          { key: "members", title: "חברים", unit: "אנשים", step: true,
            points: trajectorySelection.membership.map((m) => ({ date: m.date, value: m.count, label: m.person_id })) },
          { key: "capital", title: "הון", unit: trajectorySelection.currency, step: true,
            points: trajectorySelection.capital.map((c) => ({ date: c.date, value: c.balance })) },
        ]}
      />
    </div>
  ) : null;

  /* THE SAME SELECTED ENTITY, in the change lens. One build, shared with
     every other terminal — Dynamics adds no projection of its own. */
  const entity = await loadSelectedEntity();

  return <DynamicsView
    eventHeaderSlot={<PersonEventOrientationHeader terminal="dynamics" />}
      selectedGroup={entity?.projection.groupId}
      connectedSlot={entity ? (
        <div dir="rtl" style={{ display: "flex", flexDirection: "column",
          gap: 10, margin: "0 0 12px", minBlockSize: "70vh" }}>
          <OperationalTraceFlow trace={entity.trace} emphasis="dynamics"
            title="מה קרה, מה נגרם ממנו, ומה המערכת למדה"
            subtitle="שרשרת אמיתית בלבד: כל חוליה נקנית במזהה מוצהר על רשומה שמורה. מסלול אינו נבנה מצילומי מצב סטטיים, ולמידה שאין לה רשומה נשארת שבורה ואומרת זאת." />
          <UnifiedEntitySurface projection={entity.projection} trace={entity.trace} />
        </div>
      ) : null}
      trajectorySlot={trajectory}
      semanticContext={semanticContext}
      causal={traceEdges && causalCounts ? {
        /* Measured cells come from the canon graph the view already holds;
           tensions are the recorded contradictions. Both are read, never
           inferred — an empty list is an answer. */
        observedCells: canon.nodes.filter((n) => n.subject === personRef.person_id).length,
        counts: causalCounts,
        /* THIS WAS `[]`. The community tensions were computed 80 lines above
           and thrown away, so the causal view said "no contradictions
           recorded" on every render regardless of what was recorded. Two
           sources now feed it, both read and neither inferred: the community
           tensions already built from the resolved group, and any
           TENSION_OBSERVED events on the operational spine. An empty list is
           still an answer — it is just no longer a guaranteed one. */
        tensions: [
          ...(community?.tensions ?? []).map((t) => ({
            label: t.label,
            status: t.status,
            detail: `${t.current_state} · ${t.evidence_source}`,
          })),
          ...spineTensions,
        ],
        edges: traceEdges,
        window: causalWindow,
      } : null}
      viewerSubject={personRef.person_id} personFrameSlot={
      <>
        {personFrame ? (
        /* REFERENCE FRAME, DEMOTED to the context tier on this surface.
           It is the same three cards every terminal shows, and on a surface
           whose primary content is a causal drawing it was ~200px of
           mostly-UNKNOWN chrome sitting above the thing the reader came for.
           Unchanged and one click away. */
        <details style={{ background: "rgba(0,0,0,0.2)", borderRadius: 10, padding: "6px 12px", margin: "0 0 12px", opacity: 0.85 }}>
          <summary style={{ cursor: "pointer", fontSize: 13, letterSpacing: 1, color: "#6c86b5" }}>
            מסגרת אדם · ערך · דומיין — REFERENCE FRAME
          </summary>
          <div style={{ marginTop: 10 }}><PersonFrameStrip frame={personFrame} compact /></div>
        </details>
      ) : null}
        {/* The trace moved INTO the causal view's audit tier — it is the
            right form for checking one edge against the store, and the wrong
            form for finding out whether anything is wrong. */}
      </>
    } view={view} canon={canon} selected={selected} timeRange={timeRange} community={community} today={todayIn(systemClock)} identityLink={identityLink} personContext={personContext} defaultLifecycle={defaultLifecycle} domainStates={domainStates} />;
}
