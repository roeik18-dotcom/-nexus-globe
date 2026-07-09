"use client";

/**
 * Nexus — 30-Second Opening Experience.
 *
 * Three screens:
 *   input   — User types what's weighing on them.
 *   mapping — "We're mapping your situation." (minimum 1.8s, no spinner).
 *   result  — Four plain-language sections + "See the full map".
 *
 * The /api/analyze route classifies the user's text into a dominantForce
 * (emotional | physical | id | ego | social | rational). That force selects
 * which plain-language copy is shown. The helper-network numbers come from
 * computeNoaChain(0) — the canonical Case Zero chain.
 *
 * No ontology jargon is shown until the user clicks "See the full map".
 * No charts. No percentages. No spinner.
 */

import React, { useMemo, useState } from "react";
import { computeNoaChain } from "../lib/noa";

// ─── Types ────────────────────────────────────────────────────────────────────

type Screen = "input" | "mapping" | "result";
type Lang = "en" | "he";
type DominantForce = "emotional" | "physical" | "id" | "ego" | "social" | "rational";

const VALID_FORCES: DominantForce[] = ["emotional", "physical", "id", "ego", "social", "rational"];

// ─── Colors ───────────────────────────────────────────────────────────────────

const C = {
  bg2:        "#020d1a",
  border:     "#0a2a4a",
  borderSoft: "#1e4060",
  text:       "#cfe6f5",
  textMuted:  "#8bb8cc",
  cyan:       "#38bdf8",
  green:      "#34d399",
  red:        "#ef4444",
  orange:     "#fb923c",
};

// ─── Force-sensitive content ──────────────────────────────────────────────────

interface ForceContent {
  pressure:  string;
  missing:   string;
  firstMove: string;
}

const EN: Record<DominantForce, ForceContent> = {
  emotional: {
    pressure:  "The heaviest pressure is emotional — connection, belonging, and trust.",
    missing:   "Emotional support. Connection and belonging are not fully reaching you.",
    firstMove: "Ask one trusted person for one specific form of help.",
  },
  physical: {
    pressure:  "The heaviest pressure is physical — your body, energy, and safety.",
    missing:   "Physical restoration. Rest, safety, and care are not sufficiently present.",
    firstMove: "Rest first. Before anything else, protect your physical capacity.",
  },
  id: {
    pressure:  "The heaviest pressure is on survival energy — depletion, rest, and protection.",
    missing:   "Restoration and safety. Survival energy is depleted and needs replenishing.",
    firstMove: "Rest and restore. Protect your energy before taking any next step.",
  },
  ego: {
    pressure:  "The heaviest pressure is on direction — agency, identity, and what to do next.",
    missing:   "Orientation. A clear sense of direction and agency is missing.",
    firstMove: "Identify one person who can help with direction. Make the ask specific.",
  },
  social: {
    pressure:  "The heaviest pressure is relational — people around you and what is expected.",
    missing:   "Clear connection. The relationships around you are not carrying what they could.",
    firstMove: "Send one honest message to one person about what you actually need.",
  },
  rational: {
    pressure:  "The heaviest pressure is mental — decisions, clarity, and information load.",
    missing:   "Clarity. The information, structure, and decision support you need is missing.",
    firstMove: "Write down the most important decision you are avoiding. Just naming it is the first step.",
  },
};

