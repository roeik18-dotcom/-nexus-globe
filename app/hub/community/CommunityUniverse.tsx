/**
 * CommunityUniverse — the Value + Value-Group universe ABOVE the single
 * selected community (ledger §40). Modes: OVERVIEW / VALUES / GROUPS /
 * PEOPLE / NEEDS / RESOURCES / ACTIVITY / IMPACT. A selected group's own
 * detail (the §38 `CommunityLivingView`/`CommunityCommandTerminal`) is
 * rendered by `page.tsx` itself when `?mode=groups&community=<id>` names
 * one — this component only ever renders the LANDSCAPE, never a specific
 * group's full detail (keeps this file from re-threading a dozen extra
 * props it doesn't otherwise need).
 *
 * Everything here is a pure render over already-computed real data
 * (`valueRegistry.ts`/`groupRegistry.ts`, both pure folds over already-
 * projected `ValueGroupView`s) — no new fact is computed in this file.
 */
import type { ValueEntry, ValueRelation, ValueRelationType, GroupProvenance } from "@/app/lib/philos/community/valueRegistry";
import { VALUE_RELATION_TYPES } from "@/app/lib/philos/community/valueRegistry";
import { buildCommunityTensions, sortTensions } from "@/app/lib/philos/tension";
import {
  SOURCE_CONCEPTS,
  SOURCE_CONCEPT_TYPES,
  SOURCE_COVERAGE,
  SOURCE_GROUP_FORMATION_RULES,
  SOURCE_PRINCIPLE_LENS,
  SOURCE_CONTRADICTION_LIST_VARIANTS,
  SOURCE_CORPUS_TRIAGE,
  SOURCE_VALUE_RELATIONS,
  QUALITY_GROUP_MODEL,
  GROUP_HIERARCHY_AXES,
  RUNTIME_VALUE_RELATIONS,
  RUNTIME_QUALITY_GROUP_CRITERIA,
  RUNTIME_OPPOSITIONS,
  RUNTIME_TENSIONS,
  countByType,
  countCanonicalConcepts,
  type SourceConceptType,
  type RuntimeStatus,
} from "@/app/lib/philos/community/sourceValueModel";
import type { GroupRegistryEntry, PossibleGroup } from "@/app/lib/philos/community/groupRegistry";
import CreateNeedForm from "../CreateNeedForm";
import CreateOfferForm from "../CreateOfferForm";
import CommunityFlow from "./CommunityFlow";
import type { ActivityFeedItem, ImpactView, PersonView, ValueGroupView } from "@/app/lib/philos/projectValueGroup";
import type { ShellIdentityLink } from "@/app/lib/philos/shell/SystemShell";
import type { ActionRecord } from "@/app/lib/philos/canon/actionStore";
import type { EffectRecord } from "@/app/lib/philos/canon/effectStore";
import { isEffectVerified } from "@/app/lib/philos/canon/effect";
import type { RawFamily, RawSourceEntry } from "@/app/lib/philos/community/valueUniverse328";
import ValueUniverseView, { type UniverseSubvalueView, type UniverseFilters } from "./ValueUniverseView";
import RelationMapView from "./RelationMapView";
import type { EntityLink } from "@/app/lib/philos/bridge/entityLink";
import QualityGroupView from "./QualityGroupView";

export type Mode = "overview" | "universe" | "values" | "groups" | "relations" | "quality" | "people" | "needs" | "resources" | "activity" | "impact";
export const MODES: { key: Mode; label: string }[] = [
  { key: "overview", label: "OVERVIEW" },
  { key: "universe", label: "VALUE UNIVERSE" },
  { key: "values", label: "VALUES" },
  { key: "groups", label: "VALUE GROUPS" },
  { key: "relations", label: "RELATION MAP" },
  { key: "quality", label: "QUALITY GROUPS" },
  { key: "people", label: "PEOPLE" },
  { key: "needs", label: "NEEDS" },
  { key: "resources", label: "RESOURCES" },
  { key: "activity", label: "ACTIVITY" },
  { key: "impact", label: "IMPACT" },
];

export interface GroupMembership {
  group_id: string;
  group_name: string;
  status: GroupRegistryEntry["status"];
  central_value: string;
}

export interface PersonRow {
  person: PersonView;
  memberships: GroupMembership[];
  is_identity_linked: boolean;
}

export interface ActivityRow extends ActivityFeedItem {
  group_id: string;
  group_name: string;
  status: GroupRegistryEntry["status"];
}

export interface ImpactRow extends ImpactView {
  group_id: string;
  group_name: string;
  status: GroupRegistryEntry["status"];
}

export default function CommunityUniverse({
  mode,
  selectedValueId,
  selectedConceptType,
  valueRegistry,
  valueRelations,
  groupRegistry,
  possibleGroups,
  people,
  realNeedsCount,
  realOffersCount,
  realActionsCount,
  activity,
  impact,
  identityLink,
  canonActions,
  canonEffects,
  groupsWithProvenance,
  universeFamilies,
  universeSubvalues,
  universeSourceEntries,
  universeFilters,
  universeFamilyCandidates,
  bridgeLinks,
}: {
  mode: Mode;
  selectedValueId?: string;
  /** `?conceptType=` — filters the SOURCE CANDIDATES universe (ledger
   *  §41) by one of the 19 source-concept types. */
  selectedConceptType?: SourceConceptType;
  valueRegistry: ValueEntry[];
  valueRelations: ValueRelation[];
  groupRegistry: GroupRegistryEntry[];
  possibleGroups: PossibleGroup[];
  people: PersonRow[];
  realNeedsCount: number;
  realOffersCount: number;
  realActionsCount: number;
  activity: ActivityRow[];
  impact: ImpactRow[];
  identityLink: ShellIdentityLink;
  /** LOOP 0052 — the real canon Action/Effect stores, unfiltered (same
   *  system-wide read `ActionCollectiveContext.tsx` already established:
   *  canon Action carries no `group_id`, so this is never scoped to "this
   *  group's actions", only "canon activity that exists, period"). Kept as
   *  a SEPARATE prop/section from `activity`/`impact` (the legacy
   *  Value-Group log) — never merged into one feed or one id space. */
  canonActions: ActionRecord[];
  canonEffects: EffectRecord[];
  /** BATCH 9 — the same real `{view, provenance}` pairs `page.tsx` already
   *  computes for `valueRegistry`/`groupRegistry` — threaded through only
   *  to compute real per-value Tensions (`buildCommunityTensions`, an
   *  existing function, not a new one) on the Value detail page. This is
   *  the "Cause context": canon has no separate Cause persistence, and
   *  the mission's own instruction is not to invent one when an existing
   *  structure represents it cleanly — a real Tension already does. */
  groupsWithProvenance: { view: ValueGroupView; provenance: GroupProvenance }[];
  /** Mission B, B1/B2 — the 328-entry Board Value Universe, a SEPARATE
   *  population from `valueRegistry` (see `ValueUniverseView.tsx`'s own
   *  header). Passed through pre-computed from `page.tsx` — this
   *  component does no classification itself. */
  universeFamilies: RawFamily[];
  universeSubvalues: UniverseSubvalueView[];
  universeSourceEntries: RawSourceEntry[];
  universeFilters: UniverseFilters;
  universeFamilyCandidates: { family_id: string; name_he: string }[];
  /** Canonical Cross-Entity Link Registry, computed once in `page.tsx`
   *  (`buildDefaultLinkRegistry`) — reused here for RELATION MAP's
   *  GROUP↔NEED/GROUP↔ACTION/etc. edges, never re-derived. */
  bridgeLinks: EntityLink[];
}) {
  const realGroups = groupRegistry.filter((g) => g.status === "REAL");
  const demoGroups = groupRegistry.filter((g) => g.status === "DEMO");

  return (
    <div dir="rtl" style={S.wrap}>
      <nav style={S.tabs}>
        {MODES.map((m) => (
          <a key={m.key} href={`?mode=${m.key}`} style={{ ...S.tab, ...(mode === m.key ? S.tabActive : {}) }}>{m.label}</a>
        ))}
      </nav>

      {mode === "overview" ? (
        <Overview
          realGroups={realGroups}
          valueRegistry={valueRegistry}
          people={people}
          realNeedsCount={realNeedsCount}
          realOffersCount={realOffersCount}
          realActionsCount={realActionsCount}
          groupRegistry={groupRegistry}
          possibleGroups={possibleGroups}
          activity={activity}
        />
      ) : mode === "universe" ? (
        <ValueUniverseView
          families={universeFamilies}
          subvalues={universeSubvalues}
          sourceEntries={universeSourceEntries}
          filters={universeFilters}
        />
      ) : mode === "values" ? (
        <ValueLandscape
          valueRegistry={valueRegistry} valueRelations={valueRelations} groupRegistry={groupRegistry}
          selectedValueId={selectedValueId} selectedConceptType={selectedConceptType} people={people}
          realNeedsCount={realNeedsCount} realOffersCount={realOffersCount} realActionsCount={realActionsCount}
          possibleGroups={possibleGroups} groupsWithProvenance={groupsWithProvenance}
          universeSubvalues={universeSubvalues} universeFamilies={universeFamilies}
          canonActions={canonActions} canonEffects={canonEffects} identityLink={identityLink}
        />
      ) : mode === "groups" ? (
        <GroupLandscape groupRegistry={groupRegistry} possibleGroups={possibleGroups} people={people} universeFamilyCandidates={universeFamilyCandidates} />
      ) : mode === "relations" ? (
        <RelationMapView
          valueRegistry={valueRegistry} groupRegistry={groupRegistry} people={people}
          sourceValueRelations={SOURCE_VALUE_RELATIONS} runtimeValueRelations={RUNTIME_VALUE_RELATIONS}
          canonActions={canonActions} canonEffects={canonEffects} bridgeLinks={bridgeLinks}
        />
      ) : mode === "quality" ? (
        <QualityGroupView groupRegistry={groupRegistry} />
      ) : mode === "people" ? (
        <PeopleGraph people={people} identityLink={identityLink} />
      ) : mode === "needs" ? (
        <NeedsMode realNeedsCount={realNeedsCount} />
      ) : mode === "resources" ? (
        <ResourcesMode realOffersCount={realOffersCount} realGroups={realGroups} />
      ) : mode === "activity" ? (
        <ActivityMode activity={activity} canonActions={canonActions} canonEffects={canonEffects} identityLink={identityLink} />
      ) : (
        <ImpactMode impact={impact} />
      )}
    </div>
  );
}

