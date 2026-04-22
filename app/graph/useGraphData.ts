import { useState } from "react";

export type Node = {
  id: string;
  lat: number;
  lng: number;
  impact: "high" | "medium" | "low";
  text: string;
};

export function useGraphData() {
  const [nodes, setNodes] = useState<Node[]>([]);

  function addNode(text: string, impact: "high" | "medium" | "low") {
    const newNode: Node = {
      id: Date.now().toString(),
      lat: 20 + Math.random() * 40,
      lng: -80 + Math.random() * 160,
      impact,
      text,
    };

    setNodes((prev) => [...prev, newNode]);
  }

  return { nodes, addNode };
}
