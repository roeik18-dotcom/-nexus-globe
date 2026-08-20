/**
 * PHILOS design tokens — the one shared visual vocabulary every surface
 * pulls from (Global Design System, redesign pass). Previously every
 * component picked its own ad-hoc font sizes/colors/spacing inline —
 * visually consistent by accident, not by system, which is why every
 * surface "looked like the same report" rather than one product. This
 * file is the single source; components import from here instead of
 * hand-rolling `fontSize: 11` in twenty different places.
 */

export const TYPE = {
  display: { fontSize: 30, fontWeight: 800, letterSpacing: -0.3, lineHeight: 1.15 },
  title: { fontSize: 19, fontWeight: 700, letterSpacing: -0.1, lineHeight: 1.25 },
  subtitle: { fontSize: 15, fontWeight: 600, letterSpacing: 0.1, lineHeight: 1.35 },
  body: { fontSize: 15, fontWeight: 500, lineHeight: 1.6 },
  meta: { fontSize: 13, fontWeight: 700, letterSpacing: 1.1, textTransform: "uppercase" as const },
  /* Spread into dozens of styles across every surface, so this one number
     moves more sub-floor text than any per-component edit could. It is the
     12px floor now, not the 10px one. */
  micro: { fontSize: 12, fontWeight: 600, letterSpacing: 0.6, textTransform: "uppercase" as const },
} as const;

/**
 * THE SOCIAL SCALE — five steps, and a hard floor.
 *
 * An audit of one social surface found EIGHTEEN distinct font sizes and 259
 * elements rendering text below 10px. That is not a hierarchy: a reader
 * cannot rank eighteen levels, so nothing reads as more important than
 * anything else, and text under 10px — especially Hebrew, whose letterforms
 * carry more detail per glyph than Latin — is not "small", it is unread.
 *
 * ── THE SCALE WAS THE PROBLEM ──────────────────────────────────────────
 * A live measurement of all seven surfaces found 80.8% of visible text below
 * 12px and only 8.6% at 14px or more: 10px was the de-facto body size and
 * hierarchy was being attempted entirely with weight and colour on a flat
 * 10/11px base. That is the textbook definition of fake hierarchy, and it is
 * most of why the product read as a console rather than a product.
 *
 * The floor is now 12px and the body is 15px. Every size in the product comes
 * from here, so this one table moves all seven surfaces at once — the same
 * leverage that made `TYPE.micro` the single biggest fix in the earlier pass.
 * If something does not fit at 15px, the answer is less content on that
 * screen, not smaller text.
 */
export const FS = {
  /** The surface's own name. Exactly one per screen — the thing the eye
   *  should land on before it reads anything, which means it must out-rank
   *  every figure the screen draws. World's gate renders a 44px "0"; at 26px
   *  the title lost to it and the 3-second test still failed there. */
  title: 30,
  /** Section and card titles. */
  head: 19,
  /** Secondary section headings. */
  section: 16,
  /** THE BODY SIZE. The thing a person came to read. */
  read: 15,
  /** Supporting detail beside the thing they read. */
  meta: 13,
  /** Metadata, provenance notes, ids. */
  base: 13,
  /** Uppercase micro-labels ONLY — simple letterforms, never a sentence.
   *  This is the FLOOR and nothing may go below it. */
  tag: 12,
} as const;

/** 4px base unit — every margin/padding in the redesign is a multiple. */
export const SPACE = { xs: 4, sm: 8, md: 12, lg: 20, xl: 32, xxl: 48 } as const;

export const RADIUS = { sm: 6, md: 10, lg: 16, pill: 999 } as const;

export const COLOR = {
  bg: "#0a0e17",
  bgRaised: "#11172a",
  bgCard: "#151c33",
  border: "rgba(120,150,220,0.16)",
  borderStrong: "rgba(120,150,220,0.32)",
  text: "#f2f6fc",
  textDim: "#9fb0d0",
  /* 4.59:1 at worst against bgCard — was #5a6f96 at 3.33:1, the only token
     in the palette that failed WCAG AA and the source of most of the
     measured 29–58% per-surface failure. Same hue and saturation, raised
     lightness, so semantic differentiation between text / textDim / textFaint
     survives rather than being solved by making everything white. */
  textFaint: "#6c86b5",
  accent: "#5b9cf6",
  accentDim: "rgba(91,156,246,0.12)",
} as const;

/**
 * STATUS LANGUAGE — one visual treatment per real system state, reused
 * everywhere instead of ad-hoc per-surface color picks. `bg`/`border`
 * are the pill/badge treatment; `text` is the label color; `dot` is a
 * small filled indicator used inline (e.g. before a row label).
 */
export type StatusKind = "real" | "demo" | "unknown" | "blocked" | "verified" | "claimed" | "needs_attention" | "active" | "completed";

