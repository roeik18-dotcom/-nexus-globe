"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useGraphData } from "../graph/useGraphData";

// 🔥 זה הקריטי — בלי SSR
const GlobeView = dynamic(() => import("../globe/GlobeView"), {
  ssr: false,
});

export default function Page() {
  const data = useGraphData();
  const [selected, setSelected] = useState<any>(null);

  return (
    <div style={{ display: "flex", height: "100vh", background: "#000", color: "#fff" }}>
      
      <div style={{ flex: 2 }}>
        <GlobeView data={data} onSelect={setSelected} />
      </div>

      <div style={{ flex: 1, padding: 20 }}>
        {selected ? (
          <>
            <h2>NODE</h2>
            <p>{selected.text}</p>
          </>
        ) : (
          <p>Click point</p>
        )}
      </div>

    </div>
  );
}