const HE: Record<DominantForce, ForceContent> = {
  emotional: {
    pressure:  "הלחץ הכבד ביותר הוא רגשי — קשר, שייכות ואמון.",
    missing:   "תמיכה רגשית. קשר ושייכות לא מגיעים אליך במלואם.",
    firstMove: "בקש מאדם אחד שאתה סומך עליו צורה אחת ספציפית של עזרה.",
  },
  physical: {
    pressure:  "הלחץ הכבד ביותר הוא פיזי — גוף, אנרגיה ובטחון.",
    missing:   "שיקום פיזי. מנוחה, בטחון וטיפול אינם נוכחים מספיק.",
    firstMove: "קודם מנוחה. לפני הכל, הגן על הכוח הפיזי שלך.",
  },
  id: {
    pressure:  "הלחץ הכבד ביותר הוא על אנרגיית ההישרדות — דלדול, מנוחה והגנה.",
    missing:   "שיקום ובטחון. אנרגיית ההישרדות מדולדלת וזקוקה לחידוש.",
    firstMove: "מנוחה ושיקום. הגן על האנרגיה שלך לפני כל צעד הבא.",
  },
  ego: {
    pressure:  "הלחץ הכבד ביותר הוא על כיוון — תחושת סוכנות, זהות ומה עושים הלאה.",
    missing:   "כיוון. תחושה ברורה של כיוון ושליטה חסרה.",
    firstMove: "זהה אדם אחד שיכול לעזור עם כיוון. הפוך את הבקשה לקונקרטית.",
  },
  social: {
    pressure:  "הלחץ הכבד ביותר הוא יחסי — האנשים סביבך ומה שמצפה מהם.",
    missing:   "קשר ברור. הקשרים סביבך לא נושאים את הנטל שהם יכולים.",
    firstMove: "שלח הודעה כנה אחת לאדם אחד על מה שאתה צריך באמת.",
  },
  rational: {
    pressure:  "הלחץ הכבד ביותר הוא מנטלי — החלטות, בהירות ועומס מידע.",
    missing:   "בהירות. המידע, המבנה ותמיכת ההחלטות שאתה צריך חסרים.",
    firstMove: "כתוב את ההחלטה הכי חשובה שאתה נמנע ממנה. לתת לה שם זה הצעד הראשון.",
  },
};

// ─── Static UI strings ────────────────────────────────────────────────────────

const T = {
  en: {
    promise:  "Turn confusion into a map.",
    title:    "What's weighing on you right now?",
    subtitle: "Describe what's feeling heavy, stuck, unclear, or urgent.",
    placeholder: "Tell us in your own words.",
    button:   "Show me the map",
    examples: [
      "I feel stuck after losing my job.",
      "My family is pressuring me.",
      "I have no energy and too many decisions.",
      "I don't know what to do next.",
    ],
    emptyHint: "Say something first — any words, however they come.",
    mapping1: "We're mapping your situation.",
    mapping2: "Looking for pressure, support, and possible next moves.",
    label1:   "What we found",
    label2:   "What's missing",
    label3:   "What may already exist",
    label4:   "First move",
    available: (n: number, pct: number) =>
      `${n} people are in a position to help. ${pct}% of what you are carrying can be shared — the path to them just needs to be clearer.`,
    expand:  "See the full map",
    restart: "Start over",
    langToggle: "עברית",
  },
  he: {
    promise:  "הפיכת בלבול למפה.",
    title:    "מה כובד עליך עכשיו?",
    subtitle: "תאר מה מרגיש כבד, תקוע, לא ברור או דחוף.",
    placeholder: "ספר לנו במילים שלך.",
    button:   "הראה לי את המפה",
    examples: [
      "אני מרגיש תקוע אחרי שאיבדתי עבודה.",
      "המשפחה שלי לוחצת עלי.",
      "אין לי אנרגיה ויש יותר מדי החלטות.",
      "אני לא יודע מה לעשות הלאה.",
    ],
    emptyHint: "אמור משהו קודם — כל מילים, איך שהם באים.",
    mapping1: "אנחנו ממפים את המצב שלך.",
    mapping2: "מחפשים לחץ, תמיכה וצעדים אפשריים.",
    label1:   "מה מצאנו",
    label2:   "מה חסר",
    label3:   "מה אולי כבר קיים",
    label4:   "הצעד הראשון",
    available: (n: number, pct: number) =>
      `${n} אנשים במצב לעזור. ${pct}% ממה שאתה נושא יכול להתחלק — הדרך אליהם רק צריכה להיות ברורה יותר.`,
    expand:  "ראה את המפה המלאה",
    restart: "התחל מחדש",
    langToggle: "English",
  },
} as const;

