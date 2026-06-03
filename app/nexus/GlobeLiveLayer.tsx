"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { loadNodes, FORCE_COLOR, FORCE_LABEL, CONTEXT_LABEL, type UserNode } from "../lib/philos";
import { loadProofs, OPPORTUNITY_DEFS } from "../lib/proof";
import { generateSeedNodes } from "../lib/seed";
import { deriveNeeds, NEED_LABEL } from "../lib/need";
import { generateAllOpportunities, OPPORTUNITY_TYPE_LABEL, OPPORTUNITY_TYPE_COLOR } from "../lib/opportunity";

// ─── Demo activity library ────────────────────────────────────────────

const DEMO_ACTIONS = [
  "עזר לחבר לפתור בעיה",  "סיים פרויקט קשה",   "למד דבר חדש",
  "חיבר שני אנשים",        "הגיש הוכחה",         "קיבל אימות",
  "פתח הזדמנות חדשה",      "תמך במישהו בדרכו",   "שיתף ידע",
  "יצר קשר חשוב",          "שיפר תהליך",          "קיבל הכרה",
  "הניע פרויקט קדימה",     "פתר קונפליקט",        "תרם לקהילה",
];

const FREQ_LABELS = [396, 417, 528, 639, 741, 852, 963];
const FREQ_NAMES  = ["ביטחון", "שינוי", "אהבה", "חיבור", "ביטוי", "אינטואיציה", "אחדות"];

// ─── Activity item ────────────────────────────────────────────────────

interface ActivityItem {
  node:    UserNode;
  action:  string;
  domain:  string;
  ago:     string;
  trust:   number;
}

// ─── Component ───────────────────────────────────────────────────────

interface Props {
  proofTrustMap: Record<string, number>;
}

