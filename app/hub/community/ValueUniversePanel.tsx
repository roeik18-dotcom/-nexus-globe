/**
 * THE VALUE GROUP UNIVERSE — the open spectrum, with the viewer's position
 * marked inside it rather than substituted for it.
 *
 * Three counts head the panel because they answer three different questions
 * that a single "3 groups" figure conflated:
 *
 *   UNIVERSE     what value landscape PHILOS knows           28 / 223
 *   ALL GROUPS   who has actually organised around any of it  registry
 *   MY GROUPS    what this viewer is part of                  overlay
 *
 * The gap BETWEEN the first two is the product's real state and the reason
 * this panel renders all 223 leaves including the empty ones: a card list of
 * the three existing groups would report a community of three interests,
 * where the truth is a described landscape almost nobody has populated yet.
 * `0 קבוצות` on a leaf is information. Hiding the leaf is not minimalism, it
 * is a different claim.
 *
 * Progressive disclosure is `<details>` rather than client state so the whole
 * spectrum stays server-rendered and keyboard-operable with no hydration.
 */
import { COLOR, FS, RADIUS, SPACE, STATUS } from "@/app/lib/philos/shell/designTokens";
import type { ValueGroupUniverse } from "@/app/lib/philos/community/valueGroupUniverse";
import type { ValueGroupRegistry, RegistryEntry } from "@/app/lib/philos/community/valueGroupRegistry";
import type { ViewerGroupOverlay, ViewerGroupRelation } from "@/app/lib/philos/community/viewerGroupOverlay";
import type { SelectedGroupContext } from "@/app/lib/philos/community/selectedGroupContext";
import { SELECTED_GROUP_PARAM } from "@/app/lib/philos/community/selectedGroupContext";
import type { GroupRelation } from "@/app/lib/philos/community/groupRelations";

const REL_LABEL: Record<ViewerGroupRelation, string> = {
  FOUNDER: "מייסד", LEADING_MEMBER: "חבר מוביל", MEMBER: "חבר", CONTRIBUTOR: "תורם",
  FOLLOWING: "עוקב", CANDIDATE: "מועמד", RELATED: "קשור", NONE: "—",
};

function Metric({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: "accent" | "dim" }) {
  return (
    <div style={{ flex: "1 1 180px", minWidth: 168, padding: `${SPACE.md}px ${SPACE.lg}px`,
      background: COLOR.bgCard, border: `1px solid ${tone === "accent" ? COLOR.borderStrong : COLOR.border}`, borderRadius: RADIUS.md }}>
      <div style={{ fontSize: FS.tag, letterSpacing: ".08em", color: COLOR.textFaint }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 650, marginTop: 2, color: tone === "dim" ? COLOR.textDim : COLOR.text, fontVariantNumeric: "tabular-nums" }}>{value}</div>
      <div style={{ fontSize: FS.meta, color: COLOR.textDim, marginTop: 2 }}>{sub}</div>
    </div>
  );
}

function GroupChip({ e, relation, selected }: { e: RegistryEntry; relation: ViewerGroupRelation; selected: boolean }) {
  const s = STATUS[e.group.provenance === "REAL" ? "real" : "demo"];
  const mine = relation !== "NONE";
  return (
    <a href={`?${SELECTED_GROUP_PARAM}=${encodeURIComponent(e.group.group_id)}`}
      style={{ display: "inline-flex", alignItems: "center", gap: SPACE.sm, minBlockSize: 32,
        padding: `4px ${SPACE.md}px`, borderRadius: RADIUS.pill, textDecoration: "none",
        background: selected ? "rgba(91,156,246,0.18)" : s.bg,
        border: `1px solid ${selected ? COLOR.accent : mine ? "rgba(120,220,170,0.5)" : s.border}`,
        fontSize: FS.meta, color: COLOR.text }}>
      <span>{e.group.name}</span>
      <span style={{ fontSize: FS.tag, color: s.text }}>{s.label}</span>
      {/* The viewer's position, marked ON the global object — not by removing
          the other objects from the map. */}
      {mine ? <span style={{ fontSize: FS.tag, color: "#7fe0ab" }}>● {REL_LABEL[relation]}</span> : null}
    </a>
  );
}

