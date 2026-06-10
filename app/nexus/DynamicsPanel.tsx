"use client";

import { useMemo, useState } from "react";
import { FORCE_COLOR, FORCE_LABEL, saveNode, buildLinks, type UserNode, type DominantForce } from "../lib/philos";
import {
  getEvolutionPath, getParallelTimelines, getFutureComparison, getLongTermImpact,
  detectTensionZones, getSystemFlows, applyDynamicsAction, propagateTransition,
  TENSION_COLOR, TENSION_LABEL, FLOW_TREND_ICON, FLOW_TREND_COLOR,
  type TimeProjection, type DynamicsTransition, type PropagationResult,
} from "../lib/dynamics";

// ─── Tab types ────────────────────────────────────────────────────────

type Tab = "evolution" | "timelines" | "futures" | "longterm" | "tensions" | "flows";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "evolution",  label: "אבולוציה" },
  { id: "timelines",  label: "נתיבים"   },
  { id: "futures",    label: "עתידות"   },
  { id: "longterm",   label: "ארוך טווח"},
  { id: "tensions",   label: "מתחים"    },
  { id: "flows",      label: "זרימות"   },
];

// ─── Props ────────────────────────────────────────────────────────────

interface Props {
  selected:      UserNode | null;
  allNodes:      UserNode[];
  proofTrustMap: Record<string, number>;
  onTransition?: (transition: DynamicsTransition) => void;
}

// ─── Component ───────────────────────────────────────────────────────

