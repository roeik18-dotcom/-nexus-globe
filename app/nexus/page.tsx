"use client";

import { useState } from "react";
import GlobeView from "../globe/GlobeView";
import { useGraphData } from "../graph/useGraphData";

export default function Page() {
  const data = useGraphData();
  const [selected, setSelected] = useState<any>(null);

  return (
    <div style={{ display: "flex", height: "100vh", background: "#000", color: "white" }}>
      
      {/* 🌍 גלובוס */}
      <div style={{ flex: 2 }}>
        <GlobeView data={data} onSelect={setSelected} />
      </div>

      {/* 📊 פאנל מידע */}
      <div style={{ flex: 1, padding: 20, borderLeft: "1px solid #222" }}>
        {selected ? (
          <>
            <h2>Node Info</h2>
            <p><b>Action:</b> {selected.text}</p>
            <p><b>Impact:</b> {selected.impact}</p>
            <p><b>Intensity:</b> {selected.intensity}</p>
          </>
        ) : (
          <p>Click a point</p>
        )}
      </div>

    </div>
  );
}
