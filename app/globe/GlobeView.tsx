"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const Globe = dynamic(() => import("react-globe.gl"), { ssr: false });

export default function GlobeView({ data, onSelect }: any) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  if (!ready) return null;

  return (
    <div style={{ width: "100%", height: "100%" }}>
      <Globe
        width={window.innerWidth}
        height={window.innerHeight}
        globeImageUrl="https://unpkg.com/three-globe/example/img/earth-dark.jpg"
        backgroundColor="#000000"
        pointsData={data?.nodes || []}
        pointLat={(d: any) => d.lat}
        pointLng={(d: any) => d.lng}
        pointColor={(d: any) =>
          d.impact === "yes"
            ? "#00ff88"
            : d.impact === "partial"
            ? "#ffaa00"
            : "#ff4444"
        }
        pointAltitude={(d: any) => (d.intensity || 1) / 10}
        pointRadius={0.6}
        onPointClick={(p: any) => onSelect && onSelect(p)}
      />
    </div>
  );
}
