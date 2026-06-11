"use client";

/**
 * Nexus — Noa OPM (Operational Process Map), visual explanation only.
 *
 * Shows how burden/energy moves across the Philos departments for Case Zero:
 * Event → created → concentrates → leaks → capacity drops → orientation
 * destabilizes → redistributes → stabilizes. Every value comes from the locked
 * chain (buildOpm over computeNoaChain) — no new engine, no scores changed.
 * Capacity language only; no people-count, no graphic detail, no blame.
 */

import { useMemo, useState } from "react";
import { computeNoaChain, type NoaChain } from "../lib/noa";
import { buildOpm, type FlowTone } from "../lib/opm";

const C = {
  bg: "#030f1e", card: "#040e1c", border: "#0a2a4a", borderSoft: "#1e4060",
  cyan: "#38bdf8", green: "#34d399", red: "#ef4444", orange: "#fb923c",
  yellow: "#fbbf24", purple: "#a78bfa", muted: "#1e4060", text: "#cfe6f5",
};
const TONE: Record<FlowTone, string> = { neutral: C.borderSoft, bad: C.orange, good: C.green };
const sec: React.CSSProperties = { fontSize: 9, color: C.borderSoft, letterSpacing: 2, textTransform: "uppercase", margin: "14px 0 7px" };

function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <div style={{ flex: 1, height: 6, background: "#0a1a2e", borderRadius: 3, overflow: "hidden" }}>
      <div style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: "100%", background: color, borderRadius: 3 }} />
    </div>
  );
}

function Row({ label, value, pct, color }: { label: string; value: string; pct: number; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
      <div style={{ width: 92, fontSize: 9.5, color: C.borderSoft }}>{label}</div>
      <Bar pct={pct} color={color} />
      <div style={{ width: 28, fontSize: 9.5, fontWeight: 700, color, textAlign: "right" }}>{value}</div>
    </div>
  );
}

