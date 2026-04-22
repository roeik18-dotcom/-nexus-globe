"use client";

import { useRouter } from "next/navigation";

export default function Page() {
  const router = useRouter();

  async function analyze() {
    const res = await fetch("/api/analyze", { method: "POST" });
    const json = await res.json();

    localStorage.setItem("lastResult", JSON.stringify(json));
    router.push("/nexus");
  }

  return (
    <div style={{ padding: 40, background: "#000", color: "#fff", height: "100vh" }}>
      <h1>PHILOS</h1>
      <button onClick={analyze}>Analyze</button>
    </div>
  );
}
