/**
 * SOCIAL SOURCE SPINE — the shared source layer behind Community, Globe
 * and World.
 *
 * ── Why these three, and why this is not a colour grouping ─────────────
 *
 * The locked master (`PHILOS-SYSTEM-LANGUAGE.md` §8) assigns COMMUNITY 🟢,
 * GLOBE 🟢+🟣 and WORLD ⚪+🟣. That is a CHAIN, not a uniform family:
 * Community and Globe share green, Globe and World share purple, and World
 * carries no green at all. So these three are NOT grouped here by colour —
 * doing that would contradict the master.
 *
 * What genuinely connects them is the L-layer spine, quoted verbatim in the
 * same locked document (§12):
 *
 *   L3 — close relations   → who is connected around a value  (Community)
 *   L4 — social structure  → how those relations are laid out (Globe)
 *   L5 — wider system      → the system beyond them           (World)
 *
 * All three already draw on ONE source model
 * (`community/sourceValueModel.ts`) — but until now only Community read it.
 * Globe and World are the same social layer and were not seeing the same
 * source. This panel is that shared read.
 *
 * ── Everything here is SOURCE tier ─────────────────────────────────────
 *
 * Nothing in this panel is a measurement, a state, or a runtime value. Each
 * row carries the source model's OWN honesty fields — `confidence` and
 * `review_status` — verbatim, never re-graded. A surface may show fewer
 * rows; none may promote one.
 */
import { SOURCE_CONCEPTS, type SourceConcept } from "../community/sourceValueModel";
import { COLOR, RADIUS, SPACE, TYPE } from "./designTokens";
import { ProvenanceBadge } from "./provenance";

const LAYER_OF_SURFACE: Record<"community" | "globe" | "world", { layer: string; question: string }> = {
  community: { layer: "L3 — שכבת הקשרים הקרובים", question: "מי מחובר סביב איזה ערך" },
  globe: { layer: "L4 — שכבת המבנה החברתי", question: "איך הקשרים פרוסים במרחב" },
  world: { layer: "L5 — שכבת המערכת הרחבה", question: "מה קורה במערכת שמעבר להם" },
};

export default function SocialSourceSpinePanel({
  surface, limit = 6,
}: { surface: "community" | "globe" | "world"; limit?: number }) {
  const oppositions = SOURCE_CONCEPTS.filter((c) => c.type === "CONTINUUM");
  const dimensions = SOURCE_CONCEPTS.filter((c) => c.type === "MEASURABLE_DIMENSION");
  const here = LAYER_OF_SURFACE[surface];

  return (
    <section dir="rtl" style={S.band}>
      <div style={S.head}>
        <span style={S.eyebrow}>עמוד שדרה חברתי · SOCIAL SOURCE SPINE — משותף ל-Community · Globe · World</span>
        <ProvenanceBadge p="STATIC" />
      </div>

      <div style={S.layerRow}>
        <span style={S.layerHere}>{here.layer}</span>
        <span style={S.layerGloss}>{here.question}</span>
        <span style={S.layerNote}>
          שלושת המסופים חולקים מודל מקור אחד. הקיבוץ הוא לפי שכבות L3→L4→L5 (§12),
          לא לפי צבע — המאסטר נותן ל-World ⚪+🟣 ולא 🟢.
        </span>
      </div>

      {/* L1–L5 — real quoted formulas, SOURCE tier */}
      <div style={S.subHead}>שכבות מדידות · MEASURABLE DIMENSIONS ({dimensions.length})</div>
      {dimensions.slice(0, limit).map((d) => <Row key={d.canonical_id} c={d} mono />)}

      {/* the 24 base oppositions */}
      <div style={S.subHead}>ניגודי בסיס · BASE OPPOSITIONS ({oppositions.length} מתוך 30 שחולצו)</div>
      {oppositions.slice(0, limit).map((c) => <Row key={c.canonical_id} c={c} />)}
      {oppositions.length > limit ? (
        <div style={S.more}>ועוד {oppositions.length - limit} — ראה AUDIT</div>
      ) : null}

      {/* the aggregate, and why it is absent */}
      <div style={S.gap}>
        <div style={{ ...TYPE.micro, fontSize: 8.5, color: "#fbbf24", marginBottom: 3 }}>
          חישוב כולל · AGGREGATE — לא מחושב, וזה מכוון
        </div>
        <div style={S.gapLine}>
          <b>S = Σ(L1..L6)</b> אינו מחושב בשום מקום. §13 (כלל אי-קידום) קובע ש-S,
          <code> capacityScore</code>, <code>execution gap</code> ו-<code>readiness to act</code> נשמרים
          כ-SOURCE ו“אינם מקודמים ל-Person Now, ל-Canon State או לאף projection ב-runtime”.
        </div>
        <div style={S.gapLine}>
          בנוסף — <b>L6 הוא GAP מוצהר</b> (“לא סופק. לא מומצא”). גם ללא §13, חישוב S היה
          דורש להמציא את L6.
        </div>
        <div style={S.gapLine}>
          <b>צבירת ניגודי בסיס לפני/אחרי Action — חסומה, ולא בגלל היעדר נתונים.</b> ה-runtime
          מזהה 5 ניגודים ממדיים (INTERNAL↔EXTERNAL, PHYSICAL↔EMOTIONAL …) בעוד שהמקור מגדיר
          {" "}{oppositions.length} ניגודי בסיס אחרים לגמרי. אין מיפוי בין שתי אוצרות המילים,
          ובניית מיפוי כזה תהיה המצאה — לא גזירה.
        </div>
      </div>
    </section>
  );
}