export const STATUS: Record<StatusKind, { bg: string; border: string; text: string; label: string }> = {
  real: { bg: "rgba(52,211,153,0.12)", border: "rgba(52,211,153,0.4)", text: "#34d399", label: "REAL" },
  demo: { bg: "rgba(251,191,36,0.12)", border: "rgba(251,191,36,0.4)", text: "#fbbf24", label: "DEMO" },
  unknown: { bg: "rgba(90,111,150,0.12)", border: "rgba(90,111,150,0.35)", text: "#8798b8", label: "UNKNOWN" },
  blocked: { bg: "rgba(242,99,92,0.12)", border: "rgba(242,99,92,0.4)", text: "#f2635c", label: "BLOCKED" },
  verified: { bg: "rgba(52,211,153,0.16)", border: "rgba(52,211,153,0.5)", text: "#34d399", label: "VERIFIED" },
  claimed: { bg: "rgba(251,191,36,0.1)", border: "rgba(251,191,36,0.3)", text: "#fbbf24", label: "CLAIMED" },
  needs_attention: { bg: "rgba(242,99,92,0.14)", border: "rgba(242,99,92,0.45)", text: "#fc8a84", label: "NEEDS ATTENTION" },
  active: { bg: "rgba(91,156,246,0.14)", border: "rgba(91,156,246,0.4)", text: "#5b9cf6", label: "ACTIVE" },
  completed: { bg: "rgba(52,211,153,0.1)", border: "rgba(52,211,153,0.3)", text: "#6fe3b4", label: "COMPLETED" },
};

/** Pill/badge component style, built from one status token — every
 *  surface renders REAL/DEMO/BLOCKED/etc. identically now. */
export function statusBadgeStyle(kind: StatusKind): React.CSSProperties {
  const s = STATUS[kind];
  return {
    display: "inline-flex", alignItems: "center", gap: 4,
    fontSize: FS.tag, fontWeight: 800, letterSpacing: 0.6,
    padding: "2px 8px", borderRadius: RADIUS.pill,
    background: s.bg, border: `1px solid ${s.border}`, color: s.text,
  };
}

/** Card surface treatment — `primary` = the operational card a user acts
 *  on (elevated, colored left accent); `secondary` = supporting context
 *  (flatter, muted); `audit` = diagnostic/reference (dashed, monospace
 *  accent, always inside a collapsed `<details>` by convention). */
export function cardStyle(kind: "primary" | "secondary" | "audit", accent?: string): React.CSSProperties {
  if (kind === "primary") {
    return {
      background: COLOR.bgCard, border: `1px solid ${COLOR.border}`,
      borderInlineStart: `3px solid ${accent ?? COLOR.accent}`,
      borderRadius: RADIUS.lg, padding: `${SPACE.md}px ${SPACE.lg}px`,
      boxShadow: "0 1px 0 rgba(255,255,255,0.02) inset, 0 8px 24px -12px rgba(0,0,0,0.5)",
    };
  }
  if (kind === "audit") {
    return {
      background: "rgba(90,111,150,0.04)", border: `1px dashed ${COLOR.border}`,
      borderRadius: RADIUS.md, padding: `${SPACE.sm}px ${SPACE.md}px`,
      fontFamily: "ui-monospace, monospace",
    };
  }
  return {
    background: COLOR.bgRaised, border: `1px solid ${COLOR.border}`,
    borderRadius: RADIUS.md, padding: `${SPACE.sm}px ${SPACE.md}px`,
  };
}

/**
 * TERMINAL IDENTITY — one canonical accent per product surface.
 *
 * The colour of each terminal is **not** a design choice made here: it is
 * transcribed from the locked `PHILOS-SYSTEM-LANGUAGE.md` §8 (itself from
 * `PHILOS_SYSTEM_MASTER_OPM_LANGUAGE_7_TERMINALS_v1.docx` §9), which assigns
 * every terminal a Color-Monster function role:
 *
 *   HUB 🟣+🔵 · BRAIN 🔵+🟣+⚪ · DYNAMICS 🟡 · COMMUNITY 🟢
 *   MARKETPLACE 🟠+🔴 · GLOBE 🟢+🟣 · WORLD ⚪+🟣
 *
 * `accent` is the terminal's PRIMARY role colour; `support` its secondary.
 * The hex values are the Color-Monster palette already used across this
 * codebase — reused, not re-picked.
 *
 * **`Cell_ID ≠ Color_ID`** (colour master, every record's own NOTES): colour
 * here is semantic ROUTING metadata for the surface, never a state, never a
 * value, and never a 3×3 cell.
 */