export default function GlobeLiveLayer({ proofTrustMap }: Props) {
  const [nodes,     setNodes]     = useState<UserNode[]>([]);
  const [tick,      setTick]      = useState(0);
  const [freqIdx,   setFreqIdx]   = useState(0);
  const [pulse,     setPulse]     = useState({ energy: 0, trust: 0 });
  const [highlight, setHighlight] = useState<number | null>(null);

  useEffect(() => {
    const real = loadNodes();
    setNodes(real.length > 0 ? real : generateSeedNodes());
  }, []);

  // Rotate activity every 2.8s
  useEffect(() => {
    const t = setInterval(() => setTick(i => i + 1), 2800);
    return () => clearInterval(t);
  }, []);

  // Cycle frequency every 4s
  useEffect(() => {
    const t = setInterval(() => setFreqIdx(i => (i + 1) % FREQ_LABELS.length), 4000);
    return () => clearInterval(t);
  }, []);

  // Pulse values
  useEffect(() => {
    if (!nodes.length) return;
    const energy = Math.round(nodes.reduce((s, n) => s + n.intensity, 0) / nodes.length * 10);
    const trust  = Math.round(nodes.reduce((s, n) => s + (proofTrustMap[n.id] ?? n.trustScore), 0) / nodes.length);
    setPulse({ energy, trust });
  }, [nodes, proofTrustMap]);

  // Generate rolling activity feed
  const activities: ActivityItem[] = useMemo(() => {
    if (!nodes.length) return [];
    return nodes.map((n, i) => ({
      node:   n,
      action: DEMO_ACTIONS[(i + tick) % DEMO_ACTIONS.length],
      domain: CONTEXT_LABEL[n.context],
      ago:    tick % 5 === i % 5 ? "עכשיו" : `${((i * 3 + tick) % 12) + 1}ד'`,
      trust:  proofTrustMap[n.id] ?? n.trustScore,
    }));
  }, [nodes, tick, proofTrustMap]);

  // Pick 4 visible activity cards (rotating)
  const visible4 = useMemo(() =>
    activities.slice(tick % Math.max(activities.length - 4, 1), (tick % Math.max(activities.length - 4, 1)) + 4),
    [activities, tick]
  );

  // Opportunities
  const opps = useMemo(() =>
    generateAllOpportunities(nodes, proofTrustMap, 3),
    [nodes, proofTrustMap]
  );

  // "What changes your path today" — top opportunity for profile user or highest score
  const topOpp = opps[0] ?? null;

  // Force distribution
  const forceDist = useMemo(() => {
    const fd: Record<string, number> = {};
    nodes.forEach(n => { fd[n.dominantForce] = (fd[n.dominantForce] || 0) + 1; });
    return Object.entries(fd).sort((a, b) => b[1] - a[1]).slice(0, 3);
  }, [nodes]);

  if (!nodes.length) return null;

  return (
    <>
      {/* ── Activity stream: bottom-left floating cards ── */}
      <div style={{
        position: "absolute", bottom: 110, left: 16, zIndex: 6,
        display: "flex", flexDirection: "column", gap: 5,
        maxWidth: 230, pointerEvents: "none",
      }}>
        {visible4.slice(0, 3).map((a, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "5px 9px",
            background: "rgba(2,13,26,0.82)",
            backdropFilter: "blur(8px)",
            border: `1px solid ${FORCE_COLOR[a.node.dominantForce]}44`,
            borderRadius: 20,
            animation: `fadeIn .4s ease`,
          }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: FORCE_COLOR[a.node.dominantForce], flexShrink: 0 }} />
            <div style={{ flex: 1, fontSize: 10, color: "#caf0f8", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
              <b>{a.node.name.split(" ")[0]}</b> {a.action}
            </div>
            <div style={{ fontSize: 8, color: "#1e4060", flexShrink: 0 }}>{a.ago}</div>
          </div>
        ))}
      </div>

      {/* ── Energy + Frequency ring: top-center ── */}
      <div style={{
        position: "absolute", top: 50, left: "50%",
        transform: "translateX(-50%)",
        zIndex: 6, pointerEvents: "none",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
      }}>
        <div style={{
          display: "flex", gap: 14,
          padding: "5px 16px",
          background: "rgba(2,13,26,0.80)",
          backdropFilter: "blur(8px)",
          border: "1px solid #0a2a4a",
          borderRadius: 20,
        }}>
          <span style={{ fontSize: 9, color: "#fbbf24" }}>⚡ {pulse.energy}</span>
          <span style={{ fontSize: 9, color: "#34d399" }}>⬡ {pulse.trust}</span>
          <span style={{ fontSize: 9, color: "#38bdf8" }}>
            {FREQ_LABELS[freqIdx]}hz · {FREQ_NAMES[freqIdx]}
          </span>
        </div>
        {/* Dominant forces */}
        <div style={{ display: "flex", gap: 6 }}>
          {forceDist.map(([f, c]) => (
            <div key={f} style={{ fontSize: 8, padding: "2px 7px", borderRadius: 10, background: FORCE_COLOR[f as keyof typeof FORCE_COLOR] + "22", color: FORCE_COLOR[f as keyof typeof FORCE_COLOR], border: `1px solid ${FORCE_COLOR[f as keyof typeof FORCE_COLOR]}44` }}>
              {FORCE_LABEL[f as keyof typeof FORCE_LABEL]} {Math.round((c / nodes.length) * 100)}%
            </div>
          ))}
        </div>
      </div>

      {/* ── "What changes your path" — right side float ── */}
      {topOpp && (
        <div style={{
          position: "absolute", top: "30%", right: 356,
          zIndex: 6, maxWidth: 200,
          background: "rgba(2,13,26,0.86)",
          backdropFilter: "blur(10px)",
          border: `1px solid ${OPPORTUNITY_TYPE_COLOR[topOpp.type]}55`,
          borderRadius: 8,
          padding: "10px 12px",
          pointerEvents: "none",
        }}>
          <div style={{ fontSize: 8, color: OPPORTUNITY_TYPE_COLOR[topOpp.type], letterSpacing: 2, textTransform: "uppercase", marginBottom: 5 }}>
            ↝ מה ישנה את המסלול
          </div>
          <div style={{ fontSize: 10, color: "#caf0f8", fontWeight: 600, marginBottom: 4 }}>
            {topOpp.provider.name}
          </div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 5 }}>
            {topOpp.matchedNeeds.map(n => (
              <span key={n} style={{ fontSize: 8, padding: "1px 5px", borderRadius: 8, background: "#34d39922", color: "#34d399" }}>{NEED_LABEL[n]}</span>
            ))}
          </div>
          <div style={{ fontSize: 8, color: "#1e4060" }}>
            {OPPORTUNITY_TYPE_LABEL[topOpp.type]} · {topOpp.score}% התאמה
          </div>
        </div>
      )}

      {/* ── Parallel opportunities — bottom-right of globe ── */}
      {opps.length > 1 && (
        <div style={{
          position: "absolute", bottom: 110, right: 356,
          zIndex: 6,
          display: "flex", flexDirection: "column", gap: 4,
          pointerEvents: "none",
          maxWidth: 190,
        }}>
          <div style={{ fontSize: 8, color: "#1e4060", letterSpacing: 2, textTransform: "uppercase", marginBottom: 2 }}>הזדמנויות מקבילות</div>
          {opps.slice(1, 4).map((o, i) => {
            const col = OPPORTUNITY_TYPE_COLOR[o.type];
            return (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "4px 9px",
                background: "rgba(2,13,26,0.82)",
                backdropFilter: "blur(6px)",
                border: `1px solid ${col}44`,
                borderRadius: 16,
              }}>
                <span style={{ fontSize: 8, padding: "1px 5px", borderRadius: 3, background: col + "22", color: col }}>{OPPORTUNITY_TYPE_LABEL[o.type]}</span>
                <span style={{ fontSize: 9, color: "#caf0f8", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.provider.name}</span>
                <span style={{ fontSize: 9, color: col, fontWeight: 700 }}>{o.score}%</span>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Systemic rotation label: bottom-center ── */}
      <div style={{
        position: "absolute", bottom: 72, left: "50%",
        transform: "translateX(-50%)",
        zIndex: 6, pointerEvents: "none",
        fontSize: 8, color: "#1e4060", letterSpacing: 2,
      }}>
        {nodes.length} nodes · {FREQ_LABELS[freqIdx]}hz · רוטציה מערכתית
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateX(-8px); } to { opacity: 1; transform: translateX(0); } }
      `}</style>
    </>
  );
}
