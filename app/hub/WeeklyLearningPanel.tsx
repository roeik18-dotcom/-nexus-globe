/**
 * WeeklyLearningPanel — P2, the weekly rollup sibling of `DayCycle`'s daily
 * Carry-Forward. Reads the SAME real stores every other canonical panel
 * reads (`findDomainStatesForSubject`, `buildActionLifecycleSummary`) and
 * folds them through `buildWeeklyLearningSummary` (`canonical/
 * weeklyLearning.ts`, pure — no I/O of its own). No new store; a week with
 * no real activity renders as an honest all-zero/empty state, never
 * backfilled.
 */
import { findDomainStatesForSubject } from "@/app/lib/philos/canon/domainStateStoreAccessor";
import { buildActionLifecycleSummary } from "@/app/lib/philos/canon/actionLifecycle";
import { buildPersonInstance, buildValueDomainInstance } from "@/app/lib/philos/canonical/personInstance";
import { buildActivePersonRefs } from "@/app/lib/philos/canonical/activeConfig";
import { availableDomainConfigs } from "@/app/lib/philos/canonical/domainConfigRegistry";
import { buildBrainDerivation } from "@/app/lib/philos/canonical/brainDerivation";
import { buildWeeklyLearningSummary } from "@/app/lib/philos/canonical/weeklyLearning";
import { HUMAN_CANON_DOMAIN_ID } from "./CanonicalSlicePanel";

export default async function WeeklyLearningPanel({ subject, asOf }: { subject: string; asOf: string }) {
  const domainStates = await findDomainStatesForSubject(subject);
  const human = buildPersonInstance({ subject_id: subject, domain_id: HUMAN_CANON_DOMAIN_ID, records: domainStates, source_kind: "CANON", source_refs: buildActivePersonRefs().refObjects, asOf });
  const domainInstances = availableDomainConfigs().map((slot) =>
    buildValueDomainInstance({
      subject_id: subject, domain_id: slot.domain_id, records: domainStates,
      source_kind: "CANON", source_refs: slot.activeConfig().refObjects, asOf,
    }),
  );
  const lifecycle = await buildActionLifecycleSummary(subject);
  // hasRealObservation=true here means "do not claim first-observation" —
  // this panel has no canon read of its own; an unproven claim is worse
  // than a suppressed prompt (next-action truth, 2026-08-17).
  const brain = buildBrainDerivation({ subject_id: subject, lifecycle, instances: [human, ...domainInstances], hasRealObservation: true });
  const weekly = buildWeeklyLearningSummary({
    subject_id: subject, now: asOf, lifecycle, instances: [human, ...domainInstances],
    unresolvedUnknowns: brain.unknown, nextActionLabel: brain.next_action?.label ?? null,
  });

  return (
    <section dir="rtl" style={S.card}>
      <div style={S.head}>
        <span style={S.badge}>CANON</span>
        <h3 style={S.title}>סיכום שבועי · Weekly Learning ({weekly.window_start.slice(0, 10)} → {weekly.window_end.slice(0, 10)})</h3>
      </div>

      <div style={S.grid}>
        <Metric label="Actions" value={weekly.actions_this_week} />
        <Metric label="Effects מאומתים" value={weekly.effects_verified_this_week} color="#34d399" />
        <Metric label="Effects claimed בלבד" value={weekly.effects_claimed_only_this_week} color="#fbbf24" />
        {/* Two consecutive real DomainState READINGS of the same parameter —
            a measurement pair, not a canonical State′ transition. The label
            says so: no canonical persistence/update contract for State′
            exists (`canon/STATE-TRANSITION-BOUNDARY.md`). */}
        <Metric label="DomainState readings (זוגות)" value={weekly.state_transitions_this_week.length} />
      </div>

      <div style={S.subHead}>קריאות DomainState עוקבות השבוע ({weekly.state_transitions_this_week.length}) — מדידה, לא מעבר State′ קנוני</div>
      {weekly.state_transitions_this_week.length === 0 ? (
        <Empty text="אין זוג קריאות DomainState לאותו פרמטר השבוע" />
      ) : (
        weekly.state_transitions_this_week.map((t, i) => (
          <div key={i} style={S.row}>
            <span>{t.domain_id}/{t.parameter_id}</span>
            <span style={S.meta}>{t.from_level ?? "—"} → {t.to_level} @ {t.observed_at.slice(0, 16).replace("T", " ")}</span>
          </div>
        ))
      )}

      <div style={S.subHead}>Evidence השבוע ({weekly.evidence_this_week.length})</div>
      {weekly.evidence_this_week.length === 0 ? <Empty text="אין ראיה חדשה השבוע" /> : weekly.evidence_this_week.map((e, i) => <div key={i} style={S.row}><span>{e}</span></div>)}

      <div style={S.subHead}>Open Loops (מצב נוכחי, לא מוגבל לשבוע)</div>
      <div style={S.row}>
        <span>{weekly.open_loops.no_effect_recorded} Action ללא Effect · {weekly.open_loops.effect_claimed_only} Effect claimed בלבד</span>
      </div>

      <div style={S.subHead}>Unresolved Unknowns ({weekly.unresolved_unknowns.length})</div>
      {weekly.unresolved_unknowns.length === 0 ? <Empty text="אין UNKNOWN פתוח" /> : weekly.unresolved_unknowns.map((u, i) => <div key={i} style={{ ...S.row, color: "#8fa3c9" }}><span>{u}</span></div>)}

      <div style={S.subHead}>Carry-Forward Priorities</div>
      {weekly.carry_forward_priorities.length === 0 ? <Empty text="אין עדיפות מועברת כרגע" /> : weekly.carry_forward_priorities.map((p, i) => <div key={i} style={{ ...S.row, color: "#5b9cf6" }}><span>{p}</span></div>)}
    </section>
  );
}

function Metric({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div style={S.paramCard}>
      <div style={{ fontSize: 18, fontWeight: 800, color: color ?? "#dbe6f6" }}>{value}</div>
      <div style={{ fontSize: 9.5, color: "#8fa3c9" }}>{label}</div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div style={{ ...S.row, fontStyle: "italic", color: "#7b8ca6" }}>{text}</div>;
}

const S: Record<string, React.CSSProperties> = {
  card: { background: "rgba(18,24,38,0.7)", border: "1px solid rgba(91,156,246,0.3)", borderRadius: 16, padding: "16px 18px", marginTop: 16 },
  head: { display: "flex", alignItems: "center", gap: 10, marginBottom: 6 },
  badge: { fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 6, border: "1px solid rgba(52,211,153,0.4)", color: "#34d399", fontFamily: "ui-monospace, monospace" },
  title: { fontSize: 13.5, fontWeight: 700, margin: 0, color: "#f0f4fc" },
  subHead: { fontSize: 10.5, fontWeight: 700, color: "#8fa3c9", marginTop: 10, marginBottom: 4 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10, marginBottom: 8 },
  paramCard: { border: "1px solid rgba(90,120,180,0.2)", borderRadius: 8, padding: "8px 10px", textAlign: "center" },
  row: { display: "flex", justifyContent: "space-between", gap: 8, padding: "4px 8px", borderRadius: 6, background: "rgba(90,120,180,0.05)", fontSize: 11.5, marginBottom: 3 },
  meta: { color: "#8aa0c8" },
};