export const COLOR_ROLE = {
  white:  "#e6edf7", // 0 · REFERENCE / EVIDENCE
  purple: "#a78bfa", // 1 · MEANING / VISION
  blue:   "#5b9cf6", // 2 · STRUCTURE / LOGIC
  green:  "#34d399", // 3 · EXPRESSION / CONNECTION
  yellow: "#fbbf24", // 4 · TRANSITION / CHANGE
  orange: "#fb923c", // 5 · DRIVE / MOMENTUM
  red:    "#f2635c", // 6 · ACTION / EXECUTION
} as const;

/**
 * PRODUCT_FAMILY_CUE — NOT a Colour Source Lock role.
 * ---------------------------------------------------------------------------
 * `PRODUCT_FAMILY_CUE ≠ CANONICAL_COLOR_ROLE`.
 *
 * This is a NAVIGATION AFFORDANCE ONLY: the tint used to draw the container
 * around the social/product family (Community · Globe · World) so the three
 * read as one grouped product rather than three sibling destinations.
 *
 * It is derived from GREEN because two of the three members genuinely carry
 * GREEN in the Colour Source Lock (Community = GREEN, Globe = GREEN + PURPLE),
 * which makes green the recognisable cue for this family in the product.
 *
 * It asserts NOTHING about any member's canonical role. In particular it does
 * NOT make World green. The Colour Source Lock is unchanged and remains the
 * only authority on roles:
 *
 *   Community = GREEN
 *   Globe     = GREEN + PURPLE
 *   World     = WHITE + PURPLE
 *
 * Enforcement: this token is used ONLY for the family container's own
 * background/border/label. Each member's own accent still comes from
 * `TERMINAL[surface].accent`, so an active sub-tab always paints its
 * canonical role — World's active tab is WHITE-family, never green, even
 * while sitting inside a green-cued capsule.
 *
 * Never read this token as a state, a value, or a cell (`Cell_ID ≠ Color_ID`).
 */
export const PRODUCT_FAMILY_CUE = {
  /** Container fill when the family is not the current surface. */
  bgIdle: "rgba(52,211,153,0.055)",
  /** Container fill when one of the family members is the current surface. */
  bgActive: "rgba(52,211,153,0.12)",
  /** Container hairline when idle. */
  borderIdle: "rgba(52,211,153,0.22)",
  /** Container hairline when the family is current. */
  borderActive: "rgba(52,211,153,0.42)",
  /** The family label / internal divider. */
  label: "rgba(52,211,153,0.62)",
  labelActive: "#34d399",
} as const;

export interface TerminalIdentity {
  /** Hebrew-first label — `PHILOS-SYSTEM-LANGUAGE.md` §9 "Hebrew-first". */
  label_he: string;
  label_en: string;
  /** The user question this terminal answers (master §9, verbatim). */
  question_he: string;
  accent: string;
  support: string;
  /** The Color-Monster glyphs this terminal carries, per master §9. */
  glyphs: string;
}

export const TERMINAL: Record<
  "hub" | "brain" | "dynamics" | "community" | "marketplace" | "globe" | "world",
  TerminalIdentity
> = {
  hub:         { label_he: "מרכז",   label_en: "Hub",         question_he: "מה חשוב עכשיו ולאן ממשיכים?",              accent: COLOR_ROLE.purple, support: COLOR_ROLE.blue,   glyphs: "🟣🔵" },
  brain:       { label_he: "מוח",    label_en: "Brain",       question_he: "מה זה אומר ולמה?",                         accent: COLOR_ROLE.blue,   support: COLOR_ROLE.purple, glyphs: "🔵🟣⚪" },
  dynamics:    { label_he: "דינמיקה", label_en: "Dynamics",    question_he: "מה השתנה, מתי ומה גרם למה?",               accent: COLOR_ROLE.yellow, support: COLOR_ROLE.orange, glyphs: "🟡" },
  community:   { label_he: "קהילה",  label_en: "Community",   question_he: "מי מחובר סביב איזה ערך ומה הקבוצה עושה?",   accent: COLOR_ROLE.green,  support: COLOR_ROLE.blue,   glyphs: "🟢" },
  marketplace: { label_he: "שוק",    label_en: "Marketplace", question_he: "מה חסר, מה זמין ומה ניתן לבצע?",           accent: COLOR_ROLE.orange, support: COLOR_ROLE.red,    glyphs: "🟠🔴" },
  globe:       { label_he: "גלובוס", label_en: "Globe",       question_he: "איך הישויות והקשרים פרוסים ברשת?",          accent: COLOR_ROLE.green,  support: COLOR_ROLE.purple, glyphs: "🟢🟣" },
  world:       { label_he: "עולם",   label_en: "World",       question_he: "מה קורה במערכת הרחבה ומה רלוונטי?",         accent: COLOR_ROLE.white,  support: COLOR_ROLE.purple, glyphs: "⚪🟣" },
};
