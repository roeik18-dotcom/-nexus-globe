import path from "path";
import WorldNow from "./WorldNow";
import EntityChainFlow from "@/app/lib/philos/crossTerminal/EntityChainFlow";
import UnifiedEntitySurface from "@/app/lib/philos/crossTerminal/UnifiedEntitySurface";
import { loadSelectedEntity } from "@/app/lib/philos/crossTerminal/loadSelectedEntity";
import SystemGateFunnel from "./SystemGateFunnel";
import { resolveViewerContextSemantics } from "@/app/lib/philos/context/resolveViewerContextSemantics";
import SignOutButton from "@/app/signin/SignOutButton";
import { resolveViewerGroupView } from "@/app/lib/philos/community/viewerGroupView";
import { readJsonStore } from "@/app/lib/json-store";
import type { Mission } from "@/app/lib/mission/schema";
import type { Gap } from "@/app/lib/gap/schema";
import type { Value } from "@/app/lib/value/schema";
import type { Capability } from "@/app/lib/capability/schema";
import type { ValueCapabilityRelation } from "@/app/lib/value-capability-relation/schema";
import type { Provider } from "@/app/lib/provider/schema";
import type { ProviderCapabilityRelation } from "@/app/lib/provider-capability-relation/schema";
import WorldView from "./WorldView";
import SystemGateVisual from "./SystemGateVisual";
import { SystemShell } from "@/app/lib/philos/shell/SystemShell";
import DemoSimulationSection from "@/app/lib/philos/analysis/DemoSimulationSection";
import RealDataGapPanel, { factFromCount, factFromRecords } from "@/app/lib/philos/day/RealDataGapPanel";
import { loadCanonEvents } from "@/app/lib/philos/canon/canonEventStoreAccessor";
import { selectRealUnitReadings } from "@/app/lib/philos/analysis/realUnitReadings";
import { COLOR, FS, RADIUS, STATUS, TYPE } from "@/app/lib/philos/shell/designTokens";
import TerminalPage, { type TerminalSection } from "@/app/lib/philos/shell/TerminalPage";
import { loadPhilosEvents } from "@/app/lib/philos-event-store";
import { systemClock, todayIn } from "@/app/lib/philos/eventStore";
import { projectValueGroup, type ValueGroupView } from "@/app/lib/philos/projectValueGroup";
import { DEMO_COMMUNITIES } from "@/app/lib/philos/demoCommunities";
import { resolvePersonRef } from "@/app/lib/philos/person/personRef";
import PersonFrameStrip from "@/app/lib/philos/shell/PersonFrameStrip";
import SocialSourceSpinePanel from "@/app/lib/philos/shell/SocialSourceSpinePanel";
import SocialValueSpinePanel from "@/app/lib/philos/shell/SocialValueSpinePanel";
import SocialRoleStrip from "@/app/lib/philos/shell/SocialRoleStrip";
import { loadSocialSystem } from "@/app/lib/philos/social/loadSocialSystem";
import { resolveViewerContext } from "@/app/lib/philos/identity/viewerContext";
import { resolveSocialSelection } from "@/app/lib/philos/social/socialSelection";
import { buildSocialFlow } from "@/app/lib/philos/social/socialFlowStages";
import { primaryStage } from "@/app/lib/philos/shell/primaryStage";
import SocialFrame from "@/app/lib/philos/shell/SocialFrame";
import { buildSocialPrimaryContext } from "@/app/lib/philos/social/socialPrimaryContext";
import { buildSocialValueSpine } from "@/app/lib/philos/valueSystem/socialValueSpine";
import SocialChronologyPanel from "@/app/lib/philos/shell/SocialChronologyPanel";
import { loadSocialChronology } from "@/app/lib/philos/social/loadSocialChronology";
import { resolvePersonFrame } from "@/app/lib/philos/person/personFrameAccessor";
import { resolvePersonContext } from "@/app/lib/philos/person/personContext";
import CanonicalSlicePanel from "@/app/hub/CanonicalSlicePanel";
import ObservationReadingPanel from "@/app/lib/philos/shell/ObservationReadingPanel";
import { AuditHeading, AuditSection } from "@/app/lib/philos/shell/epistemics";
import { buildOperationalGroupProfile } from "@/app/lib/philos/valueSystem/operationalGroup";
import DayStatusStrip from "@/app/lib/philos/day/DayStatusStrip";
import { loadDaySession } from "@/app/lib/philos/day/loadDaySession";
import { loadActionEffectProjection } from "@/app/lib/philos/crossTerminal/loadActionEffectProjection";
import ActionEffectPanel from "@/app/lib/philos/crossTerminal/ActionEffectPanel";

