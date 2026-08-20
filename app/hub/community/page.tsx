import path from "path";
import { connection } from "next/server";

import ValueHub from "../ValueHub";
import ActionCollectiveContext from "./ActionCollectiveContext";
import CommunityCommandTerminal, { type Provenance } from "./CommunityCommandTerminal";
import CommunityComparison from "./CommunityComparison";
import CommunityLivingView from "./CommunityLivingView";
import CommunityUniverse, { type ActivityRow, type ImpactRow, type Mode, type PersonRow } from "./CommunityUniverse";
import { SOURCE_CONCEPT_TYPES, type SourceConceptType } from "@/app/lib/philos/community/sourceValueModel";
import { joinGroupAction, postUpdateAction, proposeAllocationAction, recordImpactAction } from "../actions";
import { systemClock, todayIn } from "@/app/lib/philos/eventStore";
import { buildActivityFeed, buildCapitalTimeline, buildContributorRanking, buildMembershipTimeline, projectValueGroup, type ValueGroupView } from "@/app/lib/philos/projectValueGroup";
import { linksByRelation } from "@/app/lib/philos/bridge/entityLink";
import ValueGroupsBoard, { type ValueGroupCardData } from "./ValueGroupsBoard";
import ObservationReadingPanel from "@/app/lib/philos/shell/ObservationReadingPanel";
import { resolveValueGroups, type ResolverGroupInput } from "@/app/lib/philos/valueSystem/groupResolver";
import { buildOperationalGroupProfile, deriveLeadingFamily } from "@/app/lib/philos/valueSystem/operationalGroup";
import { classifyObservationText } from "@/app/lib/philos/valueSystem/classifier";
import { projectCanonDynamics } from "@/app/lib/philos/canon/projectCanonDynamics";
import OperationalGroupDetail from "./OperationalGroupDetail";
import { buildCommunityTensions, sortTensions } from "@/app/lib/philos/tension";
import { GROUP_ID } from "@/app/lib/philos/valueGroupLog";
import { DEMO_COMMUNITIES } from "@/app/lib/philos/demoCommunities";
import { buildDefaultLinkRegistry } from "@/app/lib/philos/bridge/linkRegistry";
import { loadPhilosEvents } from "@/app/lib/philos-event-store";
import { resolveViewer } from "@/app/lib/philos-viewer";
import { loadActions } from "@/app/lib/philos/canon/actionStoreAccessor";
import { loadEffects } from "@/app/lib/philos/canon/effectStoreAccessor";
import { isEffectVerified } from "@/app/lib/philos/canon/effect";
import { findNeedsForSubject } from "@/app/lib/philos/canon/needStoreAccessor";
import { findOffersForSource } from "@/app/lib/philos/canon/offerStoreAccessor";
import { resolvePersonRef } from "@/app/lib/philos/person/personRef";
import { loadNeedGroupLinks } from "@/app/lib/philos/community/needGroupLinkStoreAccessor";
import { loadSocialChronology } from "@/app/lib/philos/social/loadSocialChronology";
import SocialChronologyPanel from "@/app/lib/philos/shell/SocialChronologyPanel";
import PersonFrameStrip from "@/app/lib/philos/shell/PersonFrameStrip";
import SocialSourceSpinePanel from "@/app/lib/philos/shell/SocialSourceSpinePanel";
import SocialValueSpinePanel from "@/app/lib/philos/shell/SocialValueSpinePanel";
import SocialRoleStrip from "@/app/lib/philos/shell/SocialRoleStrip";
import { loadSocialSystem } from "@/app/lib/philos/social/loadSocialSystem";
import { resolveSocialSelection } from "@/app/lib/philos/social/socialSelection";
import { buildSocialFlow } from "@/app/lib/philos/social/socialFlowStages";
import SocialFrame from "@/app/lib/philos/shell/SocialFrame";
import { buildSocialValueSpine } from "@/app/lib/philos/valueSystem/socialValueSpine";
import { resolvePersonFrame } from "@/app/lib/philos/person/personFrameAccessor";
import { resolvePersonContext } from "@/app/lib/philos/person/personContext";
import { SystemShell } from "@/app/lib/philos/shell/SystemShell";
import { AuditHeading, AuditSection } from "@/app/lib/philos/shell/epistemics";
import { resolveShellIdentityLink } from "@/app/lib/philos/community/resolveShellIdentityLink";
import { buildValueRegistry, buildValueRelations, type GroupProvenance, type PudmValueSource, type ValueScope } from "@/app/lib/philos/community/valueRegistry";
import { RAW_FAMILIES, RAW_SOURCE_ENTRIES, SUBVALUES } from "@/app/lib/philos/community/valueUniverse328";
import { classifySubvalues, type SubvalueStatus } from "@/app/lib/philos/community/valueUniverseClassification";
import type { UniverseSubvalueView, UniverseFilters, UniverseProvenanceFilter } from "./ValueUniverseView";
import { buildGroupRegistry, buildPossibleGroups, type GroupRegistryEntry } from "@/app/lib/philos/community/groupRegistry";
import { readJsonStore } from "@/app/lib/json-store";
import type { Value } from "@/app/lib/value/schema";
import PersonCommunityLinkPanel from "./PersonCommunityLinkPanel";
import { parseSystemContextRef } from "@/app/lib/systemContext";
import { resolveSharedContext } from "@/app/lib/philos/sharedContext";
import EntityContextPanel from "@/app/lib/philos/shell/EntityContextPanel";
import CommunityExperience, { type FamilyGroupLink, type NetworkStats } from "./CommunityExperience";
import CanonicalSlicePanel from "@/app/hub/CanonicalSlicePanel";
import CommunityPrototype, { type PrototypeLiveData, type PrototypeLiveFamilyGroup } from "./CommunityPrototype";
import { SOURCE_VALUE_RELATIONS } from "@/app/lib/philos/community/sourceValueModel";

