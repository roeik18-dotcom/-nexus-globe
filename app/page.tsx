"use client";

import GlobeView from "./globe/GlobeView";
import { useGraphData } from "./graph/useGraphData";
import { useState } from "react";

export default function Page() {
  const data = useGraphData();

  const [result, setResult] = useState<any>(null);

  async function analyze() {
    const res = await fetch("/api/analyze", { method: "POST" });
    const json = await res.json();
    setResult(json);
  }

  return (
    <div style={{ padding: 20 }}>
      
      {/* 🌍 GLOBE */}
      <div style={{ width: "100%", height: "500px" }}>
        <GlobeView data={data} />
      </div>

      <h1>Analyze</h1>

      <button onClick={analyze}>Analyze</button>

      {result && <pre>{JSON.stringify(result, null, 2)}</pre>}
    </div>
  );
}