export const metadata = { title: "Living World — Philos" };

const DATA = path.join(process.cwd(), "data");

export default async function WorldPage({ searchParams }: {
  /** Only `sel` is read — the shared social selection, carried by the nav so
   *  the same object stays selected when the user changes scale. */
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  /* THE SHARED OPERATIONAL DAY — one projection, seven terminals. Loaded
     here rather than assembled per-page so every terminal shows the same
     day_id, the same identity pair and the same derived gate results. */
  const daySession = await loadDaySession();
  const params = (await searchParams) ?? {};
  // STEP 1 — the ONE shared identity reference. World has no `?subject=`,
  // so this resolves to the designated real subject, exactly as the bare
  // constant did before.
  const personRef = resolvePersonRef(await resolveViewerContext());
  /* THE SHARED ACTION→EFFECT READ. One loader for all seven terminals, so
     the same two records cannot appear as ids here, a bare count there and
     nothing at all elsewhere. This terminal interprets; it does not
     re-decide which records count. */
  const aeProjection = await loadActionEffectProjection(personRef.person_id);
  /* REAL unit readings — one shared selector, never a per-page derivation. */
  const realUnitReadings = selectRealUnitReadings({
    events: await loadCanonEvents(),
    subject_id: personRef.person_id,
  });
  // STEP 2 — the frame this screen's readings are relative to (canon §19).
  const personContext = resolvePersonContext({ person: personRef, asOf: systemClock.now() });
  // SAME shared accessor as Hub/Brain — this surface resolves no
  // frame of its own and cannot redefine Human Base / Value / Domain.
  const personFrame = await resolvePersonFrame({
    subject: personRef.person_id, asOf: systemClock.now(),
  }).catch(() => null);
  // Operational-groups pass — the ONE shared profile for World's
  // group-relevance block below.
  const worldGroupProfile = await buildOperationalGroupProfile().catch(() => null);
  const missions     = readJsonStore<Mission>                    (path.join(DATA, "missions.json"));
  const gaps         = readJsonStore<Gap>                        (path.join(DATA, "gaps.json"));
  const values       = readJsonStore<Value>                      (path.join(DATA, "values.json"));
  const capabilities = readJsonStore<Capability>                 (path.join(DATA, "capabilities.json"));
  const vcRelations  = readJsonStore<ValueCapabilityRelation>   (path.join(DATA, "value-capability-relations.json"));
  const providers    = readJsonStore<Provider>                   (path.join(DATA, "providers.json"));
  const pcRelations  = readJsonStore<ProviderCapabilityRelation>(path.join(DATA, "provider-capability-relations.json"));

  // Mission B, B10 — the SAME real central_value name-join Marketplace's
  // B6 established, reused here (World shares the exact same PUDM Value
  // dataset with Marketplace).
  const worldPhilosEvents = await loadPhilosEvents();
  // ONE authority. World previously built the projection with an EMPTY
  // needGroups map, which is why it reported NETWORK = 10 while the other two
  // reported 11 from the same records.
  const viewer = await resolveViewerContext();
  const social = await loadSocialSystem(viewer);
  const chronology = social.chronology;
  const socialObjects = social.objects;
  const worldToday = todayIn(systemClock);
  const worldRealGroup = (await resolveViewerGroupView({ events: worldPhilosEvents, today: worldToday })).view;
  const worldDemoViews = DEMO_COMMUNITIES
    .map((c) => projectValueGroup(c.events, c.group_id, c.today))
    .filter((v): v is ValueGroupView => v !== null);
  const worldCommunityGroups: { name: string; central_value: string; status: "REAL" | "DEMO" }[] = [
    ...(worldRealGroup ? [{ name: worldRealGroup.name, central_value: worldRealGroup.central_value, status: "REAL" as const }] : []),
    ...worldDemoViews.map((v) => ({ name: v.name, central_value: v.central_value, status: "DEMO" as const })),
  ];
  const communityGroupsByValueId: Record<string, { group_name: string; status: "REAL" | "DEMO" }[]> = {};
  for (const v of values) {
    const matches = worldCommunityGroups.filter((g) => g.central_value === v.context.label);
    if (matches.length > 0) communityGroupsByValueId[v.id] = matches.map((g) => ({ group_name: g.name, status: g.status }));
  }

  /* OBSERVED-tier figures, read off the SAME flow the frame renders — not a
     second count, and not a hardcoded 0. `eligible` is what reaches SYSTEM;
     `count` is what exists in the model. Keeping both visible is the whole
     point: "0 at this scale" and "these records exist" are both true, and
     collapsing them would either invent system relevance or erase real
     records. The reason string comes from the flow builder itself, so this
     strip cannot drift from the lane above it. */
  const systemFlow = social.flow({ scale: "SYSTEM" });
  const systemSelection = resolveSocialSelection(params?.sel, socialObjects);
  /* The SAME expression `SocialFrame` reads, off the SAME objects array, so
     the orientation band and this table cannot disagree. */
  const systemPresent = socialObjects.filter((o) => o.scales.SYSTEM.present).length;
  const systemReason = systemFlow.find((st) => st.not_eligible_because)?.not_eligible_because
    ?? "אין ראיה מערכתית רחבה משלו";
  /* SHARED PRIMARY CONTEXT — built by the ONE builder, from the ONE loader.
     World supplies only what is genuinely its own: its title, its audit node,
     and the fact that it draws no arcs. Every figure on the stage (headline,
     scope, relation accounting, provenance) is derived in
     `buildSocialPrimaryContext`, identically to GROUP and NETWORK, so no two
     scales can disagree about a number they both display. */
  const primaryCtx = buildSocialPrimaryContext({
    scale: "SYSTEM",
    viewer,
    title: "המערכת הרחבה · WIDER SYSTEM",
    subtitle: "מה נצפה בקנה־מידה מערכתי, ומה קיים אך אינו מגיע לכאן. UNKNOWN ≠ 0.",
    objects: socialObjects,
    bridgeLinks: social.bridgeLinks,
    selection: systemSelection,
  });

  /* THE SHARED CROSS-TERMINAL OBJECT. Same function, same stores, same result
     as Community and Globe — the social system this route already loaded is
     handed over rather than read a second time. */
  const entity = await loadSelectedEntity({ social });
  const selected = entity?.projection ?? null;

  /* THE ONE semantic context. Resolved from viewer-scoped evidence, not from
     this page — see `resolveViewerContextSemantics`. */
  const semanticContext = await resolveViewerContextSemantics(viewer);

  /* ── TIERED COMPOSITION ────────────────────────────────────────────────
     Same components, same props, same projection. What changed is that this
     page now DECLARES the tier of each region instead of implying it by JSX
     order. World's question is "what reaches system scale, and what stops
     it": the gate answers it once, at primary. The two regions that retold
     the same 34→0 story inline are secondary, each labelled with the figure
     it holds so a closed drawer still reports its finding. */
  const secondary: TerminalSection[] = [
    {
      id: "world-now",
      title: "WORLD NOW · מצב העולם כרגע",
      summary: `${social.world.real_count} REAL במעלה · ${social.world.system_eligible_records.length} עומדות בשער · ${social.systemEvidence.counts.external_verified} באימות חיצוני`,
      children: (
        <WorldNow
                  groupEffect={worldGroupProfile && worldGroupProfile.evidence_statements[0] ? {
                    statement: worldGroupProfile.evidence_statements[0],
                    group: worldGroupProfile.name,
                    family: worldGroupProfile.leading_family
                      ? `${worldGroupProfile.leading_family.family_ref} ${worldGroupProfile.leading_family.label}`
                      : "משפחה UNKNOWN",
                    verified: worldGroupProfile.verified_effects,
                  } : null}
                  observedWorldEvents={social.world.system_observed_records.length}
                  systemQualified={social.world.system_eligible_records.length}
                  upstreamReal={social.world.real_count}
                  systemZeroReason={social.world.system_zero_reason}
                  counts={social.world.provenance}
                  rejections={Object.entries(social.world.rejection_summary)
                    .map(([reason, n]) => ({ reason, n: n as number }))
                    .sort((a, b) => b.n - a.n)}
                  externalEvidence={social.systemEvidence.counts.external_verified}
                  evidenceRecords={social.systemEvidence.counts.evidence_records}
                  /* `stages` NO LONGER PASSED. The eleven-stage SVG this fed is the
                     same chain `EntityChainFlow` renders 200px below, in the same
                     order and the same colors — and it was the drawing that carried
                     the hand-written "1 · 1" / "1" literals. One chain, one drawing,
                     one set of numbers, all three read from the shared projection. */
                />
      ),
    },
    {
      id: "system-eligible",
      title: "EXISTS / SYSTEM-ELIGIBLE · פירוט לפי שלב",
      summary: "קיום מול כשירות מערכתית, שלב אחר שלב · UNKNOWN ≠ 0",
      children: (
        <SocialFrame
                  surface="world"
                  spine={buildSocialValueSpine({}).links}
                  roles={{ action: null, evidence: null, relations: null, meaning: null }}
                  // At SYSTEM scale every stage past the source inventory is UNKNOWN:
                  // no record carries verified wider-system relevance, and network
                  // presence is never accepted as a substitute. UNKNOWN != 0.
                  // Same flow builder, same totals, as every other scale. SYSTEM sees
                  // no groups of its own, so only those two stages differ.
                  flow={systemFlow}
                  chronology={chronology}
                  objects={socialObjects}
                  selection={systemSelection}
                  // NOW — World's primary content, INSIDE a PRIMARY_STAGE.
                  // `CinematicBackground` is now `position: absolute` and measures its
                  // parent, so it fills this stage instead of escaping to the
                  // viewport. The stage's `isolation: isolate` seals its z-order, so
                  // nothing inside it can sort above the navigation.
                  primary={
                    /* SHARED PRIMARY COMPOSITION CONTRACT.
                       World owns exactly ONE thing on this stage: the representation
                       below. The header, the six context cells (OBJECT / STATUS /
                       TIME / ROLES / RELATIONS / PROVENANCE) and the audit entry are
                       `SocialPrimaryStage`, identical to GROUP and NETWORK, fed from
                       the same `loadSocialSystem(viewer)` result. The bespoke
                       OBSERVED lane that used to live here is gone: its two figures
                       are the stage's headline and RELATIONS cell now, so no scale
                       states them in a grammar of its own. */
                    /* SocialPrimaryStage REMOVED. Its headline ("המערכת הרחבה · 0")
                       and its six context cells restate, in a second grammar, exactly
                       what `WorldNow` above already states stage by stage and what the
                       frame's own cross-scale band already counts. The stage's unique
                       children — the drawn gate and the reference document — are kept
                       verbatim below; only the duplicate framing is gone. */
                    <>
                      {/* ── SYSTEM_UNIQUE_ONLY ─────────────────────────────────────
                          OBSERVED first, REFERENCE second — in that order, because
                          observed system state is 0 and that is the answer this
                          terminal exists to give.

                          The two-column table replaces badges that read "1 NEED"
                          above "0 REAL" and "GROUP VALUE REAL 1" beside "VALUE GROUP
                          UNKNOWN". Those mixed an EXISTENCE COUNT and a SCALE STATUS
                          inside one badge, so the reader had to infer which number
                          answered which question — and the honest report was that
                          nobody could. Existence and eligibility are two dimensions;
                          they now get two columns, named. */}
                      {/* THE DRAWN GATE IS PRIMARY AGAIN. I collapsed it to shorten
                          the page, on the reasoning that the spine already draws the
                          SYSTEM break. It does not draw the same thing: the spine says
                          ONE cell fails, this draws WHICH records exist at each stage
                          and which of them reach the gate — the per-stage EXISTS vs
                          ELIGIBLE table is World's own answer and exists nowhere else.
                          Page height is not a product objective. */}
                      <div style={S.observed}>
                        {/* ── THE PRIMARY STATEMENT, DRAWN ─────────────────────────
                            The table below is still here and still correct, but it
                            could only state that Need EXISTS 1 and is ELIGIBLE 0 — it
                            could not show that those are the SAME records meeting a
                            barrier, which is the whole of what "system = 0" means.
                            Drawn, it is one glance: a populated left side, a gate, an
                            empty right side. 0 is not missing data; it is data that
                            stops. */}
                        <SystemGateVisual
                          observed={systemPresent}
                          because={systemReason}
                          rows={systemFlow
                            .filter((st) => st.status === "REAL" || st.status === "DERIVED_REAL")
                            .map((st) => ({ label: st.label, exists: st.count, eligible: st.eligible }))}
                        />

                        {/* SECONDARY DETAIL — the same two dimensions as exact
                            figures, for a reader who wants the numbers rather than
                            the shape. */}
                        <details style={S.exDetails}>
                          <summary style={S.exSummary}>EXISTS / SYSTEM-ELIGIBLE — פירוט מספרי</summary>
                          <table style={S.exists}>
                            <thead>
                              <tr>
                                <th style={{ ...S.exCell, ...S.exHead, textAlign: "start" }} />
                                <th style={{ ...S.exCell, ...S.exHead }}>EXISTS IN SOCIAL MODEL</th>
                                <th style={{ ...S.exCell, ...S.exHead }}>SYSTEM-ELIGIBLE</th>
                              </tr>
                            </thead>
                            <tbody>
                              {systemFlow.filter((st) => st.status === "REAL" || st.status === "DERIVED_REAL").map((st) => (
                                <tr key={st.key}>
                                  <td style={{ ...S.exCell, textAlign: "start", color: COLOR.textDim }} title={st.basis}>
                                    {st.label}
                                  </td>
                                  <td style={{ ...S.exCell, color: COLOR.text, fontWeight: 700 }}>
                                    {st.count === null ? "—" : st.count}
                                  </td>
                                  {/* `eligible ?? count` was WRONG and showed it: stages
                                      with no system gate fell back to their existence
                                      count, so the table read "GROUP VALUE ·
                                      SYSTEM-ELIGIBLE 1" directly under "OBSERVED
                                      SYSTEM STATE 0". No verdict is UNKNOWN — not
                                      eligible, and not 0. */}
                                  <td style={{ ...S.exCell, fontWeight: 700, color: st.eligible === undefined ? COLOR.textFaint : st.eligible ? STATUS.real.text : COLOR.textFaint }}
                                      title={st.eligible === undefined
                                        ? "אין שער מערכתי מוגדר לשלב הזה — UNKNOWN, לא 0 ולא זהה לקיום"
                                        : st.not_eligible_because}>
                                    {st.eligible === undefined ? "UNKNOWN" : st.eligible}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          <div style={{ fontSize: FS.tag, color: COLOR.textFaint, lineHeight: 1.6, marginTop: 6 }}>
                            <b>UNKNOWN ≠ 0</b> — הרשומות קיימות; הן פשוט אינן מגיעות לקנה־המידה הזה.
                          </div>
                        </details>
                      </div>

                      {/* REFERENCE — secondary, and visibly a reference document
                          rather than a second application: it opens closed, under a
                          heading that names what it is. */}
                      <details style={S.reference}>
                        <summary style={S.referenceTag}>
                          <span style={{ ...TYPE.micro, color: STATUS.demo.text }}>REFERENCE ARCHITECTURE</span>
                          <span style={{ fontSize: FS.tag, color: COLOR.textDim }}>— PUDM, להמחשה בלבד · לא Observation/Action/Effect קנוני</span>
                        </summary>
                        <div style={{ ...primaryStage({ minHeight: 560, scroll: true }), marginTop: 8 }}>
                          <WorldView
                            missions={missions}
                            gaps={gaps}
                            values={values}
                            capabilities={capabilities}
                            vcRelations={vcRelations}
                            providers={providers}
                            pcRelations={pcRelations}
                            communityGroupsByValueId={communityGroupsByValueId}
                          />
                        </div>
                      </details>
                    </>
                  }
                  // AUDIT — passed to the shared stage as its AUDIT ENTRY primitive,
                  // not rendered a second time here. One audit node per scale.
                />
      ),
    },
  ];

  const audit: TerminalSection[] = [
    {
      id: "world-audit",
      title: "מקור · פרובננס · מצב אדם/ערך",
      summary: "שדרת מקור · קריאת תצפית · מצב אדם/ערך קנוני",
      children: (
        <>
          <AuditHeading accent="#e6edf7" />
                    <SocialSourceSpinePanel surface="world" />
                    <AuditSection
                      title="קריאת התצפית האחרונה · OBSERVATION READING"
                      note="6 אזכורים, ערכי בסיס, משפחות ערך, ניגודים, Color Roles, DEMO"
                    >
                      <ObservationReadingPanel subject={personRef.person_id} surface="WORLD" />
                    </AuditSection>
                    {/* GROUP RELEVANCE — General Value → operational groups →
                        tensions/competing → verified external relevance ONLY. */}
                    {/* WORLD GROUP RELEVANCE removed. Its "השפעה מערכתית אמיתית" line
                        repeated the same REAL group effect under the same promoted label
                        this pass corrected at the top of the page — a second, uncorrected
                        copy of the misreading. The effect now appears once, classified. */}
                    <AuditSection title="מצב אדם / ערך · PERSON / VALUE STATE" note="Phase 4 · CANON — זהה לכל שאר המסופים">
                      <CanonicalSlicePanel subject={personRef.person_id} asOf={systemClock.now()} />
                    </AuditSection>
        </>
      ),
    },
  ];

  return (
    <TerminalPage
      background={COLOR.bg}
      nav={
        <><SystemShell
                  dense
                  signOut={<SignOutButton />}
                  viewerContext={semanticContext}
                  surface="world"
                  selectedGroup={selected?.groupId}
                  purpose="מה נצפה בקנה-מידה מערכתי, ומה קיים אך אינו מגיע לכאן."
                  subject={personRef.person_id}
                /><DayStatusStrip session={daySession} /><ActionEffectPanel terminal="world" pairs={aeProjection.pairs} legacyCount={aeProjection.counts.legacy} /><RealDataGapPanel session={daySession} realUnits={realUnitReadings} terminal="world" facts={[
                  /* These two record shapes are {record_id, evidence_id} and
                     {record_id, as} — no provenance field, so the count cannot
                     claim REAL. */
                  factFromCount("System-eligible records", "loadSocialSystem → world.system_eligible_records",
                    social.world.system_eligible_records.length, "אין רשומה כשירה — לא נמצאה רשומה מבנית"),
                  factFromCount("System-observed records", "loadSocialSystem → world.system_observed_records",
                    social.world.system_observed_records.length, "אין רשומה נצפית — לא נמצאה רשומה מבנית"),
                  /* SocialObject DOES declare provenance (REAL | DERIVED_REAL |
                     DEMO | REFERENCE | UNKNOWN), so this is counted per class
                     and DEMO never raises the REAL figure. */
                  factFromRecords("Social objects", "loadSocialSystem → objects",
                    socialObjects, (o) => o.provenance,
                    "אין אובייקט חברתי REAL — לא נמצאה רשומה ב־loadSocialSystem"),
                ]} /><DemoSimulationSection terminal="world" /></>
      }
      entity={selected ? (
        <UnifiedEntitySurface projection={entity!.projection} trace={entity!.trace} compact />
      ) : undefined}
      /* WORLD'S PRIMARY — the gate, the reason it reads 0, and the upstream
         statement, in one component: the whole 34→0 causal story, told once. */
      primary={
        <SystemGateFunnel
                  provenance={social.world.provenance}
                  eligible={social.world.system_eligible_records.length}
                  observed={social.world.system_observed_records.length}
                  externalVerified={social.systemEvidence.counts.external_verified}
                  evidenceRecords={social.systemEvidence.counts.evidence_records}
                  rejections={Object.entries(social.world.rejection_summary)
                    .map(([reason, n]) => ({ reason, n: n as number }))}
                  unresolvedCandidates={social.world.unresolved_system_candidates.length}
                  zeroReason={social.world.system_zero_reason}
                  groupEffect={worldGroupProfile && worldGroupProfile.evidence_statements[0] ? {
                    statement: worldGroupProfile.evidence_statements[0],
                    verified: worldGroupProfile.verified_effects,
                  } : null}
                />
      }
      actions={selected ? (
        <nav dir="rtl" aria-label="המשך מ-World" style={{ display: "flex", gap: 8,
                    flexWrap: "wrap", margin: "0 20px 10px" }}>
                    {[
                      { href: `/hub/community?group=${selected.groupId}`, label: "הקבוצה שמייצרת את האפקט →" },
                      { href: `/dynamics?group=${selected.groupId}`, label: "איך זה השתנה בזמן →" },
                      { href: `/marketplace?group=${selected.groupId}`, label: "צורך · משאב · פעולה →" },
                      { href: `/planet?group=${selected.groupId}`, label: "איפה זה גאוגרפית →" },
                      { href: `/brain?subject=${personRef.person_id}`, label: "למה זה קורה →" },
                    ].map((l) => (
                      <a key={l.href} href={l.href} style={{
                        fontSize: 12.5, padding: "6px 12px", minBlockSize: 32, display: "inline-flex",
                        alignItems: "center", borderRadius: 999, textDecoration: "none",
                        color: "#c2d1e8", background: "rgba(17,23,42,0.7)",
                        border: "1px solid rgba(120,150,220,0.2)",
                      }}>{l.label}</a>
                    ))}
                  </nav>
      ) : undefined}
      secondary={secondary}
      audit={audit}
    />
  );
}

const S: Record<string, React.CSSProperties> = {
  /* The bespoke OBSERVED lane that lived here is DELETED, not restyled. Its
     two figures are now the shared stage's headline and RELATIONS cell —
     `DUPLICATED_PRIMARY_GRAMMAR = 0` means the per-scale version has to go,
     not merely look like the others. */
  /* REFERENCE — the container that holds the demotion for the whole region.
     Dashed, because a dashed edge is the one border grammar this product
     already uses for "not recorded" (the spine's CONCEPTUAL connector), and
     tinted with the DEMO token so the classification is the same colour here
     as everywhere else. */
  observed: {
    border: `1px solid ${COLOR.border}`, borderRadius: RADIUS.md,
    padding: "12px 14px", marginBottom: 12, background: "rgba(11,15,26,0.55)",
  },
  observedHead: { display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 10 },
  /* Two columns, named. Existence and scale-eligibility are two dimensions and
     were being collapsed into one badge. */
  exists: { borderCollapse: "collapse", width: "100%", maxWidth: 460, fontVariantNumeric: "tabular-nums" },
  exCell: { padding: "4px 10px", fontSize: FS.meta, textAlign: "center", borderBottom: `1px solid ${COLOR.border}` },
  exHead: { ...TYPE.micro, fontSize: FS.tag, letterSpacing: 1.2, color: COLOR.textFaint, fontWeight: 700 },
  exDetails: { marginTop: 10, borderTop: `1px solid ${COLOR.border}`, paddingTop: 8 },
  exSummary: { cursor: "pointer", fontSize: FS.tag, letterSpacing: 1, color: "#6c86b5", padding: "2px 0" },

  reference: {
    border: `1px dashed ${STATUS.demo.border}`,
    borderRadius: RADIUS.lg,
    background: STATUS.demo.bg,
    padding: 10,
  },
  referenceTag: {
    display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer",
    padding: "5px 12px", borderRadius: RADIUS.pill,
    background: STATUS.demo.bg, border: `1px solid ${STATUS.demo.border}`,
  },
};
