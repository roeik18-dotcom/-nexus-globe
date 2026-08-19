import { connection } from "next/server";

import { projectCanonDynamics, type CanonDynamicsGraph } from "@/app/lib/philos/canon/projectCanonDynamics";
import { buildKnowledgeGraph, buildRealityGraph, type RealityNode } from "@/app/lib/philos/brainGraph";
import { buildMeasuredStateSpace, type OrientationCore } from "@/app/lib/philos/orientationCore";
import { buildActionLifecycleSummary, type ActionLifecycleSummary } from "@/app/lib/philos/canon/actionLifecycle";
import { findKnownNeeds, needsRequiringAction } from "@/app/lib/philos/sharedContext";
import type { KnownNeedResult } from "@/app/lib/systemContext";
import { SystemShell } from "@/app/lib/philos/shell/SystemShell";
import { AuditHeading, AuditSection } from "@/app/lib/philos/shell/epistemics";
import { buildDefaultLinkRegistry } from "@/app/lib/philos/bridge/linkRegistry";
import { linksForEntity } from "@/app/lib/philos/bridge/entityLink";
import { loadPhilosEvents } from "@/app/lib/philos-event-store";
import { systemClock, todayIn } from "@/app/lib/philos/eventStore";
import { resolveShellIdentityLink } from "@/app/lib/philos/community/resolveShellIdentityLink";
import { resolveSharedContext } from "@/app/lib/philos/sharedContext";
import { parseSystemContextRef } from "@/app/lib/systemContext";
import EntityContextPanel from "@/app/lib/philos/shell/EntityContextPanel";
import StateDiffPanel from "@/app/lib/philos/shell/StateDiffPanel";
import BrainV2, { type ValueContext } from "./BrainV2";
import CanonicalBrainPanel from "./CanonicalBrainPanel";
import ObservationReadingPanel from "@/app/lib/philos/shell/ObservationReadingPanel";
import GroupOpsPanel from "@/app/lib/philos/shell/GroupOpsPanel";
import { resolvePersonRef } from "@/app/lib/philos/person/personRef";
import { resolvePersonContext } from "@/app/lib/philos/person/personContext";
import path from "path";
import { DEMO_COMMUNITIES } from "@/app/lib/philos/demoCommunities";
import { projectValueGroup, type ValueGroupView } from "@/app/lib/philos/projectValueGroup";
import { GROUP_ID } from "@/app/lib/philos/valueGroupLog";
import { buildValueRegistry, type GroupProvenance, type PudmValueSource } from "@/app/lib/philos/community/valueRegistry";
import { buildGroupRegistry } from "@/app/lib/philos/community/groupRegistry";
import { buildCommunityTensions, sortTensions } from "@/app/lib/philos/tension";
import { readJsonStore } from "@/app/lib/json-store";
import type { Value } from "@/app/lib/value/schema";

export const metadata = { title: "Philos — Brain" };

const EMPTY_CANON: CanonDynamicsGraph = { source: "canon", nodes: [], summary: { node_count: 0, persisted_count: 0, domains: { G: 0, E: 0, C: 0 } } };
const EMPTY_LIFECYCLE: ActionLifecycleSummary = {
  subject: "",
  actions: [],
  counts: { actions_total: 0, no_effect_recorded: 0, effect_claimed_only: 0, effect_verified: 0, learnings_with_state_prime: 0 },
};
const EMPTY_NEEDS: KnownNeedResult = { needs: [], checked: false, reason: "not computed" };

