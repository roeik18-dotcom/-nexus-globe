/**
 * Dynamics — Human/Value/Mission temporal depth (ledger §26). Reuses the
 * EXACT §25 components (`HumanDimensionMatrix`, `HumanValueMatrix`) with
 * zero Dynamics-specific re-implementation — same canonical parameter
 * IDs render identically in `/hub`, `/hub/human-config`, and here. The
 * only NEW pieces are genuinely temporal/relational views that don't
 * exist elsewhere: a Day/Week/Month/History heatmap (honestly
 * `INSUFFICIENT_HISTORY` throughout — no real per-parameter time series
 * exists yet), a multi-lane summary, a tension list, and a condensed
 * Mission trajectory. Action→Effect and Capability/Gap are NOT
 * duplicated here — `DynamicsDayClosingSection` (Action→Effect, via
 * `DayClosingFusion`) and `ValueDomainDemoPanel` (Capability/Gap) already
 * render on this same page; re-showing them here would be exactly the
 * "duplicate local truth" this task forbids.
 */
import HumanDimensionMatrix from "@/app/hub/human-config/HumanDimensionMatrix";
import HumanValueMatrix from "@/app/hub/HumanValueMatrix";
import { TEMPERAMENT_DIMENSIONS } from "@/app/lib/philos/humanConfig/temperamentDimensions";
import { buildMissionOrientation } from "@/app/lib/philos/mission/missionOrientation";
import { buildCarryForward } from "@/app/lib/philos/dayClosingFusion";
import { buildDomainStateProjectionRows, resolveValueDomainParam, type DomainStateProjectionRow } from "@/app/lib/philos/canon/domainStateQuery";
import type { DomainStateRecord } from "@/app/lib/philos/canon/domainStateStore";
import type { OrientationCore } from "@/app/lib/philos/orientationCore";
import type { TensionItem } from "@/app/lib/philos/tension";
import type { ActionLifecycleSummary, ActionLifecycleEntry } from "@/app/lib/philos/canon/actionLifecycle";
import type { NeedRecord } from "@/app/lib/philos/canon/needStore";

/** Human parameter_id → Hebrew label, the same real, curated 7-parameter
 *  source Human Config uses — not a Music/Value special-case, just the
 *  one real label lookup that exists. Anything else (Value-Domain
 *  parameters) falls back to its own real parameter_id/domain_id, never
 *  a fabricated name. */
const TEMPERAMENT_LABEL = new Map(TEMPERAMENT_DIMENSIONS.map((d) => [d.parameter_id, d.label_he]));

/**
 * Real DomainState-backed state/timeline projection — replaces the
 * previous `TimeHeatmap`, which was 100% `INSUFFICIENT_HISTORY` by
 * construction because it never read the DomainState backbone at all.
 * Same query path for BOTH Human and Value DomainState (no Music/Human
 * special-case): `buildDomainStateProjectionRows` groups by whatever
 * real (domain_id, parameter_id) pairs the subject actually has —
 * nothing pre-declared, nothing invented for a domain with 0 real
 * readings.
 */
