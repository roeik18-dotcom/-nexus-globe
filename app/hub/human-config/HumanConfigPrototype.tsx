"use client";

/**
 * Human Config — first-viewport PROTOTYPE ONLY (`?view=prototype`).
 * Visual-checkpoint artifact, not a production surface: production
 * `/hub/human-config` (no query param) is completely untouched — see
 * `page.tsx`'s early-return branch. Renders the SAME real
 * `TEMPERAMENT_DIMENSIONS` (7 real parameters) and the SAME real
 * DomainState records already loaded in `page.tsx` (via
 * `findDomainStatesForSubject`/`buildDomainStateTimeline` — no new
 * store, no new query, no fabricated numbers): today that means every
 * parameter is honestly UNKNOWN, because no real `human_temperament`
 * DomainState has been recorded for any subject yet.
 *
 * Visual checkpoint 2 — SPATIAL configuration map, not a list. HUMAN →
 * CURRENT CONFIG is now a real hub-and-spoke composition: one hub
 * ("CURRENT CONFIG"), seven parameter nodes arranged around it. Spokes
 * represent MEMBERSHIP only ("this parameter belongs to this person's
 * config") — never a causal/semantic relation between parameters,
 * because the source model draws none. Node size/brightness encodes
 * known vs. unknown; the map carries no per-node metadata text (state/
 * confidence/evidence move into the one contextual detail panel that
 * opens on selection). The "UPDATE" fields in that panel stay
 * deliberately INERT — the real write path is unchanged:
 * `CreateHumanDomainStateForm.tsx` / `createDomainStateForCurrentUser`.
 */
import { useState } from "react";
import type { TemperamentRange } from "@/app/lib/philos/humanConfig/temperamentDimensions";
import type { DomainStateTimelinePoint } from "@/app/lib/philos/canon/domainStateQuery";
import { PhilosState, PhilosDelta, StatusTag, TYPE, STATUS_COLOR } from "@/app/lib/philos/visual/PhilosPrimitives";

export interface PrototypeParameterRow {
  dimension: TemperamentRange;
  latest: DomainStateTimelinePoint | null;
  evidenceCount: number;
  changed: boolean;
}

const CX = 240;
const CY = 230;
const R = 150;
const HUB_Y = 60;

