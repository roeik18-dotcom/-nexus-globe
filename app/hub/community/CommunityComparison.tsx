/**
 * CommunityComparison — shared canonical comparison (System-Wide Build,
 * `comparison.ts::compareCommunities`, not a page-specific score). Compares
 * the currently-viewed community against a second one, on real, compatible
 * dimensions only. Every row exposes its own unit/provenance; no combined
 * score anywhere.
 */
import { compareCommunities, winningSide, type MetricProvenance } from "@/app/lib/philos/comparison";
import type { ValueGroupView } from "@/app/lib/philos/projectValueGroup";

export default function CommunityComparison({
  current, currentProvenance, other, otherProvenance,
}: {
  current: ValueGroupView;
  currentProvenance: MetricProvenance;
  other: ValueGroupView;
  otherProvenance: MetricProvenance;
}) {
  const cmp = compareCommunities(current, currentProvenance, other, otherProvenance);

  return (
    <div dir="rtl" style={S.card}>
      <div style={S.head}>השוואה · COMPARISON</div>
      <div style={S.subHead}>
        {cmp.subject_a.label} <span style={badgeStyle(currentProvenance)}>{currentProvenance}</span>
        {" "}לעומת{" "}
        {cmp.subject_b.label} <span style={badgeStyle(otherProvenance)}>{otherProvenance}</span>
      </div>
      <div style={S.rows}>
        {cmp.metrics.map((m) => {
          const win = winningSide(m);
          return (
            <div key={m.key} style={S.row}>
              <span style={S.metricLabel}>{m.label} ({m.unit})</span>
              <span style={{ ...S.val, fontWeight: win === "a" ? 800 : 400 }}>{m.a.value ?? "לא ידוע"}</span>
              <span style={S.vs}>↔</span>
              <span style={{ ...S.val, fontWeight: win === "b" ? 800 : 400 }}>{m.b.value ?? "לא ידוע"}</span>
            </div>
          );
        })}
      </div>
      <div style={S.note}>אין ציון כולל אחד — כל שורה היא מדד עצמאי, ניתן להשוואה רק בממד תואם.</div>
    </div>
  );
}

function badgeStyle(p: MetricProvenance): React.CSSProperties {
  return { fontSize: 12, fontWeight: 800, padding: "1px 6px", borderRadius: 5, marginRight: 4, color: p === "DEMO" ? "#fbbf24" : "#34d399", border: `1px solid ${p === "DEMO" ? "#fbbf24" : "#34d399"}55` };
}

const S: Record<string, React.CSSProperties> = {
  card: { background: "rgba(18,24,38,0.7)", border: "1px solid rgba(90,120,180,0.14)", borderRadius: 16, padding: "16px 18px", marginTop: 16 },
  head: { fontSize: 13, fontWeight: 700, color: "#5aa6ff", marginBottom: 6 },
  subHead: { fontSize: 13, color: "#dbe6f6", marginBottom: 10 },
  rows: { display: "flex", flexDirection: "column", gap: 4 },
  row: { display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: 8, alignItems: "center", fontSize: 13, padding: "4px 8px", borderRadius: 6, background: "rgba(90,120,180,0.05)" },
  metricLabel: { color: "#8fa3c9" },
  val: { color: "#e8edf6", textAlign: "center" as const, minWidth: 60 },
  vs: { color: "#6c86b5" },
  note: { fontSize: 12, color: "#6c86b5", marginTop: 8 },
};