function Row({ c, mono = false }: { c: SourceConcept; mono?: boolean }) {
  return (
    <div style={S.row}>
      <span style={{ ...S.rowLabel, fontFamily: mono ? "ui-monospace, monospace" : undefined, fontSize: mono ? 10 : 11 }}>
        {c.source_wording}
      </span>
      <span style={S.rowMeta}>
        {c.normalized_label} · confidence {c.confidence} · {c.review_status}
      </span>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  band: { background: "rgba(52,211,153,0.04)", border: "1px solid rgba(52,211,153,0.18)", borderRadius: RADIUS.md, padding: `${SPACE.sm}px ${SPACE.md}px`, marginBottom: SPACE.md },
  head: { display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 6 },
  eyebrow: { ...TYPE.micro, fontSize: 8.5, color: "#6fe3b4" },
  layerRow: { display: "flex", flexDirection: "column", gap: 2, background: "rgba(20,28,48,0.5)", border: `1px solid ${COLOR.border}`, borderRadius: RADIUS.sm, padding: "6px 9px", marginBottom: 6 },
  layerHere: { fontSize: 11.5, fontWeight: 700, color: COLOR.text },
  layerGloss: { fontSize: 10, color: COLOR.textDim },
  layerNote: { fontSize: 9, color: COLOR.textFaint, lineHeight: 1.5, marginTop: 2 },
  subHead: { ...TYPE.micro, fontSize: 8, color: COLOR.textFaint, margin: "7px 0 3px" },
  row: { display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 7, padding: "3px 8px", background: "rgba(90,120,180,0.05)", borderRadius: RADIUS.sm, marginBottom: 2 },
  rowLabel: { color: COLOR.text, flex: 1, minWidth: 170 },
  rowMeta: { fontSize: 8.5, color: COLOR.textFaint, fontFamily: "ui-monospace, monospace" },
  more: { fontSize: 9, color: COLOR.textFaint, padding: "2px 8px" },
  gap: { marginTop: SPACE.sm, paddingTop: SPACE.sm, borderTop: `1px solid ${COLOR.border}` },
  gapLine: { fontSize: 10, color: COLOR.textDim, lineHeight: 1.6, marginBottom: 4 },
};
