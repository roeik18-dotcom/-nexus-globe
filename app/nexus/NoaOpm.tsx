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
import { buildOpm, type FlowTone, type DeptExplain } from "../lib/opm";

const C = {
  bg: "#030f1e", card: "#040e1c", border: "#0a2a4a", borderSoft: "#1e4060",
  cyan: "#38bdf8", green: "#34d399", red: "#ef4444", orange: "#fb923c",
  yellow: "#fbbf24", purple: "#a78bfa", muted: "#1e4060", text: "#cfe6f5",
};
const TONE: Record<FlowTone, string> = { neutral: C.borderSoft, bad: C.orange, good: C.green };
const sec: React.CSSProperties = { fontSize: 9, color: C.borderSoft, letterSpacing: 2, textTransform: "uppercase", margin: "14px 0 7px" };

// Energy-flow layout (top → bottom): Communal at the top, Physical at the root.
// Energy flows UP — each layer feeds the one above (see OPM_FLOW in lib/opm).
const FLOW_ROWS: string[][] = [
  ["Communal"],
  ["SUPEREGO", "EGO"],        // חברתי · מיידעי
  ["Emotional", "Rational"],  // רגשי · רציונלי
  ["ID"],                     // דחף
  ["Physical"],               // גופני
];

type FlowNode = {
  key: string; he: string; en: string;
  load: number; capacity: number; gap: number;
  communal: boolean; leaking?: boolean; actionTarget?: boolean;
  explain?: DeptExplain;
};