// ── OVERVIEW ─────────────────────────────────────────────────────────────

function Overview({
  realGroups, valueRegistry, people, realNeedsCount, realOffersCount, realActionsCount, groupRegistry, possibleGroups, activity,
}: {
  realGroups: GroupRegistryEntry[]; valueRegistry: ValueEntry[]; people: PersonRow[];
  realNeedsCount: number; realOffersCount: number; realActionsCount: number;
  groupRegistry: GroupRegistryEntry[]; possibleGroups: PossibleGroup[]; activity: ActivityRow[];
}) {
  const verifiedEffects = realGroups.reduce((s, g) => s + g.verified_effects, 0);
  return (
    <>
      {/* BATCH 3 — the real visual relationship chain, same grammar as
          Dynamics'/Marketplace's flow components: VALUES → GROUPS →
          NEEDS ↔ RESOURCES → ACTIONS → VERIFIED IMPACT. */}
      <div style={S.compactStrip}>{people.length} people</div>
      <CommunityFlow
        valueCount={valueRegistry.length}
        groupCount={realGroups.length}
        needCount={realNeedsCount}
        resourceCount={realOffersCount}
        actionCount={realActionsCount}
        impactCount={verifiedEffects}
      />

      <Section title="ערכים · VALUES">
        <ValueChips valueRegistry={valueRegistry} />
        <a href="?mode=values" style={S.moreLink}>פתח את מלוא נוף הערכים →</a>
      </Section>

      <Section title="קבוצות פעילות · ACTIVE GROUPS">
        <div style={S.groupChips}>
          {groupRegistry.filter((g) => g.status === "REAL" || g.status === "DEMO").map((g) => (
            <a key={g.group_id} href={`?mode=groups&community=${encodeURIComponent(g.group_id)}`} style={{ ...S.groupChip, borderColor: g.status === "REAL" ? "#34d39955" : "#fbbf2455", color: g.status === "REAL" ? "#34d399" : "#fbbf24" }}>
              {g.name} · {g.status} · {g.member_count}
            </a>
          ))}
        </div>
      </Section>

      <Section title="סיבות / נושאים פתוחים · CAUSES / ISSUES">
        <Empty>Cause אינה ישות עצמאית קיימת עדיין בבנייה זו — ראה Tension ב-Dynamics/Hub לפער אמיתי ומתועד.</Empty>
      </Section>

      <Section title={`צרכים פתוחים · OPEN NEEDS (${realNeedsCount})`}>
        {realNeedsCount === 0 ? <Empty>עדיין לא נרשם Need אמיתי.</Empty> : <div style={S.note}>{realNeedsCount} Need אמיתי רשום.</div>}
        <a href="?mode=needs" style={S.moreLink}>פתח מצב NEEDS →</a>
      </Section>

      <Section title={`משאבים זמינים · AVAILABLE RESOURCES (${realOffersCount})`}>
        {realOffersCount === 0 ? <Empty>עדיין לא נרשם Offer אמיתי.</Empty> : <div style={S.note}>{realOffersCount} Offer אמיתי רשום.</div>}
        <a href="?mode=resources" style={S.moreLink}>פתח מצב RESOURCES →</a>
      </Section>

      <Section title={`פעולות נוכחיות · CURRENT ACTIONS (${realActionsCount})`}>
        {realActionsCount === 0 ? <Empty>עדיין לא נרשמה Action אמיתית.</Empty> : <div style={S.note}>{realActionsCount} Action אמיתית רשומה.</div>}
        <a href="?mode=activity" style={S.moreLink}>פתח מצב ACTIVITY →</a>
      </Section>

      <Section title={`השפעה מאומתת · VERIFIED IMPACT (${verifiedEffects})`}>
        {verifiedEffects === 0 ? <Empty>עדיין אין Effect קנוני מאומת.</Empty> : <div style={S.note}>{verifiedEffects} Effect מאומת.</div>}
        <a href="?mode=impact" style={S.moreLink}>פתח מצב IMPACT →</a>
      </Section>

      <details style={{ margin: "12px 20px" }}>
        <summary style={{ cursor: "pointer", fontSize: 10.5, letterSpacing: 1, color: "#5a76a3", padding: "4px 0" }}>
          DETAILS / AUDIT — קבוצות פוטנציאליות, פעילות חיה גולמית
        </summary>
        <div style={{ marginTop: 8 }}>
          <Section title={`קבוצות פוטנציאליות · FORMING / POSSIBLE (${possibleGroups.length})`}>
            {possibleGroups.length === 0 ? <Empty>אין כרגע.</Empty> : (
              <div style={S.note}>{possibleGroups.length} ערכים אמיתיים ללא אף קבוצה אמיתית/DEMO סביבם — ראה מצב GROUPS.</div>
            )}
          </Section>
          <Section title="פעילות חיה · LIVE ACTIVITY">
            {activity.length === 0 ? <Empty>אין פעילות רשומה.</Empty> : (
              <div style={S.feed}>
                {activity.slice(0, 6).map((a) => (
                  <div key={a.event_id} style={S.feedRow}>
                    <span style={{ ...S.feedTag, color: a.status === "REAL" ? "#34d399" : "#fbbf24" }}>{a.status}</span>
                    <span style={S.feedText}><b>{a.actor_name}</b> · {a.group_name} · {a.text}</span>
                  </div>
                ))}
              </div>
            )}
            <a href="?mode=activity" style={S.moreLink}>כל הפעילות →</a>
          </Section>
        </div>
      </details>
    </>
  );
}

// ── VALUES ───────────────────────────────────────────────────────────────

// PHILOS' INDIVIDUAL → GROUP → COMMON axis (Value Groups Convergence pass)
// — derived from real group count, see `deriveValueScope`. Distinct from
// PROV_COLOR/RUNTIME_STATUS_COLOR, a different axis entirely.
// Mission B, B13 — SCOPE_COLOR/PROMOTION_STATUS_COLOR now live in
// `./colors.ts` (standalone, no circular import), imported (and
// re-exported) here so existing `from "./CommunityUniverse"` imports
// elsewhere keep working without touching every call site.
import { SCOPE_COLOR, PROMOTION_STATUS_COLOR } from "./colors";
export { SCOPE_COLOR, PROMOTION_STATUS_COLOR };

