"use client";

/**
 * ExplainerSequence — a real, steppable Hebrew sequence rendering
 * `PHILOS-EXPLAINER-STORYBOARD.md`'s shots 5–12 (the ones this repo can
 * back with real components/data). Shots 1–4/13–14 (system/world framing)
 * render as staged text only, per the storyboard's own "does not claim"
 * section — no real system/world entity data exists to visualize honestly.
 */
import { useState } from "react";

const WHITE = "#e8ecf5", PURPLE = "#b592e8", BLUE = "#5b9cf6", GREEN = "#4fd1a5", YELLOW = "#f2d34a", ORANGE = "#f2a154", RED = "#f2635c";

type Status = "SOURCE_PROVEN" | "PRODUCT_STRUCTURE" | "VISUAL_REFERENCE";
const STATUS_LABEL: Record<Status, string> = {
  SOURCE_PROVEN: "מבוסס מקור מאומת",
  PRODUCT_STRUCTURE: "מבנה מוצר אמיתי",
  VISUAL_REFERENCE: "מסגור חזותי בלבד",
};
const STATUS_COLOR: Record<Status, string> = { SOURCE_PROVEN: GREEN, PRODUCT_STRUCTURE: BLUE, VISUAL_REFERENCE: "#5a76a3" };

interface Shot { n: number; narration: string; color: string; status: Status; product: string; link?: string }

const SHOTS: Shot[] = [
  { n: 1, narration: "יש מציאות רחבה מסביב.", color: WHITE, status: "VISUAL_REFERENCE", product: "Planet — קנה מידה מערכתי" },
  { n: 2, narration: "בתוכה — מערכות ומבנים.", color: BLUE, status: "PRODUCT_STRUCTURE", product: "Brain — טבעת מערכת (UNKNOWN היום)" },
  { n: 3, narration: "קהילות, שנושאות ערכים.", color: PURPLE, status: "PRODUCT_STRUCTURE", product: "Community — יכולת קולקטיבית", link: "/hub/community" },
  { n: 4, narration: "בתוך קהילה — קבוצות וקשרים אמיתיים.", color: GREEN, status: "PRODUCT_STRUCTURE", product: "Planet — value_group + קשתות חברות אמיתיות", link: "/planet" },
  { n: 5, narration: "ובמרכז — אדם אחד.", color: BLUE, status: "PRODUCT_STRUCTURE", product: "Hub / Brain — צומת אדם מרכזי", link: "/hub" },
  { n: 6, narration: "גוף. רגש. שכל.", color: ORANGE, status: "SOURCE_PROVEN", product: "קנון §3 — Domain (G/E/C)", link: "/hub" },
  { n: 7, narration: "כוחות פועלים על האדם — חלקם ידועים, חלקם עדיין לא.", color: ORANGE, status: "SOURCE_PROVEN", product: "6/10 כוחות מאומתים ממקור", link: "/brain" },
  { n: 8, narration: "המצב משתנה — יש מה שנצפה, ויש מה שעוד לא ידוע.", color: YELLOW, status: "PRODUCT_STRUCTURE", product: "Dynamics — מצב קודם ← כוח ← מצב נוכחי", link: "/dynamics" },
  { n: 9, narration: "האדם לא לבד — יש קבוצה סביבו, עם יכולת פוטנציאלית.", color: GREEN, status: "PRODUCT_STRUCTURE", product: "Community — יכולת פוטנציאלית vs אפקטיבית", link: "/hub/community" },
  { n: 10, narration: "צורך יכול לפגוש יכולת — אבל רק דרך הסכמה אמיתית, לא אוטומטית.", color: RED, status: "SOURCE_PROVEN", product: "קנון §10/§14 — Matching, לא Flow", link: "/marketplace" },
  { n: 11, narration: "עזרה לאחד אינה חיובית אם היא יוצרת מחסור חמור אצל מי שנותן.", color: RED, status: "SOURCE_PROVEN", product: "קנון §1/§21 — Anti-Depletion", link: "/marketplace" },
  { n: 12, narration: "פעולה משפיעה — וההשפעה חוזרת כראיה חדשה.", color: RED, status: "PRODUCT_STRUCTURE", product: "מצב מעודכן — עדיין UNKNOWN בפועל", link: "/marketplace" },
  { n: 13, narration: "וכל זה חוזר להיות חלק מהמציאות הרחבה יותר.", color: WHITE, status: "VISUAL_REFERENCE", product: "Brain — תצוגת macro" },
  { n: 14, narration: "וממשיך משם, מהאדם, שוב.", color: BLUE, status: "VISUAL_REFERENCE", product: "הלולאה נסגרת" },
];

