/**
 * CanonicalSlicePanel — Phase 4 vertical slice, shared verbatim between
 * `/hub` and `/dynamics` (Phase 4 §8: "Both must resolve and display the
 * SAME subject_id / domain_id / PersonInstance / ValueDomainInstance /
 * source_refs / current_state / history / evidence / changed"). One
 * component, one data path — never two independent re-derivations of the
 * same facts. Clock-free itself (`subject`/`asOf` are caller-supplied, same
 * discipline `ValueDomainDemoPanel.tsx` already established for `today`) so
 * it renders identically regardless of which route calls it.
 *
 * Reads three frozen Source Locks (`HumanMasterLoader`/`MusicMasterLoader`/
 * `ColorMasterLoader`) and the ALREADY-REAL, ALREADY-PERSISTED
 * `DomainStateStore` (`findDomainStatesForSubject`, reused verbatim — no new
 * store). Never writes anything; the Action→Effect→Evidence→Learning→
 * State(t1) loop itself (`canonical/stateLoop.ts`) is exercised by real
 * canon forms elsewhere on this page (`CreateActionForm`/`CreateEffectForm`)
 * plus its own roundtrip test — this panel only ever displays the result.
 *
 * Every dataset below is labeled with its real `SOURCE_KIND` — CANON for
 * the three frozen masters and any DomainState read back from the store,
 * never silently presented as more authoritative than it is (Phase 4 §9).
 */
import { findDomainStatesForSubject } from "@/app/lib/philos/canon/domainStateStoreAccessor";
import { humanMasterMeta, summarizeHumanMaster } from "@/app/lib/philos/canonical/humanMasterLoader";
import {
  MUSIC_CANON_DOMAIN_ID,
  musicMasterMeta,
  summarizeMusicMaster,
} from "@/app/lib/philos/canonical/musicMasterLoader";
import { buildActivePersonRefs, buildActiveMusicRefs } from "@/app/lib/philos/canonical/activeConfig";
import { resolveCanonicalRef } from "@/app/lib/philos/canonical/canonicalRef";
import { colorMasterMeta, loadColorMaster, whiteColorConflict } from "@/app/lib/philos/canonical/colorMasterLoader";
import { buildPersonInstance, buildValueDomainInstance, type CanonicalStateSnapshot } from "@/app/lib/philos/canonical/personInstance";
import type { SourceKind } from "@/app/lib/philos/canonical/sourceKind";
import { buildActionLifecycleSummary } from "@/app/lib/philos/canon/actionLifecycle";
import { findNeedsForSubject } from "@/app/lib/philos/canon/needStoreAccessor";
import { findOffersForSource } from "@/app/lib/philos/canon/offerStoreAccessor";
import { resolveShellIdentityLink } from "@/app/lib/philos/community/resolveShellIdentityLink";
import { loadPhilosEvents } from "@/app/lib/philos-event-store";
import { buildCapitalTimeline, projectValueGroup, type ValueGroupView } from "@/app/lib/philos/projectValueGroup";
import type { PhilosEvent } from "@/app/lib/philos/events";
import { GROUP_ID } from "@/app/lib/philos/valueGroupLog";
import { DEMO_COMMUNITIES } from "@/app/lib/philos/demoCommunities";
import { buildDefaultLinkRegistry } from "@/app/lib/philos/bridge/linkRegistry";
import { linksByRelation } from "@/app/lib/philos/bridge/entityLink";

/** The one real `domain_id` this pass uses for Human-domain DomainState
 *  readings — mirrors `MUSIC_CANON_DOMAIN_ID`'s own "one stable id" role. */
export const HUMAN_CANON_DOMAIN_ID = "human_canon";

const KIND_STYLE: Record<SourceKind, { bg: string; border: string; text: string }> = {
  CANON: { bg: "rgba(52,211,153,0.12)", border: "rgba(52,211,153,0.4)", text: "#34d399" },
  LEGACY: { bg: "rgba(91,156,246,0.12)", border: "rgba(91,156,246,0.4)", text: "#5b9cf6" },
  DEMO: { bg: "rgba(251,191,36,0.12)", border: "rgba(251,191,36,0.4)", text: "#fbbf24" },
  STATIC: { bg: "rgba(90,111,150,0.12)", border: "rgba(90,111,150,0.35)", text: "#8798b8" },
};

function Kind({ kind }: { kind: SourceKind }) {
  const s = KIND_STYLE[kind];
  return <span style={{ ...S.kindBadge, background: s.bg, border: `1px solid ${s.border}`, color: s.text }}>{kind}</span>;
}

