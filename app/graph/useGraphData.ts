"use client";

import dynamic from "next/dynamic";
import { useGraphData } from "../graph/useGraphData";

const GlobeView = dynamic(() => import("../globe/GlobeView"), {
  ssr: false,
});

export default function Page() {
  const data = useGraphData();

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#000" }}>
      <GlobeView data={data} />
    </div>
  );
}