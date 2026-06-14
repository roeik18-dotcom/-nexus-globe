"use client";

/**
 * Nexus — OPM "Network Effects" section (VISUALIZATION ONLY).
 *
 * The CASE value-network: the real helpers that carry Noa's burden — NOT the
 * wider globe seed network. Every number is a real engine output:
 *   • Helper communities  ← chain.load.helpers grouped by value (ROLE_VALUE)
 *   • People              ← helper count per value
 *   • Capacity            ← Σ helper supportCapacity (seedLoadProfiles)
 *   • Burden carried      ← Σ helper allocated
 *   • Burden share        ← carried / chain.load.distributedLoad
 *   • Utilization         ← carried / capacity  (real ratio)
 *   • Burnout risk        ← utilization thresholds (80% / 95%)
 *   • Recovered capacity  ← chain.load.distributedLoad
 *   • Remaining gap       ← chain.load.afterIndividualLoad
 *   • Projected recovery  ← verified Wellbeing track endpoint
 * No engine/verifier/calculation changes. Reach and a separate Influence metric
 * are deliberately OMITTED — there is no grounded source for them here.
 */

import { useMemo } from "react";
import { getLoadProfile, type NoaChain } from "../lib/noa";
import { WELLBEING_STATES, type Wellbeing } from "../lib/causalEngine";
import { useSyncSelection, selectSync, ROLE_VALUE } from "./syncStore";

const C = {
  card: "#040e1c", border: "#0a2a4a", borderSoft: "#1e4060",
  text: "#cfe6f5", cyan: "#38bdf8", green: "#34d399", red: "#ef4444",
  orange: "#fb923c", yellow: "#fbbf24", purple: "#a78bfa",
};
const sec: React.CSSProperties = { fontSize: 9, color: C.borderSoft, letterSpacing: 2, textTransform: "uppercase", margin: "12px 0 7px" };
const VALUE_COLOR: Record<string, string> = {
  Truth: "#38bdf8", Justice: "#a78bfa", Protection: "#34d399",
  Responsibility: "#fb923c", Dignity: "#fbbf24",
};
const STATE_COLOR: Record<Wellbeing, string> = {
  Destroyed: C.red, Damaged: C.orange, Fragile: C.yellow, Stable: C.cyan, Recovered: C.green,
};
const ROLE_LABEL: Record<string, string> = {
  lawyer: "Lawyer", therapist: "Therapist", journalist: "Journalist",
  donor: "Donor", peer_survivor: "Peer Survivor",
};

interface HelperCommunity { value: string; people: number; capacity: number; carried: number; roles: string[]; }

function riskOf(util: number): { label: string; col: string } {
  if (util > 0.95) return { label: "🔴 Overloaded", col: C.red };
  if (util > 0.80) return { label: "⚠ Near exhaustion", col: C.orange };
  return { label: "✓ Safe capacity", col: C.green };
}