export default function NoaOpm({ chain }: { chain?: NoaChain }) {
  const fallback = useMemo(() => computeNoaChain(0), []);
  const opm = useMemo(() => buildOpm(chain ?? fallback), [chain, fallback]);
  const [open, setOpen] = useState<string | null>(null);
  const toggle = (k: string) => setOpen(o => (o === k ? null : k));

  // Unified node accessor for the energy-flow map (departments + the communal layer).
  const deptByKey = useMemo(() => {
    const m: Record<string, typeof opm.departments[number]> = {};
    for (const d of opm.departments) m[d.key] = d;
    return m;
  }, [opm]);
  const nodeOf = (key: string): FlowNode => {
    if (key === "Communal") {
      const c = opm.communal;
      return { key, he: c.he, en: c.en, load: 0, capacity: c.carryingCapacity, gap: c.gap, communal: true };
    }
    const d = deptByKey[key];
    if (!d) return { key, he: key, en: key, load: 0, capacity: 0, gap: 0, communal: false };
    return { key, he: d.he, en: d.en, load: d.load, capacity: d.capacityApplied, gap: d.missingCapacity, communal: false, leaking: d.leaking, actionTarget: d.actionTarget, explain: d.explain };
  };
  const openNode = open ? nodeOf(open) : null;

  return (
    <div dir="ltr" style={{ marginBottom: 16, color: C.text, fontSize: 12 }}>
      <div style={{ fontSize: 9, color: C.borderSoft, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>
        OPM — Operational Process Map
      </div>

      {/* PRIMARY — the causal path is the dominant view */}
      <div style={{ fontSize: 11, color: C.cyan, letterSpacing: 2.5, textTransform: "uppercase", fontWeight: 800 }}>Causal Path</div>
      <div style={{ fontSize: 9.5, color: C.borderSoft, marginTop: 2, marginBottom: 10 }}>event → values harmed → impact → community response → recovery</div>

      {/* CAUSALITY MAP — the rigid, event-type-agnostic spine:
           event → values harmed → impact → community response → recovery.
           Reads "what happened → what was harmed → the cost → what the community
           does → recovery state" in ~3s. Stage 1 stays consent-gated; the numeric
           OPM metrics are unchanged and live below in the energy-flow map. */}
      {opm.causality.map((stage, i) => {
        const accent = TONE[stage.tone];
        const isEvent = stage.key === "event";
        return (
          <div key={stage.key}>
            <div style={{ background: C.card, border: `1px solid ${accent}55`, borderInlineStart: `3px solid ${accent}`, borderRadius: 8, padding: "9px 11px" }}>
              <div style={{ fontSize: 8.5, color: accent, letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 700 }}>{stage.titleEn}</div>
              {isEvent ? (
                <div style={{ marginTop: 4 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                    <span style={{ fontSize: 15, fontWeight: 800, color: C.text }}>{stage.items[0].he}</span>
                    <span style={{ fontSize: 10, color: C.borderSoft }}>{stage.items[0].en}</span>
                  </div>
                  {stage.items[1]?.badge && (
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 6, padding: "2px 8px", borderRadius: 999, background: `${C.green}1a`, border: `1px solid ${C.green}66` }}>
                      <span style={{ width: 5, height: 5, borderRadius: "50%", background: C.green, display: "inline-block" }} />
                      <span style={{ fontSize: 9.5, fontWeight: 700, color: C.green }}>{stage.items[1].he} · {stage.items[1].en}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5px 10px", marginTop: 6 }}>
                  {stage.items.map(it => (
                    <div key={it.en} style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
                      <span style={{ width: 4, height: 4, borderRadius: "50%", background: accent, display: "inline-block", flex: "0 0 auto" }} />
                      <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{it.he}</span>
                      <span style={{ fontSize: 8.5, color: C.borderSoft }}>{it.en}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {i < opm.causality.length - 1 && (
              <div style={{ textAlign: "center", fontSize: 13, color: C.borderSoft, lineHeight: 1, margin: "3px 0" }}>↓</div>
            )}
          </div>
        );
      })}

      {/* SECONDARY — measured effects: the numbers behind the causal path.
           Visually de-emphasized (subordinate to the spine). Calculations and the
           energy-flow map itself are UNCHANGED — only the hierarchy is. */}
      <div style={{ marginTop: 18, paddingTop: 12, borderTop: `1px solid ${C.border}`, opacity: 0.72 }}>
        <div style={{ fontSize: 9, color: C.borderSoft, letterSpacing: 2, textTransform: "uppercase", fontWeight: 600 }}>Measured Effects</div>
        <div style={{ fontSize: 9, color: C.muted, marginTop: 2 }}>secondary · the metrics behind the causal path</div>

        {/* 2 + 3 · DEPARTMENT ENERGY-FLOW MAP — one connected system, NOT isolated
             cards. Energy flows up: גופני → דחף → (רגשי|רציונלי) → (חברתי|מיידעי) →
             קהילתי. Each node carries Load (L) · Capacity (C) · Gap (G). Tap a node
             for its detail (incl. which department it flows into). */}
        <div style={sec}>Energy-flow map · load → capacity → gap</div>
      <div style={{ background: "radial-gradient(circle at 50% 0%, #07182b 0%, #030f1e 80%)", border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 10px" }}>
        {FLOW_ROWS.map((row, ri) => (
          <div key={ri}>
            {ri > 0 && <div style={{ textAlign: "center", color: C.borderSoft, fontSize: 11, lineHeight: 1, margin: "2px 0" }}>▲</div>}
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              {row.map(key => {
                const n = nodeOf(key);
                const sev = n.communal ? C.green : n.gap >= 50 ? C.red : n.gap >= 25 ? C.orange : C.green;
                const isSel = open === key;
                return (
                  <button key={key} onClick={() => toggle(key)} style={{
                    flex: row.length > 1 ? 1 : "0 0 62%", minWidth: 0, textAlign: "left", cursor: "pointer",
                    background: isSel ? "#06223a" : C.card,
                    border: `1px solid ${isSel ? C.cyan : sev + "88"}`, borderRadius: 8, padding: "7px 9px",
                  }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 800, color: C.text }}>{n.he}</span>
                      <span style={{ fontSize: 8, color: C.borderSoft }}>{n.en}</span>
                      {n.leaking && <span title="strongest leak" style={{ width: 6, height: 6, borderRadius: "50%", background: C.red, display: "inline-block" }} />}
                      {n.actionTarget && <span title="action target" style={{ fontSize: 8, color: C.cyan }}>◆</span>}
                    </div>
                    <div style={{ display: "flex", gap: 7, marginTop: 4, fontSize: 9.5, fontWeight: 700 }}>
                      {!n.communal && <span style={{ color: C.red }}>L {n.load}</span>}
                      <span style={{ color: C.green }}>C {n.capacity}</span>
                      <span style={{ color: sev }}>G {n.gap}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        <div style={{ fontSize: 9, color: C.borderSoft, textAlign: "center", marginTop: 9, lineHeight: 1.5 }}>
          ▲ energy flows up — each layer feeds the one above · L load · C capacity · G gap
        </div>
      </div>

      {/* tapped-node detail (rendered below the map so the layout stays stable) */}
      {openNode && openNode.explain && (
        <div style={{ background: C.card, border: `1px solid ${C.cyan}`, borderRadius: 8, padding: "10px 12px", marginTop: 8, fontSize: 11, lineHeight: 1.6, color: "#9fc7df" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: C.text }}>{openNode.he}</span>
            <span style={{ fontSize: 9, color: C.borderSoft }}>{openNode.en}</span>
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 9.5, color: C.red }}>L {openNode.load}</span>
            <span style={{ fontSize: 9.5, color: C.green }}>C {openNode.capacity}</span>
            <span style={{ fontSize: 9.5, color: C.orange }}>G {openNode.gap}</span>
          </div>
          <p style={{ margin: "0 0 6px", color: C.text }}>{openNode.explain.meaning}</p>
          <div><b style={{ color: C.orange }}>Raises load:</b> {openNode.explain.raises}</div>
          <div><b style={{ color: C.green }}>Lowers load:</b> {openNode.explain.lowers}</div>
          <div><b style={{ color: C.purple }}>Affects (flows into):</b> {openNode.explain.affects}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "7px 0", fontSize: 10 }}>
            <span style={{ color: C.red }}>load {openNode.load}</span>
            <span style={{ color: C.borderSoft }}>→ capacity −{openNode.capacity} →</span>
            <span style={{ color: C.orange }}>gap {openNode.gap}</span>
          </div>
          <div style={{ background: "#06223a", border: `1px solid ${C.cyan}`, borderRadius: 6, padding: "6px 9px", color: C.cyan, fontWeight: 600 }}>
            Action: {openNode.explain.action}
          </div>
        </div>
      )}
      {openNode && openNode.communal && (
        <div style={{ background: C.card, border: `1px solid ${C.green}66`, borderRadius: 8, padding: "10px 12px", marginTop: 8, fontSize: 10.5, color: "#9fc7df", lineHeight: 1.6 }}>
          <b style={{ color: C.text }}>{openNode.he} · {openNode.en}</b> — the carrying layer where capacity collects. Available capacity <b style={{ color: C.green }}>{openNode.capacity}</b> · community now carries <b style={{ color: C.green }}>{opm.communal.communityPct}%</b> · still concentrated <b style={{ color: C.orange }}>{openNode.gap}</b>.
        </div>
      )}

        {/* next move — the first redistribution step */}
        <div style={{ fontSize: 10.5, color: C.borderSoft, marginTop: 10, paddingTop: 8, borderTop: `1px solid ${C.border}`, lineHeight: 1.5 }}>
          Next move: <b style={{ color: C.cyan }}>{opm.action.label} → {opm.action.targetHe}</b> · the first redistribution step (−{opm.action.loadReduction} load · +{opm.action.energyGain} energy · +{opm.action.orientationGain} orientation).
        </div>
      </div>
    </div>
  );
}
