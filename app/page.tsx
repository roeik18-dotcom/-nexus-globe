"use client";

// Root route ("/") = Event Zero.
//
// Mounts the redesigned pain-first Event Zero experience (the human story
// poster) at the landing route, replacing the old class/level/expression intake
// wizard. No duplicate component — this reuses the SAME NoaTransformation that
// the /nexus journey tab renders. Route/UI mount only: no engine, data, or Noa
// output changes.

import { useRouter } from "next/navigation";
import NoaTransformation from "./nexus/NoaTransformation";

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
      {/* Event Zero poster — story first, numbers behind "See Analysis".
          "Continue to your map →" carries the user into the live app. */}
      <div
        style={{
          width: "100%",
          maxWidth: 460,
          height: "min(680px, 90dvh)",
          background: "#030f1e",
          border: "1px solid #0a2a4a",
          borderRadius: 14,
          overflowY: "auto",
          boxShadow: "0 24px 70px rgba(0,0,0,0.55)",
        }}
      >
        <NoaTransformation onContinue={() => router.push("/nexus")} />
      </div>
    </main>
  );
}
