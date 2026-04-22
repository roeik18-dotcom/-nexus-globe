"use client";

import GlobeView from "../globe/GlobeView";
import { useGraphData } from "../graph/useGraphData";

export default function NexusPage() {
  const data = useGraphData();

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#000" }}>
      <GlobeView data={data} />
    </div>
  );
}
