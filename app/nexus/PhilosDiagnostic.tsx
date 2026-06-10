"use client";

/**
 * Nexus — Philos Diagnostic Engine (visual only).
 *
 * Reframes the Orientation Matrix from a CATEGORY table ("what exists?") into the
 * Philos FLOW ("what is happening?"): a diagnostic summary, then six sections in
 * order — Tension → Resistance → Leakage → Value → Impact → Action. Story first;
 * the 18-cell matrix becomes supporting evidence below. All numbers come from the
 * locked chain (computeNoaChain, lib/noa); no engine/data/Noa changes.
 */

import { useMemo } from "react";
import { computeNoaChain } from "../lib/noa";

const C = {
  bg: "#030f1e", card: "#040e1c", border: "#0a2a4a", borderSoft: "#1e4060",
  cyan: "#38bdf8", green: "#34d399", red: "#ef4444", orange: "#fb923c",
  yellow: "#fbbf24", purple: "#a78bfa", muted: "#1e4060", text: "#cfe6f5",
};
const VALUE_COLOR: Record<string, string> = {
  Truth: "#38bdf8", Justice: "#a78bfa", Protection: "#34d399",
  Responsibility: "#fb923c", Dignity: "#fbbf24",
};
const ROLE_VALUE: Record<string, string> = {
  lawyer: "Justice", therapist: "Protection", journalist: "Truth",
  donor: "Responsibility", peer_survivor: "Dignity",
};
const VALUE_ORDER = ["Truth", "Justice", "Protection", "Responsibility", "Dignity"];

function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <div style={{ flex: 1, height: 7, background: "#0a1a2e", borderRadius: 4, overflow: "hidden" }}>
      <div style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: "100%", background: color, borderRadius: 4 }} />
    </div>
  );
}
const sec: React.CSSProperties = { fontSize: 9, color: C.borderSoft, letterSpacing: 2, textTransform: "uppercase", margin: "16px 0 7px" };
const cell: React.CSSProperties = { background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, padding: "9px 11px" };

