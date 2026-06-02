"use client";

// diagnostic step 2e: need.ts imported, computeNeedFits NOT called
// isolates: module-load vs runtime-execution

import { useEffect, useState } from "react";
import { loadNodes, type UserNode } from "../lib/philos";
import { loadProfile } from "../lib/profile";
import { NEED_LABEL } from "../lib/need"; // import only — computeNeedFits NOT called

export default function Page() {
  const [allNodes, setAllNodes] = useState<UserNode[]>([]);
  const [profile,  setProfile]  = useState<ReturnType<typeof loadProfile>>(null);

  useEffect(() => {
    setAllNodes(loadNodes());
    setProfile(loadProfile());
  }, []);

  return (
    <div style={{ display: "flex", width: "100vw", height: "100vh", background: "#020d1a", color: "#e0f2fe", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ flex: 1, display: "grid", placeItems: "center" }}>
        <div style={{ color: "#1e4060", fontSize: 12, letterSpacing: 2 }}>bisect: need.ts imported, computeNeedFits NOT called</div>
        <div style={{ marginTop: 12, fontSize: 11, color: "#8bb8cc" }}>
          nodes: {allNodes.length} · profile: {profile ? profile.name : "none"}
        </div>
        <div style={{ marginTop: 8, fontSize: 10, color: "#1e4060" }}>
          NEED_LABEL check: {NEED_LABEL.momentum}
        </div>
      </div>
      <div style={{ width: 320, background: "#030f1e", borderLeft: "1px solid #0a2a4a", padding: 20 }}>
        <div style={{ fontSize: 13, letterSpacing: 4, color: "#38bdf8", fontWeight: 700 }}>PHILOS · NEXUS</div>
        <div style={{ marginTop: 8, fontSize: 10, color: "#1e4060" }}>{allNodes.length} nodes</div>
      </div>
    </div>
  );
}
