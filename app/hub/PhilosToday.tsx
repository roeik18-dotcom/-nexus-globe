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

const TERMINALS = [
  ["WORLD", "עולם"], ["PEOPLE", "אנשים"], ["VALUES", "ערכים"],
  ["ACTIVITY", "פעילות"], ["RESOURCES", "משאבים"], ["IMPACT", "השפעה"],
] as const;

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

export default function PhilosToday({ figures }: { figures: TodayFigures }) {
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
      <header style={S.nav}>
        <div style={S.brand}><span style={S.mark} /> PHILOS</div>
        <nav style={S.terminals}>
          {TERMINALS.map(([en, he]) => (
            <Link key={en} href="/hub/community" style={S.term}>
              <span style={S.termHe}>{he}</span><span style={S.termEn}>{en}</span>
            </Link>
          ))}
        </nav>
      </header>

      <main style={S.page}>
        <div style={S.heroHead}>
          היום ב-Philos <span style={S.heroSub}>— מה נרשם ביומן האירועים</span>
        </div>
        <div style={S.notice}>
          כל מספר בעמוד הזה נגזר מיומן האירועים. המערכת מכילה כרגע קבוצת ערך אחת,
          ולכן המספרים קטנים — זה המצב האמיתי, לא דוגמה.
        </div>

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

        <Link href="/hub/community" style={S.cta}>
          היכנס לקבוצה: <b>{figures.group_name}</b> · {figures.members} חברים · {figures.events_total} אירועים ←
        </Link>
      </main>
    </div>
  );
}

const card: React.CSSProperties = { background: "rgba(18,24,38,0.7)", border: "1px solid rgba(90,120,180,0.14)", borderRadius: 16, padding: "16px 18px" };
const S: Record<string, React.CSSProperties> = {
  root: { minHeight: "100vh", background: "radial-gradient(120% 80% at 50% -10%, #0e1626 0%, #070b14 60%, #04060c 100%)", color: "#e8edf6", fontFamily: "system-ui, -apple-system, sans-serif" },
  nav: { display: "flex", alignItems: "center", gap: 24, padding: "14px 30px", borderBottom: "1px solid rgba(90,120,180,0.12)", position: "sticky", top: 0, background: "rgba(7,11,20,0.85)", backdropFilter: "blur(10px)", zIndex: 20 },
  brand: { display: "flex", alignItems: "center", gap: 9, fontSize: 15, fontWeight: 700, letterSpacing: "3px", color: "#eaf1ff" },
  mark: { width: 20, height: 20, borderRadius: "50%", background: "radial-gradient(circle at 50% 40%, #ffd477, #e08a2b 55%, transparent 75%)", boxShadow: "0 0 14px 2px rgba(255,180,80,0.5)" },
  terminals: { display: "flex", gap: 4, flex: 1 },
  term: { display: "flex", flexDirection: "column", alignItems: "center", padding: "6px 14px", borderRadius: 10, color: "#7f93b5", textDecoration: "none" },
  termHe: { fontSize: 13, fontWeight: 600 }, termEn: { fontSize: 7.5, letterSpacing: "1.5px", opacity: 0.6 },

  page: { maxWidth: 1180, margin: "0 auto", padding: "26px 30px 46px" },
  heroHead: { fontSize: 22, fontWeight: 800, color: "#f4f8ff", marginBottom: 12 },
  heroSub: { fontSize: 14, fontWeight: 400, color: "#7f93b5" },
  notice: { fontSize: 11.5, lineHeight: 1.6, color: "#8aa0c8", padding: "9px 13px", borderRadius: 10, background: "rgba(90,120,180,0.08)", border: "1px solid rgba(90,120,180,0.16)", marginBottom: 16 },

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
};
