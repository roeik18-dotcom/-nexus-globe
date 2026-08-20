"use client";

/**
 * Flat, searchable index over all real navigable Dimensions
 * (Section×Heading pairs — `DimensionCoverage[]`, same data
 * `humanConfigHierarchy.ts` already builds; no new source read, no new
 * fact). Complements the Section→Heading drill-down cards below: this is
 * the "type to find one of 147" path, that is the "browse the map" path.
 * Client-only text/checkbox filtering — no server round-trip, no new
 * backend.
 */
import { useMemo, useState } from "react";
import type { DimensionCoverage } from "@/app/lib/philos/humanConfig/humanConfigHierarchy";

export default function DimensionExplorer({ dimensions }: { dimensions: DimensionCoverage[] }) {
  const [query, setQuery] = useState("");
  const [reviewOnly, setReviewOnly] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return dimensions.filter((d) => {
      if (reviewOnly && d.reviewRequired === 0) return false;
      if (!q) return true;
      return d.section.toLowerCase().includes(q) || d.heading.toLowerCase().includes(q);
    });
  }, [dimensions, query, reviewOnly]);

  return (
    <div dir="rtl" style={S.wrap}>
      <div style={S.headRow}>
        <div style={S.head}>DIMENSION EXPLORER — {dimensions.length} Dimensions (Section × Heading)</div>
        <div style={S.count}>{filtered.length} מוצגים</div>
      </div>
      <div style={S.controls}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="חיפוש Section / Heading…"
          style={S.search}
        />
        <label style={S.toggle}>
          <input type="checkbox" checked={reviewOnly} onChange={(e) => setReviewOnly(e.target.checked)} />
          <span>REVIEW_REQUIRED בלבד</span>
        </label>
      </div>
      <div style={S.scroll}>
        {filtered.length === 0 ? (
          <div style={S.empty}>0 תוצאות</div>
        ) : (
          filtered.map((d) => (
            <a key={`${d.section}␟${d.heading}`} href={`?section=${encodeURIComponent(d.section)}&heading=${encodeURIComponent(d.heading)}`} style={S.row}>
              <div style={S.rowMain}>
                <span style={S.rowSection}>{d.section}</span>
                <span style={S.rowArrow}>→</span>
                <span style={S.rowHeading}>{d.heading}</span>
              </div>
              <div style={S.rowMeta}>
                <span>{d.canonicalConceptCount} concepts</span>
                <span>{d.unitCount} units</span>
                {d.reviewRequired > 0 ? <span style={S.reviewTag}>{d.reviewRequired} review</span> : null}
              </div>
            </a>
          ))
        )}
      </div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  wrap: { marginTop: 4, marginBottom: 16 },
  headRow: { display: "flex", alignItems: "baseline", justifyContent: "space-between" },
  head: { fontSize: 13, fontWeight: 700, color: "#5aa6ff" },
  count: { fontSize: 12, color: "#6c86b5" },
  controls: { display: "flex", gap: 10, alignItems: "center", margin: "8px 0" },
  search: { flex: 1, maxWidth: 340, background: "rgba(18,24,38,0.7)", border: "1px solid rgba(90,120,180,0.3)", borderRadius: 8, padding: "6px 10px", color: "#e6ebf5", fontSize: 13 },
  toggle: { display: "flex", alignItems: "center", gap: 5, fontSize: 13, color: "#8fa3c9" },
  scroll: { maxHeight: 260, overflowY: "auto", border: "1px solid rgba(90,120,180,0.2)", borderRadius: 8, display: "flex", flexDirection: "column" },
  empty: { padding: 14, fontSize: 13, color: "#6c86b5", textAlign: "center" },
  row: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 10px", textDecoration: "none", color: "inherit", borderBottom: "1px solid rgba(90,120,180,0.08)", gap: 10 },
  rowMain: { display: "flex", alignItems: "center", gap: 6, minWidth: 0, overflow: "hidden" },
  rowSection: { fontSize: 12, color: "#6c86b5", whiteSpace: "nowrap" },
  rowArrow: { fontSize: 12, color: "#6c86b5" },
  rowHeading: { fontSize: 13, color: "#dbe6f6", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  rowMeta: { display: "flex", gap: 10, fontSize: 12, color: "#8aa0c8", whiteSpace: "nowrap" },
  reviewTag: { color: "#fbbf24" },
};
