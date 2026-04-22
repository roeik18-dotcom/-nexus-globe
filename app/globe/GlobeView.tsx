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
    let mounted = true;

    async function run() {
      if (!ref.current || !data) return;

      const mod = await import("globe.gl");
      const Globe = mod.default;
      if (!mounted || !ref.current) return;

      const g: any = Globe()(ref.current)
        .globeImageUrl("//unpkg.com/three-globe/example/img/earth-dark.jpg")
        .backgroundColor("#000")
        .pointsData(data.nodes)
        .pointLat((d: any) => d.lat)
        .pointLng((d: any) => d.lng)
        .pointColor((d: any) =>
          d.impact === "yes" ? "#00ff88" : d.impact === "partial" ? "#ffaa00" : "#ff4444"
        )
        .pointAltitude((d: any) => d.intensity / 10)
        .pointRadius(0.3);

      g.controls().autoRotate = true;
      g.controls().autoRotateSpeed = 0.5;
    }

    run();

    return () => {
      mounted = false;
      if (ref.current) ref.current.innerHTML = "";
    };
  }, [data]);

  return <div ref={ref} style={{ width: "100%", height: "500px" }} />;
}
