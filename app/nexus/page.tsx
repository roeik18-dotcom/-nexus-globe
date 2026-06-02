"use client";

// diagnostic step 2: data layer only — no react-globe.gl, no WebGL canvas

import { useEffect, useMemo, useState } from "react";
import { loadNodes, buildLinks, type UserNode } from "../lib/philos";
import { loadProfile } from "../lib/profile";
import { computeDailySummary } from "../lib/daily";
import { computeMatches } from "../lib/match";
import { computeNeedFits } from "../lib/need";
import { aggregateStress } from "../lib/stress";
import { SEED_TOPICS, loadStances, computeEdges, systemStress } from "../lib/topics";
import { generateSeedNodes } from "../lib/seed";

export default function Page() {
  const [allNodes, setAllNodes] = useState<UserNode[]>([]);
  const [profile,  setProfile]  = useState<ReturnType<typeof loadProfile>>(null);
  const [stances,  setStances]  = useState<ReturnType<typeof loadStances>>([]);

  useEffect(() => {
    setAllNodes(loadNodes());
    setProfile(loadProfile());
    setStances(loadStances());
  }, []);

  const links       = useMemo(() => buildLinks(allNodes), [allNodes]);
  const daily       = useMemo(() => computeDailySummary(allNodes), [allNodes]);
  const matches     = useMemo(() => computeMatches(allNodes, profile).slice(0, 3), [allNodes, profile]);
  const needFits    = useMemo(() => computeNeedFits(allNodes).slice(0, 3), [allNodes]);
  const stressAgg   = useMemo(() => aggregateStress(allNodes), [allNodes]);
  const topTopic    = SEED_TOPICS[0];
  const topicEdges  = useMemo(() => computeEdges(topTopic, stances), [stances]);
  const topicStress = useMemo(() => systemStress(topicEdges), [topicEdges]);

  return (
    <div style={{ display: "flex", width: "100vw", height: "100vh", background: "#020d1a", color: "#e0f2fe", fontFamily: "system-ui, sans-serif" }}>

      {/* ── Main area ── */}
      <div style={{ flex: 1, position: "relative", display: "grid", placeItems: "center" }}>
        <div style={{ color: "#1e4060", fontSize: 12, letterSpacing: 2 }}>GLOBE PLACEHOLDER — data layer active</div>

        {/* Top overlay */}
        <div style={{
          position: "absolute", top: 20, left: 20, right: 340, zIndex: 5,
          background: "rgba(3,15,30,0.85)", border: "1px solid #0a2a4a55",
          backdropFilter: "blur(8px)", borderRadius: 8, padding: "14px 18px",
          pointerEvents: "none",
        }}>
          <div style={{ fontSize: 9, letterSpacing: 3, color: "#38bdf8", textTransform: "uppercase", marginBottom: 6 }}>
            diagnostic · data layer
          </div>
          <div style={{ display: "flex", gap: 20, fontSize: 11 }}>
            <span>nodes: <b style={{ color: "#00f5d4" }}>{allNodes.length}</b></span>
            <span>links: <b style={{ color: "#38bdf8" }}>{links.length}</b></span>
            <span>matches: <b style={{ color: "#fbbf24" }}>{matches.length}</b></span>
            <span>need fits: <b style={{ color: "#a78bfa" }}>{needFits.length}</b></span>
          </div>
        </div>

        {/* Bottom-left: stress summary */}
        <div style={{
          position: "absolute", bottom: 20, left: 20, zIndex: 5,
          background: "rgba(3,15,30,0.85)", border: "1px solid #0a2a4a",
          backdropFilter: "blur(8px)", borderRadius: 8, padding: "10px 14px",
        }}>
          <div style={{ fontSize: 9, color: "#1e4060", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>Stress aggregate</div>
          <div style={{ fontSize: 10, color: "#8bb8cc" }}>conflict: <b style={{ color: "#fb923c" }}>{stressAgg.average.conflict}</b></div>
          <div style={{ fontSize: 10, color: "#8bb8cc" }}>harmRisk: <b style={{ color: "#ef4444" }}>{stressAgg.average.harmRisk}</b></div>
          <div style={{ fontSize: 10, color: "#8bb8cc" }}>prosocial: <b style={{ color: "#22c55e" }}>{stressAgg.average.prosocialValue}</b></div>
          <div style={{ fontSize: 10, color: "#8bb8cc", marginTop: 4 }}>topic stress: <b style={{ color: topicStress > 0.5 ? "#ef4444" : "#22c55e" }}>{(topicStress * 100).toFixed(0)}%</b></div>
        </div>
      </div>

      {/* ── Side panel ── */}
      <div style={{ width: 320, background: "#030f1e", borderLeft: "1px solid #0a2a4a", padding: 20, overflowY: "auto" }}>
        <div style={{ fontSize: 13, letterSpacing: 4, color: "#38bdf8", fontWeight: 700, marginBottom: 4 }}>
          PHILOS · NEXUS
        </div>
        <div style={{ fontSize: 10, color: "#1e4060", letterSpacing: 2, textTransform: "uppercase", marginBottom: 18 }}>
          {allNodes.length} nodes · {links.length} links
        </div>

        {/* Daily summary */}
        <div style={{ padding: 12, border: "1px solid #0a2a4a", borderRadius: 6, background: "#040e1c", marginBottom: 16 }}>
          <div style={{ fontSize: 9, color: "#1e4060", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>סיכום יום</div>
          <div style={{ fontSize: 10, color: "#8bb8cc" }}>avg intensity: <b style={{ color: "#e0f2fe" }}>{daily.avgIntensity.toFixed(1)}</b></div>
          <div style={{ fontSize: 10, color: "#8bb8cc" }}>forward: <b style={{ color: "#e0f2fe" }}>{Math.round(daily.forwardRatio * 100)}%</b></div>
          <div style={{ fontSize: 10, color: "#8bb8cc" }}>links created: <b style={{ color: "#e0f2fe" }}>{daily.linksCreated}</b></div>
        </div>

        {/* Top topic */}
        <div style={{ padding: 12, border: "1px solid #0a2a4a", borderRadius: 6, background: "#040e1c", marginBottom: 16 }}>
          <div style={{ fontSize: 9, color: "#1e4060", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>Top topic</div>
          <div style={{ fontSize: 11, color: topTopic.color, fontWeight: 700 }}>{topTopic.title}</div>
          <div style={{ fontSize: 10, color: "#8bb8cc", marginTop: 4 }}>edges: {topicEdges.length} · stress: {(topicStress * 100).toFixed(0)}%</div>
        </div>

        {/* Matches */}
        <div style={{ padding: 12, border: "1px solid #0a2a4a", borderRadius: 6, background: "#040e1c", marginBottom: 16 }}>
          <div style={{ fontSize: 9, color: "#1e4060", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>Matches</div>
          {matches.length === 0
            ? <div style={{ fontSize: 10, color: "#1e4060" }}>—</div>
            : matches.map((m, i) => (
              <div key={i} style={{ fontSize: 10, color: "#8bb8cc", marginBottom: 4 }}>
                {m.a.name} ↔ {m.b.name} · <b style={{ color: "#fbbf24" }}>{m.urgency}</b>
              </div>
            ))
          }
        </div>

        {/* Need fits */}
        <div style={{ padding: 12, border: "1px solid #0a2a4a", borderRadius: 6, background: "#040e1c", marginBottom: 16 }}>
          <div style={{ fontSize: 9, color: "#1e4060", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>Need fits</div>
          {needFits.length === 0
            ? <div style={{ fontSize: 10, color: "#1e4060" }}>—</div>
            : needFits.map((f, i) => (
              <div key={i} style={{ fontSize: 10, color: "#8bb8cc", marginBottom: 4 }}>
                {f.a.name} ↔ {f.b.name} · <b style={{ color: "#a78bfa" }}>{f.bidirectional ? "הדדי" : "חד-צדדי"}</b>
              </div>
            ))
          }
        </div>

        {/* Seed button */}
        <button
          onClick={() => {
            generateSeedNodes().forEach(n => {
              import("../lib/philos").then(({ saveNode }) => saveNode(n));
            });
            setTimeout(() => setAllNodes(loadNodes()), 50);
          }}
          style={{
            width: "100%", padding: "8px 10px", fontSize: 10, letterSpacing: 2,
            color: "#a78bfa", background: "transparent",
            border: "1px dashed #a78bfa66", borderRadius: 6, cursor: "pointer",
          }}
        >
          + זרע דמו
        </button>

        <div style={{ marginTop: 12 }}>
          <a href="/" style={{
            display: "block", textAlign: "center",
            padding: "10px 12px", fontSize: 11, letterSpacing: 2,
            color: "#020d1a", fontWeight: 700,
            background: "linear-gradient(135deg,#00f5d4,#38bdf8)",
            borderRadius: 6, textDecoration: "none",
          }}>
            ניתוח חדש
          </a>
        </div>
      </div>
    </div>
  );
}
