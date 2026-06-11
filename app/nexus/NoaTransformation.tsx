"use client";

/**
 * Nexus — The First 30 Seconds (visual only).
 *
 * Begins with RESISTANCE, not measurement. Psychological flow:
 *   Pain → Explanation → Support → Action → Position.
 * Five auto-playing beats, each filling one tracker marker
 * (Resistance · Leakage · Support · Action · Orientation), then a closing
 * screen. All numbers come from the locked deterministic chain (computeNoaChain,
 * lib/noa) — nothing invented, no engine/core/data changes.
 */

import { useEffect, useMemo, useState } from "react";
import { computeNoaChain } from "../lib/noa";
import { buildBurdenNarrative } from "../lib/burdenNarrative";

const C = {
  bg: "#030f1e", card: "#040e1c", border: "#0a2a4a", borderSoft: "#1e4060",
  cyan: "#38bdf8", green: "#34d399", red: "#ef4444", orange: "#fb923c",
  yellow: "#fbbf24", purple: "#a78bfa", muted: "#1e4060", text: "#cfe6f5",
};

const TRACK = ["Resistance", "Leakage", "Support", "Action", "Orientation"];
const ACCENT = [C.red, C.orange, C.cyan, C.cyan, C.green];
const QUESTION = [
  "What is hurting me?",
  "What is this causing?",
  "What helps?",
  "What should I do now?",
  "Where am I now?",
];
const DURATIONS = [6000, 6000, 8000, 7000, 3000];