function ValueChips({ valueRegistry }: { valueRegistry: ValueEntry[] }) {
  return (
    <div style={S.grid}>
      {valueRegistry.map((v) => (
        <a key={v.value_id} href={`?mode=values&value=${encodeURIComponent(v.value_id)}`} style={{ ...S.valueCard, borderColor: `${PROV_COLOR[v.provenance]}55` }}>
          <div style={{ ...S.valueCardTitle, color: PROV_COLOR[v.provenance] }}>{v.name}</div>
          <div style={S.valueCardMeta}>
            {v.provenance} · {v.groups.length} groups ·{" "}
            <span style={{ color: SCOPE_COLOR[v.scope] }}>{v.scope}</span>
          </div>
        </a>
      ))}
    </div>
  );
}

const CONCEPT_TYPE_COLOR: Partial<Record<SourceConceptType, string>> = {
  VALUE: "#34d399", VALUE_DOMAIN: "#5b9cf6", PRINCIPLE: "#a78bfa", TENSION: "#f2635c",
  OPPOSITION: "#f2635c", GROUP_CRITERION: "#fbbf24", MEASURABLE_DIMENSION: "#5aa6ff",
  CONTINUUM: "#5aa6ff", OUTCOME: "#34d399", QUALITY: "#5b9cf6",
  NON_VALUE: "#5a76a3", REVIEW_REQUIRED: "#8fa3c9",
};

// §50 — SOURCE MODEL → RUNTIME CANON promotion status colors — now the
// shared `PROMOTION_STATUS_COLOR` (see `./colors.ts`), kept under this
// name for the call sites below that already reference it.
const RUNTIME_STATUS_COLOR: Record<RuntimeStatus, string> = PROMOTION_STATUS_COLOR as Record<RuntimeStatus, string>;