export default function DynamicsPanel({ selected, allNodes, proofTrustMap, onTransition }: Props) {
  const [tab,         setTab]         = useState<Tab>("evolution");
  const [lastEvent,   setLastEvent]   = useState<DynamicsTransition | null>(null);
  const [propagation, setPropagation] = useState<PropagationResult | null>(null);
  const [applying,    setApplying]    = useState<string | null>(null);

  // Precompute graph links for propagation
  const links = useMemo(() => buildLinks(allNodes), [allNodes]);

  function handleApply(timeline: ReturnType<typeof getParallelTimelines>[number]) {
    if (!selected) return;
    setApplying(timeline.label);

    const transition = applyDynamicsAction(selected, timeline);
    saveNode(transition.updatedNode);

    // Propagate effects to surrounding system
    const prop = propagateTransition(selected, transition, allNodes, links);
    setPropagation(prop);
    setLastEvent(transition);
    onTransition?.(transition);
    setTimeout(() => setApplying(null), 1200);
  }

  const trust       = selected ? (proofTrustMap[selected.id] ?? selected.trustScore) : 0;
  const evo         = selected ? getEvolutionPath(selected.dominantForce) : null;
  const timelines   = selected ? getParallelTimelines(selected.dominantForce, "") : [];
  const comparison  = selected ? getFutureComparison(selected, trust) : null;
  const longTerm    = selected ? getLongTermImpact(selected, trust) : null;
  const tensions    = useMemo(() => detectTensionZones(allNodes), [allNodes]);
  const flows       = useMemo(() => getSystemFlows(allNodes), [allNodes]);

  const fc  = selected ? FORCE_COLOR[selected.dominantForce] : "#38bdf8";
  const S = {
    section: { marginBottom: 14 } as React.CSSProperties,
    head:    { fontSize: 9, letterSpacing: 2, color: "#1e4060", textTransform: "uppercase" as const, marginBottom: 6 } as React.CSSProperties,
    card:    (color: string) => ({ padding: "8px 10px", borderRadius: 6, border: `1px solid ${color}33`, background: color + "09", marginBottom: 6 } as React.CSSProperties),
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>

      {/* Header */}
      <div style={{ padding: "10px 14px 6px", borderBottom: "1px solid #0a2a4a", flexShrink: 0 }}>
        <div style={{ fontSize: 9, letterSpacing: 3, color: "#38bdf8", fontWeight: 700, marginBottom: 5 }}>
          NEXUS DYNAMICS
        </div>
        {selected && (
          <div style={{ fontSize: 10, color: fc }}>
            {selected.name} · {FORCE_LABEL[selected.dominantForce]}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid #0a2a4a", flexShrink: 0, overflowX: "auto" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              flex: 1, padding: "6px 4px", fontSize: 9, border: "none", cursor: "pointer",
              background: tab === t.id ? "#0a2a4a" : "transparent",
              color: tab === t.id ? "#38bdf8" : "#1e4060",
              fontWeight: tab === t.id ? 700 : 400,
              borderBottom: tab === t.id ? "2px solid #38bdf8" : "2px solid transparent",
              whiteSpace: "nowrap",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "10px 12px" }}>

        {/* ── EVOLUTION ── */}
        {tab === "evolution" && (
          <div>
            {!selected && <div style={{ fontSize: 10, color: "#1e4060", textAlign: "center", padding: 16 }}>בחר node לראות נתיב אבולוציה</div>}
            {selected && evo && (
              <>
                <div style={S.section}>
                  <div style={S.head}>נתיב אבולוציה</div>
                  {[
                    { label: "עכשיו",      text: evo.currentDesc, color: fc,                           node: evo.current },
                    { label: "מאזן",        text: evo.balanceDesc, color: FORCE_COLOR[evo.balance as DominantForce] ?? "#38bdf8", node: evo.balance },
                    { label: "הבא",         text: evo.nextDesc,    color: evo.next ? FORCE_COLOR[evo.next] : "#a78bfa",           node: evo.next },
                    { label: "ארוך טווח",   text: evo.longTerm,    color: "#a78bfa",                   node: null },
                  ].map((step, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "flex-start" }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                        <div style={{ width: 10, height: 10, borderRadius: "50%", background: step.color, border: `2px solid ${step.color}` }} />
                        {i < 3 && <div style={{ width: 2, height: 22, background: step.color + "55", marginTop: 2 }} />}
                      </div>
                      <div>
                        <div style={{ fontSize: 8, color: "#1e4060", letterSpacing: 1, marginBottom: 2 }}>{step.label}</div>
                        {step.node && (
                          <div style={{ fontSize: 10, color: step.color, fontWeight: 600, marginBottom: 2 }}>
                            {typeof step.node === "string" ? FORCE_LABEL[step.node as DominantForce] ?? step.node : ""}
                          </div>
                        )}
                        <div style={{ fontSize: 10, color: "#8bb8cc" }}>{step.text}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Trust trajectory */}
                <div style={S.card(fc)}>
                  <div style={S.head}>מסלול אמון נוכחי</div>
                  <div style={{ fontSize: 12, color: fc, fontWeight: 700 }}>{trust}/100</div>
                  <div style={{ height: 6, borderRadius: 3, background: "#0a2a4a", overflow: "hidden", marginTop: 6 }}>
                    <div style={{ width: `${trust}%`, height: "100%", background: `linear-gradient(90deg,${fc},${fc}88)`, borderRadius: 3 }} />
                  </div>
                  <div style={{ fontSize: 9, color: "#1e4060", marginTop: 4 }}>
                    {trust < 20 ? "🌱 ראשית — בנה הוכחות ראשונות" : trust < 50 ? "📈 בצמיחה — המשך" : trust < 80 ? "🔥 מהימן — תרחיב" : "⭐ סמכות — הוביל"}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── PARALLEL TIMELINES ── */}
        {tab === "timelines" && (
          <div>
            {!selected && <div style={{ fontSize: 10, color: "#1e4060", textAlign: "center", padding: 16 }}>בחר node לראות נתיבים מקבילים</div>}
            {selected && (
              <>
                <div style={{ fontSize: 10, color: "#8bb8cc", marginBottom: 8 }}>
                  אם היית בוחר היום — {selected.name}:
                </div>

                {/* Last transition event */}
                {lastEvent && (
                  <div style={{ padding: "7px 10px", borderRadius: 6, border: "1px solid #34d39944", background: "#34d39908", marginBottom: 10 }}>
                    <div style={{ fontSize: 9, color: "#34d399", letterSpacing: 1, marginBottom: 3 }}>✓ DYNAMICS_TRANSITION</div>
                    <div style={{ fontSize: 10, color: "#caf0f8" }}>{lastEvent.event.message}</div>
                    <div style={{ display: "flex", gap: 8, marginTop: 4, fontSize: 9, color: "#8bb8cc" }}>
                      <span>+{lastEvent.trustDelta} trust</span>
                      {lastEvent.forceShift && (
                        <span style={{ color: FORCE_COLOR[lastEvent.forceShift.to] }}>
                          {FORCE_LABEL[lastEvent.forceShift.from]} → {FORCE_LABEL[lastEvent.forceShift.to]}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Propagation preview */}
                {propagation && (
                  <div style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid #38bdf844", background: "#38bdf808", marginBottom: 10 }}>
                    <div style={{ fontSize: 9, color: "#38bdf8", letterSpacing: 1, marginBottom: 6 }}>
                      ◎ SYSTEM_PROPAGATION
                    </div>

                    {/* Affected nodes */}
                    {propagation.affected.length > 0 && (
                      <div style={{ marginBottom: 6 }}>
                        <div style={{ fontSize: 8, color: "#1e4060", marginBottom: 4 }}>nodes מושפעים:</div>
                        {propagation.affected.map((e, i) => (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                            <div style={{ width: 5, height: 5, borderRadius: "50%", background: FORCE_COLOR[e.node.dominantForce], flexShrink: 0 }} />
                            <span style={{ fontSize: 9, color: "#caf0f8", flex: 1 }}>{e.node.name}</span>
                            <span style={{ fontSize: 9, color: "#34d399" }}>+{e.trustDelta}</span>
                            <span style={{ fontSize: 8, color: "#1e4060" }}>{e.strength}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Pulse delta */}
                    <div style={{ display: "flex", gap: 8, fontSize: 9, color: "#8bb8cc", marginBottom: 6, flexWrap: "wrap" }}>
                      {[
                        { label: "⚡", val: propagation.pulseDelta.energy,   color: "#fbbf24" },
                        { label: "⬡",  val: propagation.pulseDelta.trust,    color: "#34d399" },
                        { label: "⊗",  val: propagation.pulseDelta.stress,   color: "#f87171" },
                        { label: "◉",  val: propagation.pulseDelta.activity, color: "#38bdf8" },
                      ].map(m => (
                        <span key={m.label} style={{ color: m.color }}>
                          {m.label} {m.val > 0 ? "+" : ""}{m.val}
                        </span>
                      ))}
                    </div>

                    {/* Flow deltas */}
                    {Object.keys(propagation.flowDeltas).length > 0 && (
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {Object.entries(propagation.flowDeltas).map(([k, v]) => (
                          <span key={k} style={{ fontSize: 8, padding: "1px 5px", borderRadius: 3, background: "#34d39922", color: "#34d399" }}>
                            {k} +{v}%
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {timelines.map((t, i) => {
                  const col       = FORCE_COLOR[t.force];
                  const isApplying = applying === t.label;
                  return (
                    <div key={i} style={S.card(col)}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <span style={{ fontSize: 10, color: col, fontWeight: 700 }}>{t.label}</span>
                        <span style={{ fontSize: 9, color: "#1e4060" }}>+{t.trustDelta} · {t.connections} קשרים</span>
                      </div>
                      <div style={{ fontSize: 10, color: "#caf0f8", marginBottom: 4 }}>{t.action}</div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", gap: 8, fontSize: 9 }}>
                          <span style={{ color: "#f87171" }}>⚠ {t.risk}</span>
                          <span style={{ color: "#34d399" }}>✦ {t.opportunity}</span>
                        </div>
                        <button
                          onClick={() => handleApply(t)}
                          style={{
                            padding: "4px 10px", borderRadius: 4, fontSize: 9, fontWeight: 700,
                            border: `1px solid ${col}88`,
                            background: isApplying ? col + "44" : col + "22",
                            color: col, cursor: "pointer",
                            transition: "all .15s",
                          }}
                        >
                          {isApplying ? "✓ הוחל" : "↳ הפעל"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}

        {/* ── ALTERNATIVE FUTURES ── */}
        {tab === "futures" && (
          <div>
            {!selected && <div style={{ fontSize: 10, color: "#1e4060", textAlign: "center", padding: 16 }}>בחר node לראות עתידות חלופיות</div>}
            {selected && comparison && (
              <>
                <div style={{ fontSize: 10, color: "#8bb8cc", marginBottom: 10, lineHeight: 1.5 }}>{comparison.insight}</div>

                {[
                  { fut: comparison.current,     label: "נתיב נוכחי",    color: fc },
                  { fut: comparison.alternative, label: "נתיב חלופי",    color: FORCE_COLOR[comparison.alternative.force] },
                ].map(({ fut, label, color }) => (
                  <div key={label} style={S.card(color)}>
                    <div style={{ fontSize: 9, color, letterSpacing: 1, fontWeight: 700, marginBottom: 4 }}>{label}: {fut.label}</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                      <div>
                        <div style={{ fontSize: 8, color: "#1e4060" }}>שבוע 1</div>
                        <div style={{ fontSize: 11, color, fontWeight: 700 }}>+{fut.week1Trust} trust</div>
                        <div style={{ fontSize: 9, color: "#8bb8cc" }}>{fut.week1Conns} קשרים</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 8, color: "#1e4060" }}>חודש 1</div>
                        <div style={{ fontSize: 11, color, fontWeight: 700 }}>+{fut.month1Trust} trust</div>
                        <div style={{ fontSize: 9, color: "#8bb8cc" }}>{fut.month1Opps} הזדמנויות</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 9, color: "#1e4060", marginTop: 4 }}>תפקיד: {fut.description}</div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* ── LONG TERM IMPACT ── */}
        {tab === "longterm" && (
          <div>
            {!selected && <div style={{ fontSize: 10, color: "#1e4060", textAlign: "center", padding: 16 }}>בחר node לראות השפעה ארוכת טווח</div>}
            {selected && longTerm && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginBottom: 10 }}>
                  <div style={{ fontSize: 9, color: fc, fontWeight: 700, textAlign: "center", padding: "3px 0" }}>
                    {FORCE_LABEL[longTerm.node.dominantForce]} (נוכחי)
                  </div>
                  <div style={{ fontSize: 9, color: FORCE_COLOR[longTerm.altForce], fontWeight: 700, textAlign: "center", padding: "3px 0" }}>
                    {FORCE_LABEL[longTerm.altForce]} (חלופי)
                  </div>
                </div>
                {(["1d","1w","1m","1y"] as const).map((p, i) => {
                  const curr = longTerm.projections[i];
                  const alt  = longTerm.altProjections[i];
                  return (
                    <div key={p} style={{ display: "grid", gridTemplateColumns: "60px 1fr 1fr", gap: 4, marginBottom: 6, alignItems: "center" }}>
                      <div style={{ fontSize: 9, color: "#1e4060", fontWeight: 600 }}>{curr.label}</div>
                      <ProjectionCell p={curr} color={fc} />
                      <ProjectionCell p={alt}  color={FORCE_COLOR[longTerm.altForce]} />
                    </div>
                  );
                })}
                <div style={{ fontSize: 9, color: "#1e4060", marginTop: 8, lineHeight: 1.5 }}>
                  * תחזית מבוססת על כוח דומיננטי, כיוון ורמת אמון נוכחית
                </div>
              </>
            )}
          </div>
        )}

        {/* ── TENSION ZONES ── */}
        {tab === "tensions" && (
          <div>
            <div style={S.head}>אזורי מתח מערכתיים</div>
            {tensions.length === 0
              ? <div style={{ fontSize: 10, color: "#1e4060" }}>לא מספיק נתונים</div>
              : tensions.map((t, i) => {
                const col = TENSION_COLOR[t.level];
                return (
                  <div key={i} style={S.card(col)}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                      <div style={{ fontSize: 11, color: "#caf0f8" }}>
                        <span style={{ color: FORCE_COLOR[t.forceA] }}>{FORCE_LABEL[t.forceA]}</span>
                        <span style={{ color: "#1e4060", margin: "0 4px" }}>↔</span>
                        <span style={{ color: FORCE_COLOR[t.forceB] }}>{FORCE_LABEL[t.forceB]}</span>
                      </div>
                      <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 3, background: col + "22", color: col, fontWeight: 700 }}>
                        {TENSION_LABEL[t.level]}
                      </span>
                    </div>
                    <div style={{ fontSize: 9, color: "#8bb8cc", marginBottom: 3 }}>{t.count} nodes · {t.risk}</div>
                    <div style={{ fontSize: 9, color: "#34d399" }}>✦ {t.growth}</div>
                  </div>
                );
              })
            }
          </div>
        )}

        {/* ── SYSTEM FLOWS ── */}
        {tab === "flows" && (
          <div>
            <div style={S.head}>זרימות מערכתיות</div>
            {flows.length === 0
              ? <div style={{ fontSize: 10, color: "#1e4060" }}>לא מספיק נתונים</div>
              : flows.map((f, i) => {
                const tCol = FLOW_TREND_COLOR[f.trend];
                return (
                  <div key={i} style={S.card(tCol)}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                      <div style={{ fontSize: 10, color: "#caf0f8", fontWeight: 600 }}>{f.label}</div>
                      <span style={{ fontSize: 11, color: tCol, fontWeight: 700 }}>{FLOW_TREND_ICON[f.trend]}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 5 }}>
                      <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 8, background: FORCE_COLOR[f.fromForce] + "22", color: FORCE_COLOR[f.fromForce] }}>
                        {FORCE_LABEL[f.fromForce]}
                      </span>
                      <span style={{ fontSize: 9, color: tCol }}>→</span>
                      <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 8, background: FORCE_COLOR[f.toForce] + "22", color: FORCE_COLOR[f.toForce] }}>
                        {FORCE_LABEL[f.toForce]}
                      </span>
                    </div>
                    <div style={{ height: 4, borderRadius: 2, background: "#0a2a4a", overflow: "hidden" }}>
                      <div style={{ width: `${f.magnitude}%`, height: "100%", background: tCol, borderRadius: 2 }} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8, color: "#1e4060", marginTop: 3 }}>
                      <span>{f.userCount} users</span>
                      <span>{f.pct}%</span>
                    </div>
                  </div>
                );
              })
            }
          </div>
        )}

      </div>
    </div>
  );
}

// ─── Small components ─────────────────────────────────────────────────

function ProjectionCell({ p, color }: { p: TimeProjection; color: string }) {
  return (
    <div style={{ padding: "5px 7px", borderRadius: 4, border: `1px solid ${color}22`, background: color + "08" }}>
      <div style={{ fontSize: 10, color, fontWeight: 700 }}>+{p.trustDelta}</div>
      <div style={{ fontSize: 8, color: "#1e4060" }}>{p.connections} קשרים</div>
      <div style={{ fontSize: 8, color: "#1e4060" }}>{p.opportunities} הזד'</div>
    </div>
  );
}
