import { resolveViewerContext } from "@/app/lib/philos/identity/viewerContext";
import { resolveViewerContextSemantics } from "@/app/lib/philos/context/resolveViewerContextSemantics";
import SignOutButton from "@/app/signin/SignOutButton";
import { buildViewerLinkRegistry } from "@/app/lib/philos/bridge/viewerLinkRegistry";
import { resolveViewerGroupView } from "@/app/lib/philos/community/viewerGroupView";
import { connection } from "next/server";
import type { ReactNode } from "react";

import PhilosToday, { type TodayFigures } from "./PhilosToday";
import CanonOrientationLookup from "./CanonOrientationLookup";
import OrientationCore from "./OrientationCore";
import { projectValueGroup } from "@/app/lib/philos/projectValueGroup";
import { projectViewerIdentity } from "@/app/lib/philos/viewerIdentity";
import { systemClock, todayIn } from "@/app/lib/philos/eventStore";
import { loadPhilosEvents } from "@/app/lib/philos-event-store";
import { resolveViewer } from "@/app/lib/philos-viewer";
import { projectCanonDynamics } from "@/app/lib/philos/canon/projectCanonDynamics";
import { buildMeasuredStateSpace } from "@/app/lib/philos/orientationCore";
import { findKnownNeeds, buildActionSpaceSummary, needsRequiringAction, resolveSharedContext } from "@/app/lib/philos/sharedContext";
import { parseSystemContextRef } from "@/app/lib/systemContext";
import HubNowPanel from "./HubNowPanel";
import PersonFrameStrip from "@/app/lib/philos/shell/PersonFrameStrip";
import SystemRoleRail from "@/app/lib/philos/shell/SystemRoleRail";
import SocialValueSummaryLine from "@/app/lib/philos/shell/SocialValueSummaryLine";
import { detectBaseOppositions } from "@/app/lib/philos/valueSystem/baseOppositionDetector";
import { resolvePersonFrame } from "@/app/lib/philos/person/personFrameAccessor";
import ConfigQuestionsPanel from "./ConfigQuestionsPanel";
import { deriveObservationReading, type ObservationReading } from "@/app/lib/philos/canon/observationReading";
import { classifyObservationText, type ContradictionMatch } from "@/app/lib/philos/valueSystem/classifier";
import { RAW_FAMILIES, SUBVALUES } from "@/app/lib/philos/community/valueUniverse328";
import { buildPersonInstance, buildValueDomainInstance } from "@/app/lib/philos/canonical/personInstance";
import { buildBrainDerivation, type BrainDerivation } from "@/app/lib/philos/canonical/brainDerivation";
import { buildActivePersonRefs } from "@/app/lib/philos/canonical/activeConfig";
import { availableDomainConfigs } from "@/app/lib/philos/canonical/domainConfigRegistry";
import { HUMAN_CANON_DOMAIN_ID } from "./CanonicalSlicePanel";
import type { MeasuredStateSpace } from "@/app/lib/philos/orientationCore";
import type { TensionItem } from "@/app/lib/philos/tension";
import type { KnownNeedResult } from "@/app/lib/systemContext";
import { SystemShell } from "@/app/lib/philos/shell/SystemShell";
import DemoSimulationSection from "@/app/lib/philos/analysis/DemoSimulationSection";
import RealDataGapPanel, { factFromCount } from "@/app/lib/philos/day/RealDataGapPanel";
import { loadCanonEvents } from "@/app/lib/philos/canon/canonEventStoreAccessor";
import { selectRealUnitReadings } from "@/app/lib/philos/analysis/realUnitReadings";
import { selectLinkableObservations } from "@/app/lib/philos/day/linkableObservations";
import { selectLinkableStates } from "@/app/lib/philos/day/linkableStates";
import { loadDomainStates } from "@/app/lib/philos/canon/domainStateStoreAccessor";
import EntityContextPanel from "@/app/lib/philos/shell/EntityContextPanel";
import StateDiffPanel from "@/app/lib/philos/shell/StateDiffPanel";
import { buildCarryForward, buildDayClosingQuestions } from "@/app/lib/philos/dayClosingFusion";
import { buildActionLifecycleSummary } from "@/app/lib/philos/canon/actionLifecycle";
import { buildHumanTensions, buildCommunityTensions, sortTensions } from "@/app/lib/philos/tension";
import { buildDefaultLinkRegistry } from "@/app/lib/philos/bridge/linkRegistry";
import { buildMissionOrientation } from "@/app/lib/philos/mission/missionOrientation";
import { resolveShellIdentityLink } from "@/app/lib/philos/community/resolveShellIdentityLink";
import MissionPicture from "./MissionPicture";
import ActionOutcomes from "./ActionOutcomes";
import HubCommandCenter from "./HubCommandCenter";
import CreateObservationForm from "./CreateObservationForm";
import DayCycle from "./DayCycle";
import ValueDomainDemoPanel from "./ValueDomainDemoPanel";
import HumanValueMatrix from "./HumanValueMatrix";
import HumanConfigSummaryCard from "./HumanConfigSummaryCard";
import { loadHumanConfigSource } from "@/app/lib/philos/humanConfig/masterUnitsSource";
import { buildHumanConfigSummary, classifyUnits, humanDomainUnits } from "@/app/lib/philos/humanConfig/humanConfigHierarchy";
import { DEMO_COMMUNITIES } from "@/app/lib/philos/demoCommunities";
import type { ValueGroupView } from "@/app/lib/philos/projectValueGroup";
import type { HubValueContext } from "./HubCommandCenter";
import { findDomainStatesForSubject } from "@/app/lib/philos/canon/domainStateStoreAccessor";
import { resolveValueDomainParam } from "@/app/lib/philos/canon/domainStateQuery";
import { resolvePersonRef } from "@/app/lib/philos/person/personRef";
import { resolvePersonContext } from "@/app/lib/philos/person/personContext";
import CanonicalSlicePanel from "./CanonicalSlicePanel";
import PersonNowPanel from "./PersonNowPanel";
import ObservationReadingPanel from "@/app/lib/philos/shell/ObservationReadingPanel";
import WeeklyLearningPanel from "./WeeklyLearningPanel";
import DayStatusStrip from "@/app/lib/philos/day/DayStatusStrip";
import { DayOpeningPanel, DayClosingPanel } from "./DayPanels";
import { loadDaySession, nextDate, parseDateParam, previousDate } from "@/app/lib/philos/day/loadDaySession";
import DayDateNav from "@/app/lib/philos/day/DayDateNav";
import DayChainSummary from "@/app/lib/philos/day/DayChainSummary";
import { loadActionEffectProjection } from "@/app/lib/philos/crossTerminal/loadActionEffectProjection";
import ActionEffectPanel from "@/app/lib/philos/crossTerminal/ActionEffectPanel";
import { loadRealOrientationFrame } from "@/app/lib/philos/analysis/loadRealOrientationFrame";
import RealOrientationPanel from "@/app/lib/philos/analysis/RealOrientationPanel";