export default function ExplainerSequence() {
  const [i, setI] = useState(0);
  const shot = SHOTS[i];

  return (
    <div dir="rtl" style={{ fontFamily: "system-ui", background: "#080b13", color: "#e6ebf5", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ fontSize: 10, letterSpacing: 2, color: "#5aa6ff" }}>PHILOS — רצף הסבר · שוט {shot.n}/{SHOTS.length}</div>

      <div style={{ width: 200, height: 200, borderRadius: "50%", border: `3px solid ${shot.color}`, background: `${shot.color}18`, display: "flex", alignItems: "center", justifyContent: "center", margin: "24px 0", transition: "all 0.4s" }}>
        <div style={{ width: 40, height: 40, borderRadius: "50%", background: shot.color }} />
      </div>

      <div style={{ fontSize: 20, fontWeight: 700, textAlign: "center", maxWidth: 520 }}>{shot.narration}</div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 16 }}>
        <span style={{ fontSize: 10, padding: "4px 10px", borderRadius: 12, border: `1px solid ${STATUS_COLOR[shot.status]}`, color: STATUS_COLOR[shot.status] }}>
          {STATUS_LABEL[shot.status]}
        </span>
        <span style={{ fontSize: 11, color: "#7f97c2" }}>{shot.product}</span>
      </div>

      {shot.link ? (
        <a href={shot.link} style={{ fontSize: 12, color: shot.color, marginTop: 10 }}>פתח במוצר →</a>
      ) : null}

      <div style={{ display: "flex", gap: 8, marginTop: 28 }}>
        <button onClick={() => setI((v) => Math.max(0, v - 1))} disabled={i === 0} style={{ fontSize: 12, padding: "6px 16px", borderRadius: 20, border: "1px solid #2a3f66", background: "transparent", color: i === 0 ? "#3a4d70" : "#e6ebf5", cursor: i === 0 ? "default" : "pointer" }}>
          הקודם
        </button>
        <button onClick={() => setI((v) => Math.min(SHOTS.length - 1, v + 1))} disabled={i === SHOTS.length - 1} style={{ fontSize: 12, padding: "6px 16px", borderRadius: 20, border: `1px solid ${shot.color}`, background: shot.color, color: "#0b0f1a", fontWeight: 600, cursor: i === SHOTS.length - 1 ? "default" : "pointer", opacity: i === SHOTS.length - 1 ? 0.4 : 1 }}>
          הבא
        </button>
      </div>

      <div style={{ display: "flex", gap: 4, marginTop: 16 }}>
        {SHOTS.map((s, idx) => (
          <div key={s.n} onClick={() => setI(idx)} style={{ width: 6, height: 6, borderRadius: 3, background: idx === i ? shot.color : "#2a3f66", cursor: "pointer" }} />
        ))}
      </div>

      <div style={{ fontSize: 10, color: "#5a76a3", marginTop: 20, maxWidth: 460, textAlign: "center" }}>
        סטוריבורד מלא: PHILOS-EXPLAINER-STORYBOARD.md · לא סרטון סופי — רצף אמיתי, לא תיאור בלבד.
      </div>
    </div>
  );
}
