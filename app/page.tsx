"use client";

// Root route ("/") = 30-Second Opening Experience.
//
// User describes their situation in free text. The /api/analyze route
// classifies the dominant force (emotional / physical / rational / …).
// The result screen answers the four questions — plain language, no jargon —
// then offers "See the full map" which navigates to /nexus.

import { useRouter } from "next/navigation";
import ThirtySecond from "./nexus/ThirtySecond";

export default function Page() {
  const router = useRouter();

  return (
    <main
      style={{
        minHeight: "100dvh",
        background: "radial-gradient(ellipse at 50% 28%,#0a2a4a 0%,#020d1a 60%,#000 100%)",
        color: "#cfe6f5",
        fontFamily: "'Inter',system-ui,sans-serif",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 460,
          height: "min(720px, 92dvh)",
          background: "#030f1e",
          border: "1px solid #0a2a4a",
          borderRadius: 14,
          overflowY: "auto",
          boxShadow: "0 24px 70px rgba(0,0,0,0.55)",
        }}
      >
        <ThirtySecond onContinue={() => router.push("/nexus")} />
      </div>
    </main>
  );
}
