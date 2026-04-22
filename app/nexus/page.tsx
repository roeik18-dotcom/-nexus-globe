"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

const Globe = dynamic(() => import("react-globe.gl"), { ssr: false });

export default function Page() {
  const [nodes, setNodes] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);

  useEffect(() => {
    const saved = localStorage.getItem("lastResult");
    if (!saved) return;

    const r = JSON.parse(saved);

    setNodes([
      {
        lat: 32,
        lng: 34,
        size: 1,
        color: "green",
        text: r.action,
        category: r.category,
        conflict: r.conflict,
      }
    ]);
  }, []);

  return (
    <div style={{ display: "flex", height: "100vh", background: "#000", color: "#fff" }}>
      
      <div style={{ flex: 2 }}>
        <Globe
          globeImageUrl="https://unpkg.com/three-globe/example/img/earth-dark.jpg"
          pointsData={nodes}
          pointLat={(d:any)=>d.lat}
          pointLng={(d:any)=>d.lng}
          pointColor={(d:any)=>d.color}
          pointRadius={0.5}
          onPointClick={(d:any)=>setSelected(d)}
        />
      </div>

      <div style={{ flex: 1, padding: 20 }}>
        {selected ? (
          <>
            <h2>RESULT</h2>
            <p>{selected.text}</p>
            <p>{selected.category}</p>
            <p>{selected.conflict}</p>
          </>
        ) : (
          <p>Click point</p>
        )}
      </div>

    </div>
  );
}
