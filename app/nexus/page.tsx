"use client";

// fix applied: need.ts deriveNeeds now uses ?. on FORCE_OFFERS / FORCE_NEEDS_STUCK
// testing with full allNodes — no artificial cap

import { useEffect, useMemo, useState } from "react";
import { loadNodes, type UserNode } from "../lib/philos";
import { loadProfile } from "../lib/profile";
import { computeNeedFits } from "../lib/need";

export default function Page() {
  const [allNodes, setAllNodes] = useState<UserNode[]>([]);
  const [profile,  setProfile]  = useState<ReturnType<typeof loadProfile>>(null);

  useEffect(() => {
    setAllNodes(loadNodes());
    setProfile(loadProfile());
  }, []);

  const needFits = useMemo(() => computeNeedFits(allNodes).slice(0, 3), [allNodes]);

  return (
    <div style={{ display: "flex", width: "100vw", height: "100vh", background: "#020d1a", color: "#e0f2fe", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ flex: 1, display: "grid", placeItems: "center" }}>
        <div style={{ color: "#1e4060", fontSize: 12, letterSpacing: 2 }}>fix test: computeNeedFits full allNodes</div>
        <div style={{ marginTop: 12, fontSize: 11, color: "#8bb8cc" }}>
          nodes: {allNodes.length} · fits: {needFits.length} · profile: {profile ? profile.name : "none"}
        </div>
      </div>
      <div style={{ width: 320, background: "#030f1e", borderLeft: "1px solid #0a2a4a", padding: 20 }}>
        <div style={{ fontSize: 13, letterSpacing: 4, color: "#38bdf8", fontWeight: 700 }}>PHILOS · NEXUS</div>
        <div style={{ marginTop: 8, fontSize: 10, color: "#1e4060" }}>{allNodes.length} nodes · {needFits.length} fits</div>
        {needFits.map((f, i) => (
          <div key={i} style={{ marginTop: 6, fontSize: 10, color: "#8bb8cc" }}>{f.a.name} ↔ {f.b.name}</div>
        ))}
      </div>
    </div>
  );
}