function DomainStateTimelinePanel({ rows }: { rows: DomainStateProjectionRow[] }) {
  if (rows.length === 0) {
    return (
      <div dir="rtl" style={S.block}>
        <div style={S.head}>DomainState — State / History</div>
        <div style={S.note}>אין עדיין DomainState אמיתי לנושא זה — ראה /hub/human-config לרישום הראשון.</div>
      </div>
    );
  }
  return (
    <div dir="rtl" style={S.block}>
      <div style={S.head}>DomainState — State / History ({rows.length} פרמטר עם קריאה אמיתית)</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {rows.map((row) => {
          const latest = row.timeline[row.timeline.length - 1];
          const prior = row.timeline.length >= 2 ? row.timeline[row.timeline.length - 2] : null;
          const label = TEMPERAMENT_LABEL.get(row.parameter_id) ?? row.parameter_id;
          return (
            <div key={`${row.domain_id}::${row.parameter_id}`} style={S.stateRow}>
              <div style={S.stateRowHead}>
                <span style={S.stateRowLabel}>{label}</span>
                <span style={S.meta}>{row.domain_id} · {row.parameter_id}</span>
              </div>
              {row.timeline.length === 1 ? (
                <>
                  <div style={S.stateRowValue}>BASELINE / CURRENT STATE — {latest.level}</div>
                  <div style={S.meta}>confidence {latest.confidence} · {latest.observed_at.slice(0, 16).replace("T", " ")}{latest.evidence ? ` · ${latest.evidence}` : ""}</div>
                  <div style={S.note}>אין עדיין דלתא — נדרשת קריאה שנייה לאותו פרמטר. לא מוצגת תנועה מומצאת.</div>
                </>
              ) : (
                <>
                  <div style={S.stateRowValue}>
                    STATE(t0) {prior!.level} → Δ {latest.delta_from_prior != null && latest.delta_from_prior >= 0 ? "+" : ""}{latest.delta_from_prior} → STATE(t1) {latest.level}
                  </div>
                  <div style={S.meta}>confidence {latest.confidence} · {latest.observed_at.slice(0, 16).replace("T", " ")}{latest.evidence ? ` · ${latest.evidence}` : ""}</div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MultiLaneSummary({
  tensions, needs, lifecycle, todaysActions, mission,
}: {
  tensions: TensionItem[];
  needs: NeedRecord[];
  lifecycle: ActionLifecycleSummary;
  todaysActions: ActionLifecycleEntry[];
  mission: ReturnType<typeof buildMissionOrientation>;
}) {
  const lanes: { label: string; value: string }[] = [
    { label: "מצב האדם", value: mission.current_state.every((r) => r.current_level === null) ? "לא ידוע" : `${mission.current_state.filter((r) => r.current_level !== null).length}/3 ידוע` },
    { label: "תחום ערך", value: mission.values.length > 0 ? `${mission.values.length} מופעל` : "לא ידוע (לא מחובר)" },
    { label: "מתחים", value: `${tensions.length} פתוח` },
    { label: "צרכים", value: `${needs.length} פתוח` },
    { label: "פעולות (היום)", value: `${todaysActions.length}` },
    { label: "תוצאות", value: `${lifecycle.counts.effect_verified} מאומת / ${lifecycle.counts.effect_claimed_only} נטען` },
    { label: "ראיה", value: lifecycle.counts.effect_verified > 0 ? `${lifecycle.counts.effect_verified} תוצאות עם עדות` : "לא ידוע" },
    { label: "מסקנות", value: `${lifecycle.counts.learnings_with_state_prime} עם מצב חדש` },
    { label: "משימה וכיוון", value: mission.uncertainty.value ?? "לא ידוע" },
  ];
  return (
    <div dir="rtl" style={S.block}>
      <div style={S.head}>Multi-Lane Summary (מסונכרן ל-{mission.today})</div>
      <div style={S.lanes}>
        {lanes.map((l) => (
          <div key={l.label} style={S.lane}>
            <span style={S.laneLabel}>{l.label}</span>
            <span style={S.laneValue}>{l.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TensionContradictionView({ tensions }: { tensions: TensionItem[] }) {
  return (
    <div dir="rtl" style={S.block}>
      <div style={S.head}>Tension / Contradiction — {tensions.length} פעיל</div>
      {tensions.length === 0 ? (
        <div style={S.note}>אין Tension פתוח כרגע.</div>
      ) : (
        tensions.map((t) => (
          <div key={t.id} style={S.tensionRow}>
            <span style={{ color: t.severity === "high" ? "#f2635c" : t.severity === "medium" ? "#fbbf24" : "#8aa0c8" }}>{t.severity}</span>
            <span>{t.label}</span>
            <span style={S.meta}>{t.current_state}</span>
            <span style={S.meta}>ניגוד: לא ידוע — אין מנגנון זיהוי סתירה אמיתי כיום</span>
          </div>
        ))
      )}
    </div>
  );
}

function MissionTrajectory({ mission }: { mission: ReturnType<typeof buildMissionOrientation> }) {
  const stages = [
    { label: "מסגרת קודמת", value: "לא ידוע — אין תמונת מצב שמורה, רק מצב חי" },
    { label: "Action", value: mission.candidate_actions.length > 0 ? `${mission.candidate_actions.length} רשום` : "לא ידוע" },
    { label: "Effect", value: mission.learning.status !== "unknown" ? "נצפה" : "לא ידוע" },
    { label: "Learning", value: mission.learning.value ?? "לא ידוע" },
    { label: "Orientation נוכחית", value: `${mission.tensions.length} Tension, ${mission.needs.length} Need` },
  ];
  return (
    <div dir="rtl" style={S.block}>
      <div style={S.head}>Mission Trajectory — {mission.subject}</div>
      <div style={S.trajectoryRow}>
        {stages.map((s, i) => (
          <div key={s.label} style={S.trajStage}>
            <div style={S.trajLabel}>{s.label}</div>
            <div style={S.trajValue}>{s.value}</div>
            {i < stages.length - 1 ? <span style={S.trajArrow}>→</span> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DynamicsHumanValueDepth({
  core, tensions, lifecycle, needs, todaysActions, subject, today, domainStates,
}: {
  core: OrientationCore;
  tensions: TensionItem[];
  lifecycle: ActionLifecycleSummary;
  needs: NeedRecord[];
  todaysActions: ActionLifecycleEntry[];
  subject: string;
  today: string;
  /** Real DomainState history for `subject` — same accessor Hub/Human
   *  Config already use, fetched once in `app/dynamics/page.tsx`. */
  domainStates: DomainStateRecord[];
}) {
  // P0 fix — the same `valueDomain` param `/hub` already supplies to
  // `buildCarryForward`, via the SAME shared resolver (no second
  // carry-forward model, no re-derived state logic).
  const valueDomainParam = resolveValueDomainParam(subject, domainStates);
  const carryForward = buildCarryForward({
    subject, today, core, lifecycle, pendingNeeds: needs, tensions, todaysActions,
    realizedLearningsToday: 0, bridgeRegistry: [], valueDomain: valueDomainParam,
  });
  const mission = buildMissionOrientation({
    subject, provenance: "REAL", today, core, needs, tensions, lifecycle, bridgeRegistry: [], carryForward,
  });
  const projectionRows = buildDomainStateProjectionRows(domainStates, subject);

  return (
    <div style={{ maxWidth: 1100, marginBottom: 16 }}>
      <div dir="rtl" style={{ fontSize: 12, letterSpacing: 1, color: "#5aa6ff", marginBottom: 8 }}>
        DYNAMICS — Human / Value / Mission — אותם Parameter IDs מ-Hub / Human Config
      </div>
      <MissionTrajectory mission={mission} />
      <MultiLaneSummary tensions={tensions} needs={needs} lifecycle={lifecycle} todaysActions={todaysActions} mission={mission} />
      <TensionContradictionView tensions={tensions} />

      {/* P0 fix — real DomainState-backed state/timeline, not the old
          permanently-`INSUFFICIENT_HISTORY` placeholder. Shown in
          primary flow (not collapsed) since it's now real operational
          signal, not structural reference. `HumanValueMatrix` (DEMO
          Music) and `HumanDimensionMatrix` (structural reference) stay
          demoted below — unchanged, out of this task's scope. */}
      <DomainStateTimelinePanel rows={projectionRows} />

      <details dir="rtl" style={{ margin: "0 0 12px" }}>
        <summary style={{ cursor: "pointer", fontSize: 13, letterSpacing: 1, color: "#6c86b5", padding: "4px 0" }}>
          DETAILS / AUDIT — Human Dimension Matrix (EXAMPLES/DEMO Value Matrix)
        </summary>
        <div style={{ marginTop: 8 }}>
          <HumanDimensionMatrix />
          <HumanValueMatrix />
        </div>
      </details>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  block: { marginBottom: 16, background: "rgba(18,24,38,0.6)", border: "1px solid rgba(90,120,180,0.14)", borderRadius: 12, padding: "12px 14px" },
  head: { fontSize: 13, fontWeight: 700, color: "#5aa6ff", marginBottom: 8 },
  note: { fontSize: 12, color: "#6c86b5", marginTop: 6, lineHeight: 1.6 },

  stateRow: { padding: "8px 10px", borderRadius: 8, background: "rgba(90,120,180,0.05)" },
  stateRowHead: { display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 3 },
  stateRowLabel: { fontSize: 13, fontWeight: 700, color: "#dbe6f6" },
  stateRowValue: { fontSize: 13, fontWeight: 700, color: "#f0f4fc", marginBottom: 2 },

  lanes: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 6 },
  lane: { display: "flex", flexDirection: "column", gap: 2, padding: "6px 8px", borderRadius: 6, background: "rgba(90,120,180,0.05)" },
  laneLabel: { fontSize: 12, color: "#6c86b5", letterSpacing: 0.5 },
  laneValue: { fontSize: 13, color: "#dbe6f6", fontWeight: 600 },

  tensionRow: { display: "flex", flexWrap: "wrap", gap: 8, padding: "5px 8px", borderRadius: 6, background: "rgba(90,120,180,0.05)", fontSize: 13, marginBottom: 3 },
  meta: { color: "#8aa0c8" },

  trajectoryRow: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 4 },
  trajStage: { display: "flex", alignItems: "center", gap: 4 },
  trajLabel: { fontSize: 12, color: "#6c86b5" },
  trajValue: { fontSize: 13, color: "#dbe6f6", fontWeight: 600, marginRight: 4 },
  trajArrow: { color: "#6c86b5", margin: "0 4px" },
};