export default async function CanonicalSlicePanel({ subject, asOf }: { subject: string; asOf: string }) {
  const humanSummary = summarizeHumanMaster();
  const humanMeta = humanMasterMeta();
  const musicSummary = summarizeMusicMaster();
  const musicMeta = musicMasterMeta();
  const colors = loadColorMaster();
  const colorMeta = colorMasterMeta();
  const whiteConflict = whiteColorConflict();

  // Person + Music config ACTIVATION — the same two mechanical folds every
  // instance-building call site now uses (`canonical/activeConfig.ts`).
  // Refs only; CURRENT_STATE below stays exactly as observed (or UNKNOWN).
  const activePerson = buildActivePersonRefs();
  const activeMusic = buildActiveMusicRefs();

  const domainStates = await findDomainStatesForSubject(subject);
  const personInstance = buildPersonInstance({
    subject_id: subject, domain_id: HUMAN_CANON_DOMAIN_ID, records: domainStates,
    source_kind: "CANON", source_refs: activePerson.refObjects, asOf,
  });
  const musicInstance = buildValueDomainInstance({
    subject_id: subject, domain_id: MUSIC_CANON_DOMAIN_ID, records: domainStates,
    source_kind: "CANON", source_refs: activeMusic.refObjects, asOf,
  });

  // Phase 8 — Action Chain + Community/Marketplace flow, same real reads
  // the shared-state API route already performs (`app/api/canon/shared-
  // state/route.ts`), reused here so every terminal rendering this shared
  // component (all 7) shows the identical chain, not a per-terminal
  // re-derivation.
  const lifecycle = await buildActionLifecycleSummary(subject);
  const [needs, offers] = await Promise.all([findNeedsForSubject(subject), findOffersForSource(subject)]);

  // Phase 8 — real Value Groups, same identity-bridge + REAL/DEMO
  // computation `/hub`'s own page.tsx already performs, reused here so
  // this shared component (rendered on all 7 terminals) also carries a
  // real value-group layer to Globe/World/Community/Marketplace, not just
  // Hub/Dynamics/Brain.
  const today = asOf.slice(0, 10);
  const identityLink = await resolveShellIdentityLink();
  const philosEvents = await loadPhilosEvents();
  let valueGroups: { view: ValueGroupView; provenance: "REAL" | "DEMO"; trend: string }[] = [];
  if (identityLink.status === "VERIFIED_SAME_PERSON") {
    const realGroup = projectValueGroup(philosEvents, GROUP_ID, today);
    const demoViews = DEMO_COMMUNITIES
      .map((c) => projectValueGroup(c.events, c.group_id, c.today))
      .filter((v): v is ValueGroupView => v !== null);
    const allGroups: { view: ValueGroupView; provenance: "REAL" | "DEMO"; events: readonly PhilosEvent[] }[] = [
      ...(realGroup ? [{ view: realGroup, provenance: "REAL" as const, events: philosEvents }] : []),
      ...demoViews.map((view, i) => ({ view, provenance: "DEMO" as const, events: DEMO_COMMUNITIES[i]?.events ?? [] })),
    ];
    valueGroups = allGroups
      .filter(({ view }) => view.members.some((m) => m.person_id === identityLink.community_member_id))
      .map(({ view, provenance, events }) => {
        const capital = buildCapitalTimeline(events);
        const trend = capital.length < 2
          ? "אין מספיק היסטוריה למגמה"
          : `${capital.length} תנועות · אחרונה: ${capital[capital.length - 1].delta >= 0 ? "+" : ""}${capital[capital.length - 1].delta} → יתרה ${capital[capital.length - 1].balance}`;
        return { view, provenance, trend };
      });
  }

  // Phase 8/P0 — "World event → relevance → affected Person/Value/
  // Community → possible action": the SAME real Canonical Cross-Entity
  // Link Registry Brain/Globe already build, over the SAME real event log.
  // No external news/event feed exists anywhere in this codebase (Day
  // Opening's own `collect_world_external` reports this honestly) — this
  // section shows real INTERNAL relevance (which real Action affected
  // which real Community) rather than inventing an external one.
  const bridgeRegistry = buildDefaultLinkRegistry(philosEvents, today);
  const worldRelevanceLinks = linksByRelation(bridgeRegistry, "ACTION_AFFECTS_COMMUNITY");

  return (
    <section dir="rtl" style={S.card}>
      <div style={S.head}>
        <Kind kind="CANON" />
        <h3 style={S.title}>שכבה קנונית · Phase 4 — Human / Music / Color Source Locks</h3>
      </div>
      <div style={S.note}>
        נטען ישירות מקבצי ה-Source Lock הקפואים (`canonical/data/*.master.json`) — אף שדה SOURCE_TEXT אינו נשמר במופעי Runtime (PersonInstance/ValueDomainInstance) למטה.
      </div>

      <div style={S.grid}>
        <MasterCard label="Human" meta={humanMeta} total={humanSummary.total} buckets={humanSummary.by_runtime_status} />
        <MasterCard label="Music" meta={musicMeta} total={musicSummary.total} buckets={musicSummary.by_runtime_status} />
        <div style={S.paramCard}>
          <div style={S.paramLabel}>Color · {colorMeta.row_count} רשומות</div>
          <div style={S.tag}>id_field: {colorMeta.id_field}</div>
          {whiteConflict ? (
            <div style={{ ...S.tag, color: whiteConflict.conflict_status === "OPEN" ? "#f2635c" : "#8fa3c9" }}>
              White (COLOR_ID=0) · CONFLICT_STATUS: {whiteConflict.conflict_status ?? "—"}
            </div>
          ) : null}
        </div>
      </div>

      <div style={S.subHead}>Color — Semantic Metadata (COLOR_ID · CANONICAL_FUNCTION · MAPPING_BASIS · CONFLICT_STATUS)</div>
      <div style={S.grid}>
        {colors.map((c) => (
          <div key={String(c.COLOR_ID)} style={S.paramCard}>
            <div style={S.paramLabel}>{c.COLOR} · ID={String(c.COLOR_ID)}</div>
            <div style={S.tag}>{c.CANONICAL_FUNCTION}</div>
            <div style={S.tag}>MAPPING_BASIS: {c.MAPPING_BASIS ?? "—"}</div>
            {c.CONFLICT_STATUS ? (
              <div style={{ ...S.tag, color: "#f2635c" }}>CONFLICT_STATUS: {c.CONFLICT_STATUS}</div>
            ) : null}
          </div>
        ))}
      </div>

      {/* ACTIVE MUSIC CONFIG — replaces the old "First Contact" inventory
          listing. KNOWN = activated canonical refs, grouped by the lock's
          own TYPE words; UNKNOWN/LIVE = what only a real Observation can
          answer, stated as UNKNOWN, never inferred from the config. */}
      <div style={S.subHead}>ACTIVE MUSIC CONFIG — ידוע (CANON, {activeMusic.refs.length} refs מתוך {musicSummary.total}) מול חי (UNKNOWN עד Observation)</div>
      <ActiveConfigSummary bytype={activeMusic.by_type} />
      <div style={{ ...S.row, background: "rgba(90,111,150,0.08)" }}>
        <span>חי · LIVE — שלב workflow נוכחי · מצב פרויקט · לולאות פתוחות · ראיה נוכחית · פעולה מוזיקלית הבאה</span>
        <span style={{ ...S.meta, fontStyle: "italic" }}>UNKNOWN — אין תצפית אמיתית; לא מוסק מהקונפיג</span>
      </div>

      <div style={S.subHead}>PersonInstance — subject={subject} · domain={HUMAN_CANON_DOMAIN_ID}</div>
      <InstanceRows instance={personInstance} />

      <div style={S.subHead}>ValueDomainInstance — subject={subject} · domain={MUSIC_CANON_DOMAIN_ID}</div>
      <InstanceRows instance={musicInstance} />

      <div style={S.subHead}>Action Chain — State(t0) → Action → Effect → Evidence → Learning → State(t1)</div>
      <ActionChain instance={personInstance} label="Human" />
      <ActionChain instance={musicInstance} label="Music" />
      {lifecycle.actions.length === 0 ? (
        <div style={{ ...S.row, fontStyle: "italic", color: "#7b8ca6" }}>אין Action/Effect אמיתי לנושא הזה עדיין</div>
      ) : (
        lifecycle.actions.slice(0, 5).map((a) => (
          <div key={a.action.action.action_id} style={S.row}>
            <span>Action {a.action.action.action_id.slice(0, 18)}… → {a.verification_state}</span>
            <span style={S.meta}>{a.effects[0]?.verified ? "Effect: VERIFIED" : a.effects[0] ? "Effect: CLAIMED" : "אין Effect"}</span>
          </div>
        ))
      )}

      <div style={S.subHead}>Need → Offer → Match → Action → Effect (Community/Marketplace)</div>
      <div style={S.flowRow}>
        <FlowStep label="Need" count={needs.length} />
        <FlowArrow />
        <FlowStep label="Offer" count={offers.length} />
        <FlowArrow />
        <FlowStep label="Action" count={lifecycle.counts.actions_total} />
        <FlowArrow />
        <FlowStep label="Effect (מאומת)" count={lifecycle.counts.effect_verified} />
      </div>

      <div style={S.subHead}>Value Groups — שכבת ערך אמיתית (Globe/World/Community layer, {valueGroups.length})</div>
      {valueGroups.length === 0 ? (
        <div style={{ ...S.row, fontStyle: "italic", color: "#7b8ca6" }}>אין חברות בקבוצת ערך מאומתת עבור subject זה</div>
      ) : (
        <div style={S.grid}>
          {valueGroups.map(({ view, provenance, trend }) => (
            <div key={view.group_id} style={{ ...S.paramCard, opacity: provenance === "DEMO" ? 0.7 : 1 }}>
              <div style={S.paramLabel}>
                {view.name} <span style={{ ...S.kindBadge, marginInlineStart: 6, ...(provenance === "REAL" ? { background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.4)", color: "#34d399" } : { background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.4)", color: "#fbbf24" }) }}>{provenance}</span>
              </div>
              <div style={S.tag}>ערך מרכזי: {view.central_value}</div>
              <div style={S.tag}>{view.members.length} חברים · תקציב זמין {view.budget.available} · Impact מאומת {view.impact.filter((i) => i.verified).length}/{view.impact.length}</div>
              <div style={S.tag}>מגמת תקציב (trend): {trend}</div>
            </div>
          ))}
        </div>
      )}

      <div style={S.subHead}>World Relevance — Action → Community (real Cross-Entity Link Registry, {worldRelevanceLinks.length})</div>
      <div style={{ ...S.note, marginBottom: 6 }}>
        אין מקור אירועים חיצוני (חדשות/עולם) מחובר למערכת הזו כרגע — UNKNOWN, לא מומצא. הקטע הזה מציג רלוונטיות אמיתית פנימית: אילו Action אמיתיים משפיעים על אילו Community אמיתיות.
      </div>
      {worldRelevanceLinks.length === 0 ? (
        <div style={{ ...S.row, fontStyle: "italic", color: "#7b8ca6" }}>אין קישור Action→Community אמיתי כרגע</div>
      ) : (
        worldRelevanceLinks.map((l) => (
          <div key={l.link_id} style={S.row}>
            <span>{l.source.type}:{l.source.canonical_id} → {l.target.type}:{l.target.canonical_id}</span>
            <span style={S.meta}>{l.provenance}{l.note ? ` · ${l.note}` : ""}</span>
          </div>
        ))
      )}
    </section>
  );
}

/** Grouped, resolved display of an active ref set — labels come from
 *  `resolveCanonicalRef` (structurally SOURCE_TEXT-free), first two per
 *  group + honest "+N" for the rest. */
function ActiveConfigSummary({ bytype }: { bytype: Record<string, string[]> }) {
  return (
    <>
      {Object.entries(bytype).map(([type, refs]) => (
        <div key={type} style={S.row}>
          <span>{type} ({refs.length})</span>
          <span style={S.meta}>
            {refs.slice(0, 2).map((raw) => {
              const r = resolveCanonicalRef(raw);
              return r.status === "resolved" ? `${raw} · ${r.label}` : raw;
            }).join(" | ")}
            {refs.length > 2 ? ` | +${refs.length - 2} נוספים` : ""}
          </span>
        </div>
      ))}
    </>
  );
}

function ActionChain({ instance, label }: { instance: { history: CanonicalStateSnapshot[] }; label: string }) {
  if (instance.history.length < 2) return null;
  const before = instance.history[instance.history.length - 2];
  const after = instance.history[instance.history.length - 1];
  return (
    <div style={S.chainRow}>
      <span style={S.chainLabel}>{label}</span>
      <span style={S.chainState}>State(t0): {before.parameter_id}={before.level} @ {before.observed_at}</span>
      <span style={S.chainArrow}>→</span>
      <span style={S.chainState}>State(t1): {after.parameter_id}={after.level} @ {after.observed_at}</span>
    </div>
  );
}

function FlowStep({ label, count }: { label: string; count: number }) {
  return (
    <div style={S.flowStep}>
      <div style={{ fontSize: 16, fontWeight: 800, color: count > 0 ? "#34d399" : "#5a6f96" }}>{count}</div>
      <div style={{ fontSize: 9.5, color: "#8fa3c9" }}>{label}</div>
    </div>
  );
}

function FlowArrow() {
  return <div style={{ fontSize: 14, color: "#5a76a3", alignSelf: "center" }}>→</div>;
}

function MasterCard({ label, meta, total, buckets }: { label: string; meta: { row_count: number; id_field: string }; total: number; buckets: Record<string, number> }) {
  return (
    <div style={S.paramCard}>
      <div style={S.paramLabel}>{label} · {total} רשומות</div>
      <div style={S.tag}>id_field: {meta.id_field}</div>
      {Object.entries(buckets).map(([k, v]) => (
        <div key={k} style={S.tag}>{k}: {v}</div>
      ))}
    </div>
  );
}

function InstanceRows({ instance }: { instance: { current_state: CanonicalStateSnapshot[]; history: CanonicalStateSnapshot[]; evidence: string[]; source_refs: string[]; timestamp: string; confidence: number; changed: boolean; source_kind: SourceKind } }) {
  return (
    <>
      <div style={S.row}>
        <span>current_state</span>
        <span style={S.meta}>
          {instance.current_state.length === 0 ? "לא ידוע — אין תצפית אמיתית עדיין" : instance.current_state.map((s) => `${s.parameter_id}=${s.level}`).join(" · ")}
        </span>
      </div>
      <div style={S.row}>
        <span>history</span>
        <span style={S.meta}>{instance.history.length} רשומות</span>
      </div>
      <div style={S.row}>
        <span>evidence</span>
        <span style={S.meta}>{instance.evidence.length === 0 ? "—" : instance.evidence.join(" · ")}</span>
      </div>
      <div style={S.row}>
        <span>source_refs</span>
        <span style={S.meta}>
          {instance.source_refs.length === 0
            ? "— (לא הופעלו הפניות קנוניות)"
            : `${instance.source_refs.length} refs פעילים · ${instance.source_refs.slice(0, 4).join(" · ")}${instance.source_refs.length > 4 ? ` · +${instance.source_refs.length - 4}` : ""}`}
        </span>
      </div>
      <div style={S.row}>
        <span>changed · confidence · timestamp</span>
        <span style={S.meta}>{String(instance.changed)} · {instance.confidence} · {instance.timestamp}</span>
      </div>
    </>
  );
}

const S: Record<string, React.CSSProperties> = {
  card: { background: "rgba(18,24,38,0.7)", border: "1px solid rgba(52,211,153,0.3)", borderRadius: 16, padding: "16px 18px", marginTop: 16 },
  head: { display: "flex", alignItems: "center", gap: 10, marginBottom: 6 },
  kindBadge: { fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 6, fontFamily: "ui-monospace, monospace" },
  title: { fontSize: 13.5, fontWeight: 700, margin: 0, color: "#f0f4fc" },
  note: { fontSize: 10.5, color: "#8fa3c9", lineHeight: 1.7, marginBottom: 10, maxWidth: 900 },
  subHead: { fontSize: 10.5, fontWeight: 700, color: "#8fa3c9", marginTop: 10, marginBottom: 4 },

  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10, marginBottom: 8 },
  paramCard: { border: "1px solid rgba(90,120,180,0.2)", borderRadius: 8, padding: "8px 10px" },
  paramLabel: { fontSize: 12, fontWeight: 700, color: "#dbe6f6" },
  tag: { fontSize: 10, color: "#8fa3c9", marginTop: 4 },

  row: { display: "flex", justifyContent: "space-between", gap: 8, padding: "4px 8px", borderRadius: 6, background: "rgba(90,120,180,0.05)", fontSize: 11.5, marginBottom: 3 },
  meta: { color: "#8aa0c8" },

  chainRow: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 6, background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.2)", fontSize: 11, marginBottom: 4 },
  chainLabel: { fontWeight: 800, color: "#34d399", fontSize: 10 },
  chainState: { color: "#dbe6f6" },
  chainArrow: { color: "#5a76a3" },

  flowRow: { display: "flex", alignItems: "center", gap: 8, padding: "8px 4px" },
  flowStep: { display: "flex", flexDirection: "column", alignItems: "center", minWidth: 64, border: "1px solid rgba(90,120,180,0.2)", borderRadius: 8, padding: "6px 8px" },
};
