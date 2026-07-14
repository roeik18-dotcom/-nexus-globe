import type { Metadata } from "next";

export const metadata: Metadata = { title: "Philos" };

const VIEWS = [
  {
    href:   "/world",
    label:  "World",
    status: "Live",
    statusColor: "#34D399",
    role:   "The living system",
    desc:   "Mission-driven PUDM cascade. Select a mission and watch the Value → Capability → Provider chain animate in real time.",
    display: "Animated SVG",
    accent: "#A371F7",
  },
  {
    href:   "/marketplace",
    label:  "Marketplace",
    status: "Live",
    statusColor: "#34D399",
    role:   "Provider discovery",
    desc:   "Browse and match capabilities to gaps. VCR and PCR relations drive the full mission → provider chain.",
    display: "Table + chain",
    accent: "#5B8CFF",
  },
  {
    href:   "/pudm",
    label:  "PUDM",
    status: "Live",
    statusColor: "#34D399",
    role:   "Data model explorer",
    desc:   "Inspect the full chain: Mission → Gap → Value → Capability → Provider. Every node, every relation, every evidence grade.",
    display: "Tree view",
    accent: "#FFB84D",
  },
  {
    href:   "/nexus",
    label:  "Nexus",
    status: "Live",
    statusColor: "#34D399",
    role:   "Force graph",
    desc:   "Interactive user node map. Describe a situation — the system classifies dominant forces and positions you in the ecosystem.",
    display: "Force graph",
    accent: "#22D3EE",
  },
  {
    href:   "/lab",
    label:  "Lab",
    status: "Reference",
    statusColor: "#FFB84D",
    role:   "Architecture docs",
    desc:   "OPM specification, Marketplace core, Research Charter, and earlier visual prototypes. Source of architectural truth.",
    display: "Document list",
    accent: "#F87171",
  },
];

export default function HomePage() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        background: "#020d1a",
        color: "#cfe6f5",
        fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
        padding: "48px 20px 80px",
      }}
    >
      <style>{`
        .ph-card {
          display: block;
          background: #030c18;
          border: 1px solid #0a1e2e;
          border-radius: 8px;
          padding: 20px 22px;
          text-decoration: none;
          color: inherit;
          transition: border-color 0.15s ease;
        }
        .ph-card:hover { border-color: var(--card-accent); }
      `}</style>

      <div style={{ maxWidth: 860, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: 48 }}>
          <div style={{
            display: "inline-block",
            background: "rgba(52,211,153,0.08)",
            border: "1px solid rgba(52,211,153,0.2)",
            borderRadius: 4, padding: "3px 10px", marginBottom: 16,
            fontSize: 10, fontWeight: 700, letterSpacing: "2px",
            textTransform: "uppercase" as const, color: "#34D399",
          }}>
            Philos Research System
          </div>
          <h1 style={{
            fontSize: 28, fontWeight: 600, color: "#e0f0ff",
            letterSpacing: "-0.4px", marginBottom: 10,
          }}>
            Choose a view
          </h1>
          <p style={{ fontSize: 13, color: "#2a4a64", maxWidth: 480, lineHeight: 1.7 }}>
            Five lenses onto the same data model. Each route is independent —
            no login, no state to carry between them.
          </p>
        </div>

        {/* Card grid */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: 14,
        }}>
          {VIEWS.map(v => (
            <a
              key={v.href}
              href={v.href}
              className="ph-card"
              style={{ "--card-accent": v.accent + "66" } as React.CSSProperties}
            >
              {/* Top row: label + status */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: v.accent }}>
                  {v.label}
                </span>
                <span style={{
                  fontSize: 8.5, fontWeight: 700, letterSpacing: "1.5px",
                  textTransform: "uppercase" as const,
                  color: v.statusColor,
                  background: v.statusColor + "14",
                  border: `1px solid ${v.statusColor}30`,
                  borderRadius: 3, padding: "2px 7px",
                  marginTop: 2,
                }}>
                  {v.status}
                </span>
              </div>

              {/* Role */}
              <div style={{ fontSize: 11, fontWeight: 600, color: "#1a3a55", marginBottom: 8, textTransform: "uppercase" as const, letterSpacing: "0.8px" }}>
                {v.role}
              </div>

              {/* Description */}
              <p style={{ fontSize: 12, color: "#1e3a52", lineHeight: 1.65, marginBottom: 14 }}>
                {v.desc}
              </p>

              {/* Footer: display type + arrow */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{
                  fontSize: 9.5, color: "#0f2030",
                  fontFamily: "var(--font-geist-mono), monospace",
                }}>
                  {v.display}
                </span>
                <span style={{ fontSize: 11, color: v.accent + "99" }}>→</span>
              </div>
            </a>
          ))}
        </div>

        {/* Footer note */}
        <div style={{
          marginTop: 48, borderTop: "1px solid #071420", paddingTop: 16,
          fontSize: 11, color: "#0d1e2e",
          fontFamily: "var(--font-geist-mono), monospace",
        }}>
          Philos · PUDM v0 · All data is Candidate grade — designed, not validated
        </div>

      </div>
    </main>
  );
}
