"use client";

import dynamic from "next/dynamic";

const Globe = dynamic(() => import("react-globe.gl"), { ssr: false });

export default function GlobeView({ data }: any) {
  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <Globe
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
        pointRadius={0.5}
      />
    </div>
  );
}