export const metadata = { title: "Philos — היום" };

/**
 * Hub chrome styles for the final product pass. `SUMMARY_ACTION` is a
 * product control (the one write path); `SUMMARY_AUDIT` is deliberately
 * quieter — the audit sections should be findable, not competitive with
 * the primary dashboard. Presentation only: no section's content, source
 * or availability changed with this pass, only whether it starts open.
 */
const SUMMARY_ACTION: React.CSSProperties = {
  cursor: "pointer", display: "inline-block", fontSize: 13, fontWeight: 700,
  letterSpacing: 0.4, color: "#cfe0f5", padding: "8px 16px", borderRadius: 8,
  background: "rgba(91,156,246,0.12)", border: "1px solid rgba(91,156,246,0.4)",
};
const SUMMARY_AUDIT: React.CSSProperties = {
  cursor: "pointer", fontSize: 13, letterSpacing: 0.6, color: "#7d90b4", padding: "7px 0",
};
const AUDIT_HEAD: React.CSSProperties = {
  fontSize: 12, fontWeight: 700, letterSpacing: 1.4, color: "#6c86b5",
  textTransform: "uppercase", margin: "18px 0 2px",
  borderTop: "1px solid rgba(120,150,220,0.16)", paddingTop: 12,
};
const AUDIT_DETAILS: React.CSSProperties = { margin: 0, borderBottom: "1px solid rgba(120,150,220,0.10)" };