export default function PhilosDiagnostic() {
  const c = useMemo(() => computeNoaChain(0), []);

  const tension = c.tension;
  const fields = tension?.fields ?? [];
  const strongest = tension?.strongest;
  const dims = c.resource?.dimensionDeficits ?? { Physical: 0, Emotional: 0, Rational: 0 };
  const leak = c.leakage?.totalLeakage ?? 0;
  const load = c.load;
  const action = c.action;
  const orientation = c.orientation?.score ?? 0;
  const resistance = c.collapse?.totalNegativeDominance ?? 0;

  // Value strengths from the value network (real: helper load per value).
  const valueStrength = useMemo(() => {
    const m: Record<string, number> = { Truth: 0, Justice: 0, Protection: 0, Responsibility: 0, Dignity: 0 };
    for (const h of load?.helpers ?? []) { const v = ROLE_VALUE[h.role]; if (v) m[v] += h.allocated; }
    return m;
  }, [load]);
  const valueRanked = VALUE_ORDER.map(v => ({ v, s: valueStrength[v] })).sort((a, b) => b.s - a.s);
  const dominantValue = valueRanked[0]?.s ? valueRanked[0].v : "—";
  const maxValueS = Math.max(1, ...valueRanked.map(x => x.s));

  const dimRanked = (["Physical", "Emotional", "Rational"] as const)
    .map(d => ({ d, v: dims[d] })).sort((a, b) => b.v - a.v);

  const retained = Math.max(0, 100 - leak);

  const summary: { k: string; v: string; c: string }[] = [
    { k: "Main Tension", v: strongest?.name ?? "—", c: C.red },
    { k: "Resistance", v: `${resistance}`, c: C.orange },
    { k: "Leakage", v: `${leak}`, c: C.orange },
    { k: "Dominant Value", v: dominantValue, c: VALUE_COLOR[dominantValue] ?? C.cyan },
    { k: "Impact", v: `${action?.collectiveImpact ?? 0}`, c: C.green },
    { k: "Action", v: `${cap(action?.recommendedAction ?? "—")} → ${action?.targetDimension ?? ""}`, c: C.cyan },
  ];

  return (
    <div dir="ltr" style={{ color: C.text, fontSize: 12 }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: C.cyan }}>Philos Diagnostic</div>
      <div style={{ fontSize: 9, color: C.borderSoft, letterSpacing: 1, marginBottom: 10 }}>
        Tension → Resistance → Leakage → Value → Impact → Action
      </div>

      {/* Diagnostic summary */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 4 }}>
        {summary.map(s => (
          <div key={s.k} style={cell}>
            <div style={{ fontSize: 8.5, color: C.borderSoft, letterSpacing: 1, textTransform: "uppercase" }}>{s.k}</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: s.c, marginTop: 2, lineHeight: 1.2 }}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* 1 · Tension */}
      <div style={sec}>1 · Tension</div>
      <div style={cell}>
        {fields.map(f => {
          const isMax = f.name === strongest?.name;
          return (
            <div key={f.name} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
              <div style={{ width: 130, fontSize: 9.5, color: isMax ? C.red : C.text, fontWeight: isMax ? 700 : 400, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.name}</div>
              <Bar pct={f.intensity} color={isMax ? C.red : C.borderSoft} />
              <div style={{ width: 22, fontSize: 9.5, fontWeight: 700, color: isMax ? C.red : C.borderSoft }}>{f.intensity}</div>
            </div>
          );
        })}
        <div style={{ fontSize: 10, color: "#9fc7df", marginTop: 4 }}>
          Strongest: <b style={{ color: C.red }}>{strongest?.name}</b> ({strongest?.department}, {strongest?.intensity}) — where most of the tension accumulates.
        </div>
      </div>

      {/* 2 · Resistance */}
      <div style={sec}>2 · Resistance</div>
      <div style={cell}>
        {dimRanked.map((d, i) => (
          <div key={d.d} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
            <div style={{ width: 80, fontSize: 10, color: i === 0 ? C.orange : C.text, fontWeight: i === 0 ? 700 : 400 }}>{d.d}</div>
            <Bar pct={d.v} color={i === 0 ? C.orange : C.borderSoft} />
            <div style={{ width: 22, fontSize: 9.5, fontWeight: 700, color: i === 0 ? C.orange : C.borderSoft }}>{d.v}</div>
          </div>
        ))}
        <div style={{ fontSize: 10, color: "#9fc7df", marginTop: 2 }}>Pressure accumulates most in <b style={{ color: C.orange }}>{dimRanked[0]?.d}</b>.</div>
      </div>

      {/* 3 · Leakage */}
      <div style={sec}>3 · Leakage</div>
      <div style={cell}>
        <div style={{ display: "flex", gap: 14, marginBottom: 8, fontSize: 11 }}>
          <span>Retained <b style={{ color: C.green }}>{retained}</b></span>
          <span>Lost <b style={{ color: C.red }}>{leak}</b></span>
          <span>Leakage <b style={{ color: C.orange }}>{leak}%</b></span>
        </div>
        <div style={{ display: "flex", height: 12, borderRadius: 6, overflow: "hidden", background: "#0a1a2e" }}>
          <div style={{ width: `${retained}%`, background: C.green }} />
          <div style={{ width: `${leak}%`, background: C.red }} />
        </div>
        {load && <div style={{ fontSize: 10, color: "#9fc7df", marginTop: 6 }}>Energy {load.beforeEnergy} → {load.afterEnergy} (+{load.energyRecovered}) once the network shares the load.</div>}
      </div>

      {/* 4 · Value */}
      <div style={sec}>4 · Value</div>
      <div style={cell}>
        {valueRanked.map((x, i) => (
          <div key={x.v} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
            <div style={{ width: 18, fontSize: 9, color: C.borderSoft }}>#{i + 1}</div>
            <div style={{ width: 96, fontSize: 10, color: VALUE_COLOR[x.v], fontWeight: i === 0 ? 700 : 400 }}>● {x.v}</div>
            <Bar pct={(x.s / maxValueS) * 100} color={VALUE_COLOR[x.v]} />
            <div style={{ width: 20, fontSize: 9.5, fontWeight: 700, color: VALUE_COLOR[x.v] }}>{x.s}</div>
          </div>
        ))}
        <div style={{ fontSize: 10, color: "#9fc7df", marginTop: 2 }}>Dominant value: <b style={{ color: VALUE_COLOR[dominantValue] ?? C.cyan }}>{dominantValue}</b>.</div>
      </div>

      {/* 5 · Impact */}
      <div style={sec}>5 · Impact</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
        {[
          { k: "People", v: `${load?.helpers.length ?? 0}` },
          { k: "Connections", v: `${load?.helpers.length ?? 0}` },
          { k: "Load reduced", v: `${load?.distributedLoad ?? 0}` },
          { k: "Support", v: `${load?.communityPct ?? 0}%` },
          { k: "Impact score", v: `${action?.collectiveImpact ?? 0}` },
          { k: "Orientation", v: `${orientation}/100` },
        ].map(s => (
          <div key={s.k} style={cell}>
            <div style={{ fontSize: 8, color: C.borderSoft, textTransform: "uppercase", letterSpacing: 0.5 }}>{s.k}</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: C.green, marginTop: 2 }}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* 6 · Action (ONE) */}
      <div style={sec}>6 · Action</div>
      <div style={{ ...cell, border: `1px solid ${C.cyan}`, background: "#06223a" }}>
        <div style={{ fontSize: 9, color: C.borderSoft, letterSpacing: 1, textTransform: "uppercase" }}>Recommended action</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: C.cyan, margin: "3px 0 8px" }}>{cap(action?.recommendedAction ?? "stabilize")} → {action?.targetDimension ?? "Physical"}</div>
        <div style={{ display: "flex", gap: 14, fontSize: 12 }}>
          <span style={{ color: C.green }}>+{action?.expectedEnergyGain ?? 16} Energy</span>
          <span style={{ color: C.green }}>−{action?.expectedLoadReduction ?? 11} Load</span>
          <span style={{ color: C.green }}>+{action?.expectedOrientationGain ?? 9} Orientation</span>
        </div>
      </div>

      <div style={{ ...sec, color: C.muted }}>Supporting evidence — the matrix explains why ↓</div>
    </div>
  );
}

function cap(s: string): string { return s.charAt(0).toUpperCase() + s.slice(1); }
