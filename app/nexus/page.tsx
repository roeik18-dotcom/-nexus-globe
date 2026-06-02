"use client";

// diagnostic step 2b: bisect — stress.ts and topics.ts removed

import { useEffect, useMemo, useState } from "react";
import { loadNodes, buildLinks, type UserNode } from "../lib/philos";
import { loadProfile } from "../lib/profile";
import { computeDailySummary } from "../lib/daily";
import { computeMatches } from "../lib/match";
import { computeNeedFits } from "../lib/need";
// import { aggregateStress } from "../lib/stress";       // DISABLED
// import { ... } from "../lib/topics";                    // DISABLED
import { generateSeedNodes } from "../lib/seed";

export default function Page() {
  const [allNodes, setAllNodes] = useState<UserNode[]>([]);
  const [profile,  setProfile]  = useState<ReturnType<typeof loadProfile>>(null);

  useEffect(() => {
    setAllNodes(loadNodes());
    setProfile(loadProfile());
  }, []);

  const links    = useMemo(() => buildLinks(allNodes), [allNodes]);
  const daily    = useMemo(() => computeDailySummary(allNodes), [allNodes]);
  const matches  = useMemo(() => computeMatches(allNodes, profile).slice(0, 3), [allNodes, profile]);
  const needFits = useMemo(() => computeNeedFits(allNodes).slice(0, 3), [allNodes]);

  return (
    <div style={{ display: "flex", width: "100vw", height: "100vh", background: "#020d1a", color: "#e0f2fe", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ flex: 1, position: "relative", display: "grid", placeItems: "center" }}>
        <div style={{ color: "#1e4060", fontSize: 12, letterSpacing: 2 }}>bisect: stress + topics DISABLED</div>

        <div style={{
          position: "absolute", top: 20, left: 20, right: 340, zIndex: 5,
          background: "rgba(3,15,30,0.85)", border: "1px solid #0a2a4a55",
          borderRadius: 8, padding: "14px 18px", pointerEvents: "none",
        }}>
          <div style={{ fontSize: 9, letterSpacing: 3, color: "#38bdf8", textTransform: "uppercase", marginBottom: 6 }}>
            bisect · stress+topics off
          </div>
          <div style={{ display: "flex", gap: 20, fontSize: 11 }}>
            <span>nodes: <b style={{ color: "#00f5d4" }}>{allNodes.length}</b></span>
            <span>links: <b style={{ color: "#38bdf8" }}>{links.length}</b></span>
            <span>matches: <b style={{ color: "#fbbf24" }}>{matches.length}</b></span>
            <span>need fits: <b style={{ color: "#a78bfa" }}>{needFits.length}</b></span>
          </div>
        </div>
      </div>

      <div style={{ width: 320, background: "#030f1e", borderLeft: "1px solid #0a2a4a", padding: 20, overflowY: "auto" }}>
        <div style={{ fontSize: 13, letterSpacing: 4, color: "#38bdf8", fontWeight: 700, marginBottom: 4 }}>PHILOS · NEXUS</div>
        <div style={{ fontSize: 10, color: "#1e4060", marginBottom: 18 }}>{allNodes.length} nodes · {links.length} links</div>

        <div style={{ padding: 12, border: "1px solid #0a2a4a", borderRadius: 6, background: "#040e1c", marginBottom: 16 }}>
          <div style={{ fontSize: 9, color: "#1e4060", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>daily</div>
          <div style={{ fontSize: 10, color: "#8bb8cc" }}>avg intensity: <b>{daily.avgIntensity.toFixed(1)}</b></div>
          <div style={{ fontSize: 10, color: "#8bb8cc" }}>forward: <b>{Math.round(daily.forwardRatio * 100)}%</b></div>
        </div>

        <div style={{ padding: 12, border: "1px solid #0a2a4a", borderRadius: 6, background: "#040e1c", marginBottom: 16 }}>
          <div style={{ fontSize: 9, color: "#1e4060", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>matches</div>
          {matches.length === 0
            ? <div style={{ fontSize: 10, color: "#1e4060" }}>—</div>
            : matches.map((m, i) => <div key={i} style={{ fontSize: 10, color: "#8bb8cc", marginBottom: 4 }}>{m.a.name} ↔ {m.b.name}</div>)
          }
        </div>

        <div style={{ padding: 12, border: "1px solid #0a2a4a", borderRadius: 6, background: "#040e1c", marginBottom: 16 }}>
          <div style={{ fontSize: 9, color: "#1e4060", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>need fits</div>
          {needFits.length === 0
            ? <div style={{ fontSize: 10, color: "#1e4060" }}>—</div>
            : needFits.map((f, i) => <div key={i} style={{ fontSize: 10, color: "#8bb8cc", marginBottom: 4 }}>{f.a.name} ↔ {f.b.name}</div>)
          }
        </div>

        <button
          onClick={() => { generateSeedNodes().forEach(n => { import("../lib/philos").then(({ saveNode }) => saveNode(n)); }); setTimeout(() => setAllNodes(loadNodes()), 50); }}
          style={{ width: "100%", padding: "8px 10px", fontSize: 10, color: "#a78bfa", background: "transparent", border: "1px dashed #a78bfa66", borderRadius: 6, cursor: "pointer" }}
        >+ זרע דמו</button>
        <div style={{ marginTop: 12 }}>
          <a href="/" style={{ display: "block", textAlign: "center", padding: "10px 12px", fontSize: 11, color: "#020d1a", fontWeight: 700, background: "linear-gradient(135deg,#00f5d4,#38bdf8)", borderRadius: 6, textDecoration: "none" }}>ניתוח חדש</a>
        </div>
      </div>
    </div>
  );
}