export default function NoaOpm({ chain }: { chain?: NoaChain }) {
  const fallback = useMemo(() => computeNoaChain(0), []);
  const opm = useMemo(() => buildOpm(chain ?? fallback), [chain, fallback]);
  const [open, setOpen] = useState<string | null>(null);
  const toggle = (k: string) => setOpen(o => (o === k ? null : k));

  return (
    <div dir="ltr" style={{ marginBottom: 16, color: C.text, fontSize: 12 }}>
      <div style={{ fontSize: 9, color: C.borderSoft, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>
        OPM — Operational Process Map
      </div>

      {/* 1 · EVENT NODE */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderInlineStart: `3px solid ${C.purple}`, borderRadius: 8, padding: "9px 11px", marginBottom: 12 }}>
        <div style={{ fontSize: 8.5, color: C.purple, letterSpacing: 1.5, textTransform: "uppercase" }}>Event</div>
        <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2 }}>{opm.event}</div>
        <div style={{ fontSize: 10, color: C.borderSoft, marginTop: 3 }}>The event is the trigger. The map tracks the burden — not the event.</div>
      </div>

      {/* 4 · FLOW DIAGRAM (the spine) */}
      <div style={sec}>Flow</div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "stretch", gap: 0, marginBottom: 4 }}>
        {opm.flow.map((s, i) => (
          <div key={s.key}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 6, border: `1px solid ${TONE[s.tone]}44`, background: `${TONE[s.tone]}0f` }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: TONE[s.tone] }}>{s.label}</span>
              <span style={{ fontSize: 10.5, color: C.text }}>{s.value}</span>
            </div>
            {i < opm.flow.length - 1 && (
              <div style={{ textAlign: "center", fontSize: 10, color: C.borderSoft, lineHeight: 1.1, margin: "1px 0" }}>↓</div>
            )}
          </div>
        ))}
      </div>

      {/* 2 + 3 · IMPACT DEPARTMENTS (load / capacity / gap + expandable More) */}
      <div style={sec}>Impact departments</div>
      {opm.departments.map(d => {
        const isOpen = open === d.key;
        return (
          <div key={d.key} style={{ background: C.card, border: `1px solid ${d.actionTarget ? C.cyan : C.border}`, borderRadius: 8, padding: "9px 11px", marginBottom: 7 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 800 }}>{d.he}</span>
              <span style={{ fontSize: 10, color: C.borderSoft }}>{d.en}</span>
              <span style={{ flex: 1 }} />
              {d.leaking && <span style={{ fontSize: 8, color: C.red, border: `1px solid ${C.red}55`, borderRadius: 8, padding: "1px 6px" }}>leaking</span>}
              {d.actionTarget && <span style={{ fontSize: 8, color: C.cyan, border: `1px solid ${C.cyan}55`, borderRadius: 8, padding: "1px 6px" }}>action</span>}
              <button onClick={() => toggle(d.key)} style={{ fontSize: 10, cursor: "pointer", border: `1px solid ${C.borderSoft}`, background: "transparent", color: C.borderSoft, borderRadius: 6, padding: "2px 8px" }}>
                {isOpen ? "סגור" : "עוד / More"}
              </button>
            </div>
            <Row label="current load" value={`${d.load}`} pct={d.load} color={C.red} />
            <Row label="capacity in" value={`${d.capacityApplied}`} pct={d.capacityApplied} color={C.green} />
            <Row label="missing cap." value={`${d.missingCapacity}`} pct={d.missingCapacity} color={C.orange} />

            {isOpen && (
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.border}`, fontSize: 11, lineHeight: 1.6, color: "#9fc7df" }}>
                <p style={{ margin: "0 0 6px", color: C.text }}>{d.explain.meaning}</p>
                <div><b style={{ color: C.orange }}>Raises load:</b> {d.explain.raises}</div>
                <div><b style={{ color: C.green }}>Lowers load:</b> {d.explain.lowers}</div>
                <div><b style={{ color: C.purple }}>Affects others:</b> {d.explain.affects}</div>
                {/* energy-flow mini diagram */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "7px 0", fontSize: 10 }}>
                  <span style={{ color: C.red }}>load {d.load}</span>
                  <span style={{ color: C.borderSoft }}>→ capacity −{d.capacityApplied} →</span>
                  <span style={{ color: C.orange }}>gap {d.missingCapacity}</span>
                </div>
                <div style={{ background: "#06223a", border: `1px solid ${C.cyan}`, borderRadius: 6, padding: "6px 9px", color: C.cyan, fontWeight: 600 }}>
                  Action: {d.explain.action}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Communal carrying layer (where capacity exists) */}
      <div style={{ background: C.card, border: `1px solid ${C.green}55`, borderInlineStart: `3px solid ${C.green}`, borderRadius: 8, padding: "9px 11px", marginBottom: 7 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 800 }}>{opm.communal.he}</span>
          <span style={{ fontSize: 10, color: C.borderSoft }}>{opm.communal.en} · carrying layer</span>
        </div>
        <div style={{ fontSize: 10.5, color: "#9fc7df", lineHeight: 1.6 }}>
          Where carrying capacity exists. <b style={{ color: C.green }}>{opm.communal.carryingCapacity}</b> of load can be absorbed by the value-network · community now carries <b style={{ color: C.green }}>{opm.communal.communityPct}%</b> · still concentrated: <b style={{ color: C.orange }}>{opm.communal.gap}</b>.
        </div>
      </div>

      {/* 6 · DEPARTMENT OCCUPANCY (capacity language, not people-count) */}
      <div style={sec}>Department occupancy</div>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "9px 11px" }}>
        {opm.departments.map(d => (
          <div key={d.key} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, fontSize: 10.5 }}>
            <span style={{ width: 64, color: C.text }}>{d.he}</span>
            <span style={{ color: d.supported ? C.green : C.borderSoft }}>capacity {d.supported ? "connected" : "—"} +{d.capacityApplied}</span>
            <span style={{ flex: 1 }} />
            <span style={{ color: d.missingCapacity > 0 ? C.orange : C.green }}>{d.missingCapacity > 0 ? `gap ${d.missingCapacity}` : "covered"}</span>
          </div>
        ))}
        <div style={{ fontSize: 10, color: C.borderSoft, marginTop: 6, paddingTop: 6, borderTop: `1px solid ${C.border}`, lineHeight: 1.5 }}>
          Next move: <b style={{ color: C.cyan }}>{opm.action.label} → {opm.action.targetHe}</b> · the first redistribution step (−{opm.action.loadReduction} load · +{opm.action.energyGain} energy · +{opm.action.orientationGain} orientation).
        </div>
      </div>
    </div>
  );
}
