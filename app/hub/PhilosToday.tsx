"use client";

/**
 * PhilosToday — the entry screen.
 *
 * Every figure here is projected from the canonical event log (app/lib/philos).
 * There are no example numbers and no animated counters: the previous version
 * ticked six headline stats upward with Math.random() every 2.2 s, which made a
 * fabricated figure look like a live measurement — the exact thing
 * PHILOS-SYSTEM-BLUEPRINT §0 forbids ("every metric declares source · time-range
 * · sample-size · confidence · verification-status").
 *
 * Sections that need data the log cannot yet supply — value movement, 24-hour
 * trends — are shown as explicit placeholders naming what is missing. Sections
 * that were pure invention (live counts, rotating success stories, influence
 * leaderboards) are removed rather than filled with a different guess.
 */

import Link from "next/link";

const nis = (n: number) => "₪" + n.toLocaleString("he-IL");

export interface TodayFigures {
  group_name: string;
  groups: number;
  members: number;
  events_total: number;
  events_today: number;
  money_received: number;
  money_transferred: number;
  people_affected_verified: number;
  transfer?: { amount: number; from_value: string; to: string };
}

/**
 * What the log knows about the person reading the screen — projected by
 * `projectViewerIdentity`, never assumed here. `name_is_recorded` is the field
 * that keeps this honest: a name the log has not registered is shown as not yet
 * recorded rather than printed as though an event carried it.
 */
export interface TodayViewer {
  display_name: string;
  name_is_recorded: boolean;
  registered: boolean;
  memberships: { group_name: string; basis: "joined" | "founded" | "appointed"; since: string }[];
  recorded_events: number;
  source_events: number;
}

const BASIS_LABEL: Record<TodayViewer["memberships"][number]["basis"], string> = {
  joined: "הצטרפת",
  founded: "פתחת",
  appointed: "מונית",
};