export default function NoaTransformation({ onContinue }: { onContinue?: () => void }) {
  const chain = useMemo(() => computeNoaChain(0), []);
  const narrative = useMemo(() => buildBurdenNarrative(chain), [chain]);
  const [beat, setBeat] = useState(0);     // 0..4
  const [done, setDone] = useState(false); // closing screen
  const [playing, setPlaying] = useState(true);
  const [analysis, setAnalysis] = useState(false); // false = human story (default), true = numbers/diagnostic

  // Data (all from the validated chain).
  const strongest = chain.tension?.strongest;
  const resistanceName = strongest?.name ?? "Connection ↔ Disconnection";
  const resistanceLevel = strongest?.intensity ?? 90;
  const fields = chain.tension?.fields ?? [];
  const leakage = chain.leakage?.totalLeakage ?? 78;
  const helpers = chain.load?.helpers ?? [];
  const communityPct = chain.load?.communityPct ?? 65;
  const beforePct = chain.load?.beforePct ?? 100;
  const afterPct = chain.load?.afterPct ?? 35;
  const action = chain.action;
  const actName = action?.recommendedAction ?? "Stabilize";
  const actDim = action?.targetDimension ?? "Physical";
  const dE = action?.expectedEnergyGain ?? 16;
  const dL = action?.expectedLoadReduction ?? 11;
  const dO = action?.expectedOrientationGain ?? 9;
  const orientation = chain.orientation?.score ?? 45;

  const COPY = [
    `The strongest resistance detected: ${resistanceName}. Pressure level: ${resistanceLevel}. This is where most of the tension accumulates.`,
    `Your energy is leaking here. A large portion of your attention is being consumed by this resistance. Current leakage: ${leakage}.`,
    `People who share your values can absorb part of the burden. Current support capacity: ${communityPct}%. Load reduced: ${beforePct} → ${afterPct}.`,
    `Recommended action: ${cap(actName)} → ${actDim}. Expected outcome: +${dE} Energy, −${dL} Load, +${dO} Orientation.`,
    `You are here: ${orientation} / 100. First Stabilization. Not collapse. Not recovery. The first stable grip.`,
  ];

  // Auto-play: advance through the beats on their durations.
  useEffect(() => {
    if (done || !playing || !analysis) return; // beats only auto-play inside Analysis
    const t = setTimeout(() => {
      if (beat < TRACK.length - 1) setBeat(b => b + 1);
      else setDone(true);
    }, DURATIONS[beat]);
    return () => clearTimeout(t);
  }, [beat, playing, done, analysis]);

  const accent = done ? C.green : ACCENT[beat];

  const replay = () => { setBeat(0); setDone(false); setPlaying(true); };
  const openAnalysis = () => { setAnalysis(true); setBeat(0); setDone(false); setPlaying(true); };

  // Helper bubbles around Noa (fixed angles, no randomness).
  const positioned = helpers.slice(0, 5).map((h, i) => {
    const ang = (-90 + i * (360 / Math.max(1, Math.min(5, helpers.length)))) * (Math.PI / 180);
    return { ...h, x: 50 + Math.cos(ang) * 36, y: 50 + Math.sin(ang) * 36 };
  });

  return (
    <div dir="ltr" style={{ padding: 14, color: C.text, display: "flex", flexDirection: "column", height: "100%", fontSize: 12 }}>
      {!analysis ? (
        /* ── STORY (Event Zero V2) — a human poster, understood in ~3s with ZERO
           numbers. Ask "what is she experiencing?" before "what are the metrics?".
           Everything quantitative (orientation, energy, community, helpers, matrix,
           diagnostics) lives behind "See Analysis". Reads like Netflix, not Excel. ── */
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-start", gap: 13, overflowY: "auto" }}>
          {/* 1 · HUMAN — the window, not the subject */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: "50%", background: `linear-gradient(135deg, ${C.purple}, ${C.red} 55%, ${C.green})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, fontWeight: 800, color: "#fff", boxShadow: "0 0 0 2px rgba(255,255,255,0.22)" }}>N</div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 0.3, lineHeight: 1 }}>{narrative.person}</div>
              <div style={{ fontSize: 9, letterSpacing: 2, color: C.purple, textTransform: "uppercase", marginTop: 4 }}>{narrative.title}</div>
            </div>
          </div>

          {/* 2 · EVENT — what happened */}
          <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.45, color: C.text }}>{narrative.event}</div>

          {/* 3 · BURDEN — concentration (← loadModel) */}
          <div style={{ fontSize: 13, color: "#cfe6f5", lineHeight: 1.65 }}>
            {narrative.concentrationLines.map((l, i) => <div key={i}>{l}</div>)}
          </div>

          {/* 4 · CONSEQUENCE — what deteriorated (← energyLeakage + orientationScore) */}
          <div style={{ fontSize: 12.5, lineHeight: 1.7 }}>
            <div style={{ color: "#9fc7df" }}>{narrative.consequenceLead}</div>
            {narrative.consequenceItems.map((l, i) => (
              <div key={i} style={{ color: C.orange, fontWeight: 600 }}>
                {l}{i < narrative.consequenceItems.length - 1 ? "," : "."}
              </div>
            ))}
          </div>

          {/* 5 · CAPACITY — the LAW, the emphasized core (← helpers vs burden) */}
          <div style={{ borderInlineStart: `4px solid ${C.cyan}`, background: "#06223a", borderRadius: 8, padding: "11px 13px" }}>
            <div style={{ fontSize: 11.5, color: C.borderSoft, marginBottom: 5 }}>{narrative.lawIntro}</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: C.cyan, lineHeight: 1.4 }}>{narrative.law}</div>
          </div>

          {/* 6 · REDISTRIBUTION — what can be done (← action) */}
          <div style={{ fontSize: 12.5, color: "#cfe6f5", lineHeight: 1.6 }}>
            <div style={{ color: C.borderSoft, marginBottom: 4 }}>Nexus identifies:</div>
            {narrative.identifies.map((l, i) => <div key={i}>• {l}</div>)}
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.green, lineHeight: 1.5 }}>{narrative.stabilization}</div>

          {/* Reveal — the only path to the numbers (7 · Measurement) */}
          <div style={{ display: "flex", flexDirection: "column", gap: 9, marginTop: 4 }}>
            <button onClick={openAnalysis} style={{ alignSelf: "flex-start", padding: "9px 18px", borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: "pointer", border: `1px solid ${C.borderSoft}`, background: "transparent", color: C.text }}>
              See Analysis →
            </button>
            {onContinue && (
              <button onClick={() => onContinue()} style={{ alignSelf: "flex-start", padding: "2px 2px", fontSize: 11, cursor: "pointer", border: "none", background: "transparent", color: C.borderSoft, textDecoration: "underline" }}>
                Continue to your map →
              </button>
            )}
          </div>
        </div>
      ) : (
        /* ── ANALYSIS — the diagnostic evidence (numbers), revealed on demand ── */
        <>
          <button onClick={() => setAnalysis(false)} style={{ alignSelf: "flex-start", marginBottom: 12, padding: "5px 12px", borderRadius: 6, fontSize: 11, cursor: "pointer", border: `1px solid ${C.borderSoft}`, background: "transparent", color: C.borderSoft }}>← Noa&apos;s story</button>

      {/* Tracker */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {TRACK.map((label, i) => {
          const filled = done || i <= beat;
          const active = !done && i === beat;
          return (
            <div key={label} style={{ flex: 1, textAlign: "center" }}>
              <div style={{
                height: 4, borderRadius: 2, marginBottom: 4,
                background: filled ? ACCENT[i] : C.muted,
                boxShadow: active ? `0 0 8px ${ACCENT[i]}` : "none",
                transition: "background .4s",
              }} />
              <div style={{ fontSize: 8, letterSpacing: 0.5, color: filled ? C.text : C.borderSoft }}>{label}</div>
            </div>
          );
        })}
      </div>

      {done ? (
        // ── Closing screen ──
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", textAlign: "center", gap: 14 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: C.green }}>
            That was one orientation, located.
          </div>
          <div style={{ fontSize: 12, color: "#9fc7df", lineHeight: 1.6 }}>
            Nexus began with the resistance — not a score.
          </div>
          <div style={{ fontSize: 10, color: C.borderSoft, letterSpacing: 1 }}>
            Resistance → Leakage → Support → Action → Orientation
          </div>
          <button onClick={() => onContinue?.()} style={{ alignSelf: "center", marginTop: 6, padding: "10px 28px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", border: `1px solid ${C.green}`, background: "#0c3a2c", color: C.green }}>
            Continue
          </button>
          <div style={{ fontSize: 10, color: C.borderSoft }}>This was Noa. Next, Nexus will map you.</div>
          <button onClick={replay} style={{ alignSelf: "center", marginTop: 4, padding: "5px 14px", borderRadius: 6, fontSize: 10, cursor: "pointer", border: `1px solid ${C.borderSoft}`, background: "transparent", color: C.text }}>↻ Replay</button>
        </div>
      ) : (
        <>
          {/* Question */}
          <div style={{ fontSize: 17, fontWeight: 800, color: accent, transition: "color .5s", marginBottom: 12 }}>
            {QUESTION[beat]}
          </div>

          {/* Focal visual per beat */}
          <div style={{ background: "radial-gradient(circle at 50% 40%, #07182b 0%, #030f1e 75%)", border: `1px solid ${C.border}`, borderRadius: 10, padding: 12, marginBottom: 12, minHeight: 190, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {beat === 0 && (
              <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 6 }}>
                {fields.map(f => {
                  const isMax = f.name === resistanceName;
                  return (
                    <div key={f.name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 150, fontSize: 9, color: isMax ? C.red : C.borderSoft, textAlign: "right", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.name}</div>
                      <div style={{ flex: 1, height: 8, background: "#0a1a2e", borderRadius: 4, overflow: "hidden" }}>
                        <div style={{ width: `${f.intensity}%`, height: "100%", background: isMax ? C.red : C.borderSoft, borderRadius: 4, animation: isMax ? "pulse 1.1s ease-in-out infinite" : "none" }} />
                      </div>
                      <div style={{ width: 22, fontSize: 9, fontWeight: 700, color: isMax ? C.red : C.borderSoft }}>{f.intensity}</div>
                    </div>
                  );
                })}
              </div>
            )}
            {beat === 1 && (
              <div style={{ width: "100%", textAlign: "center" }}>
                <div style={{ fontSize: 42, fontWeight: 800, color: C.orange }}>{leakage}</div>
                <div style={{ fontSize: 9, color: C.borderSoft, letterSpacing: 2, marginBottom: 12 }}>ENERGY LEAKAGE</div>
                <div style={{ height: 12, background: "#0a1a2e", borderRadius: 6, overflow: "hidden" }}>
                  <div style={{ width: `${leakage}%`, height: "100%", background: `linear-gradient(90deg, ${C.red}, ${C.orange})`, borderRadius: 6, transition: "width 1s ease" }} />
                </div>
              </div>
            )}
            {(beat === 2) && (
              <div style={{ position: "relative", width: 180, height: 160 }}>
                <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.55 }}>
                  {positioned.map((p, i) => <line key={i} x1="50%" y1="50%" x2={`${p.x}%`} y2={`${p.y}%`} stroke={C.cyan} strokeWidth="1" />)}
                </svg>
                {positioned.map((p, i) => (
                  <div key={i} title={p.name} style={{ position: "absolute", left: `${p.x}%`, top: `${p.y}%`, transform: "translate(-50%,-50%)", width: 30, height: 30, borderRadius: "50%", background: "#06223a", border: `1px solid ${C.cyan}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 7, color: C.text, textAlign: "center", animation: `fadeIn .5s ${i * 0.12}s both` }}>{p.name.split(" ")[0]}</div>
                ))}
                <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: 50, height: 50, borderRadius: "50%", background: "#0c2c3a", border: `2px solid ${C.cyan}`, boxShadow: `0 0 16px ${C.cyan}66`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800 }}>Noa</div>
              </div>
            )}
            {beat === 3 && (
              <div style={{ width: "90%", border: `1px solid ${C.cyan}`, borderRadius: 10, padding: 14, background: "#06223a" }}>
                <div style={{ fontSize: 9, color: C.borderSoft, letterSpacing: 2 }}>RECOMMENDED ACTION</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: C.cyan, margin: "4px 0 10px" }}>{cap(actName)} → {actDim}</div>
                <div style={{ display: "flex", gap: 14, fontSize: 12 }}>
                  <span style={{ color: C.green }}>+{dE} Energy</span>
                  <span style={{ color: C.green }}>−{dL} Load</span>
                  <span style={{ color: C.green }}>+{dO} Orientation</span>
                </div>
              </div>
            )}
            {beat === 4 && (
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 52, fontWeight: 800, color: C.green }}>{orientation}<span style={{ fontSize: 18, color: C.borderSoft }}>/100</span></div>
                <div style={{ fontSize: 13, color: C.green, fontWeight: 700, letterSpacing: 1 }}>First Stabilization</div>
              </div>
            )}
          </div>

          {/* Copy */}
          <div style={{ flex: 1, fontSize: 12.5, lineHeight: 1.6, background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, padding: "10px 12px" }}>
            {COPY[beat]}
          </div>

          {/* Controls */}
          <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center" }}>
            <button onClick={() => setPlaying(p => !p)} style={ctrlBtn()}>{playing ? "⏸ Pause" : "▶ Play"}</button>
            <button onClick={() => { if (beat < TRACK.length - 1) setBeat(b => b + 1); else setDone(true); }} style={ctrlBtn()}>Next ▶</button>
            <button onClick={() => setDone(true)} style={{ ...ctrlBtn(), flex: 0, padding: "8px 12px", color: C.borderSoft }}>Skip</button>
          </div>
        </>
      )}
        </>
      )}

      <style>{`
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: .45; } }
        @keyframes fadeIn { from { opacity: 0; transform: translate(-50%,-50%) scale(.4); } to { opacity: 1; transform: translate(-50%,-50%) scale(1); } }
      `}</style>
    </div>
  );
}

function cap(s: string): string { return s.charAt(0).toUpperCase() + s.slice(1); }
function ctrlBtn(): React.CSSProperties {
  return { flex: 1, padding: "8px 0", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", border: `1px solid ${C.borderSoft}`, background: "transparent", color: C.text };
}
