"use client";

import { useEffect, useRef } from "react";

type Node = {
  id: string;
  lat: number;
  lng: number;
  impact: "yes" | "partial" | "no";
  intensity: number;
};

export default function GlobeView({ data }: { data?: { nodes: Node[] } }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;

    (async () => {
      const Globe = (await import("globe.gl")).default;

      const g: any = Globe()(ref.current!)
        .globeImageUrl("https://unpkg.com/three-globe/example/img/earth-dark.jpg")
        .backgroundColor("#000")
        .pointsData(data?.nodes || [])
        .pointLat((d: any) => d.lat)
        .pointLng((d: any) => d.lng)
        .pointColor((d: any) =>
          d.impact === "yes" ? "#00ff88" :
          d.impact === "partial" ? "#ffaa00" :
          "#ff4444"
        )
        .pointAltitude((d: any) => (d.intensity || 1) / 10)
        .pointRadius(0.4);

      g.controls().autoRotate = true;
      g.controls().autoRotateSpeed = 0.6;
    })();

    return () => {
      if (ref.current) ref.current.innerHTML = "";
    };
  }, [data]);

  return <div ref={ref} style={{ width: "100%", height: "100%" }} />;
}