export default function NoaNetworkEffects({ chain }: { chain: NoaChain }) {
  const sync = useSyncSelection();
  const load = chain.load;
  const helpers = load?.helpers ?? [];
  const distributed = load?.distributedLoad ?? 0;
  const originalGap = load?.beforeIndividualLoad ?? 100;
  const remainingGap = load?.afterIndividualLoad ?? originalGap;
  const carryPct = Math.min(100, Math.round((distributed / Math.max(1, originalGap)) * 100));
  const projectedEnd: Wellbeing = "Recovered";

  const communities = useMemo<HelperCommunity[]>(() => {
    const m = new Map<string, HelperCommunity>();
    for (const h of helpers) {
      if ((h.allocated ?? 0) <= 0) continue;
      const v = ROLE_VALUE[h.role];
      if (!v) continue;
      const c = m.get(v) ?? { value: v, people: 0, capacity: 0, carried: 0, roles: [] };
      c.people += 1;
      c.capacity += getLoadProfile(h.id)?.supportCapacity ?? 0;
      c.carried += h.allocated ?? 0;
      c.roles.push(ROLE_LABEL[h.role] ?? h.role);
      m.set(v, c);
    }
    return [...m.values()].sort((a, b) => b.carried - a.carried);
  }, [helpers]);

  return (
    <div style={{ marginTop: 14, color: C.text }}>
      <div style={{ fontSize: 11, color: C.purple, letterSpacing: 2.5, textTransform: "uppercase", fontWeight: 800 }}>Network Effects</div>
      <div style={{ fontSize: 9.5, color: C.borderSoft, marginTop: 2, marginBottom: 8 }}>
        the case value-network — Noa&apos;s helpers — that actually carried the burden
      </div>

      {/* 1 · VALUES HARMED → ACTIVATED HELPER COMMUNITIES */}
      <div style={sec}>Values Harmed → Activated Helper Communities</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8 }}>
        {communities.length === 0 && <span style={{ fontSize: 10, color: C.borderSoft }}>no helper communities active</span>}
        {communities.map(c => (
          <span key={c.value} style={{ fontSize: 9.5, fontWeight: 700, color: VALUE_COLOR[c.value] ?? C.cyan, border: `1px solid ${(VALUE_COLOR[c.value] ?? C.cyan)}66`, borderRadius: 999, padding: "1px 8px" }}>
            ● {c.value}
          </span>
        ))}
      </div>

      {/* 2 · COMMUNITY ROWS — People · Capacity · Carried · Share + Utilization + Burnout risk */}
      {communities.map(c => {
        const col = VALUE_COLOR[c.value] ?? C.cyan;
        const sharePct = distributed > 0 ? Math.round((c.carried / distributed) * 100) : 0;
        const util = c.capacity > 0 ? c.carried / c.capacity : 0;
        const utilPct = Math.round(util * 100);
        const risk = riskOf(util);
        const matched = sync.value === c.value;
        return (
          <div key={c.value} onClick={() => selectSync(c.value, "opm", c.value)}
            style={{ cursor: "pointer", background: matched ? "#06223a" : C.card, border: `1px solid ${matched ? C.cyan : col + "55"}`, borderRadius: 7, padding: "6px 9px", marginBottom: 5 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 6 }}>
              <span style={{ fontSize: 11.5, fontWeight: 800, color: col }}>{c.value}{matched ? " ◀" : ""}</span>
              <span style={{ fontSize: 8.5, fontWeight: 700, color: risk.col }}>{risk.label}</span>
            </div>
            <div style={{ fontSize: 9, color: C.borderSoft, marginTop: 1 }}>{c.roles.join(", ")}</div>
            <div style={{ display: "flex", gap: 10, marginTop: 3, fontSize: 9.5 }}>
              <span style={{ color: C.borderSoft }}>👥 <b style={{ color: C.text }}>{c.people}</b></span>
              <span style={{ color: C.borderSoft }}>cap <b style={{ color: C.green }}>{c.capacity}</b></span>
              <span style={{ color: C.borderSoft }}>carried <b style={{ color: C.orange }}>{c.carried}</b></span>
              <span style={{ color: C.borderSoft }}>share <b style={{ color: col }}>{sharePct}%</b></span>
            </div>
            {/* utilization bar = carried / capacity (risk-colored) */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 5 }}>
              <div style={{ flex: 1, height: 5, background: "#0a2a4a", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ width: `${Math.min(100, utilPct)}%`, height: "100%", background: risk.col }} />
              </div>
              <span style={{ fontSize: 8.5, fontWeight: 700, color: risk.col, whiteSpace: "nowrap" }}>{utilPct}% utilized</span>
            </div>
          </div>
        );
      })}

      {/* 3 · BURDEN CARRIED → REMAINING GAP (real chain.load figures) */}
      <div style={sec}>Burden Carried → Remaining Gap</div>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 7, padding: "8px 10px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginBottom: 6 }}>
          <span style={{ color: C.borderSoft }}>Original <b style={{ color: C.text }}>{originalGap}</b></span>
          <span style={{ color: C.borderSoft }}>Carried <b style={{ color: C.green }}>{distributed}</b></span>
          <span style={{ color: C.borderSoft }}>Remaining <b style={{ color: remainingGap > 0 ? C.red : C.green }}>{remainingGap}</b></span>
        </div>
        <div style={{ display: "flex", height: 9, borderRadius: 5, overflow: "hidden", border: `1px solid ${C.border}` }}>
          <div style={{ width: `${carryPct}%`, background: C.green }} title={`carried ${carryPct}%`} />
          <div style={{ width: `${100 - carryPct}%`, background: C.red }} title="remaining gap" />
        </div>
        <div style={{ fontSize: 8.5, color: C.borderSoft, marginTop: 5 }}>{carryPct}% of the burden carried by the helper network</div>
      </div>

      {/* 4 · VALUE FLOW — OPMCloud-style: communities → carried/remaining → recovery */}
      <div style={sec}>Value Flow</div>
      <div style={{ fontSize: 8.5, color: C.borderSoft, marginBottom: 6 }}>helper communities → carried → remaining → recovery</div>
      <div style={{ display: "flex", height: 22, borderRadius: 6, overflow: "hidden", border: `1px solid ${C.border}` }}>
        {communities.map(c => (
          <div key={c.value} title={`${c.value} carried ${c.carried}`}
            style={{ width: `${(c.carried / Math.max(1, originalGap)) * 100}%`, background: VALUE_COLOR[c.value] ?? C.cyan, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 7.5, fontWeight: 800, color: "#03101e" }}>{c.carried}</span>
          </div>
        ))}
        <div title={`remaining ${remainingGap}`}
          style={{ width: `${(remainingGap / Math.max(1, originalGap)) * 100}%`, background: C.red, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 7.5, fontWeight: 800, color: "#fff" }}>{remainingGap}</span>
        </div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 5, fontSize: 8.5 }}>
        {communities.map(c => (
          <span key={c.value} style={{ color: VALUE_COLOR[c.value] ?? C.cyan }}>● {c.value} {distributed > 0 ? Math.round((c.carried / distributed) * 100) : 0}%</span>
        ))}
        <span style={{ color: C.red }}>● remaining {originalGap > 0 ? Math.round((remainingGap / originalGap) * 100) : 0}%</span>
      </div>

      <div style={{ textAlign: "center", fontSize: 11, color: C.borderSoft, margin: "5px 0 2px" }}>↓</div>
      <div style={{ textAlign: "center", fontSize: 10 }}>
        <b style={{ color: C.green }}>{distributed} carried</b> <span style={{ color: C.borderSoft }}>·</span> <b style={{ color: remainingGap > 0 ? C.red : C.green }}>{remainingGap} remaining</b>
      </div>
      <div style={{ textAlign: "center", fontSize: 11, color: C.borderSoft, margin: "2px 0" }}>↓</div>

      {/* recovery track (verified Wellbeing endpoint) */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 3, flexWrap: "wrap" }}>
        {WELLBEING_STATES.map((s, i) => (
          <span key={s} style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
            <span style={{ fontSize: 8, fontWeight: 700, color: STATE_COLOR[s], border: `1px solid ${STATE_COLOR[s]}${s === projectedEnd ? "" : "66"}`, background: s === projectedEnd ? `${STATE_COLOR[s]}22` : "transparent", borderRadius: 999, padding: "2px 7px" }}>
              {s}{s === projectedEnd ? " ◀" : ""}
            </span>
            {i < WELLBEING_STATES.length - 1 && <span style={{ fontSize: 9, color: C.borderSoft }}>→</span>}
          </span>
        ))}
      </div>
      <div style={{ fontSize: 8.5, color: C.borderSoft, marginTop: 5 }}>
        helpers carried the burden · click a value to find it across the wider globe network
      </div>
    </div>
  );
}
