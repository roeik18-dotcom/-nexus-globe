import { useEffect, useState } from "react";

export function useGraphData() {
  const [nodes, setNodes] = useState<any[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem("lastResult");
    if (!saved) return;

    const data = JSON.parse(saved);

    setNodes([
      {
        id: "main",
        lat: 32,
        lng: 34,
        impact: "yes",
        intensity: 8,
        text: data.action,
      }
    ]);
  }, []);

  return { nodes };
}
