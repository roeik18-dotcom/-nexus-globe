"use client";

// diagnostic step 2c: bisect — philos + profile only

import { useEffect, useState } from "react";
import { loadNodes, buildLinks, type UserNode } from "../lib/philos";
import { loadProfile } from "../lib/profile";
// import { computeDailySummary } from "../lib/daily";   // DISABLED
// import { computeMatches } from "../lib/match";        // DISABLED
// import { computeNeedFits } from "../lib/need";        // DISABLED
// import { generateSeedNodes } from "../lib/seed";      // DISABLED

export default function Page() {
  const [allNodes, setAllNodes] = useState<UserNode[]>([]);
  const [profile,  setProfile]  = useState<ReturnType<typeof loadProfile>>(null);

  useEffect(() => {
    setAllNodes(loadNodes());
    setProfile(loadProfile());
  }, []);

  const links = buildLinks(allNodes);

  return (
    <div style={{ display: "flex", width: "100vw", height: "100vh", background: "#020d1a", color: "#e0f2fe", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ flex: 1, display: "grid", placeItems: "center" }}>
        <div style={{ color: "#1e4060", fontSize: 12, letterSpacing: 2 }}>bisect: philos + profile only</div>
        <div style={{ marginTop: 12, fontSize: 11, color: "#8bb8cc" }}>
          nodes: {allNodes.length} · links: {links.length} · profile: {profile ? profile.name : "none"}
        </div>
      </div>
      <div style={{ width: 320, background: "#030f1e", borderLeft: "1px solid #0a2a4a", padding: 20 }}>
        <div style={{ fontSize: 13, letterSpacing: 4, color: "#38bdf8", fontWeight: 700 }}>PHILOS · NEXUS</div>
        <div style={{ marginTop: 8, fontSize: 10, color: "#1e4060" }}>{allNodes.length} nodes · {links.length} links</div>
      </div>
    </div>
  );
}