export const metadata = { title: "Philos — קבוצת ערך" };

const MODE_KEYS: Mode[] = ["overview", "universe", "values", "groups", "relations", "quality", "people", "needs", "resources", "activity", "impact"];

export default async function CommunityPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await connection();

  const events = await loadPhilosEvents();
  const viewer = await resolveViewer();
  const today = todayIn(systemClock);
  const group = projectValueGroup(events, GROUP_ID, today);

  const params = await searchParams;
  // STEP 1 — the ONE shared identity reference.
  const personRef = resolvePersonRef(params.subject);
  // STEP 2 — the frame this screen's readings are relative to (canon §19).
  const personContext = resolvePersonContext({ person: personRef, asOf: systemClock.now() });
  const isPrototypeView = params.view === "prototype";

  const mode: Mode = (typeof params.mode === "string" && MODE_KEYS.includes(params.mode as Mode) ? (params.mode as Mode) : "overview");
  const hasExplicitCommunity = typeof params.community === "string";
  const requestedCommunity = hasExplicitCommunity ? (params.community as string) : GROUP_ID;
  const demoMatch = DEMO_COMMUNITIES.find((c) => c.group_id === requestedCommunity);
  // GROUP DETAIL only renders when the universe's GROUPS landscape was
  // explicitly drilled into (ledger §40) — every other mode ignores
  // `?community=` and shows the landscape instead of one group's detail.
  const showingGroupDetail = mode === "groups" && hasExplicitCommunity;
  const terminalGroup = demoMatch
    ? projectValueGroup(demoMatch.events, demoMatch.group_id, demoMatch.today)
    : group;
  const terminalEvents = demoMatch ? demoMatch.events : events;
  const terminalProvenance: Provenance = demoMatch ? "DEMO" : "REAL";

  const allCommunities: { group_id: string; events: typeof events; today: string; provenance: Provenance }[] = [
    { group_id: GROUP_ID, events, today, provenance: "REAL" },
    ...DEMO_COMMUNITIES.map((c) => ({ group_id: c.group_id, events: c.events, today: c.today, provenance: "DEMO" as const })),
  ];
  const currentIndex = allCommunities.findIndex((c) => c.group_id === terminalGroup?.group_id);
  const otherEntry = currentIndex >= 0 ? allCommunities[(currentIndex + 1) % allCommunities.length] : undefined;
  const otherGroup = otherEntry ? projectValueGroup(otherEntry.events, otherEntry.group_id, otherEntry.today) : null;

  let actions: Awaited<ReturnType<typeof loadActions>> = [];
  try {
    actions = await loadActions();
  } catch {
    actions = [];
  }
  let effects: Awaited<ReturnType<typeof loadEffects>> = [];
  try {
    effects = await loadEffects();
  } catch {
    effects = [];
  }

  // ONE authority for every social fact this page shows. The registry used to
  // be built here WITHOUT needs or actions, so it produced no real links and
  // the group card contradicted the flow rail in the same viewport.
  const social = await loadSocialSystem();
  const chronology = social.chronology;
  const socialObjects = social.objects;
  const bridgeLinks = social.bridgeLinks;
  const socialSelection = resolveSocialSelection(params.sel, socialObjects);
  const identityLink = await resolveShellIdentityLink();

  const activityFeed = group ? buildActivityFeed(events, GROUP_ID, 15) : [];
  let realNeedsCount = 0;
  // Needs this subject may declare a group for: their own, carrying no group
  // yet. Nothing here reads the Need text to guess a group — the list is
  // "ungrouped", the choice is the person's.
  let declarableNeeds: { need_id: string; desired_change: string }[] = [];
  try {
    const own = await findNeedsForSubject(personRef.person_id);
    const linked = identityLink.status === "VERIFIED_SAME_PERSON" ? await findNeedsForSubject(identityLink.community_member_id) : [];
    realNeedsCount = new Set([...own, ...linked].map((n) => n.need.need_id)).size;

    // "Ungrouped" is decided by the ONE map that knows both sources: an
    // origin group written at creation, and an explicit later declaration.
    declarableNeeds = own
      .filter((n) => !social.needGroups.has(n.need.need_id))
      .map((n) => ({ need_id: n.need.need_id, desired_change: n.need.desired_change }));
  } catch {
    realNeedsCount = 0;
  }
  let realOffersCount = 0;
  try {
    const own = await findOffersForSource(personRef.person_id);
    const linked = identityLink.status === "VERIFIED_SAME_PERSON" ? await findOffersForSource(identityLink.community_member_id) : [];
    realOffersCount = new Set([...own, ...linked].map((o) => o.offer.offer_id)).size;
  } catch {
    realOffersCount = 0;
  }

  // ── Value + Value-Group Universe (ledger §40) ───────────────────────────
  // Pure folds over already-projected data — real REAL group, real DEMO
  // groups, real PUDM "Candidate" values (§39: MIGRATABLE). No new store.
  const demoViews = DEMO_COMMUNITIES
    .map((c) => ({ id: c.group_id, view: projectValueGroup(c.events, c.group_id, c.today) }))
    .filter((d): d is { id: string; view: ValueGroupView } => d.view !== null);
  const groupsWithProvenance: { view: ValueGroupView; provenance: GroupProvenance }[] = [
    ...(group ? [{ view: group, provenance: "REAL" as const }] : []),
    ...demoViews.map((d) => ({ view: d.view, provenance: "DEMO" as const })),
  ];
  // SAME shared accessor as every other surface. Community DOES have real
  // membership evidence, so it passes it: the value axis is VERIFIED here
  // rather than projected-less. Only REAL groups the identity-linked member
  // actually belongs to — DEMO groups and mere value similarity never
  // qualify, so config can never imply membership.
  // The latest real Observation's own free text — used only to report which
  // of the 24 source oppositions it NAMES. A mention, never a measurement.
  const latestObservationText = await (async () => {
    try {
      const { canonEventStore } = await import("@/app/lib/philos/canon/canonEventStoreAccessor");
      const events = await canonEventStore().load();
      const obs = events.filter((e) => e.canon_type === "observation" && e.payload.subject === personRef.person_id);
      const latest = [...obs].sort((a, b) => b.payload.time.localeCompare(a.payload.time))[0];
      return latest ? String(latest.payload.context ?? "") : undefined;
    } catch { return undefined; }
  })();

  const personFrame = await resolvePersonFrame({
    subject: personRef.person_id,
    asOf: systemClock.now(),
    verifiedGroups: identityLink.status === "VERIFIED_SAME_PERSON"
      ? groupsWithProvenance.filter(
          (g) => g.provenance === "REAL"
            && g.view.members.some((m) => m.person_id === identityLink.community_member_id),
        )
      : [],
  }).catch(() => null);

  const pudmValuesRaw = readJsonStore<Value>(path.join(process.cwd(), "data", "values.json"));
  const pudmValues: PudmValueSource[] = pudmValuesRaw.map((v) => ({ id: v.id, context: { label: v.context.label, domain: v.context.domain } }));
  const valueRegistry = buildValueRegistry(groupsWithProvenance, pudmValues);
  const valueRelations = buildValueRelations();

  // ── Value Universe (Mission B, 328-entry Board reconciliation) ──────────
  // Real classification against the SAME live `valueRegistry` names above
  // — never a hand-typed guess (§ this pass's own established discipline
  // after catching a false-positive substring match earlier: "כנות" was
  // never really related to "שכנות טובה", see `valueUniverseClassification.ts`).
  const runtimeValueNameToEntry = new Map(valueRegistry.map((v) => [v.name, v] as const));
  const classifiedSubvalues = classifySubvalues(SUBVALUES, valueRegistry.map((v) => v.name));
  const universeSubvalues: UniverseSubvalueView[] = classifiedSubvalues.map((sv) => {
    const matchedEntry = sv.matched_runtime_value_names.length > 0 ? runtimeValueNameToEntry.get(sv.matched_runtime_value_names[0]) : undefined;
    return { ...sv, scope: matchedEntry?.scope, matched_runtime_value_id: matchedEntry?.value_id };
  });
  // B3 — Value-Family-derived group CANDIDATEs (explicitly NOT real
  // groups): a family with zero real/DEMO group centered on any of its
  // matched runtime subvalues. Real, mechanical check against `groups`
  // already computed above — never a guess at who "should" form one.
  const familyIdsWithRealOrDemoGroup = new Set(
    universeSubvalues.filter((sv) => sv.matched_runtime_value_id && (runtimeValueNameToEntry.get(sv.matched_runtime_value_names[0])?.groups.length ?? 0) > 0)
      .map((sv) => sv.family_id).filter((id): id is string => id !== null),
  );
  const universeFamilyCandidates = RAW_FAMILIES.filter((f) => !familyIdsWithRealOrDemoGroup.has(f.id))
    .map((f) => ({ family_id: f.id, name_he: f.name_he }));

  // Reciprocal of the Value detail page's FAMILY/SUBVALUES row (B2): the
  // real 328-universe Value Family for a given group's own real
  // central_value, via the SAME `universeSubvalues` join — never
  // re-derived, never forced when no match exists.
  const valueFamilyForCentralValue = (centralValue: string): string | undefined => {
    const match = universeSubvalues.find((sv) => sv.matched_runtime_value_names.includes(centralValue) && sv.family_id);
    return match?.family_id ? RAW_FAMILIES.find((f) => f.id === match.family_id)?.name_he : undefined;
  };

  const UNIVERSE_SCOPES: ValueScope[] = ["INDIVIDUAL", "GROUP", "COMMON"];
  const UNIVERSE_STATUSES: SubvalueStatus[] = ["CANONICAL_RUNTIME", "REVIEW_REQUIRED", "REFERENCE_ONLY", "UNSUPPORTED"];
  const universeFilters: UniverseFilters = {
    search: typeof params.search === "string" && params.search.length > 0 ? params.search : undefined,
    familyId: typeof params.family === "string" && params.family.length > 0 ? params.family : undefined,
    subvalueId: typeof params.subvalue === "string" ? params.subvalue : undefined,
    scope: typeof params.uscope === "string" && UNIVERSE_SCOPES.includes(params.uscope as ValueScope) ? (params.uscope as ValueScope) : undefined,
    status: typeof params.ustatus === "string" && UNIVERSE_STATUSES.includes(params.ustatus as SubvalueStatus) ? (params.ustatus as SubvalueStatus) : undefined,
    provenance: params.uprov === "RUNTIME" || params.uprov === "SOURCE_ONLY" ? (params.uprov as UniverseProvenanceFilter) : undefined,
  };
  const groupRegistry = buildGroupRegistry(groupsWithProvenance);
  const possibleGroups = buildPossibleGroups(valueRegistry);
  const selectedValueId = typeof params.value === "string" ? params.value : undefined;
  const selectedConceptType: SourceConceptType | undefined =
    typeof params.conceptType === "string" && SOURCE_CONCEPT_TYPES.includes(params.conceptType as SourceConceptType)
      ? (params.conceptType as SourceConceptType)
      : undefined;

  const statusOf = (groupId: string): GroupRegistryEntry["status"] => groupRegistry.find((g) => g.group_id === groupId)?.status ?? "DEMO";

  const people: PersonRow[] = (() => {
    const byId = new Map<string, PersonRow>();
    for (const { view } of groupsWithProvenance) {
      for (const m of view.members) {
        const membership = { group_id: view.group_id, group_name: view.name, status: statusOf(view.group_id), central_value: view.central_value };
        const existing = byId.get(m.person_id);
        const isLinked = identityLink.status === "VERIFIED_SAME_PERSON" && m.person_id === identityLink.community_member_id;
        if (existing) existing.memberships.push(membership);
        else byId.set(m.person_id, { person: m, memberships: [membership], is_identity_linked: isLinked });
      }
    }
    return [...byId.values()];
  })();

  const eventsByGroupId = new Map<string, typeof events>([
    [GROUP_ID, events],
    ...DEMO_COMMUNITIES.map((c) => [c.group_id, c.events] as const),
  ]);
  const activityAll: ActivityRow[] = groupsWithProvenance.flatMap(({ view }) =>
    buildActivityFeed(eventsByGroupId.get(view.group_id) ?? [], view.group_id)
      .map((a) => ({ ...a, group_id: view.group_id, group_name: view.name, status: statusOf(view.group_id) })),
  ).sort((a, b) => `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`));

  const impactAll: ImpactRow[] = groupsWithProvenance.flatMap(({ view }) =>
    view.impact.map((i) => ({ ...i, group_id: view.group_id, group_name: view.name, status: statusOf(view.group_id) })),
  );

  // ── CommunityExperience (new primary screen) — real per-family group
  // links, via the SAME `universeSubvalues.matched_runtime_value_id` join
  // already used elsewhere (Brain L6, Value detail's FAMILY row) — never
  // re-derived, never fabricated. ────────────────────────────────────────
  const familyGroups: Record<string, FamilyGroupLink[]> = {};
  for (const sv of universeSubvalues) {
    if (!sv.family_id || !sv.matched_runtime_value_id) continue;
    const entry = valueRegistry.find((v) => v.value_id === sv.matched_runtime_value_id);
    if (!entry) continue;
    for (const gid of entry.groups) {
      const g = groupRegistry.find((gr) => gr.group_id === gid);
      if (!g || (g.status !== "REAL" && g.status !== "DEMO")) continue;
      const arr = familyGroups[sv.family_id] ?? (familyGroups[sv.family_id] = []);
      if (!arr.some((x) => x.group_id === g.group_id)) {
        arr.push({ group_id: g.group_id, group_name: g.name, status: g.status, central_value: g.central_value, member_count: g.member_count, verified_effects: g.verified_effects });
      }
    }
  }
  const experienceNetwork: NetworkStats = {
    realGroups: groupRegistry.filter((g) => g.status === "REAL").length,
    demoGroups: groupRegistry.filter((g) => g.status === "DEMO").length,
    people: people.length,
    needs: realNeedsCount,
    resources: realOffersCount,
    activeActions: actions.length,
    verifiedEffects: groupRegistry.reduce((s, g) => s + g.verified_effects, 0),
  };

  // R5.2 — real member list per group, for the live prototype's group
  // drill-down (real `ValueGroupView.members`, the SAME real projection
  // every other surface reads, never re-derived).
  const familyGroupsLive: Record<string, PrototypeLiveFamilyGroup[]> = {};
  for (const [familyId, links] of Object.entries(familyGroups)) {
    familyGroupsLive[familyId] = links.map((l) => {
      const view = groupsWithProvenance.find(({ view }) => view.group_id === l.group_id)?.view;
      return { ...l, members: view ? view.members.map((m) => ({ person_id: m.person_id, display_name: m.display_name })) : [] };
    });
  }
  const canonVerifiedEffectsCount = effects.filter((e) => isEffectVerified(e.effect)).length;
  const prototypeLiveData: PrototypeLiveData = {
    familyGroups: familyGroupsLive,
    canonNeedsCount: realNeedsCount,
    canonOffersCount: realOffersCount,
    canonActionsCount: actions.length,
    canonEffectsCount: effects.length,
    canonVerifiedEffectsCount,
    identityLinked: identityLink.status === "VERIFIED_SAME_PERSON",
    realGroupsCount: experienceNetwork.realGroups,
    peopleCount: experienceNetwork.people,
    // Bug fix (R5.2 live check): `experienceNetwork.verifiedEffects` sums
    // ALL groups (REAL+DEMO), which silently blended DEMO data into a
    // REAL-only network strip — caught by live verification (rendered 3,
    // not the real 1). REAL-only here, matching this screen's own
    // "REAL default, DEMO hidden" rule.
    legacyVerifiedEffectsCount: groupRegistry.filter((g) => g.status === "REAL").reduce((s, g) => s + g.verified_effects, 0),
  };

  // Recovery board task R5.2 — `?view=prototype` now renders with REAL
  // live selectors (family→group→members/needs/offers/actions/effects),
  // still a separate acceptance route from production — see
  // `CommunityPrototype.tsx`'s own header. Early return here, before the
  // production-only computation below (activity feed, ctx resolution,
  // bridge registry), which the prototype route doesn't use.
  if (isPrototypeView) {
    return <CommunityPrototype live={prototypeLiveData} />;
  }
  const isAuditView = params.view === "audit";

  // LOOP 0054 — the same shared `?ctx=` resolver Dynamics/Globe/Marketplace
  // already use, now reachable from Community too. Scoped here to the
  // `action:`/`effect:` kinds it can genuinely resolve today (canon
  // Observation/legacy-event detail rendering doesn't exist as a Community
  // view yet — not added here, out of this loop's scope); any other ref
  // kind resolves normally (`none`/`unknown`/`not_found`) and the panel
  // below simply renders nothing.
  const ctxRaw = typeof params.ctx === "string" ? params.ctx : undefined;
  const entityContext = await resolveSharedContext(parseSystemContextRef(ctxRaw));

  // Operational-groups pass — the ONE shared profile for the REAL group,
  // loaded only when its detail is actually being shown.
  const operationalProfile = showingGroupDetail && !demoMatch && group
    ? await buildOperationalGroupProfile().catch(() => null)
    : null;

  // ── VALUE GROUPS board (Visual Delivery pass) — one card per group, all
  // fields folded from data THIS page already computed above: the same
  // `groupsWithProvenance` projections, the same `bridgeLinks` registry,
  // the same real Need/Offer counts, the same identity link. The capital/
  // membership timelines are the same pure folds the group-detail terminal
  // already runs — computed here once per group, no new store. ────────────
  // The ONE shared Value Group resolver (valueSystem/groupResolver.ts) —
  // person-level relations only here (no observation classification on the
  // board): MEMBER_OF / CONTRIBUTES_TO / BENEFITS_FROM / TENSION from real
  // records; value similarity plays no part in this call at all.
  const resolverInput: ResolverGroupInput[] = groupsWithProvenance.map(({ view, provenance }) => ({
    group_id: view.group_id,
    name: view.name,
    central_value: view.central_value,
    provenance,
    member_ids: view.members.map((m) => m.person_id),
    transfers: view.transfers.filter((t) => t.state === "completed").map((t) => ({ transfer_id: t.transfer_id, recipient: t.recipient })),
    effects: view.impact.map((i) => ({ id: i.impact_id, verified: i.verified })),
    tension_ids: sortTensions(buildCommunityTensions(view, provenance)).map((t) => t.id),
    bridge_action_ids: linksByRelation(bridgeLinks, "ACTION_AFFECTS_COMMUNITY")
      .filter((l) => l.target.canonical_id === view.group_id).map((l) => l.source.canonical_id),
    bridge_effect_ids: identityLink.status === "VERIFIED_SAME_PERSON"
      ? linksByRelation(bridgeLinks, "EFFECT_AFFECTS_PERSON")
          .filter((l) => l.target.canonical_id === identityLink.community_member_id).map((l) => l.source.canonical_id)
      : [],
  }));
  // The latest real Observation's classification (same shared classifier
  // the panel uses) so each card can carry its own honest
  // OBSERVATION↔GROUP state alongside the person relations.
  const latestObsClassification = await projectCanonDynamics()
    .then((canon) => {
      const latest = canon.nodes
        .filter((n) => n.subject === personRef.person_id)
        .sort((a, b) => b.observed_at.localeCompare(a.observed_at))[0];
      return latest ? classifyObservationText(latest.context) : null;
    })
    .catch(() => null);

  const boardResolution = resolveValueGroups({
    familyMatches: latestObsClassification?.value_family_matches ?? [],
    generalValueMatches: latestObsClassification?.general_value_matches ?? [],
    baseValueMatches: latestObsClassification?.base_value_matches ?? [],
    groups: resolverInput,
    viewer: identityLink.status === "VERIFIED_SAME_PERSON"
      ? { linked: true, community_member_id: identityLink.community_member_id }
      : { linked: false },
  });

  const groupCards: ValueGroupCardData[] = groupsWithProvenance.map(({ view, provenance }) => {
    const groupEvents = eventsByGroupId.get(view.group_id) ?? [];
    const capitalTl = buildCapitalTimeline(groupEvents);
    const membershipTl = buildMembershipTimeline(groupEvents);
    const capitalLast = capitalTl[capitalTl.length - 1];
    const membershipLast = membershipTl[membershipTl.length - 1];
    const isLinkedMember = identityLink.status === "VERIFIED_SAME_PERSON"
      && view.members.some((m) => m.person_id === identityLink.community_member_id);
    return {
      view,
      provenance,
      bridgeActionCount: linksByRelation(bridgeLinks, "ACTION_AFFECTS_COMMUNITY").filter((l) => l.target.canonical_id === view.group_id).length,
      capital: capitalLast ? { balance: capitalLast.balance, lastDelta: capitalLast.delta, date: capitalLast.date, currency: capitalLast.currency } : null,
      membership: membershipLast ? { count: membershipLast.count, lastJoinDate: membershipLast.date } : null,
      openTensions: sortTensions(buildCommunityTensions(view, provenance)).length,
      personRelation: { linked: isLinkedMember, memberId: isLinkedMember && identityLink.status === "VERIFIED_SAME_PERSON" ? identityLink.community_member_id : undefined },
      // Canon Needs/Offers are subject-owned with no group key — honestly
      // attachable only to the REAL group via the verified identity link.
      linkedSubjectNeeds: provenance === "REAL" && identityLink.status === "VERIFIED_SAME_PERSON" ? realNeedsCount : null,
      // From the ONE registry, same source the flow rail reads.
      groupNeedLinks: linksByRelation(bridgeLinks, "COMMUNITY_HAS_NEED")
        .filter((l) => l.source.canonical_id === view.group_id || l.target.canonical_id === view.group_id).length,
      linkedSubjectOffers: provenance === "REAL" && identityLink.status === "VERIFIED_SAME_PERSON" ? realOffersCount : null,
      resolvedRelations: boardResolution.groups.find((g) => g.group_id === view.group_id)?.subject_relations ?? [],
      observationState: boardResolution.groups.find((g) => g.group_id === view.group_id)?.observation_state ?? "UNRESOLVED",
      leadingFamily: deriveLeadingFamily(view.central_value),
    };
  });

  return (
    // One page-level surface: the blocks below each paint their own
    // background, so the area under the last one fell through to the white
    // body. Same fix Hub already carries.
    <div style={{ background: "#0b0f1a", minHeight: "100vh" }}>
      <div style={{ padding: "12px 20px 0", background: "#0b0f1a" }}>
        <SystemShell
          surface="community"
          personContext={personContext}
          purpose="עולם הערכים והקבוצות של PHILOS — לא קבוצה אחת בלבד."
          community={showingGroupDetail && terminalGroup ? { group_id: terminalGroup.group_id, label: terminalGroup.name, provenance: terminalProvenance } : undefined}
          subject={personRef.person_id}
          valueLabel={showingGroupDetail && terminalGroup ? terminalGroup.central_value : undefined}
          identityLink={identityLink}
        />
      </div>

      {/* FAMILY ORIENTATION — where this surface sits in the SOCIAL family.
          Community is the GROUP zoom level. Not navigation (that is the nav
          capsule) and not a causal chain. */}
      <div style={{ margin: "10px 20px 0" }}>
        {/* ONE frame for the whole social layer. Previously six sibling
            bands; now one structure with lanes on a shared column grid, the
            same one Globe and World render. The source spine moves inside it
            as the collapsed AUDIT lane rather than a seventh box. */}
        <SocialFrame
          surface="community"
          spine={buildSocialValueSpine({
            verifiedGroupRelations: identityLink.status === "VERIFIED_SAME_PERSON"
              ? groupsWithProvenance.filter((g) => g.provenance === "REAL"
                  && g.view.members.some((m) => m.person_id === identityLink.community_member_id)).length
              : 0,
            valueGroups: groupsWithProvenance.filter((g) => g.provenance === "REAL").length,
          }).links}
          roles={{
            action: groupsWithProvenance.filter((g) => g.provenance === "REAL")
              .reduce((n, g) => n + g.view.impact.length, 0),
            evidence: groupsWithProvenance.filter((g) => g.provenance === "REAL")
              .reduce((n, g) => n + g.view.impact.filter((i) => i.verified).length, 0),
            relations: groupCards.filter((g) => g.provenance === "REAL")
              .reduce((n, g) => n + g.view.members.length + g.resolvedRelations.length, 0),
            meaning: groupCards.filter((g) => g.provenance === "REAL" && g.leadingFamily).length,
          }}
          // Same flow builder and the SAME canon totals as Globe and World.
          // Only the two value-model stages are scale-specific.
          flow={social.flow({
            valueGroups: groupsWithProvenance.filter((g) => g.provenance === "REAL").length || null,
            memberships: groupCards.filter((g) => g.provenance === "REAL")
              .reduce((n, g) => n + g.view.members.length, 0) || null,
          })}
          chronology={chronology}
          objects={socialObjects}
          selection={socialSelection}
          // NOW — this surface's own primary content, INSIDE the frame. The
          // board used to sit below it, which made the frame a header rather
          // than the surface. One object on screen, not a header plus a page.
          primary={!showingGroupDetail ? (
            <ValueGroupsBoard
              groups={groupCards}
              linkedSubject={identityLink.status === "VERIFIED_SAME_PERSON" ? personRef.person_id : undefined}
            />
          ) : undefined}
          // AUDIT — the source spine and the shared person/value state, both
          // collapsed in the one SOURCE lane instead of two separate bands.
          audit={
            <>
              <SocialSourceSpinePanel surface="community" observationText={latestObservationText} />
              <div style={{ marginTop: 8 }}>
                <AuditSection title="מצב אדם / ערך · PERSON / VALUE STATE" note="Phase 4 · CANON — זהה לכל שאר המסופים">
                  <CanonicalSlicePanel subject={personRef.person_id} asOf={systemClock.now()} />
                </AuditSection>
              </div>
            </>
          }
        />
      </div>

      {entityContext.status === "found_entity" ? (
        <div dir="rtl" style={{ margin: "12px 20px 0" }}>
          <EntityContextPanel selected={entityContext} here="community" />
        </div>
      ) : entityContext.status === "unknown" || entityContext.status === "not_found" ? (
        <div dir="rtl" style={{ margin: "12px 20px 0", padding: "10px 14px", borderRadius: 8, border: "1px solid #5a4a2a", fontSize: 11, color: "#cfe0f5" }}>
          {entityContext.status === "unknown" ? entityContext.raw : ctxRaw} — {entityContext.status === "unknown" ? "לא זוהה כמזהה תקין. לא ידוע." : "לא נמצאה רשומה תואמת (Action/Effect קנוני בלבד נתמכים כרגע ב-Community). לא ידוע."}
        </div>
      ) : null}

      {/* Phase 6A — the SAME shared Person/Value runtime state Hub/Dynamics/
          Brain already render (`CanonicalSlicePanel`, unmodified). Real
          canon Action/Effect/Evidence for personRef.person_id are already
          shown elsewhere on this page (`realActionsCount`, `actionsSection`
          etc.) — this adds the Phase 4 Human/Music/Color source_refs +
          current_state/history/evidence layer Community did not read
          before. Collapsed — not primary flow content. */}

      {/* PRIMARY — the Value Groups board. Everything on it is a fold over
          data this page already loaded; the universe explorer below keeps
          every capability it had, one fold down. */}
      {!showingGroupDetail ? (
        <>
          {/* 7-terminal propagation — the SAME shared Observation reading;
              on Community the VALUE GROUP relation row is the point: a real
              join or UNRESOLVED, never an invented membership. */}
          {/* STEP 5/6 — same product/audit split as Hub. Community's PRIMARY
              is the Value Groups board above; the ontology reading is real,
              unchanged, one click away. §9: technical below product. */}
          <div style={{ margin: "0 20px" }}>
            <AuditHeading accent="#34d399" />
            <AuditSection
              title="קריאת התצפית האחרונה · OBSERVATION READING"
              note="6 אזכורים, ערכי בסיס, משפחות ערך, ניגודים, Color Roles, DEMO"
            >
              <ObservationReadingPanel subject={personRef.person_id} surface="COMMUNITY" />
            </AuditSection>
          </div>
        </>
      ) : null}

      {/* SECONDARY — the full Value/Group Universe explorer (values,
          relations, quality, people, needs, resources, activity, impact
          modes). Unchanged internally; auto-opens whenever the viewer
          explicitly navigated into one of its modes via `?mode=`. */}
      {!showingGroupDetail ? (
        <details open={mode !== "overview"} style={{ margin: "0 20px 12px" }}>
          <summary style={{ cursor: "pointer", fontSize: 11, fontWeight: 700, letterSpacing: 1, color: "#5a76a3", padding: "10px 0", borderTop: "1px solid rgba(90,120,180,0.15)" }} dir="rtl">
            UNIVERSE / AUDIT — חקר עולם הערכים המלא ({valueRegistry.length} ערכים · {groupRegistry.length} קבוצות · {SUBVALUES.length} תתי-ערכים)
          </summary>
        <CommunityUniverse
          mode={mode}
          selectedValueId={selectedValueId}
          selectedConceptType={selectedConceptType}
          valueRegistry={valueRegistry}
          valueRelations={valueRelations}
          groupRegistry={groupRegistry}
          possibleGroups={possibleGroups}
          people={people}
          realNeedsCount={realNeedsCount}
          declarableNeeds={declarableNeeds}
          subjectId={personRef.person_id}
          realOffersCount={realOffersCount}
          realActionsCount={actions.length}
          activity={activityAll}
          impact={impactAll}
          identityLink={identityLink}
          groupsWithProvenance={groupsWithProvenance}
          canonActions={actions}
          canonEffects={effects}
          universeFamilies={RAW_FAMILIES}
          universeSubvalues={universeSubvalues}
          universeSourceEntries={RAW_SOURCE_ENTRIES}
          universeFilters={universeFilters}
          universeFamilyCandidates={universeFamilyCandidates}
          bridgeLinks={bridgeLinks}
        />
        </details>
      ) : null}

      {/* GROUP DETAIL — reached only via GROUPS landscape drill-down
          (ledger §40). REAL group reuses `CommunityLivingView` (§38); a
          DEMO group reuses the existing `CommunityCommandTerminal`. */}
      {showingGroupDetail && !demoMatch && group ? (
        <>
          <a href="?mode=groups" style={{ display: "block", margin: "8px 20px 0", fontSize: 11, color: "#5b9cf6", textDecoration: "none" }} dir="rtl">← נוף הקבוצות</a>
          {/* Operational-groups pass — the 13-section detail + acceptance
              trace, from the ONE shared profile assembler. */}
          {operationalProfile ? <OperationalGroupDetail profile={operationalProfile} /> : null}
          <CommunityLivingView
            group={group}
            activity={activityFeed}
            contributors={buildContributorRanking(events)}
            identityLink={identityLink}
            provenance="REAL"
            realNeedsCount={realNeedsCount}
            realOffersCount={realOffersCount}
            valueFamilyLabel={valueFamilyForCentralValue(group.central_value)}
          />
          <details dir="rtl" style={{ margin: "0 20px 16px" }}>
            <summary style={{ cursor: "pointer", fontSize: 10.5, letterSpacing: 1, color: "#5a76a3", padding: "4px 0" }}>DETAILS / AUDIT</summary>
            <div style={{ marginTop: 8 }}>
              <PersonCommunityLinkPanel
                personId={identityLink.person_id}
                communityMemberId={identityLink.community_member_id}
                communityMemberDisplayName={viewer.display_name}
                communityId={GROUP_ID}
                initialStatus={identityLink.status}
              />
              <CommunityCommandTerminal
                group={terminalGroup!}
                capital={buildCapitalTimeline(terminalEvents)}
                contributors={buildContributorRanking(terminalEvents)}
                tensions={sortTensions(buildCommunityTensions(terminalGroup!, terminalProvenance))}
                provenance={terminalProvenance}
                bridgeLinks={bridgeLinks}
                valueFamilyLabel={valueFamilyForCentralValue(terminalGroup!.central_value)}
              />
              {otherGroup && otherEntry ? (
                <CommunityComparison current={terminalGroup!} currentProvenance={terminalProvenance} other={otherGroup} otherProvenance={otherEntry.provenance} />
              ) : null}
              <ActionCollectiveContext actions={actions} identityLink={identityLink} />
            </div>
          </details>
          <ValueHub
            events={events}
            groupId={GROUP_ID}
            today={today}
            viewerId={viewer.person_id}
            joinAction={joinGroupAction}
            postAction={postUpdateAction}
            proposeAction={proposeAllocationAction}
            impactAction={recordImpactAction}
          />
        </>
      ) : null}

      {showingGroupDetail && demoMatch && terminalGroup ? (
        <>
          <a href="?mode=groups" style={{ display: "block", margin: "8px 20px 0", fontSize: 11, color: "#5b9cf6", textDecoration: "none" }} dir="rtl">← נוף הקבוצות</a>
          <CommunityCommandTerminal
            group={terminalGroup}
            capital={buildCapitalTimeline(terminalEvents)}
            contributors={buildContributorRanking(terminalEvents)}
            tensions={sortTensions(buildCommunityTensions(terminalGroup, terminalProvenance))}
            provenance={terminalProvenance}
            bridgeLinks={bridgeLinks}
            valueFamilyLabel={valueFamilyForCentralValue(terminalGroup.central_value)}
          />
          {otherGroup && otherEntry ? (
            <CommunityComparison current={terminalGroup} currentProvenance={terminalProvenance} other={otherGroup} otherProvenance={otherEntry.provenance} />
          ) : null}
          <div dir="rtl" style={{ margin: "16px 20px", padding: "14px 18px", borderRadius: 12, border: "1px solid rgba(251,191,36,0.3)", background: "rgba(251,191,36,0.06)", fontSize: 12, color: "#8fa3c9", lineHeight: 1.7 }}>
            <b style={{ color: "#fbbf24" }}>DEMO</b> — קהילת הדגמה זו לקריאה בלבד. פעולות כתיבה פועלות רק על הקבוצה האמיתית.{" "}
            <a href="?mode=groups" style={{ color: "#5b9cf6" }}>חזרה לנוף הקבוצות →</a>
          </div>
        </>
      ) : null}
    </div>
  );
}