export default async function HubPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // The log has a writer now, so it differs between requests. `connection()`
  // says this render must wait for a request rather than be captured at build.
  await connection();

  // Cross-surface context (product pass): a real `?subject=` carried in from
  // Dynamics/Planet/Marketplace (all of which already expose `selected.
  // subject`) focuses Hub on the SAME subject instead of the default —
  // real, checked, never silently ignored when absent (falls back to the
  // same deterministic default as before).
  const params = await searchParams;

  /* THE SHARED OPERATIONAL DAY — one projection, seven terminals.
     `?date=` is READ-ONLY: it selects which day to project and nothing else.
     Strictly parsed, so `2026-02-31` or junk falls back to today rather than
     rolling over into a day the user did not ask for. */
  const dayToday = todayIn(systemClock);
  const viewedDate = parseDateParam(params.date, dayToday);
  const daySession = await loadDaySession({ date: viewedDate });
  const dayIsToday = viewedDate === dayToday;

  // STEP 1 — the ONE shared identity reference.
  const personRef = resolvePersonRef(await resolveViewerContext(), params.subject);
  /* THE SHARED ACTION→EFFECT READ. One loader for all seven terminals, so
     the same two records cannot appear as ids here, a bare count there and
     nothing at all elsewhere. This terminal interprets; it does not
     re-decide which records count. */
  const aeProjection = await loadActionEffectProjection(personRef.person_id);
  /* THE PHILOS MATERIAL. Anchored to the day's own Observation — never the
     latest — so a day already opened keeps meaning what it meant. */
  const orientationFrame = await loadRealOrientationFrame(personRef.person_id, viewedDate);
  /* REAL unit readings — one shared selector, never a per-page derivation. */
  const canonEventsForViewer = await loadCanonEvents();
  const realUnitReadings = selectRealUnitReadings({
    events: canonEventsForViewer,
    subject_id: personRef.person_id,
  });
  /* The Observations this person may link to today's opening. Selected
     server-side from the same store the writer re-reads, so the options and
     the accepted set are the same set. */
  const linkableObservations = selectLinkableObservations({
    events: canonEventsForViewer,
    subject_id: personRef.person_id,
  });
  /* The State(t0) records this person may cite at opening. Same store the
     writer re-reads, so options and accepted set are the same set. */
  const linkableStates = selectLinkableStates({
    records: await loadDomainStates(),
    subject_id: personRef.person_id,
  });
  // `resolvePersonRef` already applied this exact `typeof` check; kept as a
  // local alias so the canon-scoped block below reads unchanged.
  const requestedSubject: string | undefined = typeof params.subject === "string" ? params.subject : undefined;

  // LOOP 0054 — the same shared `?ctx=` resolver Dynamics/Globe/Marketplace/
  // Community already use, now reachable from Hub too. Scoped to the
  // `action:`/`effect:` kinds it can genuinely resolve today, same as
  // Community — Hub's own canon-Observation lookup is `?subject=`-based
  // (above), a different, pre-existing mechanism this doesn't replace.
  const ctxRaw = typeof params.ctx === "string" ? params.ctx : undefined;
  const entityContext = await resolveSharedContext(parseSystemContextRef(ctxRaw));

  // Orientation Core (source-locked prototype pass, additive): the SAME
  // canon read + the SAME knownNeeds/actionSpace functions Dynamics/Globe/
  // Marketplace already use — no new store, no new fact. A canon read
  // failure degrades to "no orientation to show" rather than breaking the
  // (unrelated) Value Group panel below.
  // Mission B, B8 — "VALUES RELEVANT NOW / GROUPS RELEVANT NOW": the SAME
  // real identityLink bridge (`VERIFIED_SAME_PERSON`) Brain's L6 and
  // Dynamics' membership panel already use. Computed once, early, so
  // `commandCenterSection` below can use it — never all 251 Value
  // Universe entries, only THIS viewer's own real memberships.
  const hubIdentityLink = await resolveShellIdentityLink();
  // PERSON-IN-CONTEXT — resolved ONCE, through the shared accessor, so Hub
  // and every other surface answer "who, in what frame" identically.
  let personFrame: Awaited<ReturnType<typeof resolvePersonFrame>> | null = null;
  let hubValueContext: HubValueContext = { verified: false, memberships: [] };
  // Phase 8 — the full ValueGroupView objects (not just the trimmed
  // membership summary above) for `PersonNowPanel`'s VALUE GROUPS section,
  // captured once here so it is never re-derived a second time.
  let myValueGroups: { view: ValueGroupView; provenance: "REAL" | "DEMO" }[] = [];
  if (hubIdentityLink.status === "VERIFIED_SAME_PERSON") {
    const hubEvents = await loadPhilosEvents();
    const hubToday = todayIn(systemClock);
    const hubRealGroup = (await resolveViewerGroupView({ events: hubEvents, today: hubToday })).view;
    const hubDemoViews = DEMO_COMMUNITIES
      .map((c) => projectValueGroup(c.events, c.group_id, c.today))
      .filter((v): v is ValueGroupView => v !== null);
    const hubGroups: { view: ValueGroupView; provenance: "REAL" | "DEMO" }[] = [
      ...(hubRealGroup ? [{ view: hubRealGroup, provenance: "REAL" as const }] : []),
      ...hubDemoViews.map((view) => ({ view, provenance: "DEMO" as const })),
    ];
    const myHubGroups = hubGroups.filter(({ view }) => view.members.some((m) => m.person_id === hubIdentityLink.community_member_id));
    myValueGroups = myHubGroups;
    hubValueContext = {
      verified: true,
      memberships: myHubGroups.map(({ view, provenance }) => ({
        group_name: view.name, central_value: view.central_value, provenance,
        openTensions: sortTensions(buildCommunityTensions(view, provenance)).length,
      })),
    };
  }

  let commandCenterSection: ReactNode = null;
  let orientationSection: ReactNode = null;
  // Action/Effect/Learning integration pass: the compact "מה דורש פעולה /
  // מה בוצע / מה חזר מהפעולות" section, keyed by the SAME subject the
  // orientation block above already resolved — no new subject lookup, no
  // parallel identity. A canon-side failure degrades this section to absent
  // (never a fabricated empty-looking success) without breaking the
  // (unrelated) Value Group panel below, same posture as orientationSection.
  let actionOutcomesSection: ReactNode = null;
  // Day Opening/Closing (System-Wide Build, continued): a real, PHILOS-
  // native cycle built from the SAME core/lifecycle/tensions — never
  // Merlin's Day Opening ritual (deferred, separate track).
  let dayCycleSection: ReactNode = null;
  let missionSection: ReactNode = null;
  let personNowSection: ReactNode = null;
  // The HUB NOW view's inputs, captured out of the canon-scoped try block
  // below so the panel can be rendered next to `identity` (resolved after
  // it). Every field is a value that block ALREADY computed — nothing here
  // is a second read or a second derivation.
  let nowInputs: {
    subject: string;
    core: MeasuredStateSpace;
    tensions: TensionItem[];
    contradictions: ContradictionMatch[];
    reading: ObservationReading | null;
    knownNeeds: KnownNeedResult;
    brain: BrainDerivation;
    activeDomainId?: string;
  } | null = null;
  // Lifted out of the try block so the shared shell (rendered below,
  // outside the canon-scoped section) can carry it forward too — same
  // real value, not a second resolution.
  let resolvedSubject: string | undefined;
  try {
    const canon = await projectCanonDynamics();
    const subject = personRef.person_id;
    // PERSON-IN-CONTEXT — resolved once, through the shared accessor, so
    // Hub and every other surface answer "who, in what frame" identically.
    // `myValueGroups` is already resolved above, so the value axis carries
    // only REAL verified relations; `activeDomainId` is resolved from a
    // real DomainState INSIDE the accessor, never supplied by this page.
    personFrame = await resolvePersonFrame({
      subject,
      asOf: systemClock.now(),
      verifiedGroups: myValueGroups.filter((g) => g.provenance === "REAL"),
    }).catch(() => null);
    resolvedSubject = subject;
    if (subject) {
      const core = buildMeasuredStateSpace(canon, subject);
      const knownNeeds = await findKnownNeeds(subject);
      const actionSpace = buildActionSpaceSummary(knownNeeds);
      const lifecycle = await buildActionLifecycleSummary(subject);
      const tensions = sortTensions(buildHumanTensions(core));

      // Hub command-center pass: the operational orientation layer, composed
      // entirely over the SAME core/knownNeeds/actionSpace/lifecycle values
      // used below — no new fact, no new store, no duplicate model.
      commandCenterSection = (
        <HubCommandCenter subject={subject} core={core} knownNeeds={knownNeeds} actionSpace={actionSpace} lifecycle={lifecycle} today={todayIn(systemClock)} valueContext={hubValueContext} />
      );
      orientationSection = <OrientationCore core={core} knownNeeds={knownNeeds} actionSpace={actionSpace} />;
      actionOutcomesSection = <ActionOutcomes knownNeeds={knownNeeds} lifecycle={lifecycle} />;
      // Canonical Cross-Entity Link Registry: the SAME registry Community/
      // Planet/Dynamics build, over the SAME real event log — used here
      // only to check whether today's Actions have a real collective link
      // (COMMUNITY/MARKET PROPAGATION in the runtime-loop carry-forward).
      const bridgeRegistry = await buildViewerLinkRegistry();
      dayCycleSection = <DayCycle subject={subject} core={core} tensions={tensions} lifecycle={lifecycle} today={todayIn(systemClock)} knownNeeds={knownNeeds} bridgeRegistry={bridgeRegistry} />;

      // Mission / Orientation Picture: composed entirely from the SAME
      // core/tensions/lifecycle/bridgeRegistry above, plus the SAME
      // carryForward §21 already builds — no second model.
      const pendingNeeds = needsRequiringAction(knownNeeds, lifecycle);

      // State-fusion backbone pass — feeds `buildCarryForward`'s own
      // pre-existing `valueDomain` param (designed for exactly this,
      // previously always absent: "no real config exists"). Real
      // DomainState records only, never DEMO. `resolveValueDomainParam`
      // (domainStateQuery.ts) is the ONE shared resolver — Dynamics uses
      // the exact same function now, so this is no longer duplicated
      // per-terminal state logic.
      const myDomainStates = await findDomainStatesForSubject(subject);
      const valueDomainParam = resolveValueDomainParam(subject, myDomainStates);

      const carryForward = buildCarryForward({
        subject, today: todayIn(systemClock), core, lifecycle, pendingNeeds, tensions,
        todaysActions: lifecycle.actions.filter((a) => a.action.action.time.slice(0, 10) === todayIn(systemClock)),
        realizedLearningsToday: 0, bridgeRegistry, valueDomain: valueDomainParam,
      });
      const mission = buildMissionOrientation({
        subject, provenance: "REAL", today: todayIn(systemClock), core,
        needs: pendingNeeds, tensions, lifecycle, bridgeRegistry, carryForward,
      });
      missionSection = <MissionPicture mission={mission} />;

      // Phase 8 — the primary, above-the-fold product view: PERSON NOW /
      // ACTIVE VALUE-DOMAIN / WHAT CHANGED / OPEN TENSIONS / OPEN NEEDS /
      // PRIORITIES / NEXT ACTIONS / EVIDENCE / DAY CLOSING / VALUE GROUPS.
      // Composed entirely from the SAME tensions/knownNeeds/lifecycle/
      // myValueGroups/carryForward already computed here — no second
      // derivation, no new store. Assigned last only so the SAME
      // `carryForward` and Day-Closing questions `DayCycle` renders below
      // can be handed to it rather than recomputed; render ORDER is set by
      // the JSX below, where this section stays first.
      personNowSection = (
        <PersonNowPanel
          subject={subject} asOf={systemClock.now()} tensions={tensions}
          knownNeeds={knownNeeds} lifecycle={lifecycle} valueGroups={myValueGroups}
          closingQuestions={buildDayClosingQuestions({
            todaysActions: lifecycle.actions.filter((a) => a.action.action.time.slice(0, 10) === todayIn(systemClock)),
            pendingNeeds, tensions, lifecycle,
          })}
          carryForward={carryForward}
          today={todayIn(systemClock)}
          pendingNeedsForBrain={pendingNeeds.map((n) => ({ need_id: n.need.need_id, desired_change: n.need.desired_change }))}
          hasRealObservation={!!(core.G || core.E || core.C)}
        />
      );

      // HUB NOW — the product "now" view. Reuses `canon` (already
      // projected above) for the observation reading, `myDomainStates`
      // (already read above) for the instances, and the SAME
      // `buildBrainDerivation` PersonNowPanel runs — so WHAT CHANGED /
      // NEXT ACTION / RECENT EVIDENCE here can never disagree with the
      // detailed panel below. No additional store access.
      const latestMark = canon.nodes
        .filter((n) => n.subject === subject)
        .sort((a, b) => b.observed_at.localeCompare(a.observed_at))[0];
      const nowReading = latestMark
        ? deriveObservationReading(latestMark, { subvalues: SUBVALUES, families: RAW_FAMILIES })
        : null;
      const nowContradictions = latestMark ? classifyObservationText(latestMark.context).contradictions : [];
      const nowAsOf = systemClock.now();
      const nowBrain = buildBrainDerivation({
        subject_id: subject,
        lifecycle,
        instances: [
          buildPersonInstance({ subject_id: subject, domain_id: HUMAN_CANON_DOMAIN_ID, records: myDomainStates, source_kind: "CANON", source_refs: buildActivePersonRefs().refObjects, asOf: nowAsOf }),
          ...availableDomainConfigs().map((slot) =>
            buildValueDomainInstance({
              subject_id: subject, domain_id: slot.domain_id, records: myDomainStates,
              source_kind: "CANON", source_refs: slot.activeConfig().refObjects, asOf: nowAsOf,
            }),
          ),
        ],
        pendingNeeds: pendingNeeds.map((n) => ({ need_id: n.need.need_id, desired_change: n.need.desired_change })),
        hasRealObservation: !!(core.G || core.E || core.C),
      });
      nowInputs = {
        subject, core, tensions, contradictions: nowContradictions, reading: nowReading,
        knownNeeds, brain: nowBrain,
        // Real recorded DomainState only. An activated CONFIG is not an
        // active domain, so nothing is filled in from one.
        activeDomainId: valueDomainParam?.config.domain.domain_id,
      };
    }
  } catch {
    commandCenterSection = null;
    orientationSection = null;
    actionOutcomesSection = null;
    dayCycleSection = null;
    missionSection = null;
    nowInputs = null;
  }

  // Real Human Config source (§23): read-only, live from Dropbox, never
  // copied into this repo. A read failure (file moved/unavailable) shows
  // the honest "not available" state below rather than breaking the rest
  // of the page.
  let humanConfigSummary: ReturnType<typeof buildHumanConfigSummary> | null = null;
  let humanConfigSourceFileName: string | null = null;
  try {
    const source = await loadHumanConfigSource();
    if (source) {
      const humanUnits = humanDomainUnits(source.units);
      const classified = classifyUnits(humanUnits, source.reviewQueue);
      humanConfigSummary = buildHumanConfigSummary({
        allUnits: source.units, classifiedHuman: classified,
        collisionAudit: source.collisionAudit, coverage: source.coverage,
      });
      humanConfigSourceFileName = source.sourceFileName;
    }
  } catch {
    humanConfigSummary = null;
    humanConfigSourceFileName = null;
  }

  // The store, not the seed constant: the same seeded history plus everything
  // the product has recorded since. `today` comes from the same clock that
  // stamps events, so an action is findable under the date it was taken.
  const events = await loadPhilosEvents();
  const g = (await resolveViewerGroupView({ events })).view;

  // Who is looking, and what the log actually knows about them. The entry screen
  // used to answer only "what happened in the system"; §14's journey begins with
  // *why me*, and that question needs an identity the events can account for.
  const viewer = await resolveViewer();
  const identity = projectViewerIdentity(events, viewer.person_id, viewer.display_name);
  const identityLink = hubIdentityLink;

  // Every headline figure is a projection of the log. Nothing on the screen is
  // authored here; if the log cannot supply it, the screen says so instead.
  const completed = g?.transfers.filter((t) => t.state === "completed") ?? [];
  const verified = g?.impact.filter((i) => i.verified) ?? [];

  const figures: TodayFigures = {
    group_name: g?.name ?? "",
    groups: g ? 1 : 0,
    members: g?.members.length ?? 0,
    events_total: g?.event_count ?? 0,
    events_today: g?.today.length ?? 0,
    money_received: g?.budget.received ?? 0,
    money_transferred: completed.reduce((s, t) => s + t.amount, 0),
    people_affected_verified: verified.reduce((s, i) => s + i.people_affected, 0),
    transfer: completed[0]
      ? {
          amount: completed[0].amount,
          from_value: g?.central_value ?? "",
          to: completed[0].recipient,
        }
      : undefined,
  };

  // Shared product shell — mounted HERE, at the top of the route, rather
  // than inside `PhilosToday`. `PhilosToday` is now the collapsed FULL
  // LEGACY DASHBOARD at the bottom of this page, so the one place Hub
  // rendered the shared navigation was inside a closed `<details>`: Hub
  // was the one terminal with no visible product navigation at all.
  // Nothing else moved — the shell mount was relocated, not duplicated
  // (`PhilosToday`'s own copy is removed in the same pass).
  const hubRealGroup = myValueGroups.find((g) => g.provenance === "REAL")?.view;

  // STEP 2 — the frame (canon §19 `P = P(person, reference_group, context, time)`).
  // Hub is the reference implementation, so it populates `reference` from the
  // real observed cell rather than only declaring the slot. `reference_group`
  // stays UNKNOWN because no store records one (canon §21 forbids a default).
  const hubObservedCell = nowInputs
    ? Object.values(nowInputs.core.cells).find((c) => c.status === "OBSERVED")
    : undefined;
  const personContext = resolvePersonContext({
    person: personRef,
    reference: hubObservedCell?.reference ?? null,
    context: nowInputs?.reading?.context ?? null,
    asOf: systemClock.now(),
  });

  /* THE ONE semantic context. Resolved from viewer-scoped evidence, not from
     this page — see `resolveViewerContextSemantics`. */
  const semanticContext = await resolveViewerContextSemantics(await resolveViewerContext());

  return (
    // One page-level surface: the two content blocks below each painted
    // their own background, so the area under them fell through to the
    // white body — visible as a light strip beneath the audit list at
    // desktop height.
    <div style={{ background: "#0b0f1a", minHeight: "100vh" }}>
      <div style={{ padding: "12px 20px 0" }}>
        <SystemShell
          dense
          signOut={<SignOutButton />}
          viewerContext={semanticContext}
          surface="hub"
          observedCount={nowInputs?.core.observed_count}
          purpose="מה חשוב עכשיו, מה השתנה, ולאן ללכת משם."
          subject={resolvedSubject ?? personRef.person_id}
          identityLink={identityLink}
        />
        <DayDateNav
          date={viewedDate}
          today={dayToday}
          previous={previousDate(viewedDate)}
          next={nextDate(viewedDate)}
        />
        <DayStatusStrip session={daySession} /><RealOrientationPanel terminal="hub" frame={orientationFrame} /><ActionEffectPanel terminal="hub" pairs={aeProjection.pairs} legacyCount={aeProjection.counts.legacy} />
        <DayChainSummary session={daySession} />
        <DayOpeningPanel session={daySession} readOnly={!dayIsToday} linkable={linkableObservations} linkableStates={linkableStates} />
        <RealDataGapPanel session={daySession} realUnits={realUnitReadings} terminal="hub" facts={[
          factFromCount("State(t0)", "DaySession.state_t0", daySession.state_t0.value?.length ?? null,
            daySession.state_t0.unresolved_reason ?? "לא נמצאה רשומה"),
          factFromCount("State(t1)", "DaySession.state_t1", daySession.state_t1.value?.length ?? null,
            daySession.state_t1.unresolved_reason ?? "לא נמצאה רשומה"),
          factFromCount("Event/Observation", "DaySession.event_observation_refs",
            daySession.event_observation_refs.value?.length ?? null,
            daySession.event_observation_refs.unresolved_reason ?? "לא נמצאה רשומה"),
        ]} />
        {/* REAL chrome, hoisted OUT of the DEMO section: sign-out is a real
            control and must not sit behind a label saying the content below
            is not the user's data. */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          <span style={{ fontSize: 13, color: "#9fb0d0" }}>מה חשוב עכשיו, מה השתנה, ולאן ללכת משם.</span>
          <SignOutButton />
        </div>
      </div>
      {commandCenterSection ? (
          <div style={{ padding: "20px 20px 0" }}>
          {entityContext.status === "found_entity" ? (
            <div dir="rtl" style={{ marginBottom: 12 }}>
              <EntityContextPanel selected={entityContext} here="hub" />
            </div>
          ) : entityContext.status === "found" ? (
            <StateDiffPanel selected={entityContext} />
          ) : entityContext.status === "unknown" || entityContext.status === "not_found" ? (
            <div dir="rtl" style={{ marginBottom: 12, padding: "10px 14px", borderRadius: 8, border: "1px solid #5a4a2a", fontSize: 13, color: "#cfe0f5" }}>
              {entityContext.status === "unknown" ? entityContext.raw : ctxRaw} — {entityContext.status === "unknown" ? "לא זוהה כמזהה תקין. לא ידוע." : "לא נמצאה רשומה תואמת. לא ידוע."}
            </div>
          ) : null}
          {/* HUB NOW — the product "now" view: PERSON NOW / ATTENTION /
              ACTIVE DOMAIN / PROJECT / RELEVANT VALUES / GROUP RELATION /
              OPEN NEED / WHAT CHANGED / NEXT ACTION / RECENT EVIDENCE. */}
          {/* PERSON-IN-CONTEXT frame — the shared reference frame every
              surface reads, rendered ABOVE the measured state it is a frame
              FOR. It does not depend on `nowInputs`: the frame exists even
              when nothing has been measured yet, which is exactly when
              saying so matters most. */}
          {personFrame ? <PersonFrameStrip frame={personFrame} /> : null}
          {/* SOCIAL-VALUE summary — one line. The chain lives on Community
              and the provenance on Brain; Hub says only what touches this
              person, and keeps SOURCE counts visually distinct from REAL. */}
          {nowInputs ? (
            <SocialValueSummaryLine
              verifiedGroupRelations={myValueGroups.filter((g) => g.provenance === "REAL").length}
              namedBaseOppositions={detectBaseOppositions(nowInputs.reading?.context ?? "").length}
            />
          ) : null}
          {/* SYSTEM ROLES — the 7 canonical colour roles from the Colour
              Source Lock, each showing whether a REAL record currently
              carries it. Counts only, no flow between colours (the lock
              states none), no score. */}
          {nowInputs ? (
            <SystemRoleRail
              evidence={{
                // RED — recorded Actions.
                red: nowInputs.brain.changes.length,
                // ORANGE — no record type describes momentum: honestly unchecked.
                orange: null,
                // YELLOW — persisted State transitions. 0 by contract.
                yellow: 0,
                // GREEN — verified group relations.
                green: myValueGroups.filter((g) => g.provenance === "REAL").length,
                // BLUE — classification results over the observation text.
                blue: nowInputs.contradictions.length,
                // PURPLE — explicit value claim present.
                purple: nowInputs.reading?.general_value ? 1 : 0,
                // WHITE — evidence citations.
                white: nowInputs.brain.evidence.length,
              }}
            />
          ) : null}
          {nowInputs ? (
            <HubNowPanel
              subject={nowInputs.subject}
              displayName={identity.display_name}
              displayNameRecorded={identity.display_name_source === "event"}
              core={nowInputs.core}
              tensions={nowInputs.tensions}
              contradictions={nowInputs.contradictions}
              reading={nowInputs.reading}
              knownNeeds={nowInputs.knownNeeds}
              brain={nowInputs.brain}
              valueGroups={myValueGroups}
              activeDomainId={nowInputs.activeDomainId}
            />
          ) : null}
          {/* NEW SELF-OBSERVATION — the one write path a person reaches
              from Hub, kept as an explicit, obvious action. Collapsed so
              the full form does not occupy the default view; the trigger
              itself is styled as a primary control rather than as an audit
              toggle, because it is a product action, not diagnostics. The
              `#record-observation` anchor other surfaces link to is on the
              `<details>` itself, so a deep link still lands on it. */}
          <details id="record-observation" dir="rtl" style={{ margin: "0 0 14px" }}>
            <summary style={SUMMARY_ACTION}>＋ תצפית עצמית חדשה · NEW SELF-OBSERVATION</summary>
            <div style={{ marginTop: 10 }}>
              <CreateObservationForm subject={personRef.person_id} />
            </div>
          </details>

          {/* CONFIG-DECLARED QUESTIONS — the config→runtime ladder's
              QUESTION rung, as REFERENCE. Collapsed (SECONDARY): it tells
              the person what their config says may be asked, and states
              plainly that config never supplies the measurement. */}
          <details dir="rtl" style={{ margin: "0 0 14px" }}>
            <summary style={SUMMARY_ACTION}>
              ？ מה הקונפיג מגדיר שניתן לשאול · CONFIG-DECLARED QUESTIONS
            </summary>
            <div style={{ marginTop: 10 }}>
              <ConfigQuestionsPanel />
            </div>
          </details>

          {/* ── DETAILS / SYSTEM / AUDIT ─────────────────────────────────
              Everything below is real and unchanged — the ontology
              internals, the classifier's own output, the config detail,
              the DEMO relations and the weekly/legacy rollups. None of it
              is deleted; all of it is collapsed by default, because none
              of it is the state a person opens Hub to read. Each section
              is labeled with what it actually contains so the material is
              findable rather than merely hidden. */}
          <div dir="rtl" style={AUDIT_HEAD}>פירוט · מערכת · ביקורת — DETAILS / SYSTEM / AUDIT</div>

          <details style={AUDIT_DETAILS}>
            <summary style={SUMMARY_AUDIT}>
              פירוט מלא · PERSON NOW — CONFIG/STATE, PRIORITIES, DAY CLOSING, VALUE GROUPS
            </summary>
            <div style={{ marginTop: 10 }}>{personNowSection}</div>
          </details>

          {/* 7-terminal propagation — the ONE shared reading of the most
              recent real Observation (evidence / interpretation / unknown),
              rendered from the same projection every terminal reads.
              Collapsed here: its six-class matrix, Base Value ids, Value
              Family ids, contradiction rows, resolver internals, DEMO
              relations, Color Roles and General Principle are exactly the
              ontology dump the primary Hub must not open with. */}
          <details style={AUDIT_DETAILS}>
            <summary style={SUMMARY_AUDIT}>
              קריאת התצפית האחרונה · OBSERVATION READING — 6 תאים, ערכי בסיס, משפחות ערך, ניגודים, Color Roles, DEMO
            </summary>
            <div style={{ marginTop: 10 }}>
              <ObservationReadingPanel subject={resolvedSubject ?? personRef.person_id} surface="HUB" />
            </div>
          </details>

          <details style={AUDIT_DETAILS}>
            <summary style={SUMMARY_AUDIT}>מרכז פיקוד · COMMAND CENTER — אוריינטציה, מרחב פעולה, קבוצות</summary>
            <div style={{ marginTop: 10 }}>{commandCenterSection}</div>
          </details>

          <details style={AUDIT_DETAILS}>
            <summary style={SUMMARY_AUDIT}>תוצאות פעולות · ACTION OUTCOMES — Effect/Learning ואבחון חוסרים</summary>
            <div id="action-outcomes" style={{ marginTop: 10 }}>{actionOutcomesSection}</div>
          </details>

          <details style={AUDIT_DETAILS}>
            <summary style={SUMMARY_AUDIT}>למידה שבועית · WEEKLY LEARNING — מעברי State, ראיות ולמידות השבוע</summary>
            <div id="weekly-learning" style={{ marginTop: 10 }}>
              <WeeklyLearningPanel subject={resolvedSubject ?? personRef.person_id} asOf={systemClock.now()} />
            </div>
          </details>

          {/* A012/05B — everything below is real, kept, never deleted, but
              demoted out of the first viewport: Day Opening/Closing,
              Mission, Human Config summary, Orientation detail, and the
              legacy PhilosToday dashboard are all real secondary depth,
              not the NOW/ATTENTION/NEXT-ACTION/RECENT-RESULT surface a
              first-time visitor needs. Collapsed, not hidden — every field
              here was visible above the fold before this pass; none of it
              is gone. */}
          <details style={AUDIT_DETAILS}>
            <summary style={SUMMARY_AUDIT}>
              עוד · MORE — Day Opening/Closing, Mission, Human Config, Orientation detail
            </summary>
            <div style={{ marginTop: 10 }}>
              {dayCycleSection}
              {missionSection}
              <HumanConfigSummaryCard summary={humanConfigSummary} sourceFileName={humanConfigSourceFileName} />
              {/* Phase 4 vertical slice — SAME shared component Dynamics renders
                  (`CanonicalSlicePanel.tsx`), SAME subject, so this section and
                  Dynamics' own copy never disagree about PersonInstance/
                  ValueDomainInstance state. */}
              <CanonicalSlicePanel subject={resolvedSubject ?? personRef.person_id} asOf={systemClock.now()} />
              <details style={{ margin: "12px 0" }}>
                <summary style={{ cursor: "pointer", fontSize: 13, letterSpacing: 1, color: "#6c86b5", padding: "4px 0" }}>
                  EXAMPLES / DEMO — Value Domain (Music, hypothesis-only) — לא משפיע על REAL
                </summary>
                <div style={{ marginTop: 8 }}>
                  <ValueDomainDemoPanel today={todayIn(systemClock)} />
                  <HumanValueMatrix />
                </div>
              </details>
              {orientationSection}
            </div>
          </details>
        </div>
      ) : null}
      <details style={{ ...AUDIT_DETAILS, margin: "0 20px 20px" }}>
        <summary style={SUMMARY_AUDIT}>
          לוח מחוונים מלא · FULL LEGACY DASHBOARD
        </summary>
      <PhilosToday
        figures={figures}
        you={{
          display_name: identity.display_name,
          name_is_recorded: identity.display_name_source === "event",
          registered: identity.registered,
          memberships: identity.memberships.map((m) => ({
            group_name: m.group_name,
            basis: m.basis,
            since: m.since,
          })),
          recorded_events: identity.recorded_event_ids.length,
          source_events: identity.provenance.sample_size,
        }}
        canonSection={<CanonOrientationLookup />}
      />
      </details>
      {/* LAST on Hub, by the required render order: opening → orientation →
          priority → next action → terminal content → closing. The DEMO
          section sits below all REAL content and above the closing, so the
          operational act stays the final thing on the page. */}
      <div style={{ padding: "0 20px 20px" }}>
        <DemoSimulationSection terminal="hub" />
        <DayClosingPanel session={daySession} readOnly={!dayIsToday} />
      </div>
    </div>
  );
}