export default function ValueUniversePanel({
  universe, registry, overlay, selected, relations,
}: {
  universe: ValueGroupUniverse;
  registry: ValueGroupRegistry;
  overlay: ViewerGroupOverlay;
  selected: SelectedGroupContext;
  relations: readonly GroupRelation[];
}) {
  const c = universe.coverage;
  const populatedFamilies = universe.families.filter((f) => f.group_count > 0);
  const emptyFamilies = universe.families.length - populatedFamilies.length;

  return (
    <section style={{ margin: `${SPACE.md}px ${SPACE.lg}px 0`, padding: SPACE.lg,
      background: COLOR.bgRaised, border: `1px solid ${COLOR.border}`, borderRadius: RADIUS.lg }}>
      <h2 style={{ fontSize: FS.title, fontWeight: 700, margin: 0, color: COLOR.text, textWrap: "balance" }}>
        עולם קבוצות הערך
      </h2>
      <p style={{ fontSize: FS.read, color: COLOR.textDim, margin: `${SPACE.xs}px 0 ${SPACE.md}px`, maxWidth: "62ch" }}>
        כל הספקטרום — לא רק הקבוצות שאתה חבר בהן. מה שאתה חבר בו מסומן בתוך המפה, ולא מחליף אותה.
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: SPACE.md }}>
        <Metric label="הטקסונומיה" value={`${c.family_count} · ${c.subvalue_count}`} sub="משפחות ערך · תת-ערכים" />
        <Metric label="כל הקבוצות" value={String(c.group_count)} sub={`${registry.real_count} אמיתיות · ${registry.demo_count} DEMO`} tone="accent" />
        <Metric label="הקבוצות שלי" value={String(overlay.membership_count)} sub={overlay.membership_count ? overlay.memberGroupIds.join(" · ") : "אין חברות מתועדת"} />
        <Metric label="קשרים בין קבוצות" value={String(relations.length)} sub={relations.length ? "נגזרו מראיות" : "אין ראיה לקשר — לא הומצא קשר"} tone="dim" />
      </div>

      {/* THE TWO COVERAGES, stated apart. This sentence is the panel's thesis. */}
      <p style={{ fontSize: FS.meta, color: COLOR.textFaint, margin: `${SPACE.md}px 0 0`, maxWidth: "72ch", lineHeight: 1.6 }}>
        כיסוי אונטולוגי: {c.subvalue_count} תת-ערכים מתוארים · כיסוי אוכלוסייה: {c.populated_subvalue_count} מהם מאוכלסים בקבוצה
        {c.subvalue_count > 0 ? ` (${((c.populated_subvalue_count / c.subvalue_count) * 100).toFixed(1)}%)` : ""}.
        {c.unplaced_group_count > 0
          ? ` ${c.unplaced_group_count} קבוצות עדיין לא ממופות לטקסונומיה — מוצגות למטה, לא מוסתרות.`
          : ""}
      </p>

      {/* GROUPS NOT ON THE SPECTRUM. Unmapped is not deleted. */}
      {universe.unplaced.length > 0 ? (
        <div style={{ marginTop: SPACE.lg, padding: SPACE.md, background: COLOR.bgCard,
          border: `1px dashed ${COLOR.borderStrong}`, borderRadius: RADIUS.md }}>
          <div style={{ fontSize: FS.section, fontWeight: 600, color: COLOR.text }}>
            קבוצות שממתינות להכרעת ערך ({universe.unplaced.length})
          </div>
          <p style={{ fontSize: FS.meta, color: COLOR.textDim, margin: `2px 0 ${SPACE.sm}px`, maxWidth: "68ch" }}>
            הערך המוצהר שלהן אינו זהה לאף אחד מ-{c.subvalue_count} תת-הערכים הקנוניים. התאמה מטושטשת אינה ראיה, ולכן המיפוי נשאר פתוח.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: SPACE.sm }}>
            {universe.unplaced.map((e) => (
              <GroupChip key={e.group.group_id} e={e} relation={overlay.relationOf(e.group.group_id)}
                selected={selected.status === "selected" && selected.group_id === e.group.group_id} />
            ))}
          </div>
          {universe.unplaced.map((e) =>
            e.mapping.candidates.length ? (
              <div key={`c-${e.group.group_id}`} style={{ marginTop: SPACE.sm, fontSize: FS.meta, color: COLOR.textFaint }}>
                <span style={{ color: COLOR.textDim }}>{e.group.name} — "{e.group.central_value_label}":</span>{" "}
                {e.mapping.candidates.length} מועמדים ({e.mapping.candidates.slice(0, 4).map((x) => x.name_he).join(" · ")}
                {e.mapping.candidates.length > 4 ? " …" : ""}) — נדרשת הכרעה
              </div>
            ) : null)}
        </div>
      ) : null}

      {/* THE SPECTRUM. All 28 families; populated ones first so the sparse
          majority does not bury the three groups that do exist. */}
      <div style={{ marginTop: SPACE.lg }}>
        <div style={{ fontSize: FS.head, fontWeight: 650, color: COLOR.text, marginBottom: SPACE.sm }}>ספקטרום הערכים</div>
        {[...populatedFamilies, ...universe.families.filter((f) => f.group_count === 0)].map((f) => (
          <details key={f.family_id} style={{ marginBottom: 6, background: COLOR.bgCard,
            border: `1px solid ${f.group_count > 0 ? COLOR.borderStrong : COLOR.border}`, borderRadius: RADIUS.md }}>
            <summary style={{ display: "flex", alignItems: "center", gap: SPACE.md, minBlockSize: 32,
              padding: `${SPACE.sm}px ${SPACE.md}px`, cursor: "pointer", listStyle: "none" }}>
              <span style={{ fontSize: FS.tag, color: COLOR.textFaint, fontVariantNumeric: "tabular-nums", minWidth: 30 }}>{f.family_id}</span>
              <span style={{ fontSize: FS.read, color: COLOR.text, flex: 1 }}>{f.name_he}</span>
              <span style={{ fontSize: FS.meta, color: COLOR.textDim, fontVariantNumeric: "tabular-nums" }}>{f.subvalue_count} תת-ערכים</span>
              <span style={{ fontSize: FS.meta, fontVariantNumeric: "tabular-nums",
                color: f.group_count > 0 ? "#7fe0ab" : COLOR.textFaint }}>{f.group_count} קבוצות</span>
            </summary>
            <div style={{ padding: `0 ${SPACE.md}px ${SPACE.md}px`, borderTop: `1px solid ${COLOR.border}` }}>
              <div style={{ fontSize: FS.meta, color: COLOR.textFaint, margin: `${SPACE.sm}px 0` }}>{f.content_he}</div>
              {f.subvalues.map((s) => (
                <div key={s.subvalue_id} style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: SPACE.sm,
                  padding: "5px 0", borderTop: `1px solid ${COLOR.border}` }}>
                  <span style={{ fontSize: FS.tag, color: COLOR.textFaint, minWidth: 44, fontVariantNumeric: "tabular-nums" }}>{s.subvalue_id}</span>
                  <span style={{ fontSize: FS.base, color: COLOR.text, minWidth: 150 }}>{s.name_he}</span>
                  <span style={{ fontSize: FS.tag, color: COLOR.textFaint }}>{s.source_count} מקורות</span>
                  {s.group_count === 0
                    ? <span style={{ fontSize: FS.tag, color: COLOR.textFaint }}>0 קבוצות</span>
                    : <span style={{ display: "flex", gap: SPACE.xs, flexWrap: "wrap" }}>
                        {s.groups.map((e) => (
                          <GroupChip key={e.group.group_id} e={e} relation={overlay.relationOf(e.group.group_id)}
                            selected={selected.status === "selected" && selected.group_id === e.group.group_id} />
                        ))}
                      </span>}
                </div>
              ))}
            </div>
          </details>
        ))}
        {emptyFamilies > 0 ? (
          <p style={{ fontSize: FS.meta, color: COLOR.textFaint, marginTop: SPACE.sm }}>
            {emptyFamilies} מתוך {c.family_count} משפחות הערך עדיין ללא אף קבוצה. זה פער אוכלוסייה, לא פער טקסונומיה.
          </p>
        ) : null}
      </div>

      {/* SELECTION — inspection, stated as inspection. */}
      <div style={{ marginTop: SPACE.lg, paddingTop: SPACE.md, borderTop: `1px solid ${COLOR.border}`, fontSize: FS.meta, color: COLOR.textDim }}>
        {selected.status === "selected" ? (
          <>נבחרה לבדיקה: <strong style={{ color: COLOR.text }}>{selected.entry.group.name}</strong> ·{" "}
            {overlay.relationOf(selected.group_id) === "NONE"
              ? "אינך חבר בה — בדיקה אינה יוצרת חברות"
              : `היחס שלך אליה: ${REL_LABEL[overlay.relationOf(selected.group_id)]}`}</>
        ) : selected.status === "unknown_group" ? (
          <span style={{ color: "#f0b45c" }}>{selected.because}</span>
        ) : (
          <>NO_GROUP_SELECTED — לא נבחרה קבוצה, ולא נבחרה אחת כברירת מחדל.</>
        )}
      </div>
    </section>
  );
}