export default function HumanConfigPrototype({
  subjectId, parameters,
}: {
  subjectId: string;
  parameters: PrototypeParameterRow[];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const known = parameters.filter((p) => p.latest !== null).length;
  const changed = parameters.filter((p) => p.changed).length;
  const evidence = parameters.reduce((sum, p) => sum + p.evidenceCount, 0);
  const selected = parameters.find((p) => p.dimension.parameter_id === selectedId) ?? null;

  const positioned = parameters.map((p, i) => {
    const angle = (i / parameters.length) * Math.PI * 2 - Math.PI / 2;
    return { ...p, x: CX + R * Math.cos(angle), y: CY + R * Math.sin(angle) * 0.86 };
  });

  return (
    <div dir="rtl" style={S.wrap}>
      <div style={S.protoTag}>PROTOTYPE — תצוגה ראשונה בלבד · ?view=prototype · לא הסביבה הפעילה</div>

      <div style={{ ...TYPE.display, textAlign: "center" }}>Human Config</div>
      <div style={{ textAlign: "center", fontSize: 13, color: "#5aa6ff", marginTop: 2, marginBottom: 4 }}>{subjectId}</div>
      <div style={S.orientStrip}>ידוע {known}/{parameters.length} · השתנה {changed} · עדות {evidence}</div>

      <svg viewBox={`0 0 480 420`} style={S.svg} onClick={() => setSelectedId(null)}>
        {/* spokes — MEMBERSHIP only, never a causal/semantic edge */}
        {positioned.map((p) => (
          <line
            key={`spoke_${p.dimension.parameter_id}`}
            x1={CX} y1={HUB_Y} x2={p.x} y2={p.y}
            stroke={p.latest ? STATUS_COLOR.real : "#2a3550"}
            strokeWidth={selectedId === p.dimension.parameter_id ? 2 : 1}
            opacity={p.latest ? 0.5 : 0.28}
          />
        ))}

        {/* hub — CURRENT CONFIG */}
        <circle cx={CX} cy={HUB_Y} r={16} fill="rgba(91,156,246,0.16)" stroke={STATUS_COLOR.active} strokeWidth={2} />
        <text x={CX} y={HUB_Y + 34} textAnchor="middle" style={{ fontSize: 12, fontWeight: 700, fill: "#5aa6ff", letterSpacing: 0.4 }}>CURRENT CONFIG</text>

        {/* 7 parameter nodes — spatial, not a list */}
        {positioned.map((p) => {
          const isSelected = selectedId === p.dimension.parameter_id;
          const known_ = !!p.latest;
          const baseR = known_ ? 24 : 15;
          const r = isSelected ? baseR + 6 : baseR;
          return (
            <g
              key={p.dimension.parameter_id}
              onClick={(e) => { e.stopPropagation(); setSelectedId((cur) => (cur === p.dimension.parameter_id ? null : p.dimension.parameter_id)); }}
              style={{ cursor: "pointer" }}
            >
              <circle
                cx={p.x} cy={p.y} r={r}
                fill={known_ ? "rgba(52,211,153,0.18)" : "rgba(90,120,180,0.08)"}
                stroke={isSelected ? STATUS_COLOR.active : known_ ? STATUS_COLOR.real : "#3d4f75"}
                strokeWidth={isSelected ? 2.5 : 1.5}
              />
              <text
                x={p.x} y={p.y + r + 13} textAnchor="middle"
                style={{ fontSize: isSelected ? 11 : 9.5, fontWeight: isSelected ? 800 : 600, fill: known_ ? "#dbe6f6" : "#6c86b5" }}
              >
                {p.dimension.label_he}
              </text>
            </g>
          );
        })}
      </svg>

      {selected ? (
        <div style={S.detailPanel}>
          <div style={S.detailHead}>
            <div style={TYPE.h1}>{selected.dimension.label_he}</div>
            <StatusTag status={selected.latest ? "real" : "unknown"} />
          </div>
          <div style={TYPE.meta}>{selected.dimension.label} · {selected.dimension.low} ↔ {selected.dimension.high} · {selected.dimension.canonical_id}</div>

          <DetailRow label="STATE">
            <PhilosState value={selected.latest?.level ?? null} confidence={selected.latest?.confidence ?? null} observedAt={selected.latest?.observed_at ?? null} />
          </DetailRow>

          <DetailRow label="HISTORY / DELTA">
            <PhilosDelta
              from={selected.latest?.delta_from_prior != null ? selected.latest.level - selected.latest.delta_from_prior : null}
              to={selected.latest?.delta_from_prior != null ? selected.latest.level : null}
              delta={selected.latest?.delta_from_prior ?? null}
            />
          </DetailRow>

          <DetailRow label="EVIDENCE">
            <div style={TYPE.body}>{selected.evidenceCount} רשומות עם evidence</div>
          </DetailRow>

          <DetailRow label="UPDATE">
            <div style={S.updatePanel}>
              <div style={S.updatePanelTag}>PROTOTYPE — לתצוגה בלבד, ללא שמירה אמיתית</div>
              <div style={S.formRow}>
                <label style={TYPE.meta}>מצב נוכחי</label>
                <input disabled placeholder={`${selected.dimension.low} ↔ ${selected.dimension.high}`} style={S.input} />
              </div>
              <div style={S.formRow}>
                <label style={TYPE.meta}>רמת ביטחון</label>
                <input disabled placeholder="0–1" style={S.input} />
              </div>
              <div style={S.formRow}>
                <label style={TYPE.meta}>על מה זה מבוסס?</label>
                <input disabled placeholder="evidence" style={S.input} />
              </div>
              <button disabled style={S.disabledSubmit}>RECORD (prototype — לא פעיל)</button>
            </div>
          </DetailRow>
        </div>
      ) : (
        <div style={{ ...TYPE.meta, textAlign: "center", marginTop: 4 }}>בחר צומת כדי לראות STATE · HISTORY · EVIDENCE · UPDATE</div>
      )}
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ ...TYPE.h2, marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  wrap: { padding: "16px 20px 60px", color: "#e6ebf5", fontFamily: "system-ui", maxWidth: 640, margin: "0 auto" },
  protoTag: { fontSize: 12, fontWeight: 700, color: "#fbbf24", background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.25)", borderRadius: 8, padding: "5px 10px", marginBottom: 16, textAlign: "center" },

  orientStrip: { textAlign: "center", fontSize: 13, color: "#6c86b5", marginBottom: 6 },

  svg: { width: "100%", height: "auto", display: "block" },

  detailPanel: { marginTop: 4, border: "1px solid rgba(91,156,246,0.3)", borderRadius: 14, padding: "14px 16px", background: "rgba(18,24,38,0.6)" },
  detailHead: { display: "flex", alignItems: "center", justifyContent: "space-between" },

  updatePanel: { display: "flex", flexDirection: "column", gap: 8 },
  updatePanelTag: { fontSize: 12, color: "#fbbf24" },
  formRow: { display: "flex", flexDirection: "column", gap: 3 },
  input: { background: "#0b0f1a", color: "#6c86b5", border: "1px solid #2a3550", borderRadius: 6, padding: "7px 9px", fontSize: 13 },
  disabledSubmit: { background: "rgba(90,120,180,0.2)", color: "#6c86b5", fontWeight: 700, fontSize: 13, border: "none", borderRadius: 6, padding: "9px 14px", cursor: "not-allowed", alignSelf: "flex-start" },
};