export default function PhilosToday({
  figures,
  you,
  canonSection,
}: {
  figures: TodayFigures;
  you: TodayViewer;
  /** Optional slot for the canon-aware section (Observation → CellState →
   *  Need lookup). Kept as an injected slot, not imported here, so this
   *  file's own scope stays exactly the Value Group projection it already
   *  was — the canon section owns its own data fetching independently. */
  canonSection?: React.ReactNode;
}) {
  const stats: [string, string][] = [
    [String(figures.groups), "קבוצות ערך"],
    [String(figures.members), "חברים"],
    [String(figures.events_today), "אירועים היום"],
    [String(figures.events_total), "אירועים בסך הכל"],
    [nis(figures.money_received), "התקבלו"],
    [String(figures.people_affected_verified), "אנשים — אומת"],
  ];

  return (
    <div dir="rtl" style={S.root}>
      {/* The shared shell used to mount HERE. It now mounts once, at the
          top of `app/hub/page.tsx`, because this component became the
          collapsed FULL LEGACY DASHBOARD at the bottom of that page —
          leaving Hub with no visible navigation, and (when expanded) a
          SECOND primary nav on the same screen. Same shell, same props,
          one mount — so the `subject`/`identityLink` props that existed
          only to feed it are gone from here too. */}
      <main style={S.page}>
        <div style={S.heroHead}>
          היום ב-Philos <span style={S.heroSub}>— מה נרשם ביומן האירועים</span>
        </div>
        <div style={S.notice}>
          כל מספר בעמוד הזה נגזר מיומן האירועים. המערכת מכילה כרגע קבוצת ערך אחת,
          ולכן המספרים קטנים — זה המצב האמיתי, לא דוגמה.
        </div>

        {/* §14 — the journey starts with *why me*, so the personal answer comes
            before the system totals. Everything in it is projected from events
            attributed to this viewer; when the log knows nothing, it says so. */}
        <section style={S.you}>
          <div style={S.youHead}>
            <h2 style={S.youTitle}>אתה ב-Philos</h2>
            <span style={S.hint}>
              {you.source_events > 0
                ? `מקור: ${you.source_events} אירועים`
                : "אין אירועים שמתעדים אותך"}
            </span>
          </div>

          {you.registered ? (
            <div style={S.youBody}>
              <div style={S.youLine}>
                נרשמת ביומן בשם <b style={S.youStrong}>{you.display_name}</b>
                {" · "}
                <span style={S.youMuted}>{you.recorded_events} אירועים שביצעת</span>
              </div>
              {you.memberships.length > 0 ? (
                <ul style={S.youList}>
                  {you.memberships.map((m) => (
                    <li key={`${m.group_name}-${m.since}`} style={S.youItem}>
                      {BASIS_LABEL[m.basis]} <b style={S.youStrong}>{m.group_name}</b>
                      {" · "}
                      <span style={S.youMuted}>{m.since}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div style={S.placeholder}>אינך חבר באף קבוצת ערך עדיין.</div>
              )}
            </div>
          ) : (
            <div style={S.youBody}>
              <div style={S.placeholder}>
                היומן עדיין לא מתעד אותך. השם{" "}
                <b style={S.youStrong}>{you.display_name}</b> מוגדר מקומית ולא נרשם
                כאירוע — הוא ייכתב ליומן בפעולה הראשונה שלך.
              </div>
            </div>
          )}
          {you.registered && !you.name_is_recorded && (
            <div style={S.placeholder}>השם מוגדר מקומית ולא נגזר מאירוע רישום.</div>
          )}
        </section>

        <section style={S.stats}>
          {stats.map(([n, label]) => (
            <div key={label} style={S.stat}>
              <div style={S.statN}>{n}</div>
              <div style={S.statL}>{label}</div>
            </div>
          ))}
        </section>

        <div style={S.grid}>
          {/* event-derived: the one transfer that actually moved */}
          <section style={{ ...S.card, gridColumn: "span 2" }}>
            <div style={S.cardHead}>
              <h2 style={S.cardTitle}>זרימת ערך</h2>
              <span style={S.hint}>מתוך העברות שהושלמו</span>
            </div>
            {figures.transfer ? (
              <div style={S.flow}>
                <span style={S.flowAmt}>{nis(figures.transfer.amount)}</span>
                <span style={S.flowStep}>מ<b style={S.flowVal}>{figures.transfer.from_value}</b></span>
                <span style={S.flowArr}>←</span>
                <span style={S.flowStep}>ל<b style={S.flowTo}>{figures.transfer.to}</b></span>
              </div>
            ) : (
              <div style={S.placeholder}>טרם הושלמה העברה.</div>
            )}
          </section>

          {/* explicit placeholder: needs value-movement events */}
          <section style={{ ...S.card, gridColumn: "span 2" }}>
            <div style={S.cardHead}>
              <h2 style={S.cardTitle}>ערכים חיים</h2>
              <span style={S.hint}>ממתין לנתונים</span>
            </div>
            <div style={S.placeholder}>
              תנועת ערכים דורשת אירועים מתויגי-ערך לאורך זמן ומכמה קבוצות.
              קיימת קבוצה אחת, ולכן אין ממה לגזור מגמה.
            </div>
          </section>

          {/* explicit placeholder: needs a time series */}
          <section style={{ ...S.card, gridColumn: "span 4" }}>
            <div style={S.cardHead}>
              <h2 style={S.cardTitle}>ב-24 שעות</h2>
              <span style={S.hint}>ממתין לנתונים</span>
            </div>
            <div style={S.placeholder}>
              מגמה יומית דורשת יומן שנצבר על פני ימים. היומן הנוכחי מתעד קבוצה אחת
              מ-18.7.2026, בלי מדידה רציפה.
            </div>
          </section>
        </div>

        {canonSection ? (
          <details style={{ margin: "12px 0" }}>
            <summary style={{ cursor: "pointer", fontSize: 10.5, letterSpacing: 1, color: "#5a76a3", padding: "4px 0" }}>
              DETAILS / AUDIT — Canon field-level lookup (Observation → CellState → Need)
            </summary>
            <div style={{ marginTop: 8 }}>{canonSection}</div>
          </details>
        ) : null}

        <Link href="/hub/community" style={S.cta}>
          היכנס לקבוצה: <b>{figures.group_name}</b> · {figures.members} חברים · {figures.events_total} אירועים ←
        </Link>

        {/* The globe is a visualization layer, reached from the hub — never the
            front door. Deliberately secondary to the group CTA above. */}
        <Link href="/planet" style={S.globeLink}>
          תצוגת גלובוס — הקשרים כפי שנגזרו מהאירועים ←
        </Link>
      </main>
    </div>
  );
}

const card: React.CSSProperties = { background: "rgba(18,24,38,0.7)", border: "1px solid rgba(90,120,180,0.14)", borderRadius: 16, padding: "16px 18px" };
const S: Record<string, React.CSSProperties> = {
  root: { minHeight: "100vh", background: "radial-gradient(120% 80% at 50% -10%, #0e1626 0%, #070b14 60%, #04060c 100%)", color: "#e8edf6", fontFamily: "system-ui, -apple-system, sans-serif" },

  page: { maxWidth: 1180, margin: "0 auto", padding: "26px 30px 46px" },
  heroHead: { fontSize: 22, fontWeight: 800, color: "#f4f8ff", marginBottom: 12 },
  heroSub: { fontSize: 14, fontWeight: 400, color: "#7f93b5" },
  notice: { fontSize: 11.5, lineHeight: 1.6, color: "#8aa0c8", padding: "9px 13px", borderRadius: 10, background: "rgba(90,120,180,0.08)", border: "1px solid rgba(90,120,180,0.16)", marginBottom: 16 },

  you: { ...card, marginBottom: 16, padding: "16px 18px" },
  youHead: { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, marginBottom: 10 },
  youTitle: { fontSize: 14, fontWeight: 700, margin: 0, color: "#f0f4fc" },
  youBody: { display: "flex", flexDirection: "column", gap: 8 },
  youLine: { fontSize: 12.5, lineHeight: 1.7, color: "#a9bcdc" },
  youStrong: { color: "#e8edf6" },
  youMuted: { color: "#7f93b5" },
  youList: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 5 },
  youItem: { fontSize: 12.5, lineHeight: 1.6, color: "#a9bcdc" },

  stats: { display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 14, marginBottom: 20 },
  stat: { ...card, textAlign: "center", padding: "18px 10px" },
  statN: { fontSize: 26, fontWeight: 800, color: "#f4f8ff", fontVariantNumeric: "tabular-nums", lineHeight: 1.1, letterSpacing: "-0.5px" },
  statL: { fontSize: 10.5, color: "#6a83ad", marginTop: 6, lineHeight: 1.3 },

  grid: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16 },
  card,
  cardHead: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  cardTitle: { fontSize: 15, fontWeight: 700, margin: 0, color: "#f0f4fc" },
  hint: { fontSize: 10, color: "#5f7aa6" },
  placeholder: { fontSize: 12.5, lineHeight: 1.7, color: "#7f93b5", minHeight: 44 },

  flow: { display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", minHeight: 44 },
  flowAmt: { fontSize: 24, fontWeight: 800, color: "#34d399" },
  flowStep: { fontSize: 14, color: "#cdd8ec" },
  flowVal: { color: "#ffce8a" },
  flowTo: { color: "#7dd3fc" },
  flowArr: { color: "#5f7aa6", fontSize: 18 },

  cta: { display: "block", marginTop: 22, textAlign: "center", padding: "15px", borderRadius: 14, background: "linear-gradient(90deg, rgba(70,120,200,0.2), rgba(52,211,153,0.14))", border: "1px solid rgba(110,160,240,0.3)", color: "#eaf1ff", fontSize: 15, fontWeight: 600, textDecoration: "none" },
  globeLink: { display: "block", marginTop: 14, textAlign: "center", fontSize: 12.5, color: "#6b87a8", textDecoration: "none" },
};