function ValueLandscape({
  valueRegistry, valueRelations, groupRegistry, selectedValueId, selectedConceptType, people,
  realNeedsCount, realOffersCount, realActionsCount, possibleGroups, groupsWithProvenance, universeSubvalues, universeFamilies,
  canonActions, canonEffects, identityLink,
}: {
  valueRegistry: ValueEntry[]; valueRelations: ValueRelation[]; groupRegistry: GroupRegistryEntry[];
  selectedValueId?: string; selectedConceptType?: SourceConceptType; people: PersonRow[];
  realNeedsCount: number; realOffersCount: number; realActionsCount: number; possibleGroups: PossibleGroup[];
  groupsWithProvenance: { view: ValueGroupView; provenance: GroupProvenance }[];
  universeSubvalues: UniverseSubvalueView[]; universeFamilies: RawFamily[];
  /** Mission B, B12 — real PERSON → VALUE CONTEXT → ACTION → VERIFIED
   *  EFFECT → EVIDENCE → CONTEXTUAL CONTRIBUTION, for the one real
   *  identity-linked subject, scoped to THIS value's own real groups
   *  only. Never a universal score. */
  canonActions: ActionRecord[]; canonEffects: EffectRecord[]; identityLink: ShellIdentityLink;
}) {
  const selected = selectedValueId ? valueRegistry.find((v) => v.value_id === selectedValueId) : undefined;
  if (selected) {
    const groups = groupRegistry.filter((g) => selected.groups.includes(g.group_id));
    const relatedPeople = people.filter((p) => p.memberships.some((m) => groups.some((g) => g.group_id === m.group_id)));

    // BATCH 9 — CAUSE CONTEXT. Canon has no separate Cause persistence;
    // the mission's own instruction is not to invent one when an
    // existing structure represents it cleanly. `buildCommunityTensions`
    // (existing, unmodified — the same function Dynamics/Hub already
    // call) computed over this value's own real groups IS that existing
    // structure: a real, evidence-based gap the group is genuinely
    // carrying, not a fabricated "issue" object.
    const valueCauseTensions = sortTensions(
      groupsWithProvenance
        .filter(({ view }) => groups.some((g) => g.group_id === view.group_id))
        .flatMap(({ view, provenance }) => buildCommunityTensions(view, provenance)),
    );
    const related = valueRelations.filter((r) => r.from_value_id === selected.value_id || r.to_value_id === selected.value_id);
    // §51 (Phase 1, Product Convergence Autostrada): real name-match against the
    // source-extracted relation poles — NOT a semantic inference, a literal
    // string-equality check. Per §41's own checked finding, 0 registered runtime
    // Values currently share a name with any source pole, so this honestly
    // returns empty for "אחריות" etc. today — a real capability, exercised on
    // real data, not fabricated to look populated.
    const sourceRelationMatches = SOURCE_VALUE_RELATIONS.filter((r) => r.pole_a === selected.name || r.pole_b === selected.name);
    const runtimeRelationMatches = RUNTIME_VALUE_RELATIONS.filter((r) => r.pole_a === selected.name || r.pole_b === selected.name);
    // Word-level match only — this is NOT a claim of same-concept identity.
    // The codebase's own established discipline (§41–§42) explicitly treats
    // "אחריות" (this registry's real central_value) and "אחריות אישית" (a
    // source-cited zero-value criterion) as 3 distinct, deliberately NOT-
    // merged concepts sharing a word — the label below preserves that
    // distinction instead of implying a settled link.
    const sourceConceptCitation = SOURCE_CONCEPTS.find((c) => c.normalized_label.includes(selected.name) || c.source_wording.includes(selected.name));
    // Mission B, B2 — the reverse link into the 328-entry Value Universe:
    // real, checkable via the SAME `matched_runtime_value_id` join
    // `page.tsx` already computes, never a name-similarity guess.
    const universeMatches = universeSubvalues.filter((sv) => sv.matched_runtime_value_id === selected.value_id);
    const universeFamilyIds = [...new Set(universeMatches.map((sv) => sv.family_id).filter((id): id is string => id !== null))];
    return (
      <Section title={`ערך רשום · REGISTERED VALUE — ${selected.name}`}>
        <a href="?mode=values" style={S.back}>← כל הערכים</a>
        <div style={S.detailGrid}>
          <DetailRow label="DEFINITION / SOURCE" value={selected.source === "value_group_event" ? "central_value אמיתי מיומן קבוצת ערך" : `PUDM candidate value · domain: ${selected.domain ?? "—"}`} />
          <DetailRow label="DOMAIN" value={selected.domain ?? "לא ידוע — אין domain אמיתי במקור (central_value של קבוצת ערך אינו נושא domain)"} />
          <DetailRow
            label="SCOPE — INDIVIDUAL → GROUP → COMMON"
            value={<span style={{ color: SCOPE_COLOR[selected.scope] }}>
              {selected.scope} — {selected.groups.length === 0
                ? "0 קבוצות אמיתיות/DEMO מחזיקות בערך זה כ-central_value"
                : selected.groups.length === 1
                  ? "1 קבוצה אמיתית/DEMO מחזיקה בערך זה כ-central_value"
                  : `${selected.groups.length} קבוצות אמיתיות/DEMO חולקות ערך זה כ-central_value`}
            </span>}
          />
          <DetailRow label="RELATED / OPPOSING VALUES (runtime registry)" value={related.length > 0 ? related.map((r) => `${r.type}`).join(", ") : "0 — אין ראיה אמיתית לקשר לאף ערך רשום אחר"} />
          <DetailRow
            label="OPPOSITIONS / TENSIONS (source, §49–§50)"
            value={sourceRelationMatches.length > 0
              ? sourceRelationMatches.map((r) => `${r.pole_a}↔${r.pole_b} (${r.relation_type}, ${runtimeRelationMatches.includes(r) ? "CANONICAL_RUNTIME" : "REFERENCE_ONLY"})`).join("; ")
              : "0 — שם הערך לא מופיע כקוטב באף אחד מ-38 היחסים שחולצו מהמקור (בדיקת שוויון מחרוזות ממשית, לא הסקה)"}
          />
          <DetailRow label="REAL GROUPS" value={groups.filter((g) => g.status === "REAL").map((g) => g.name).join(", ") || "0"} />
          <DetailRow label="DEMO / FORMING GROUPS" value={groups.filter((g) => g.status !== "REAL").map((g) => `${g.name} (${g.status})`).join(", ") || "0"} />
          <DetailRow label="PEOPLE" value={relatedPeople.length > 0 ? `${relatedPeople.length} (via group membership — לא אישור ערך אישי)` : "0"} />
          <DetailRow label="NEEDS / RESOURCES / ACTIONS / EFFECTS" value="Need/Offer/Action/Effect קנוניים כן persisted (canon needStore/offerStore/actionStore/effectStore) — אך אף אחד מהם אינו נושא שדה value_context; אין עדיין קישור אמיתי ברמת Value לישויות אלה" />
          <DetailRow
            label="PROVENANCE"
            value={`registry: ${selected.provenance}${sourceConceptCitation ? ` · same-word source mention (NOT confirmed same concept): ${sourceConceptCitation.canonical_id} (${sourceConceptCitation.confidence}, ${sourceConceptCitation.review_status})` : " · אין אזכור מקור תואם-מילה"}`}
          />
          <DetailRow
            label="FAMILY / SUBVALUES (328 Board reconciliation)"
            value={universeMatches.length > 0
              ? <>
                  {universeFamilyIds.map((fid) => universeFamilies.find((f) => f.id === fid)?.name_he).filter(Boolean).join(", ") || "ללא משפחה משויכת"}
                  {" — "}
                  {universeMatches.map((sv) => (
                    <a key={sv.subvalue_id} href={`?mode=universe&subvalue=${sv.subvalue_id}`} style={{ color: "#5b9cf6", marginInlineEnd: 6 }}>{sv.name_he} →</a>
                  ))}
                </>
              : "0 — שם ערך זה לא נמצא כתת-ערך במסמך ה-328 (בדיקת שם אמיתית, לא הסקה)"}
          />
        </div>

        {/* BATCH 7 — QUALITY GROUP, per this Value. `QUALITY_GROUP_MODEL`/
            `RUNTIME_QUALITY_GROUP_CRITERIA`/`GROUP_HIERARCHY_AXES` are the
            SAME real global model the VALUES landscape default view
            already shows (reused, not duplicated) — canon's quality-group
            criteria are group-wide, not per-Value, so this section states
            that plainly rather than fabricating Value-specific criteria
            that don't exist. What IS per-Value and real: which of THIS
            value's groups have real members/verified effects — the
            closest honest "why it qualifies" signal, since no formal
            CANONICAL_RUNTIME qualification score exists (0, stated, never
            invented — same discipline as everywhere else in this file). */}
        <div style={{ ...S.subHead, marginTop: 14 }}>קבוצת-איכות · QUALITY GROUP (עבור ערך זה)</div>
        <div style={S.note}>
          מודל הקריטריונים ({QUALITY_GROUP_MODEL.status}, {RUNTIME_QUALITY_GROUP_CRITERIA.length} CANONICAL_RUNTIME) הוא כלל-קבוצתי, לא ספציפי לערך — אין קריטריון פר-Value אמיתי.
        </div>
        {groups.length === 0 ? (
          <Empty>0 קבוצות סביב ערך זה — אין מה להעריך.</Empty>
        ) : (
          <div style={S.list}>
            {groups.map((g) => (
              <div key={g.group_id} style={S.listRow}>
                <span style={S.listTitle}>{g.name}</span>
                <span style={{ ...S.listMeta, color: g.status === "REAL" ? "#34d399" : "#fbbf24" }}>
                  {g.status} · {g.member_count} חברים · {g.verified_effects} Effect מאומת — הראיה היחידה הזמינה, לא ציון פורמלי
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Mission B, B12 — real PERSON → VALUE CONTEXT → ACTION →
            VERIFIED EFFECT → EVIDENCE → CONTEXTUAL CONTRIBUTION, for the
            one real identity-linked subject. Membership check is now
            real (`groupsWithProvenance`'s own `view.members`, not just a
            count) and Action/Effect are the same canon stores every
            other surface reads — joined via `action_ref`, never
            inferred. Never a universal score: this answers "contribution
            to WHAT / in WHICH context / based on WHICH action / with
            WHICH verified effect / supported by WHICH evidence / WHEN"
            for THIS value's groups only. */}
        <div style={{ ...S.subHead, marginTop: 14 }}>תרומה הקשרית · CONTEXTUAL CONTRIBUTION (עבור ערך זה)</div>
        {(() => {
          if (identityLink.status !== "VERIFIED_SAME_PERSON") {
            return <Empty>אין גשר זהות מאומת (VERIFIED_SAME_PERSON) — לא מוצגת תרומה מומצאת.</Empty>;
          }
          const isMember = groupsWithProvenance.some(({ view }) => groups.some((g) => g.group_id === view.group_id) && view.members.some((m) => m.person_id === identityLink.community_member_id));
          if (!isMember) {
            return <Empty>זהות מאומתת, אך הנושא הנוכחי אינו חבר באף קבוצה אמיתית/DEMO סביב ערך זה.</Empty>;
          }
          const myVerifiedContributions = canonEffects
            .filter((e) => isEffectVerified(e.effect))
            .map((e) => ({ effect: e, action: canonActions.find((a) => a.action.action_id === e.effect.action_ref) }))
            .filter((pair) => pair.action?.action.owner === identityLink.person_id);
          if (myVerifiedContributions.length === 0) {
            return <Empty>חברות אמיתית מאומתת בקבוצה סביב ערך זה, אך 0 Action/Effect מאומת עדיין לנושא זה.</Empty>;
          }
          return (
            <div style={S.list}>
              {myVerifiedContributions.map(({ effect, action }) => (
                <div key={effect.effect.effect_id} style={S.listRow}>
                  <span style={S.listTitle}>תרומה ל־{selected.name} · Action: {action!.action.type}</span>
                  <span style={S.listMeta}>
                    Effect מאומת: {effect.effect.claimed_outcome.statement} · Evidence: {effect.effect.verified_outcome!.verifier_type}/{effect.effect.verified_outcome!.method} · {effect.recorded_at.slice(0, 10)}
                  </span>
                </div>
              ))}
            </div>
          );
        })()}

        {/* BATCH 6 — the smallest honest operational slice: no `value_
            context` field links a Need/Offer to a specific Value (see the
            row above), so "advancing" a value cannot be a structured,
            system-inferred link — it's a real Need/Offer the human
            explicitly writes, naming this value themselves in its
            context. "DEFEND THIS VALUE" is deliberately NOT offered: it
            would require a real "threat" signal, and none exists anywhere
            in canon — offering it would mean inventing one. */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
          <a href="?mode=needs" style={S.actionBtn}>קדם ערך זה · ADVANCE THIS VALUE → צור Need</a>
          <a href="?mode=resources" style={S.actionBtn}>קדם ערך זה · ADVANCE THIS VALUE → צור Offer</a>
        </div>
        <div style={{ fontSize: 10, color: "#5a76a3", marginTop: 6 }}>
          DEFEND THIS VALUE — לא מוצג: אין אות "איום" אמיתי בשום מקום ב-canon; הצגתה הייתה דורשת המצאת איום.
        </div>

        {/* BATCH 9 — CAUSE CONTEXT: real Tension over this Value's own real
            groups (`buildCommunityTensions`, existing function) — the
            honest "issue/opportunity" this Value is genuinely carrying,
            never a new persistent Cause entity. */}
        <div style={{ ...S.subHead, marginTop: 14 }}>הקשר סיבתי · CAUSE CONTEXT — Tension אמיתי (לא ישות Cause חדשה)</div>
        {valueCauseTensions.length === 0 ? (
          <Empty>0 — אין Tension אמיתי מחושב לאף קבוצה סביב ערך זה כרגע.</Empty>
        ) : (
          <div style={S.list}>
            {valueCauseTensions.map((t) => (
              <div key={t.id} style={S.listRow}>
                <span style={S.listTitle}>{t.label}</span>
                <span style={{ ...S.listMeta, color: t.severity === "high" ? "#f2635c" : t.severity === "medium" ? "#fbbf24" : "#8aa0c8" }}>
                  {t.current_state} · {t.severity} · {t.provenance}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Mission B, continuation — NEXT VALID ACTION for this Value, the
            same priority logic (real Tension first, else the real
            advance-affordances above) Hub/Brain/Group detail already use
            — never a separate invented action. */}
        <div style={{ ...S.subHead, marginTop: 14 }}>הפעולה הבאה התקפה · NEXT VALID ACTION</div>
        {valueCauseTensions.length > 0 ? (
          <div style={{ fontSize: 12, color: "#dbe6f6", padding: "8px 10px", borderRadius: 8, background: "rgba(242,99,92,0.08)", border: "1px solid rgba(242,99,92,0.25)" }}>
            בדוק Tension: {valueCauseTensions[0].label} — <a href="/dynamics" style={{ color: "#5b9cf6" }}>Dynamics →</a>
          </div>
        ) : selected.groups.length === 0 ? (
          <div style={{ fontSize: 12, color: "#dbe6f6", padding: "8px 10px", borderRadius: 8, background: "rgba(91,156,246,0.08)", border: "1px solid rgba(91,156,246,0.25)" }}>
            0 קבוצות סביב ערך זה — הפעולה התקפה היחידה: קדם אותו (למעלה) עד שקבוצה תיפתח.
          </div>
        ) : (
          <Empty>נבדק — אין Tension פתוח, יש קבוצה פעילה סביב ערך זה, אין פעולה דחופה מוצדקת.</Empty>
        )}

        {/* BATCH 13 — CAMPAIGNS. Unlike Cause (mapped onto the existing
            Tension structure), a Campaign — a bounded promotional effort
            with reach/join tracking — has no existing canon or legacy
            equivalent to reuse; building one for real means new
            persistence (a genuine new store/schema), a scope decision,
            not a redesign continuation. Honest zero-state only this
            pass: real 0, and a stated-disabled affordance, same
            `not_connected` discipline `buildContextActions` already
            established — never a fake "Create" button that silently
            does nothing. */}
        <div style={{ ...S.subHead, marginTop: 14 }}>קמפיינים · CAMPAIGNS (0)</div>
        <Empty>0 — Campaign אינה ישות persisted בבנייה זו עדיין (דורש store חדש, החלטת scope נפרדת).</Empty>
        <div style={{ fontSize: 10.5, color: "#5a76a3", padding: "6px 10px", border: "1px dashed rgba(90,120,180,0.3)", borderRadius: 6, marginTop: 4, display: "inline-block" }}>
          CREATE CAMPAIGN · not connected yet
        </div>
      </Section>
    );
  }

  const sourceCounts = countByType();
  const filteredConcepts = selectedConceptType ? SOURCE_CONCEPTS.filter((c) => c.type === selectedConceptType) : [];
  const activeGroupCount = groupRegistry.filter((g) => g.status === "REAL").length;
  const verifiedEffectsCount = groupRegistry.reduce((s, g) => s + g.verified_effects, 0);

  return (
    <>
      {/* OPERATIONAL SUMMARY — first viewport (§51/§52, Product Convergence
          Autostrada Phase 1/16): state + actionable controls, no corpus/pass
          commentary here. */}
      <div style={S.statGrid}>
        <Stat value={valueRegistry.length} label="VALUES" color="#5b9cf6" />
        <Stat value={activeGroupCount} label="ACTIVE GROUPS" color="#34d399" />
        <Stat value={possibleGroups.length} label="FORMING / POSSIBLE" color="#a78bfa" />
        <Stat value={realNeedsCount} label="OPEN NEEDS" color="#f2635c" />
        <Stat value={realOffersCount} label="AVAILABLE RESOURCES" color="#fbbf24" />
        <Stat value={realActionsCount} label="ACTIVE ACTIONS" color="#5aa6ff" />
        <Stat value={verifiedEffectsCount} label="VERIFIED EFFECTS" color="#34d399" />
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "4px 0 14px" }}>
        <a href="?mode=needs" style={S.actionBtn}>+ צורך חדש · NEW NEED</a>
        <a href="?mode=resources" style={S.actionBtn}>+ משאב חדש · NEW OFFER</a>
        <a href="?mode=groups" style={S.actionBtn}>קבוצות ← יצירה/הצטרפות</a>
      </div>

      {/* 1. REGISTERED VALUES — the live Community runtime registry (§40).
          Explicitly NOT presented as the complete PHILOS Value universe. */}
      <Section title={`ערכים רשומים (runtime) · REGISTERED VALUES (${valueRegistry.length})`}>
        <ValueChips valueRegistry={valueRegistry} />
      </Section>

      {/* 2. CANONICAL MODEL — the promoted (§50 CANONICAL_RUNTIME) subset
             only: real, high-confidence, independently-reviewed oppositions/
             tensions/relations/group-formation rules. NON_VALUE is never
             shown here as if it were a Value. Raw source candidates, pass
             numbers, and ledger citations live in DETAILS / AUDIT below. */}
      <Section title={`מודל קנוני · CANONICAL MODEL (${RUNTIME_TENSIONS.length + RUNTIME_OPPOSITIONS.length} ניגודים/מתחים · ${RUNTIME_VALUE_RELATIONS.length} יחסים · ${RUNTIME_QUALITY_GROUP_CRITERIA.length} קריטריוני קבוצת-איכות)`}>
        <div style={S.note}>מוצג כאן רק מה שעבר סף אמון גבוה + בדיקה עצמאית (CANONICAL_RUNTIME). שאר החומר — REFERENCE_ONLY / REVIEW_REQUIRED — ב-DETAILS / AUDIT.</div>
        <div style={S.list}>
          {[...RUNTIME_TENSIONS, ...RUNTIME_OPPOSITIONS].map((c) => (
            <div key={c.canonical_id} style={S.listRow}>
              <span style={S.listTitle}>{c.normalized_label}</span>
              <span style={{ ...S.listMeta, color: RUNTIME_STATUS_COLOR.CANONICAL_RUNTIME }}>{c.type} · CANONICAL_RUNTIME</span>
            </div>
          ))}
        </div>
        {valueRelations.length === 0 ? (
          <Empty>0 יחסים אמיתיים בין ערכים רשומים — אין מקור/ראיה המקשרים שני ערכים רשומים כלשהם כרגע.</Empty>
        ) : null}
        <div style={S.subHead}>מודל קבוצת-איכות · QUALITY-GROUP MODEL — {QUALITY_GROUP_MODEL.status}</div>
        <div style={S.note}>{RUNTIME_QUALITY_GROUP_CRITERIA.length} קריטריונים קנוניים · עדיין לא הומצא ציון/דירוג קבוצת-איכות.</div>
        <div style={S.subHead}>היררכיית קבוצה · 3 צירים נפרדים · GROUP HIERARCHY (3 AXES)</div>
        <div style={S.list}>
          {GROUP_HIERARCHY_AXES.map((axis) => (
            <div key={axis.axis_id} style={S.listRow}>
              <span style={S.listTitle}>{axis.label_he} ({axis.label_en})</span>
              <span style={{ ...S.listMeta, color: RUNTIME_STATUS_COLOR[axis.runtime_status] }}>{axis.runtime_status} · {axis.levels.map((l) => l.label_en).join(" ↓ ")}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* 3. DETAILS / AUDIT — everything source-corpus/pass/ledger-related,
             collapsed by default (same <details> convention page.tsx
             already uses for GROUP DETAIL). Kept, not deleted: real
             evidence, just not primary-viewport material. */}
      <details dir="rtl" style={{ margin: "0 0 16px" }}>
        <summary style={{ cursor: "pointer", fontSize: 10.5, letterSpacing: 1, color: "#5a76a3", padding: "4px 0" }}>DETAILS / AUDIT</summary>
        <div style={{ marginTop: 8 }}>
          <Section title={`מועמדים ממקור · SOURCE CANDIDATES (${SOURCE_CONCEPTS.length} מקור · ${countCanonicalConcepts()} קנוני לאחר איחוד כפילויות)`}>
            <div style={S.note}>
              כיסוי סמנטי: {SOURCE_CORPUS_TRIAGE.SEMANTIC_FILES_CLASSIFIED}/{SOURCE_CORPUS_TRIAGE.SEMANTIC_FILES} ({SOURCE_CORPUS_TRIAGE.SOURCE_COVERAGE_PERCENT_SEMANTIC}%, {SOURCE_CORPUS_TRIAGE.SEMANTIC_FILES_REMAINING} נותרו) —
              {" "}לא להתבלבל עם קריאת-תוכן-מלאה (שורה-אחר-שורה): {SOURCE_COVERAGE.files_scanned}/{SOURCE_COVERAGE.total_corpus_files} קבצים נקראו במלואם ({SOURCE_COVERAGE.coverage_percent}%) — שני מדדים שונים, לא מתבלבלים זה בזה.
            </div>
            <div style={S.grid}>
              {SOURCE_CONCEPT_TYPES.map((t) => (
                <a key={t} href={`?mode=values&conceptType=${t}`} style={{ ...S.valueCard, borderColor: `${CONCEPT_TYPE_COLOR[t] ?? "#5a76a3"}55`, ...(selectedConceptType === t ? { background: "rgba(91,156,246,0.12)" } : {}) }}>
                  <div style={{ ...S.valueCardTitle, color: CONCEPT_TYPE_COLOR[t] ?? "#8fa3c9" }}>{t}</div>
                  <div style={S.valueCardMeta}>{sourceCounts[t]} concepts</div>
                </a>
              ))}
            </div>
            {selectedConceptType ? (
              <div style={{ marginTop: 10 }}>
                <a href="?mode=values" style={S.back}>← כל הסוגים</a>
                <div style={S.subHead}>{selectedConceptType} ({filteredConcepts.length})</div>
                <div style={S.list}>
                  {filteredConcepts.map((c) => (
                    <div key={c.canonical_id} style={S.listRow}>
                      <span style={S.listTitle}>{c.normalized_label}</span>
                      <span style={S.listMeta}>{c.source_document} ({c.source_pass}) · confidence: {c.confidence} · {c.review_status}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </Section>

          <Section title={`יחסים ברמת המקור (REFERENCE_ONLY) · SOURCE-LEVEL RELATIONS (${SOURCE_VALUE_RELATIONS.length})`}>
            <div style={S.list}>
              {SOURCE_VALUE_RELATIONS.filter((r) => !RUNTIME_VALUE_RELATIONS.some((p) => p.relation_id === r.relation_id)).slice(0, 20).map((r) => (
                <div key={r.relation_id} style={S.listRow}>
                  <span style={S.listTitle}>{r.pole_a} ↔ {r.pole_b}</span>
                  <span style={S.listMeta}>{r.relation_type} · {r.source_concept_id}</span>
                </div>
              ))}
            </div>
          </Section>

          <Section title={`רשימות "ניגודי־בסיס" סגורות · CLOSED-LIST VARIANTS (${SOURCE_CONTRADICTION_LIST_VARIANTS.length}, none arbitrarily chosen)`}>
            <div style={S.list}>
              {SOURCE_CONTRADICTION_LIST_VARIANTS.map((v) => (
                <div key={v.variant_id} style={S.listRow}>
                  <span style={S.listTitle}>{v.label} — {v.item_count} items</span>
                  <span style={{ ...S.listMeta, color: v.status === "draft" ? "#fbbf24" : "#8aa0c8" }}>{v.status.toUpperCase()} · {v.source_document}</span>
                </div>
              ))}
            </div>
          </Section>

          <Section title={`קריטריוני קבוצת-איכות REFERENCE_ONLY (${sourceCounts.GROUP_CRITERION})`}>
            <div style={S.list}>
              {SOURCE_CONCEPTS.filter((c) => c.type === "GROUP_CRITERION").map((c) => (
                <div key={c.canonical_id} style={S.listRow}>
                  <span style={S.listTitle}>{c.normalized_label}</span>
                  <span style={S.listMeta}>REFERENCE_ONLY · {c.source_document} ({c.source_pass})</span>
                </div>
              ))}
            </div>
            <div style={S.subHead}>כללי היווצרות קבוצה · GROUP FORMATION RULES ({SOURCE_GROUP_FORMATION_RULES.length}, כולם CANONICAL_RUNTIME)</div>
            <div style={S.list}>
              {SOURCE_GROUP_FORMATION_RULES.map((r) => (
                <div key={r.rule_id} style={S.listRow}>
                  <span style={S.listTitle}>{r.statement}</span>
                  <span style={{ ...S.listMeta, color: "#34d399" }}>{r.runtime_status} · {r.source_document}</span>
                </div>
              ))}
            </div>
          </Section>

          {/* Kabbalah/Sefirot comparative lens — explicitly moved OUT of the
              primary runtime Value UI per direct instruction. Source data
              (SOURCE_PRINCIPLE_LENS) preserved, not deleted, reference-only. */}
          <Section title="עדשה השוואתית (קבלה/ספירות) · COMPARATIVE LENS — REFERENCE ONLY, NOT CANON">
            <div style={{ ...S.valueCardMeta, marginBottom: 8 }}>
              <b style={{ color: "#a78bfa" }}>{SOURCE_PRINCIPLE_LENS.status}</b>
            </div>
            <div style={S.list}>
              {SOURCE_PRINCIPLE_LENS.entries.map((p) => (
                <div key={p.principle_id} style={S.listRow}>
                  <span style={S.listTitle}>{p.label_he} ({p.label_en})</span>
                  <span style={S.listMeta}>בונה: {p.constructive_he} · מפרק: {p.destructive_he}</span>
                </div>
              ))}
            </div>
          </Section>

          <Section title="מיון קורפוס מלא · CORPUS TRIAGE">
            <div style={S.statGrid}>
              <Stat value={SOURCE_CORPUS_TRIAGE.TOTAL_FILES} label="TOTAL FILES" color="#8fa3c9" />
              <Stat value={SOURCE_CORPUS_TRIAGE.SEMANTIC_FILES} label="SEMANTIC" color="#5b9cf6" />
              <Stat value={SOURCE_CORPUS_TRIAGE.MEDIA_OUT_OF_SCOPE} label="MEDIA (OUT OF SCOPE)" color="#5a76a3" />
              <Stat value={SOURCE_CORPUS_TRIAGE.CODE_OUT_OF_SCOPE} label="CODE (OUT OF SCOPE)" color="#5a76a3" />
              <Stat value={SOURCE_CORPUS_TRIAGE.ARCHIVES} label="ARCHIVES (VERIFIED REDUNDANT)" color="#fbbf24" />
              <Stat value={SOURCE_CORPUS_TRIAGE.UNREADABLE} label="UNREADABLE / BLOCKED" color="#f2635c" />
              <Stat value={SOURCE_CORPUS_TRIAGE.SEMANTIC_FILES_REMAINING} label="SEMANTIC REMAINING" color="#34d399" />
            </div>
          </Section>
        </div>
      </details>
    </>
  );
}

// ── GROUPS ───────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<GroupRegistryEntry["status"], string> = { REAL: "#34d399", DEMO: "#fbbf24", ARCHIVED: "#5a76a3", FORMING: "#a78bfa" };

function GroupLandscape({
  groupRegistry, possibleGroups, people, universeFamilyCandidates,
}: {
  groupRegistry: GroupRegistryEntry[]; possibleGroups: PossibleGroup[]; people: PersonRow[];
  universeFamilyCandidates: { family_id: string; name_he: string }[];
}) {
  const byStatus = (s: GroupRegistryEntry["status"]) => groupRegistry.filter((g) => g.status === s);

  // BATCH 8 — GROUP NETWORK. Of the 7 relation types the mission names
  // (ALIGNED/COMPLEMENTARY/OVERLAPPING/IN_TENSION/SHARED_NEED/
  // SHARED_RESOURCE/SHARED_MEMBERS), exactly ONE is honestly computable
  // from data that exists today: SHARED_MEMBERS — a real person whose
  // `memberships` names both groups, an explicit reference check, never
  // inferred from name/value similarity. The other 6 would need either a
  // Need/Offer↔group link (doesn't exist — same gap already documented on
  // the Value detail page) or a similarity/tension-detection function
  // this codebase doesn't have — not built here rather than fabricated.
  const sharedMemberPairs: { a: string; b: string; sharedCount: number; names: string[] }[] = [];
  const groupIds = groupRegistry.map((g) => g.group_id);
  for (let i = 0; i < groupIds.length; i++) {
    for (let j = i + 1; j < groupIds.length; j++) {
      const shared = people.filter((p) => p.memberships.some((m) => m.group_id === groupIds[i]) && p.memberships.some((m) => m.group_id === groupIds[j]));
      if (shared.length > 0) {
        sharedMemberPairs.push({ a: groupRegistry[i].name, b: groupRegistry[j].name, sharedCount: shared.length, names: shared.map((p) => p.person.person_id) });
      }
    }
  }

  return (
    <>
      {(["REAL", "DEMO", "ARCHIVED", "FORMING"] as const).map((status) => (
        <Section key={status} title={`${status} GROUPS (${byStatus(status).length})`}>
          {byStatus(status).length === 0 ? <Empty>0 — אין רשומה אמיתית במצב זה.</Empty> : (
            <div style={S.grid}>
              {byStatus(status).map((g) => (
                <a key={g.group_id} href={`?mode=groups&community=${encodeURIComponent(g.group_id)}`} style={{ ...S.valueCard, borderColor: `${STATUS_COLOR[status]}55` }}>
                  <div style={{ ...S.valueCardTitle, color: STATUS_COLOR[status] }}>{g.name}</div>
                  <div style={S.valueCardMeta}>{g.central_value} · {g.member_count} people · {g.event_count} events</div>
                  <div style={S.valueCardMeta}>₪{g.available.toLocaleString()} available · {g.verified_effects} verified effect(s)</div>
                </a>
              ))}
            </div>
          )}
        </Section>
      ))}
      <Section title={`CANDIDATE — VALUE EXISTS, NO GROUP (${possibleGroups.length})`}>
        <div style={S.note}>לא קבוצה אמיתית. ערך רשום קיים אך 0 קבוצות אמיתיות/DEMO מרכזות סביבו.</div>
        {possibleGroups.length === 0 ? <Empty>0 — אין ערך אמיתי כרגע ללא קבוצה.</Empty> : (
          <div style={S.list}>
            {possibleGroups.map((p) => (
              <div key={p.value_id} style={S.listRow}>
                <span style={S.listTitle}>{p.value_name}</span>
                <span style={S.listMeta}>{p.evidence}</span>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title={`CANDIDATE — DERIVED FROM VALUE FAMILY (${universeFamilyCandidates.length})`}>
        <div style={S.note}>
          לא קבוצה אמיתית. משפחת ערך (328 Board reconciliation) שאף אחד מתת-הערכים המקושרים שלה אינו central_value של קבוצה אמיתית/DEMO היום.
        </div>
        {universeFamilyCandidates.length === 0 ? <Empty>0 — כל 28 המשפחות מכוסות ע"י קבוצה אמיתית/DEMO היום.</Empty> : (
          <div style={S.list}>
            {universeFamilyCandidates.map((f) => (
              <a key={f.family_id} href={`?mode=universe&family=${f.family_id}`} style={{ ...S.listRow, textDecoration: "none" }}>
                <span style={S.listTitle}>{f.name_he}</span>
                <span style={S.listMeta}>CANDIDATE · לא קבוצה אמיתית → צפה בתת-הערכים</span>
              </a>
            ))}
          </div>
        )}
      </Section>

      <Section title={`רשת קבוצות · GROUP NETWORK — SHARED_MEMBERS (${sharedMemberPairs.length})`}>
        <div style={S.note}>
          6 מתוך 7 סוגי היחסים (ALIGNED/COMPLEMENTARY/OVERLAPPING/IN_TENSION/SHARED_NEED/SHARED_RESOURCE) דורשים נתון שאינו קיים עדיין (קישור Need/Offer↔קבוצה, או פונקציית דמיון/מתח) — לא מוצגים, לא מומצאים. SHARED_MEMBERS בלבד ניתן לחישוב אמיתי כרגע.
        </div>
        {sharedMemberPairs.length === 0 ? (
          <Empty>0 — אין שני קבוצות עם חבר משותף אמיתי כרגע.</Empty>
        ) : (
          <div style={S.list}>
            {sharedMemberPairs.map((r) => (
              <div key={`${r.a}::${r.b}`} style={S.listRow}>
                <span style={S.listTitle}>{r.a} ↔ {r.b}</span>
                <span style={S.listMeta}>SHARED_MEMBERS · {r.sharedCount} — {r.names.join(", ")}</span>
              </div>
            ))}
          </div>
        )}
      </Section>
    </>
  );
}

// ── PEOPLE ───────────────────────────────────────────────────────────────

function PeopleGraph({ people, identityLink }: { people: PersonRow[]; identityLink: ShellIdentityLink }) {
  return (
    <Section title={`אנשים ↔ ערכים ↔ קבוצות · PEOPLE ↔ VALUES ↔ GROUPS (${people.length})`}>
      <div style={S.note}>
        חברות בקבוצה ≠ אישור ערך אישי. כל שורה מציגה שיוך דרך חברות אמיתית בקבוצה בלבד — לא הסקה של ערך אישי.
        {identityLink.status === "VERIFIED_SAME_PERSON" ? ` ${identityLink.person_id} מקושר קנונית ל-${identityLink.community_member_id} (VERIFIED_SAME_PERSON, §37).` : ""}
      </div>
      <div style={S.list}>
        {people.map((p) => (
          <div key={p.person.person_id} style={S.listRow}>
            <span style={S.listTitle}>
              {p.person.display_name}
              {p.is_identity_linked ? <span style={{ color: "#34d399", marginRight: 6 }}> ⚭ {identityLink.person_id}</span> : null}
            </span>
            <span style={S.listMeta}>
              {p.memberships.map((m) => `${m.group_name} (${m.central_value}, ${m.status})`).join(" · ") || "ללא חברות"}
            </span>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ── NEEDS / RESOURCES ────────────────────────────────────────────────────

function NeedsMode({ realNeedsCount }: { realNeedsCount: number }) {
  return (
    <Section title={`צרכים פתוחים · OPEN NEEDS (${realNeedsCount})`}>
      <CreateNeedForm />
      {realNeedsCount === 0 ? <Empty>0 Need קנוני אמיתי כרגע — השתמש בטופס למעלה כדי לרשום אחד.</Empty> : <div style={S.note}>{realNeedsCount} Need קנוני אמיתי רשום.</div>}
    </Section>
  );
}

function ResourcesMode({ realOffersCount, realGroups }: { realOffersCount: number; realGroups: GroupRegistryEntry[] }) {
  return (
    <>
      <Section title={`משאבים זמינים (canon) · AVAILABLE RESOURCES (${realOffersCount})`}>
        <CreateOfferForm />
        {realOffersCount === 0 ? <Empty>0 Offer קנוני אמיתי כרגע — השתמש בטופס למעלה כדי לרשום אחד.</Empty> : <div style={S.note}>{realOffersCount} Offer קנוני אמיתי רשום.</div>}
      </Section>
      <Section title="הון קהילתי זמין · COMMUNITY CAPITAL AVAILABLE">
        <div style={S.list}>
          {realGroups.map((g) => (
            <div key={g.group_id} style={S.listRow}>
              <span style={S.listTitle}>{g.name}</span>
              <span style={S.listMeta}>₪{g.available.toLocaleString()} available</span>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}

// ── ACTIVITY / IMPACT ────────────────────────────────────────────────────

function ActivityMode({
  activity, canonActions, canonEffects, identityLink,
}: {
  activity: ActivityRow[];
  canonActions: ActionRecord[];
  canonEffects: EffectRecord[];
  identityLink: ShellIdentityLink;
}) {
  return (
    <>
      <Section title={`קבוצה · LEGACY GROUP ACTIVITY (${activity.length})`}>
        <div style={{ fontSize: 10, color: "#5a76a3", marginBottom: 8 }}>
          מקור: יומן Value-Group ההיסטורי (legacy event log) — נפרד לגמרי ממערכת ה-canon למטה, אין מיזוג מזהים.
        </div>
        {activity.length === 0 ? <Empty>אין פעילות רשומה.</Empty> : (
          <div style={S.feed}>
            {activity.map((a) => (
              <div key={a.event_id} style={S.feedRow}>
                <span style={{ ...S.feedTag, color: a.status === "REAL" ? "#34d399" : "#fbbf24" }}>{a.status}</span>
                <span style={S.feedText}><b>{a.actor_name}</b> · {a.group_name} · {a.text}</span>
                <span style={S.feedTime}>{a.date} {a.time}</span>
              </div>
            ))}
          </div>
        )}
      </Section>
      <CanonActivitySection canonActions={canonActions} canonEffects={canonEffects} identityLink={identityLink} />
    </>
  );
}

/**
 * LOOP 0052 — real canon Action/Effect activity, kept structurally and
 * visually separate from LEGACY GROUP ACTIVITY above: different source
 * (`actionStore`/`effectStore`, not the Value-Group event log), different
 * id space (`action_id`/`effect_id` — the SAME ids `/marketplace` and
 * `/dynamics` render, never re-minted here), no group_id anywhere (canon
 * Action carries none — see `ActionCollectiveContext.tsx`'s header for
 * why that link is never fabricated). The only contextual link ever shown
 * is the real, already-checked `identityLink` (VERIFIED_SAME_PERSON) —
 * never an invented group membership.
 */
function CanonActivitySection({
  canonActions, canonEffects, identityLink,
}: {
  canonActions: ActionRecord[];
  canonEffects: EffectRecord[];
  identityLink: ShellIdentityLink;
}) {
  const linked = identityLink?.status === "VERIFIED_SAME_PERSON";
  const sortedActions = [...canonActions].sort((a, b) => b.recorded_at.localeCompare(a.recorded_at));
  const sortedEffects = [...canonEffects].sort((a, b) => b.recorded_at.localeCompare(a.recorded_at));

  return (
    <Section title={`CANON · פעילות Action/Effect קנונית (${canonActions.length + canonEffects.length})`}>
      <div style={{ fontSize: 10, color: "#5a76a3", marginBottom: 8 }}>
        מקור: canon actionStore/effectStore — אותם action_id/effect_id בדיוק כמו ב-/marketplace וב-/dynamics. אין group_id על Action קנוני — אין ייחוס קבוצתי מומצא.
      </div>
      {canonActions.length === 0 && canonEffects.length === 0 ? (
        <Empty>אין עדיין Action או Effect קנוני אמיתי רשום.</Empty>
      ) : (
        <div style={S.feed}>
          {sortedActions.map((a) => {
            const isLinkedOwner = linked && a.action.owner === identityLink.person_id;
            return (
              <a key={a.action.action_id} href={`?mode=activity&ctx=${encodeURIComponent(`action:${a.action.action_id}`)}`} style={{ ...S.feedRow, textDecoration: "none", color: "inherit" }}>
                <span style={{ ...S.feedTag, color: "#5b9cf6" }}>CANON · ACTION</span>
                <span style={S.feedText}>
                  <b>{a.action.type}</b> · {a.action.mechanism_scope} · owner {a.action.owner} · {a.action.action_id.slice(0, 10)}…
                  {isLinkedOwner ? <span style={{ color: "#34d399" }}> · מקושר לזהות הקהילתית שלך (VERIFIED_SAME_PERSON)</span> : null}
                </span>
                <span style={S.feedTime}>{a.recorded_at.slice(0, 16).replace("T", " ")}</span>
              </a>
            );
          })}
          {sortedEffects.map((e) => (
            <a key={e.effect.effect_id} href={`?mode=activity&ctx=${encodeURIComponent(`effect:${e.effect.effect_id}`)}`} style={{ ...S.feedRow, textDecoration: "none", color: "inherit" }}>
              <span style={{ ...S.feedTag, color: isEffectVerified(e.effect) ? "#34d399" : "#a78bfa" }}>
                CANON · {isEffectVerified(e.effect) ? "EFFECT VERIFIED" : "EFFECT CLAIMED"}
              </span>
              <span style={S.feedText}>
                {e.effect.claimed_outcome.statement} · action_ref {e.effect.action_ref.slice(0, 10)}… · {e.effect.effect_id.slice(0, 10)}…
              </span>
              <span style={S.feedTime}>{e.recorded_at.slice(0, 16).replace("T", " ")}</span>
            </a>
          ))}
        </div>
      )}
    </Section>
  );
}

function ImpactMode({ impact }: { impact: ImpactRow[] }) {
  return (
    <Section title={`השפעה · IMPACT (${impact.length})`}>
      {impact.length === 0 ? <Empty>אין Effect רשום.</Empty> : (
        <div style={S.list}>
          {impact.map((i) => (
            <div key={i.impact_id} style={S.listRow}>
              <span style={S.listTitle}>{i.statement}</span>
              <span style={{ ...S.listMeta, color: i.verified ? "#34d399" : "#5a76a3" }}>{i.group_name} · {i.verified ? "VERIFIED" : i.verification_level}</span>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

// ── shared bits ──────────────────────────────────────────────────────────

const PROV_COLOR: Record<string, string> = { REAL: "#34d399", DEMO: "#fbbf24", LEGACY: "#5a76a3" };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={S.section}>
      <div style={S.sectionTitle}>{title}</div>
      {children}
    </section>
  );
}
function Stat({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div style={S.stat}>
      <div style={{ ...S.statValue, color }}>{value}</div>
      <div style={S.statLabel}>{label}</div>
    </div>
  );
}
export function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={S.detailRow}>
      <span style={S.detailLabel}>{label}</span>
      <span style={S.detailValue}>{value}</span>
    </div>
  );
}
function Empty({ children }: { children: React.ReactNode }) {
  return <div style={S.empty}>{children}</div>;
}

export const S: Record<string, React.CSSProperties> = {
  wrap: { fontFamily: "system-ui", color: "#e6ebf5" },
  tabs: { display: "flex", flexWrap: "wrap", gap: 6, margin: "16px 20px 0" },
  tab: { fontSize: 11, padding: "5px 12px", borderRadius: 12, border: "1px solid rgba(90,120,180,0.3)", color: "#8fa3c9", textDecoration: "none" },
  tabActive: { color: "#0b0f1a", background: "#5b9cf6", borderColor: "#5b9cf6", fontWeight: 700 },

  statGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: 8, margin: "12px 20px" },
  compactStrip: { fontSize: 11, color: "#8fa3c9", margin: "12px 20px", padding: "8px 14px", background: "rgba(91,156,246,0.06)", border: "1px solid rgba(91,156,246,0.2)", borderRadius: 10 },
  stat: { textAlign: "center", background: "rgba(18,24,38,0.6)", border: "1px solid rgba(90,120,180,0.16)", borderRadius: 10, padding: "8px 6px" },
  statValue: { fontSize: 18, fontWeight: 800 },
  statLabel: { fontSize: 8.5, color: "#8fa3c9", letterSpacing: 0.3, marginTop: 2 },

  section: { margin: "0 20px 16px", padding: "14px 16px", background: "rgba(18,24,38,0.6)", border: "1px solid rgba(90,120,180,0.16)", borderRadius: 14 },
  sectionTitle: { fontSize: 12, fontWeight: 700, color: "#5aa6ff", letterSpacing: 0.5, marginBottom: 10 },
  subHead: { fontSize: 11, fontWeight: 700, color: "#8fa3c9", marginTop: 12, marginBottom: 6 },
  moreLink: { display: "inline-block", fontSize: 10.5, color: "#5b9cf6", textDecoration: "none", marginTop: 6 },
  actionBtn: { display: "inline-block", fontSize: 12, fontWeight: 600, color: "#0b0f1a", background: "#5b9cf6", padding: "8px 14px", borderRadius: 8, textDecoration: "none" },
  back: { display: "inline-block", fontSize: 11, color: "#5b9cf6", textDecoration: "none", marginBottom: 10 },

  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 8 },
  valueCard: { display: "block", border: "1px solid", borderRadius: 10, padding: "8px 10px", textDecoration: "none", background: "rgba(90,120,180,0.04)" },
  valueCardTitle: { fontSize: 12.5, fontWeight: 700 },
  valueCardMeta: { fontSize: 9.5, color: "#8aa0c8", marginTop: 3 },

  groupChips: { display: "flex", flexWrap: "wrap", gap: 6 },
  groupChip: { fontSize: 11, padding: "5px 12px", borderRadius: 12, border: "1px solid", textDecoration: "none" },

  detailGrid: { display: "flex", flexDirection: "column", gap: 4 },
  detailRow: { display: "flex", flexDirection: "column", gap: 2, padding: "6px 8px", borderRadius: 6, background: "rgba(90,120,180,0.05)" },
  detailLabel: { fontSize: 8.5, color: "#5a76a3", letterSpacing: 0.5 },
  detailValue: { fontSize: 12, color: "#dbe6f6" },

  list: { display: "flex", flexDirection: "column", gap: 4 },
  listRow: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 8, background: "rgba(90,120,180,0.06)", flexWrap: "wrap" },
  listTitle: { fontSize: 12, color: "#e8edf6" },
  listMeta: { fontSize: 10, color: "#8aa0c8" },

  feed: { display: "flex", flexDirection: "column", gap: 4 },
  feedRow: { display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", borderRadius: 6, background: "rgba(90,120,180,0.05)", fontSize: 11.5, flexWrap: "wrap" },
  feedTag: { fontSize: 9, fontWeight: 800, fontFamily: "ui-monospace, monospace" },
  feedText: { flex: 1, color: "#dbe6f6" },
  feedTime: { fontSize: 9.5, color: "#5a76a3" },

  note: { fontSize: 10.5, color: "#5a76a3", lineHeight: 1.7, marginBottom: 8 },
  empty: { fontSize: 11.5, color: "#7b8ca6", fontStyle: "italic", padding: "4px 2px", lineHeight: 1.6 },
};
