/**
 * SOCIAL-VALUE SPINE panel — the shared primary chain for
 * Community -> Globe -> World.
 *
 * Six links, each carrying its own source status. Community is the
 * reference surface; Globe and World project the same spine at their own
 * level and may show less.
 *
 * The full 110-entry registry, the taxonomy memberships and the provenance
 * do NOT belong here — they are AUDIT. This shows the chain and the counts
 * that are real.
 */
import { buildSocialValueSpine, type SpineLink } from "../valueSystem/socialValueSpine";
import { COLOR, RADIUS, SPACE, TYPE } from "./designTokens";

const TONE: Record<string, string> = {
  SOURCE_SUPPORTED_CONCEPTUAL: "#a78bfa",
  SOURCE_SUPPORTED_CONCEPTUAL_AGGREGATION: "#5b9cf6",
  UNRESOLVED: "#8798b8",
  NOT_SOURCE_SUPPORTED: "#f2635c",
};

export default function SocialValueSpinePanel({
  surface, verifiedGroupRelations = 0, valueGroups = 0,
}: { surface: "community" | "globe" | "world"; verifiedGroupRelations?: number; valueGroups?: number }) {
  const { links } = buildSocialValueSpine({ verifiedGroupRelations, valueGroups });
  const where = surface === "community" ? "ארגון אנשים וקבוצות"
    : surface === "globe" ? "הקרנה לרשת קשרים מאומתים"
    : "הקרנה לרמת המערכת הרחבה";

  return (
    <section dir="rtl" style={S.band}>
      <div style={S.head}>
        <span style={S.eyebrow}>
          עמוד שדרה ערכי-חברתי · SOCIAL-VALUE SPINE — משותף למשפחת SOCIAL
        </span>
        <span style={S.note}>{where}</span>
      </div>

      <div dir="ltr" style={S.rail}>
        {links.map((l, i) => (
          <div key={l.key} style={S.stepWrap}>
            {i > 0 ? <span style={S.arrow}>→</span> : null}
            <Step link={l} index={i + 1} />
          </div>
        ))}
      </div>

      <div style={S.rule}>
        <b>ערך-קבוצה ≠ קבוצת-ערך.</b> ערך משותף אינו ישות עם חברים. חברות דורשת רשומת
        חברות אמיתית, ושיתוף ניגוד/ערך/משפחה אינו קשר. <b>אין קפיצה ישירה מניגוד לקבוצת ערך</b> —
        המקור מרשה רק את המסלול המלא דרך הערך.
      </div>
    </section>
  );
}

function Step({ link, index }: { link: SpineLink; index: number }) {
  const tone = TONE[link.status] ?? COLOR.textFaint;
  const has = link.count !== null && link.count > 0;
  return (
    <div
      title={`${link.basis}\n\nלא משתמע: ${link.not_implied}`}
      style={{
        minWidth: 132, flex: "0 0 auto",
        border: `1px solid ${has ? `${tone}66` : COLOR.border}`,
        background: has ? `${tone}10` : "transparent",
        borderRadius: RADIUS.sm, padding: "7px 9px",
        display: "flex", flexDirection: "column", gap: 3,
        opacity: has ? 1 : 0.78,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <span style={{ ...TYPE.micro, fontSize: 7.5, color: COLOR.textFaint }}>{index}</span>
        <span style={{ ...TYPE.micro, fontSize: 8, color: tone, letterSpacing: 0.3 }}>{link.label}</span>
      </div>
      <div dir="rtl" style={{ fontSize: 9.5, color: COLOR.textFaint }}>{link.gloss}</div>
      <div style={{ fontSize: 15, fontWeight: 800, color: has ? COLOR.text : "#8798b8", fontFamily: "ui-monospace, monospace" }}>
        {link.count === null ? "—" : link.count}
      </div>
      <div dir="rtl" style={{ ...TYPE.micro, fontSize: 7, color: tone, letterSpacing: 0.2, lineHeight: 1.3 }}>
        {link.status.replace(/SOURCE_SUPPORTED_CONCEPTUAL_?/, "CONCEPTUAL ").trim()}
      </div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  band: { background: "rgba(167,139,250,0.05)", border: "1px solid rgba(167,139,250,0.20)", borderRadius: RADIUS.md, padding: `${SPACE.sm}px ${SPACE.md}px`, marginBottom: SPACE.md },
  head: { display: "flex", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 6 },
  eyebrow: { ...TYPE.micro, fontSize: 8.5, color: "#a78bfa" },
  note: { fontSize: 9.5, color: COLOR.textFaint },
  rail: { display: "flex", alignItems: "stretch", gap: 2, overflowX: "auto", paddingBottom: 4 },
  stepWrap: { display: "flex", alignItems: "center", gap: 2 },
  arrow: { color: COLOR.textFaint, fontSize: 12, padding: "0 1px" },
  rule: { marginTop: SPACE.sm, fontSize: 9.5, color: COLOR.textDim, lineHeight: 1.6, background: "rgba(251,191,36,0.05)", border: "1px solid rgba(251,191,36,0.2)", borderRadius: RADIUS.sm, padding: "6px 9px" },
};
