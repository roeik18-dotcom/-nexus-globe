"use client";

/**
 * Nexus — Personal Map ("You Are Here").
 *
 * The permanent navigation screen after the First 30 Seconds / User Intake. It
 * answers six questions, each from an existing Noa chain output (computeNoaChain,
 * lib/noa) — no new engines, no new calculations, no backend.
 *
 * With an optional intake `profile`, the map is REFRAMED by the user's three
 * answers (selection only): their chosen resistance field, need dimension, and
 * values pick which existing chain outputs are surfaced. Without a profile it
 * shows Noa (the validated default), unchanged.
 */

import { useMemo } from "react";
import { computeNoaChain, deptLabel, type NoaChain } from "../lib/noa";
import type { IntakeProfile } from "./UserIntake";

const C = {
  bg: "#030f1e", card: "#040e1c", border: "#0a2a4a", borderSoft: "#1e4060",
  cyan: "#38bdf8", green: "#34d399", red: "#ef4444", orange: "#fb923c",
  yellow: "#fbbf24", purple: "#a78bfa", muted: "#1e4060", text: "#cfe6f5",
};

// Helper role → core value (the value-network mapping; UI selection, not engine).
const ROLE_VALUE: Record<string, string> = {
  lawyer: "Justice", therapist: "Protection", journalist: "Truth",
  donor: "Responsibility", peer_survivor: "Dignity",
};
// Need dimension → the action that addresses it (existing action vocabulary).
const NEED_ACTION: Record<string, string> = {
  Physical: "Stabilize", Emotional: "Support", Rational: "Clarify",
};
const VALUE_HE: Record<string, string> = {
  Truth: "אמת", Justice: "צדק", Protection: "הגנה", Responsibility: "אחריות", Dignity: "כבוד",
};

function bandLabel(score: number): string {
  if (score <= 25) return "Collapse";
  if (score <= 50) return "First Stabilization";
  if (score <= 75) return "Active Recovery";
  return "Strong Orientation";
}

