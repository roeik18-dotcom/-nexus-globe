import path from "path";
import { readJsonStore } from "@/app/lib/json-store";
import type { Mission } from "@/app/lib/mission/schema";
import type { Gap } from "@/app/lib/gap/schema";
import type { Value } from "@/app/lib/value/schema";
import type { Capability } from "@/app/lib/capability/schema";
import type { ValueCapabilityRelation } from "@/app/lib/value-capability-relation/schema";
import type { Provider } from "@/app/lib/provider/schema";
import type { ProviderCapabilityRelation } from "@/app/lib/provider-capability-relation/schema";
import WorldView from "./WorldView";
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
  const personRef = resolvePersonRef();
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
  const social = await loadSocialSystem(await resolveViewerContext());
  const chronology = social.chronology;
  const socialObjects = social.objects;
  const worldToday = todayIn(systemClock);
  const worldRealGroup = projectValueGroup(worldPhilosEvents, COMMUNITY_GROUP_ID, worldToday);
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
  /* ONE source for the scale figure. An earlier version of this strip summed
     the flow's stages and reported 115/119 — it had added the 110 base
     CONTRADICTIONS and 4 VALUE EMERGENCE relations, which are SOURCE
     INVENTORY, into a count of entities (SOURCE != REAL). A second version
     summed only the REAL stages and reported 1, which contradicted the WHERE
     lane's own "0 World SYSTEM" three rows above it, because the flow gates
     eligibility on the canon tail only and GROUP VALUE carries no scale gate.

     Both were second derivations of a number the frame already computes. This
     reads the SAME expression `SocialFrame` reads, off the SAME objects array
     passed to it, so the two cannot disagree. */
  const systemPresent = socialObjects.filter((o) => o.scales.SYSTEM.present).length;
  /* What EXISTS but does not reach this scale — the canon tail, which is the
     only part of the flow the builder actually gates. Reported separately and
     never added to the figure above: "0 at SYSTEM" and "these records exist"
     are both true at once, and UNKNOWN is not 0. */
  const systemGated = systemFlow.filter((st) => st.eligible === 0 && (st.count ?? 0) > 0);
  const systemExists = systemGated.reduce((n, st) => n + (st.count ?? 0), 0);
  const systemReason = systemGated[0]?.not_eligible_because ?? "אין ראיה מערכתית רחבה משלו";

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
          selection={resolveSocialSelection(params?.sel, socialObjects)}
          // NOW — World's primary content, INSIDE a PRIMARY_STAGE.
          // `CinematicBackground` is now `position: absolute` and measures its
          // parent, so it fills this stage instead of escaping to the
          // viewport. The stage's `isolation: isolate` seals its z-order, so
          // nothing inside it can sort above the navigation.
          primary={
            <>
              {/* ── OBSERVED / REFERENCE — the SYSTEM scale's whole hierarchy
                  ────────────────────────────────────────────────────────────
                  World is the one surface whose visible content is almost
                  entirely REFERENCE. Until this pass that fact was carried by
                  a single pill at the top, which scrolled away after ~40px
                  and left 560px of large, bright, confidently-laid-out
                  architecture reading as observed reality.

                  Two tiers now, stated in this order because it is the honest
                  order: what is OBSERVED at this scale comes first even
                  though it is empty, and the reference material is wrapped
                  for its ENTIRE extent rather than introduced once. A badge
                  labels a moment; a container labels a region. */}
              <div style={S.observed}>
                <span style={{ ...TYPE.micro, fontSize: FS.tag, color: COLOR.textFaint, width: 74, flexShrink: 0, paddingTop: 2 }}>OBSERVED</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 20, fontWeight: 700, color: COLOR.textDim, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{systemPresent}</span>
                    <span style={{ ...TYPE.micro, fontSize: FS.tag, color: COLOR.textFaint }}>RECORDS AT SYSTEM SCALE</span>
                    <span style={{ ...TYPE.micro, fontSize: FS.tag, color: COLOR.textFaint, opacity: 0.5 }}>·</span>
                    <span style={{ fontSize: FS.read, fontWeight: 700, color: STATUS.real.text, fontVariantNumeric: "tabular-nums" }}>{systemExists}</span>
                    <span style={{ ...TYPE.micro, fontSize: FS.tag, color: COLOR.textFaint }}>EXIST, GATED OUT</span>
                  </div>
                  <div style={{ fontSize: FS.tag, color: COLOR.textFaint, lineHeight: 1.6, marginTop: 4 }}>
                    {systemReason} · UNKNOWN ≠ 0 — הרשומות קיימות, הן פשוט אינן מגיעות לקנה־המידה הזה.
                  </div>
                </div>
              </div>

              <div style={S.reference}>
                <div style={S.referenceTag}>
                  <span style={{ ...TYPE.micro, color: STATUS.demo.text }}>REFERENCE ARCHITECTURE</span>
                  <span style={{ fontSize: FS.tag, color: COLOR.textDim }}>— PUDM legacy dataset, לא Observation/Action/Effect קנוני אמיתי</span>
                </div>
              <div style={{ ...primaryStage({ minHeight: 560, scroll: true }), marginTop: 6 }}>
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
              </div>
            </>
          }
          audit={<SocialSourceSpinePanel surface="world" />}
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
  /* OBSERVED — a lane, not a card: same label gutter and same type scale the
     shared frame uses, so the first thing on the stage reads as part of the
     frame above it rather than as a new component. */
  observed: {
    display: "flex", alignItems: "flex-start", gap: 12,
    borderInlineStart: `2px solid ${COLOR.border}`,
    border: `1px solid ${COLOR.border}`,
    borderRadius: RADIUS.md, padding: "10px 14px", marginBottom: 10,
    background: "rgba(11,15,26,0.55)",
  },
  /* REFERENCE — the container that holds the demotion for the whole region.
     Dashed, because a dashed edge is the one border grammar this product
     already uses for "not recorded" (the spine's CONCEPTUAL connector), and
     tinted with the DEMO token so the classification is the same colour here
     as everywhere else. */
  reference: {
    border: `1px dashed ${STATUS.demo.border}`,
    borderRadius: RADIUS.lg,
    background: STATUS.demo.bg,
    padding: 10,
  },
  referenceTag: {
    display: "inline-flex", alignItems: "center", gap: 6,
    padding: "5px 12px", borderRadius: RADIUS.pill,
    background: STATUS.demo.bg, border: `1px solid ${STATUS.demo.border}`,
  },
};
