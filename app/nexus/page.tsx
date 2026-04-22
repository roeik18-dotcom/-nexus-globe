"use client";

import { useState } from "react";
import GlobeView from "../globe/GlobeView";
import { useGraphData } from "../graph/useGraphData";

export default function NexusPage() {
  const data = useGraphData();
  const [selected, setSelected] = useState(data.nodes[0]?.id || null);

  const node = data.nodes.find(n => n.id === selected);

  return (
    <div style={{ background:"#05070c", color:"#fff", minHeight:"100vh", padding:20 }}>
      
      <h1 style={{ fontSize:32, marginBottom:20 }}>
        FINAL ANALYSIS VIEW
      </h1>

      <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:20 }}>

        {/* 🌍 גלובוס */}
        <div style={{ height:600, border:"1px solid #222", borderRadius:16 }}>
          <GlobeView data={data} selectedId={selected} onSelect={setSelected} />
        </div>

        {/* 📊 פאנל */}
        <div style={{ border:"1px solid #222", borderRadius:16, padding:16 }}>
          <h2>{node?.title}</h2>

          <p><b>Impact:</b> {node?.impact}</p>
          <p><b>Level:</b> {node?.level}</p>
          <p><b>Domain:</b> {node?.domain}</p>
          <p><b>Time:</b> {node?.timeLabel}</p>

          <hr />

          <p>{node?.summary}</p>

          <div style={{ marginTop:10, fontWeight:"bold" }}>
            Action:
          </div>
          <div>{node?.action}</div>
        </div>

      </div>
    </div>
  );
}
