/**
 * Compact real Human Config summary, linking to the full
 * `/hub/human-config` browser. Real counts only — computed by the SAME
 * `humanConfigHierarchy.ts` functions the full view uses, not
 * re-approximated here.
 */
import type { HumanConfigSummary } from "@/app/lib/philos/humanConfig/humanConfigHierarchy";

export default function HumanConfigSummaryCard({ summary, sourceFileName }: { summary: HumanConfigSummary | null; sourceFileName: string | null }) {
  return (
    <section dir="rtl" style={S.card}>
      <div style={S.head}>
        <h3 style={S.title}>Human Config — מבנה מקור אמיתי</h3>
        {summary ? <a href="/hub/human-config" style={S.link}>פתח מבנה מלא →</a> : null}
      </div>
      {!summary ? (
        <div style={S.empty}>קובץ המקור לא זמין כרגע — לא הומצא תוכן חלופי.</div>
      ) : (
        <>
          <div style={S.note}>מקור: {sourceFileName} · Domain = "אדם" · {summary.sectionCount} Section · {summary.canonicalConceptCount} Canonical concept</div>
          <div style={S.row}>
            <Metric label="MAPPED" value={summary.mapped} color="#34d399" />
            <Metric label="UNMAPPED" value={summary.unmapped} color="#5a76a3" />
            <Metric label="REVIEW_REQUIRED" value={summary.reviewRequired} color="#fbbf24" />
          </div>
          <div style={S.note}>מצב חי (Live State) לכל פרמטר: לא ידוע — מבנה מקור בלבד, אין תצפית canon מקושרת עדיין.</div>
        </>
      )}
    </section>
  );
}

function Metric({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={S.metric}>
      <span style={{ ...S.metricValue, color }}>{value}</span>
      <span style={S.metricLabel}>{label}</span>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  card: { background: "rgba(18,24,38,0.7)", border: "1px solid rgba(90,120,180,0.14)", borderRadius: 16, padding: "14px 18px", marginTop: 16 },
  head: { display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 },
  title: { fontSize: 13.5, fontWeight: 700, margin: 0, color: "#f0f4fc" },
  link: { fontSize: 11, color: "#5b9cf6", textDecoration: "none" },
  note: { fontSize: 10.5, color: "#8fa3c9", marginTop: 6, lineHeight: 1.6 },
  empty: { fontSize: 11.5, color: "#7b8ca6", fontStyle: "italic", marginTop: 4 },
  row: { display: "flex", gap: 16, marginTop: 8 },
  metric: { display: "flex", flexDirection: "column", gap: 1 },
  metricValue: { fontSize: 16, fontWeight: 800 },
  metricLabel: { fontSize: 9, color: "#8fa3c9" },
};
