"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const [event, setEvent] = useState("");
  const [intensity, setIntensity] = useState(5);
  const [context, setContext] = useState("");
  const router = useRouter();

  async function analyze() {
    const res = await fetch("/api/analyze", { method: "POST" });
    const json = await res.json();

    // שומר לגלובוס
    localStorage.setItem("lastResult", JSON.stringify(json));

    router.push("/nexus");
  }

  return (
    <div style={{ padding: 40, color: "white", background: "#000", height: "100vh" }}>
      <h1>PHILOS ORIENTATION</h1>

      <input placeholder="event" onChange={(e)=>setEvent(e.target.value)} />
      <input type="number" defaultValue={5} onChange={(e)=>setIntensity(Number(e.target.value))} />
      <input placeholder="context" onChange={(e)=>setContext(e.target.value)} />

      <button onClick={analyze}>Analyze</button>
    </div>
  );
}