export default async function BrainPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await connection();
  let canon: CanonDynamicsGraph;
  try {
    canon = await projectCanonDynamics();
  } catch {
    canon = EMPTY_CANON;
  }

  const knowledge = buildKnowledgeGraph();
  const worldEvents: RealityNode[] = buildRealityGraph(canon);

  // Cross-surface context continuity: a real `?subject=` carried in from
  // Hub (same query param Hub itself accepts) focuses Brain on the SAME
  // subject instead of the default — real, checked, never silently ignored
  // when absent. The same default-subject resolution Hub's OrientationCore
  // already uses when no subject is requested — no second selection logic
  // invented here. A canon-side failure degrades every subject-scoped
  // section to its honest empty shape, never fabricated.
  const params = await searchParams;
  // STEP 1 — the ONE shared identity reference.
  const personRef = resolvePersonRef(params.subject);
  // STEP 2 — the frame this screen's readings are relative to (canon §19).
  const personContext = resolvePersonContext({ person: personRef, asOf: systemClock.now() });
  // `resolvePersonRef` performs exactly the same two steps this line used to
  // do inline (`typeof params.subject === "string" ? … : REAL_CURRENT_SUBJECT`,
  // and `resolveDefaultSubject` always returned REAL_CURRENT_SUBJECT).
  const subject = personRef.person_id;
  let core: OrientationCore | undefined;
  let knownNeeds: KnownNeedResult = EMPTY_NEEDS;
  let lifecycle: ActionLifecycleSummary = EMPTY_LIFECYCLE;
  if (subject) {
    try {
      core = buildMeasuredStateSpace(canon, subject);
      knownNeeds = await findKnownNeeds(subject);
      lifecycle = await buildActionLifecycleSummary(subject);
    } catch {
      core = undefined;
      knownNeeds = EMPTY_NEEDS;
      lifecycle = { ...EMPTY_LIFECYCLE, subject };
    }
  }

  // Canonical Cross-Entity Link Registry: an honest, real check for THIS
  // subject — canon subjects (e.g. `person_e2e`) and legacy person/community
  // ids are separate id spaces with no real bridge yet, so this is expected
  // to return 0 for every canon-sourced subject today. Reporting the real
  // zero here (not hiding the check) is the point: it makes the gap visible
  // and queryable instead of just documented in a ledger file.
  const bridgeLinkCount = subject
    ? linksForEntity(buildDefaultLinkRegistry(await loadPhilosEvents(), todayIn(systemClock)), "person", subject).length
    : 0;
  const identityLink = await resolveShellIdentityLink();

  // Mission B, B5 — the SAME real Value/Value-Group universe Community
  // renders (`valueRegistry.ts`/`groupRegistry.ts`, pure folds over
  // already-projected data — no new store), reached from Brain via the
  // ONE real, checked bridge between canon subjects and the legacy
  // Community/Value-Group id space: `identityLink.status ===
  // "VERIFIED_SAME_PERSON"`. `bridgeLinkCount` above is a DIFFERENT,
  // separate check (canon-to-canon typed links) — this is honest either
  // way: most canon subjects have no verified bridge today, and this
  // section says so plainly instead of fabricating a connection.
  let valueContext: ValueContext = { verified: false, memberships: [] };
  if (identityLink.status === "VERIFIED_SAME_PERSON") {
    const philosEvents = await loadPhilosEvents();
    const today = todayIn(systemClock);
    const realGroupView = projectValueGroup(philosEvents, GROUP_ID, today);
    const demoViews = DEMO_COMMUNITIES
      .map((c) => projectValueGroup(c.events, c.group_id, c.today))
      .filter((v): v is ValueGroupView => v !== null);
    const groupsWithProvenance: { view: ValueGroupView; provenance: GroupProvenance }[] = [
      ...(realGroupView ? [{ view: realGroupView, provenance: "REAL" as const }] : []),
      ...demoViews.map((view) => ({ view, provenance: "DEMO" as const })),
    ];
    const pudmValuesRaw = readJsonStore<Value>(path.join(process.cwd(), "data", "values.json"));
    const pudmValues: PudmValueSource[] = pudmValuesRaw.map((v) => ({ id: v.id, context: { label: v.context.label, domain: v.context.domain } }));
    const valueRegistry = buildValueRegistry(groupsWithProvenance, pudmValues);
    const groupRegistry = buildGroupRegistry(groupsWithProvenance);
    const myGroups = groupsWithProvenance.filter(({ view }) => view.members.some((m) => m.person_id === identityLink.community_member_id));
    valueContext = {
      verified: true,
      memberships: myGroups.map(({ view, provenance }) => {
        const reg = groupRegistry.find((g) => g.group_id === view.group_id);
        return {
          group_name: view.name, central_value: view.central_value, status: provenance,
          member_count: reg?.member_count ?? view.members.length, verified_effects: reg?.verified_effects ?? 0,
        };
      }),
      tensions: sortTensions(myGroups.flatMap(({ view, provenance }) => buildCommunityTensions(view, provenance))).map((t) => ({ id: t.id, label: t.label, severity: t.severity })),
      totalRuntimeValues: valueRegistry.length,
    };
  }

  // LOOP A007/A008 — the same shared `?ctx=` resolver Hub/Dynamics/Globe/
  // Marketplace/Community already use, now reachable from Brain too (its
  // first `?ctx=` support). Resolves canon Observation (BEFORE/AFTER state)
  // and canon Action/Effect entities identically to every other surface —
  // same computation, same real fields, never re-derived per-surface.
  const ctxRaw = typeof params.ctx === "string" ? params.ctx : undefined;
  const entityContext = await resolveSharedContext(parseSystemContextRef(ctxRaw));

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#080b13" }}>
      <div style={{ padding: "12px 20px 0", background: "#080b13" }}>
        <SystemShell
          surface="brain"
          personContext={personContext}
          purpose="אדם אחד, בין מציאות לאפשרות — לולאת Action/Effect/Learning משולבת מרחבית, לא כתוספת בתחתית."
          subject={subject}
          identityLink={identityLink}
        />
        {entityContext.status === "found_entity" ? (
          <div dir="rtl" style={{ marginTop: 10 }}>
            <EntityContextPanel selected={entityContext} here="brain" />
          </div>
        ) : entityContext.status === "found" ? (
          <StateDiffPanel selected={entityContext} />
        ) : entityContext.status === "unknown" || entityContext.status === "not_found" ? (
          <div dir="rtl" style={{ marginTop: 10, padding: "10px 14px", borderRadius: 8, border: "1px solid #5a4a2a", fontSize: 11, color: "#cfe0f5" }}>
            {entityContext.status === "unknown" ? entityContext.raw : ctxRaw} — {entityContext.status === "unknown" ? "לא זוהה כמזהה תקין. לא ידוע." : "לא נמצאה רשומה תואמת. לא ידוע."}
          </div>
        ) : null}
        {/* Phase 5 — Brain consumes the SAME shared Person/Value runtime
            state Hub + Dynamics already render (`CanonicalSlicePanel`,
            unmodified), plus Brain's own derived WHAT_CHANGED/WHY_IT_CHANGED/
            EVIDENCE/UNKNOWN/HYPOTHESES/NEXT_ACTION narrative. */}
        <CanonicalBrainPanel
            subject={subject ?? personRef.person_id} asOf={systemClock.now()} lifecycle={lifecycle}
            pendingNeedsForBrain={needsRequiringAction(knownNeeds, lifecycle).map((n) => ({ need_id: n.need.need_id, desired_change: n.need.desired_change }))}
            hasRealObservation={canon.nodes.some((n) => n.subject === (subject ?? personRef.person_id))}
          />
        {/* STEP 5/6 — the same product/audit split Hub established. PRIMARY
            stays above: Brain's own derivation (what changed → why →
            evidence → unknown → learning → next action). The ontology
            internals below are real and unchanged, one click away.
            `PHILOS-SYSTEM-LANGUAGE.md` §9: technical below product. */}
        <AuditHeading accent="#5b9cf6" />

        {/* 7-terminal propagation — the SAME shared Observation reading;
            on Brain its evidence/interpretation/unknown zoning IS the
            point: emotional aversion (detected token) stays interpretation,
            the record stays evidence, the rest stays UNKNOWN. */}
        <AuditSection
          title="קריאת התצפית האחרונה · OBSERVATION READING"
          note="6 אזכורים, ערכי בסיס, משפחות ערך, ניגודים, Color Roles, DEMO"
        >
          <ObservationReadingPanel subject={subject ?? personRef.person_id} surface="BRAIN" />
        </AuditSection>

        {/* Operational-groups pass — group reasoning from the ONE shared
            profile assembler; no Brain-local group derivation. */}
        <AuditSection title="הסבר קבוצה · GROUP REASONING" note="פרופיל תפעולי משותף, ללא גזירה מקומית">
          <div dir="rtl"><GroupOpsPanel variant="reasoning" /></div>
        </AuditSection>
      </div>
      {/* AUDIT / DEBUG — the spatial reality/knowledge graph. Unchanged in
          every respect except position: it is a diagnostic exploration
          surface, not the answer to "what changed and why", so it sits
          below the derivation above rather than in front of it. Same
          props, same shared runtime state — nothing was removed. */}
      <div style={{ padding: "0 20px 20px", background: "#080b13" }}>
        <details>
          <summary style={{ cursor: "pointer", fontSize: 11, fontWeight: 700, letterSpacing: 1, color: "#5a76a3", padding: "10px 0", borderTop: "1px solid rgba(90,120,180,0.15)" }}>
            AUDIT / DEBUG — מפת מציאות ואפשרות (Brain graph, {worldEvents.length} reality nodes)
          </summary>
          <div style={{ height: "80vh", minHeight: 480, marginTop: 10 }}>
            <BrainV2 subject={subject} core={core} knownNeeds={knownNeeds} lifecycle={lifecycle} worldEvents={worldEvents} knowledge={knowledge} bridgeLinkCount={bridgeLinkCount} pendingNeeds={needsRequiringAction(knownNeeds, lifecycle)} valueContext={valueContext} />
          </div>
        </details>
      </div>
    </div>
  );
}