// ─── Inner components ─────────────────────────────────────────────────────────

function SectionCard({
  label, accent, children,
}: {
  label: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{
      background: C.bg2,
      border: `1px solid ${C.border}`,
      borderInlineStart: `3px solid ${accent}`,
      borderRadius: 6,
      padding: "14px 16px",
      marginBottom: 8,
    }}>
      <div style={{
        fontSize: 10, color: C.borderSoft, letterSpacing: 1.5,
        textTransform: "uppercase", marginBottom: 8, fontWeight: 600,
      }}>
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 500, color: C.text, lineHeight: 1.55 }}>
        {children}
      </div>
    </div>
  );
}

function FirstMoveCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: "#031827",
      border: `1px solid ${C.cyan}`,
      borderRadius: 8,
      padding: "18px 18px",
      marginBottom: 10,
    }}>
      <div style={{
        fontSize: 10, color: C.cyan, letterSpacing: 2,
        textTransform: "uppercase", marginBottom: 12, fontWeight: 700,
      }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: C.cyan, lineHeight: 1.4 }}>
        {children}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ThirtySecond({ onContinue }: { onContinue: () => void }) {
  const [screen, setScreen] = useState<Screen>("input");
  const [text, setText] = useState("");
  const [force, setForce] = useState<DominantForce>("emotional");
  const [lang, setLang] = useState<Lang>("en");
  const [empty, setEmpty] = useState(false);

  const chain = useMemo(() => computeNoaChain(0), []);
  const helpers     = chain.load?.helpers.length ?? 5;
  const communityPct = chain.load?.communityPct ?? 65;

  const t       = T[lang];
  const content = lang === "en" ? EN[force] : HE[force];
  const dir     = lang === "he" ? "rtl" : "ltr";

  async function handleSubmit() {
    const trimmed = text.trim();
    if (!trimmed) { setEmpty(true); return; }
    setEmpty(false);
    setScreen("mapping");

    // Always show the mapping screen for at least 1.8s.
    // The fetch classifies force; failure keeps the 'emotional' default.
    const minWait = new Promise<void>(r => setTimeout(r, 1800));
    try {
      const res  = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: trimmed, direction: "stuck" }),
      });
      const data = await res.json();
      const f    = data.dominantForce as string;
      if (VALID_FORCES.includes(f as DominantForce)) {
        setForce(f as DominantForce);
      }
    } catch {
      // keep default
    }
    await minWait;
    setScreen("result");
  }

  function handleRestart() {
    setText("");
    setEmpty(false);
    setForce("emotional");
    setScreen("input");
  }

  const pad: React.CSSProperties = { padding: "20px 20px 24px" };

  return (
    <div dir={dir} style={{
      color: C.text,
      fontFamily: "'Inter', system-ui, sans-serif",
      height: "100%",
      display: "flex",
      flexDirection: "column",
    }}>

      {/* Language toggle — always visible */}
      <div style={{ display: "flex", justifyContent: "flex-end", padding: "12px 16px 0", flexShrink: 0 }}>
        <button
          onClick={() => setLang(l => l === "en" ? "he" : "en")}
          style={{
            fontSize: 11, color: C.textMuted, background: "none",
            border: `1px solid ${C.border}`, borderRadius: 4,
            padding: "3px 10px", cursor: "pointer", fontFamily: "inherit",
          }}
        >
          {t.langToggle}
        </button>
      </div>

      {/* ── Screen: input ─────────────────────────────────────────────────── */}
      {screen === "input" && (
        <div style={{ ...pad, flex: 1, overflowY: "auto" }}>

          <div style={{
            fontSize: 10, color: C.cyan, letterSpacing: 2,
            textTransform: "uppercase", fontWeight: 700, marginBottom: 16,
          }}>
            {t.promise}
          </div>

          <h1
            id="situation-label"
            style={{ fontSize: 22, fontWeight: 800, color: C.text, margin: "0 0 8px", lineHeight: 1.3 }}
          >
            {t.title}
          </h1>

          <p style={{ fontSize: 15, color: C.textMuted, margin: "0 0 20px", lineHeight: 1.55 }}>
            {t.subtitle}
          </p>

          <textarea
            aria-labelledby="situation-label"
            value={text}
            onChange={e => { setText(e.target.value); if (empty) setEmpty(false); }}
            onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleSubmit(); }}
            placeholder={t.placeholder}
            rows={5}
            style={{
              width: "100%", boxSizing: "border-box",
              background: "#020d1a",
              border: `1px solid ${empty ? C.red : C.border}`,
              borderRadius: 6, padding: "14px 16px",
              fontSize: 17, color: C.text, fontFamily: "inherit",
              resize: "none", outline: "none", lineHeight: 1.6,
            }}
          />

          {empty && (
            <p style={{ fontSize: 13, color: C.orange, margin: "6px 0 0" }}>
              {t.emptyHint}
            </p>
          )}

          {/* Example chips — tap to fill the textarea */}
          <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 6 }}>
            {t.examples.map(ex => (
              <button
                key={ex}
                onClick={() => { setText(ex); setEmpty(false); }}
                style={{
                  fontSize: 11, color: C.textMuted, background: "none",
                  border: `1px solid ${C.border}`, borderRadius: 12,
                  padding: "4px 10px", cursor: "pointer",
                  fontFamily: "inherit", textAlign: "start",
                }}
              >
                {ex}
              </button>
            ))}
          </div>

          <button
            onClick={handleSubmit}
            style={{
              marginTop: 24, width: "100%",
              background: C.cyan, color: "#020d1a",
              border: "none", borderRadius: 7,
              padding: "14px 0", fontSize: 16, fontWeight: 700,
              cursor: "pointer", fontFamily: "inherit", letterSpacing: 0.3,
            }}
          >
            {t.button}
          </button>
        </div>
      )}

      {/* ── Screen: mapping ───────────────────────────────────────────────── */}
      {screen === "mapping" && (
        <div style={{
          ...pad, flex: 1,
          display: "flex", flexDirection: "column", justifyContent: "center",
        }}>
          <p style={{ fontSize: 20, fontWeight: 700, color: C.text, margin: "0 0 12px", lineHeight: 1.4 }}>
            {t.mapping1}
          </p>
          <p style={{ fontSize: 15, color: C.textMuted, margin: 0, lineHeight: 1.55 }}>
            {t.mapping2}
          </p>
        </div>
      )}

      {/* ── Screen: result ────────────────────────────────────────────────── */}
      {screen === "result" && (
        <div style={{ ...pad, flex: 1, overflowY: "auto" }}>

          <SectionCard label={t.label1} accent={C.red}>
            {content.pressure}
          </SectionCard>

          <SectionCard label={t.label2} accent={C.orange}>
            {content.missing}
          </SectionCard>

          <SectionCard label={t.label3} accent={C.green}>
            {t.available(helpers, communityPct)}
          </SectionCard>

          <FirstMoveCard label={t.label4}>
            {content.firstMove}
          </FirstMoveCard>

          <div style={{ marginTop: 6, display: "flex", gap: 10 }}>
            <button
              onClick={onContinue}
              style={{
                flex: 1, background: C.cyan, color: "#020d1a",
                border: "none", borderRadius: 7,
                padding: "13px 0", fontSize: 15, fontWeight: 700,
                cursor: "pointer", fontFamily: "inherit",
              }}
            >
              {t.expand}
            </button>
            <button
              onClick={handleRestart}
              style={{
                background: "none", color: C.textMuted,
                border: `1px solid ${C.border}`, borderRadius: 7,
                padding: "13px 16px", fontSize: 14,
                cursor: "pointer", fontFamily: "inherit",
              }}
            >
              {t.restart}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
