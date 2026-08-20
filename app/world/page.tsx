import path from "path";
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
import { COLOR, FS, RADIUS, STATUS, TYPE } from "@/app/lib/philos/shell/designTokens";
import { loadPhilosEvents } from "@/app/lib/philos-event-store";
import { systemClock, todayIn } from "@/app/lib/philos/eventStore";
import { projectValueGroup, type ValueGroupView } from "@/app/lib/philos/projectValueGroup";
import { GROUP_ID as COMMUNITY_GROUP_ID } from "@/app/lib/philos/valueGroupLog";
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
import SocialPrimaryStage from "@/app/lib/philos/shell/SocialPrimaryStage";
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

export const metadata = { title: "Living World — Philos" };

const DATA = path.join(process.cwd(), "data");

export default async function WorldPage({ searchParams }: {
  /** Only `sel` is read — the shared social selection, carried by the nav so
   *  the same object stays selected when the user changes scale. */
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = (await searchParams) ?? {};
  // STEP 1 — the ONE shared identity reference. World has no `?subject=`,
  // so this resolves to the designated real subject, exactly as the bare
  // constant did before.
  const personRef = resolvePersonRef(await resolveViewerContext());
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
    audit: <SocialSourceSpinePanel surface="world" />,
  });

  return (
    <div style={{ background: COLOR.bg, minHeight: "100vh" }}>
      {/* BATCH 4 — `/world` previously mounted no shared shell at all (the
          one route that didn't), so it never visually belonged to the same
          product as Hub/Brain/Dynamics/Community/Marketplace/Globe. Also
          the one route whose entire content is `data/*.json` — the PUDM/
          Fashion legacy dataset (see `marketplace/page.tsx`'s own
          `PUDM_CLASSIFICATION` audit comment: "structurally disconnected
          from any real PHILOS Person/Need") — never real canon data, so
          labeled honestly as reference architecture, not observed reality,
          rather than silently presented as if it were. */}
      {/* `position/zIndex` are load-bearing, not decoration: `WorldView`
          renders `CinematicBackground` as `position:fixed; inset:0;
          zIndex:0`, and a positioned element at z-index 0 paints OVER
          static content. Without this stacking context the shared shell
          rendered into the DOM but was covered by the starfield — World
          looked like it had no navigation at all. */}
      <div style={{ padding: "12px 20px 0", position: "relative", zIndex: 1 }}>
        <SystemShell
          surface="world"
          personContext={personContext}
          purpose="ארכיטקטורת ייחוס — משימות/פערים/יכולות/ספקים לדוגמה, לא מציאות קנונית נצפית."
          subject={personRef.person_id}
        />
        {/* FAMILY ORIENTATION — World is the SYSTEM zoom level of the same
            social/value model Community and Globe show at GROUP and NETWORK
            scope. This is what stops World reading as an independent
            reference application. */}
        {/* Same frame, same lanes, same grid as Community and Globe — only
            the zoom differs. World's SYSTEM lane is empty and says so in
            place: no record carries verified wider-system relevance, and
            network density is never accepted as a substitute. */}
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
            <SocialPrimaryStage ctx={primaryCtx}>
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
            </SocialPrimaryStage>
          }
          // AUDIT — passed to the shared stage as its AUDIT ENTRY primitive,
          // not rendered a second time here. One audit node per scale.
        />
        {/* PRIMARY / AUDIT ORDER — World's primary question is "what is
            happening at the wider system level", and its answer is the map
            below. The observation reading, group-relevance block and
            person/value state are AUDIT tier: real and unchanged, but they
            used to render BEFORE the visualization and pushed it past the
            fold. They now follow it. Nothing was removed. */}
      </div>
      <div dir="rtl" style={{ padding: "0 20px 20px", position: "relative", zIndex: 1 }}>
        {/* Phase 6C — "replacing static-only dependency where canon data
            exists": World's PUDM/Fashion content below stays exactly what
            it was (REFERENCE ARCHITECTURE, static, never removed — see the
            badge above and this route's own header). This adds the part
            that IS real: the SAME shared Person/Value runtime state Hub/
            Dynamics/Brain/Community/Marketplace/Globe already render
            (`CanonicalSlicePanel`, unmodified) — so World is no longer
            static-only, without merging PUDM's Mission-scoped chain into
            canon's Need/Offer/Action/Effect chain (two real, deliberately
            separate schemas — see `valueDomainConfig.ts`'s own header for
            why forcing one into the other would be invented structure). */}
        {/* 7-terminal propagation — the SAME shared Observation reading; on
            World the systemic/general-value implication is the point: the
            individual aversion vs the entity's place in the wider system,
            read from the record itself — no fake external event. */}
        <div dir="rtl">
          {/* STEP 5/6 — same product/audit split as Hub. World's PRIMARY is
              the systemic/group relevance block below; the full ontology
              reading (6 mentions, base values, families, contradictions,
              Color Roles, DEMO relations) is real, unchanged, and one click
              away. `PHILOS-SYSTEM-LANGUAGE.md` §9. */}
          <AuditHeading accent="#e6edf7" />
          <AuditSection
            title="קריאת התצפית האחרונה · OBSERVATION READING"
            note="6 אזכורים, ערכי בסיס, משפחות ערך, ניגודים, Color Roles, DEMO"
          >
            <ObservationReadingPanel subject={personRef.person_id} surface="WORLD" />
          </AuditSection>
          {/* GROUP RELEVANCE — General Value → operational groups →
              tensions/competing → verified external relevance ONLY. */}
          {worldGroupProfile ? (
            <div style={{ border: "1px solid rgba(52,211,153,0.3)", borderRadius: 16, padding: "12px 18px", margin: "12px 0", background: "rgba(11,15,26,0.7)" }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1, color: "#34d399", marginBottom: 6 }}>רלוונטיות קבוצתית · WORLD GROUP RELEVANCE</div>
              <div style={{ fontSize: 11.5, color: "#dbe6f6", lineHeight: 1.8 }}>
                <div>ערך כללי מהתצפית: ראה OBSERVATION READING למעלה — join קבוצתי: UNRESOLVED אלא אם קיים.</div>
                <div>קבוצה תפעולית: {worldGroupProfile.name} — {worldGroupProfile.leading_family ? `${worldGroupProfile.leading_family.family_ref} ${worldGroupProfile.leading_family.label}` : "משפחה UNKNOWN"} · {worldGroupProfile.verified_effects} effects מאומתים</div>
                <div>מתחים / ערכים מתחרים: {worldGroupProfile.tensions.length > 0 ? worldGroupProfile.tensions.map((t) => t.label).join(" · ") : "אין Tension רשום — אין ערך מתחרה מתועד"}</div>
                <div>השפעה מערכתית אמיתית: {worldGroupProfile.evidence_statements[0] ?? "אין ראיה מאומתת"}</div>
                <div style={{ color: "#8798b8", fontStyle: "italic" }}>רלוונטיות חיצונית מאומתת: UNKNOWN — אין אירוע חיצוני מאומת מחובר; לא מומצא.</div>
              </div>
            </div>
          ) : null}
        </div>
<AuditSection title="מצב אדם / ערך · PERSON / VALUE STATE" note="Phase 4 · CANON — זהה לכל שאר המסופים">
          <CanonicalSlicePanel subject={personRef.person_id} asOf={systemClock.now()} />
        </AuditSection>
      </div>
    </div>
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
  exSummary: { cursor: "pointer", fontSize: FS.tag, letterSpacing: 1, color: "#5a76a3", padding: "2px 0" },

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
