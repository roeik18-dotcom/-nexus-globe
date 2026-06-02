"use client";

// diagnostic step 2f: computeNeedFits called with hard cap of 5 nodes
// isolates: does crash require volume (18 nodes) or even small input?

import { useEffect, useMemo, useState } from "react";
import { loadNodes, type UserNode } from "../lib/philos";
import { loadProfile } from "../lib/profile";
import { computeNeedFits } from "../lib/need";

const MAX_NODES = 5; // hard cap — 5 nodes = max 10 pairs

export default function Page() {
  const [allNodes, setAllNodes] = useState<UserNode[]>([]);
  const [profile,  setProfile]  = useState<ReturnType<typeof loadProfile>>(null);

  useEffect(() => {
    setAllNodes(loadNodes());
    setProfile(loadProfile());
  }, []);

  const needFits = useMemo(
    () => computeNeedFits(allNodes.slice(0, MAX_NODES)).slice(0, 3),
    [allNodes]
  );

  return (
    <div style={{ display: "flex", width: "100vw", height: "100vh", background: "#020d1a", color: "#e0f2fe", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ flex: 1, display: "grid", placeItems: "center" }}>
        <div style={{ color: "#1e4060", fontSize: 12, letterSpacing: 2 }}>bisect: computeNeedFits capped at {MAX_NODES} nodes</div>
        <div style={{ marginTop: 12, fontSize: 11, color: "#8bb8cc" }}>
          total nodes: {allNodes.length} · capped to: {Math.min(allNodes.length, MAX_NODES)} · fits: {needFits.length}
        </div>
      </div>
      <div style={{ width: 320, background: "#030f1e", borderLeft: "1px solid #0a2a4a", padding: 20 }}>
        <div style={{ fontSize: 13, letterSpacing: 4, color: "#38bdf8", fontWeight: 700 }}>PHILOS · NEXUS</div>
        <div style={{ marginTop: 8, fontSize: 10, color: "#1e4060" }}>{allNodes.length} nodes (using first {MAX_NODES})</div>
        {needFits.map((f, i) => (
          <div key={i} style={{ marginTop: 6, fontSize: 10, color: "#8bb8cc" }}>{f.a.name} ↔ {f.b.name}</div>
        ))}
      </div>
    </div>
  );
}