function Card(props: { n: number; q: string; accent: string; children: React.ReactNode }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderInlineStart: `3px solid ${props.accent}`, borderRadius: 6, padding: "10px 12px", marginBottom: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <span style={{ width: 16, height: 16, borderRadius: "50%", background: props.accent + "22", color: props.accent, fontSize: 9, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{props.n}</span>
        <span style={{ fontSize: 9, color: C.borderSoft, letterSpacing: 1, textTransform: "uppercase" }}>{props.q}</span>
      </div>
      {props.children}
    </div>
  );
}

/** `chain` defaults to the locked Noa chain; pass a person chain to map a real user. */
export default function PersonalMap({ profile, chain }: { profile?: IntakeProfile; chain?: NoaChain }) {
  const fallback = useMemo(() => computeNoaChain(0), []);
  const c = chain ?? fallback;

  const fields = c.tension?.fields ?? [];
  const leak = c.leakage;
  const flow = c.flow;
  const load = c.load;
  const action = c.action;
  const orientation = c.orientation?.score ?? 45;
  const level = c.orientation?.level ?? "medium";
  const allHelpers = load?.helpers ?? [];

  // ── Reframe by intake profile (selection over existing outputs) ──
  // 1 · Resistance — the user's chosen field (else the chain's strongest).
  const resField = profile
    ? fields.find(f => f.department === profile.tensionDept) ?? c.tension?.strongest
    : c.tension?.strongest;
  // 3 · Balancing force — the user's need dimension (else strongest inflow).
  const balDim = profile?.needDim ?? flow?.strongestInflowDimension ?? "Emotional";
  const balInflow = flow?.dimensions.find(d => d.dimension === balDim)?.inflow ?? flow?.totalInflow ?? 0;
  // 4 · Who is helping — helpers whose value the user holds (else everyone).
  const matched = profile
    ? allHelpers.filter(h => profile.values.includes(ROLE_VALUE[h.role] ?? ""))
    : allHelpers;
  const helpers = matched.length ? matched : allHelpers;
  // 5 · Action — addresses the user's need (else the chain's recommendation).
  const actName = profile ? NEED_ACTION[profile.needDim] : (action?.recommendedAction ?? "stabilize");
  const actDim = profile ? profile.needDim : (action?.targetDimension ?? "Physical");

  const big = (color: string): React.CSSProperties => ({ fontSize: 17, fontWeight: 800, color });
  const sub: React.CSSProperties = { fontSize: 10.5, color: "#9fc7df", marginTop: 2 };

  return (
    <div dir="ltr" style={{ color: C.text, fontSize: 12 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: C.cyan }}>You Are Here</div>
        <div style={{ fontSize: 9, color: C.borderSoft, letterSpacing: 1 }}>{(chain || profile) ? "PERSONAL MAP · YOU" : "PERSONAL MAP · NOA"}</div>
      </div>

      {/* 1 · Strongest resistance */}
      <Card n={1} q="Strongest resistance" accent={C.red}>
        <div style={big(C.red)}>{resField?.name ?? "Connection ↔ Disconnection"}</div>
        <div style={sub}>{deptLabel(resField?.department ?? "Emotional")} · pressure {resField?.intensity ?? 90}</div>
      </Card>

      {/* 2 · Where energy is leaking */}
      <Card n={2} q="Where energy is leaking" accent={C.orange}>
        <div style={big(C.orange)}>{leak?.totalLeakage ?? 78} <span style={{ fontSize: 11, color: C.borderSoft }}>/ 100 · {leak?.leakageLevel ?? "high"}</span></div>
        <div style={sub}>strongest at {leak?.strongestLeakingDepartment ?? "Emotional"} · {leak?.strongestLeakingCell?.channel ?? "Emotion"} ({leak?.strongestLeakingCell?.dominance ?? 95}%)</div>
      </Card>

      {/* 3 · Balancing force */}
      <Card n={3} q="Balancing force" accent={C.purple}>
        <div style={big(C.purple)}>{balDim}</div>
        <div style={sub}>value network channels +{balInflow} of support into your need</div>
      </Card>

      {/* 4 · Who is helping */}
      <Card n={4} q="Who is helping" accent={C.green}>
        <div style={big(C.green)}>{helpers.length} people <span style={{ fontSize: 11, color: C.borderSoft }}>· community {load?.communityPct ?? 65}%</span></div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
          {helpers.slice(0, 5).map(h => (
            <span key={h.id} title={`${ROLE_VALUE[h.role] ?? ""} · ${h.loadType}`} style={{ fontSize: 9, padding: "2px 7px", borderRadius: 10, background: "#06223a", border: `1px solid ${C.borderSoft}`, color: C.text }}>{h.name.split(" ")[0]} · {h.allocated}</span>
          ))}
        </div>
      </Card>

      {/* 5 · What to do now */}
      <Card n={5} q="What to do now" accent={C.cyan}>
        <div style={big(C.cyan)}>{actName} → {actDim}</div>
        <div style={{ display: "flex", gap: 12, marginTop: 6, fontSize: 11 }}>
          <span style={{ color: C.green }}>+{action?.expectedEnergyGain ?? 16} Energy</span>
          <span style={{ color: C.green }}>−{action?.expectedLoadReduction ?? 11} Load</span>
          <span style={{ color: C.green }}>+{action?.expectedOrientationGain ?? 9} Orient.</span>
        </div>
      </Card>

      {/* 6 · Where am I currently */}
      <Card n={6} q="Where am I currently" accent={C.green}>
        <div style={big(C.green)}>{orientation}<span style={{ fontSize: 13, color: C.borderSoft }}>/100</span></div>
        <div style={{ height: 6, background: "#0a1a2e", borderRadius: 4, overflow: "hidden", margin: "6px 0" }}>
          <div style={{ width: `${orientation}%`, height: "100%", background: C.green, borderRadius: 4 }} />
        </div>
        <div style={sub}>{bandLabel(orientation)} · {level}</div>
      </Card>

      {profile && profile.values.length > 0 && (
        <div style={{ fontSize: 10, color: C.borderSoft, textAlign: "center", marginTop: 2 }}>
          Bound by {profile.values.map(v => VALUE_HE[v] ?? v).join(" · ")}
        </div>
      )}
      <div style={{ fontSize: 10, color: C.borderSoft, textAlign: "center", marginTop: 6 }}>
        Private Burden → Shared Responsibility
      </div>
    </div>
  );
}
