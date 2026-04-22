import { useEffect, useState } from "react";

export function useGraphData() {
  const [nodes, setNodes] = useState<any[]>([
    // fallback — תמיד יציג משהו
    {
      id: "default",
      lat: 32.0853,
      lng: 34.7818,
      impact: "yes",
      intensity: 8,
      text: "default node"
    }
  ]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("lastResult");

      if (!saved) return;

      const data = JSON.parse(saved);

      setNodes([
        {
          id: "main",
          lat: 32.0853,
          lng: 34.7818,
          impact: "yes",
          intensity: 8,
          text: data.action || "no action"
        }
      ]);
    } catch (e) {
      console.log("load error", e);
    }
  }, []);

  return { nodes };
}