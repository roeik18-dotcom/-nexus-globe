/**
 * PHILOS VISUAL GRAMMAR — one encoding vocabulary for Community, Group
 * Network, Dynamics and Marketplace.
 *
 * THE RULE THAT ORGANISES EVERYTHING BELOW: no two unrelated meanings may
 * share a visual channel. Each category owns exactly one channel, and the
 * channel it owns is stated in `CHANNEL_OWNERSHIP` so a reviewer can check the
 * claim rather than trust it. When a second cue is added it is REDUNDANT
 * encoding of the same meaning (dash + label for the same data state), never a
 * second meaning smuggled onto a channel that is already spoken for.
 *
 * GRAYSCALE IS THE TEST. Every distinction here survives with colour removed,
 * because colour is the one channel a reader may not have. Data state reads
 * from dash pattern, entity type from shape, relation type from dash + endpoint
 * marker. Hue is always the third cue, never the first.
 *
 * Derived against the Imagine visual-design corpus (`visualize/read_me`,
 * modules data_viz + diagram) and reconciled with PHILOS's own canonical
 * tokens. Where the two conflict, PHILOS wins and the reason is recorded in
 * `DELIBERATE_DIVERGENCES` — that corpus targets widgets that must disappear
 * into the claude.ai host UI, and PHILOS is its own product surface.
 */
import { COLOR } from "./designTokens";

/* ── 1 · DATA STATE — owned by BORDER DASH PATTERN + a text tag ───────────
   Fill is NOT available to this category: the spectrum spends fill on
   population. So state reads from the outline and from a word, both of which
   survive grayscale and colour-blindness. */

export type DataState =
  | "REAL" | "DERIVED" | "DEMO" | "UNKNOWN"
  | "NO_EVENTS" | "EMPTY_MEASURED" | "UNRESOLVED";

export interface StateEncoding {
  /** SVG `stroke-dasharray`. `undefined` = solid. THE primary cue. */
  dash?: string;
  /** Third cue only. Never load-bearing on its own. */
  hue: string;
  /** Always rendered. The cue that survives everything. */
  tag: string;
  /** One line, for a legend or a tooltip. */
  meaning: string;
}

export const STATE: Record<DataState, StateEncoding> = {
  REAL:           { hue: "#4ade80", tag: "REAL",     meaning: "אדם רשם את זה" },
  DERIVED:        { dash: "5 3",  hue: "#8fb8ff", tag: "נגזר",  meaning: "המערכת הסיקה, ואומרת ממה" },
  DEMO:           { dash: "2 3",  hue: "#f0b45c", tag: "DEMO",     meaning: "הדגמה מוצהרת — לא נכנס לניתוח אישי" },
  UNKNOWN:        { dash: "1 4",  hue: COLOR.textFaint, tag: "UNKNOWN", meaning: "לא ידוע — ואינו אפס" },
  NO_EVENTS:      { dash: "1 4",  hue: COLOR.textFaint, tag: "אין נתון", meaning: "הערוץ קיים, לא נרשם אף אירוע" },
  EMPTY_MEASURED: { hue: COLOR.textDim, tag: "0", meaning: "נמדד ויצא אפס — עובדה, לא חוסר" },
  UNRESOLVED:     { dash: "6 2 1 2", hue: "#f0b45c", tag: "טעון הכרעה", meaning: "מועמדים קיימים, אף אחד לא נבחר" },
};

/* ── 2 · ENTITY — owned by SHAPE ──────────────────────────────────────────
   A reader must be able to tell a need from a resource without reading the
   label, and without hue. Triangles point the way the thing flows: a need
   points up (asking), a resource points down (offering). */

export type EntityKind =
  | "PERSON" | "GROUP" | "VALUE" | "NEED" | "RESOURCE"
  | "MATCH" | "ACTION" | "EFFECT" | "EVIDENCE" | "TENSION";

export interface EntityEncoding {
  shape: "circle" | "rounded-square" | "cell" | "triangle-up" | "triangle-down"
       | "diamond" | "square" | "ring" | "bowtie";
  label: string;
}

export const ENTITY: Record<EntityKind, EntityEncoding> = {
  PERSON:   { shape: "circle",         label: "אדם" },
  GROUP:    { shape: "rounded-square", label: "קבוצה" },
  VALUE:    { shape: "cell",           label: "ערך" },
  NEED:     { shape: "triangle-up",    label: "צורך" },
  RESOURCE: { shape: "triangle-down",  label: "משאב" },
  MATCH:    { shape: "bowtie",         label: "התאמה" },
  ACTION:   { shape: "square",         label: "פעולה" },
  EFFECT:   { shape: "diamond",        label: "אפקט" },
  EVIDENCE: { shape: "ring",           label: "ראיה" },
  TENSION:  { shape: "bowtie",         label: "מתח" },
};

/** SVG path for an entity glyph centred on (0,0) at radius r. One function so
 *  every surface draws the same need-triangle, not its own approximation. */
export function entityPath(kind: EntityKind, r: number): string {
  const s = ENTITY[kind].shape;
  switch (s) {
    case "triangle-up":   return `M 0 ${-r} L ${r} ${r * 0.8} L ${-r} ${r * 0.8} Z`;
    case "triangle-down": return `M 0 ${r} L ${r} ${-r * 0.8} L ${-r} ${-r * 0.8} Z`;
    case "diamond":       return `M 0 ${-r} L ${r} 0 L 0 ${r} L ${-r} 0 Z`;
    case "square":        return `M ${-r} ${-r} H ${r} V ${r} H ${-r} Z`;
    case "bowtie":        return `M ${-r} ${-r} L ${r} ${r} L ${r} ${-r} L ${-r} ${r} Z`;
    case "cell":          return `M ${-r} ${-r * 0.7} H ${r} V ${r * 0.7} H ${-r} Z`;
    case "rounded-square":
      return `M ${-r + 3} ${-r} H ${r - 3} Q ${r} ${-r} ${r} ${-r + 3} V ${r - 3} Q ${r} ${r} ${r - 3} ${r} H ${-r + 3} Q ${-r} ${r} ${-r} ${r - 3} V ${-r + 3} Q ${-r} ${-r} ${-r + 3} ${-r} Z`;
    default:              return "";  // circle / ring drawn as <circle>
  }
}

/* ── 3 · RELATION — owned by DASH PATTERN + ENDPOINT MARKER ───────────────
   The ruling's hard requirement: relation type must be readable without
   colour. Each type gets a distinct dash AND a distinct endpoint, so two
   types can never coincide on both channels. Direction matters for some
   (a transfer flows one way) and not others (an overlap is mutual) — the
   endpoint says which. */

export type RelationKind =
  | "OVERLAPPING_MEMBERS" | "SHARED_SUBVALUE" | "SHARED_VALUE_FAMILY"
  | "SHARED_NEED" | "SHARED_RESOURCE" | "COOPERATION" | "CONFLICT"
  | "RESOURCE_FLOW" | "ACTION_DEPENDENCY" | "GEOGRAPHIC_OVERLAP";

export interface RelationEncoding {
  /** Primary cue. Every entry distinct. */
  dash?: string;
  /** Secondary cue. `arrow` = directed, `none` = mutual, `bar` = terminated,
   *  `dot` = weak/observational, `cross` = opposition. */
  endpoint: "arrow" | "none" | "bar" | "dot" | "cross";
  /** Third cue. */
  hue: string;
  label: string;
  /** What must be recorded for this edge to exist at all. */
  requires: string;
  /** Directed edges are drawn from→to; mutual ones carry no arrowhead. */
  directed: boolean;
}

export const RELATION: Record<RelationKind, RelationEncoding> = {
  OVERLAPPING_MEMBERS: { endpoint: "none",  hue: "#8fb8ff", label: "חברים חופפים", directed: false,
    requires: "אדם אחד רשום בשתי הקבוצות" },
  SHARED_SUBVALUE:     { dash: "6 3", endpoint: "none", hue: "#a78bfa", label: "תת-ערך משותף", directed: false,
    requires: "שתי הקבוצות ממופות לאותו תת-ערך" },
  SHARED_VALUE_FAMILY: { dash: "2 4", endpoint: "none", hue: "#a78bfa", label: "משפחת ערך משותפת", directed: false,
    requires: "שתי הקבוצות ממופות לאותה משפחה" },
  SHARED_NEED:         { dash: "10 4", endpoint: "dot", hue: "#5eead4", label: "צורך משותף", directed: false,
    requires: "צורך מוצהר באותו תת-ערך בשתיהן" },
  SHARED_RESOURCE:     { dash: "10 4 2 4", endpoint: "dot", hue: "#5eead4", label: "משאב משותף", directed: false,
    requires: "משאב מוצהר באותו תת-ערך בשתיהן" },
  COOPERATION:         { endpoint: "arrow", hue: "#4ade80", label: "שיתוף פעולה", directed: true,
    requires: "התאמה בין-קבוצתית שאדם אישר" },
  CONFLICT:            { dash: "4 2 1 2", endpoint: "cross", hue: "#f87171", label: "ניגוד", directed: false,
    requires: "מתח מתועד שנוקב בקבוצה השנייה — לא נגזר מהבדל ערכים" },
  RESOURCE_FLOW:       { endpoint: "arrow", hue: "#fbbf24", label: "זרימת משאב", directed: true,
    requires: "אירוע תקציב עם קבוצת נגד רשומה" },
  ACTION_DEPENDENCY:   { dash: "8 2 2 2", endpoint: "bar", hue: "#fb923c", label: "תלות פעולה", directed: true,
    requires: "פעולה שקלט שלה שייך לקבוצה אחרת" },
  GEOGRAPHIC_OVERLAP:  { dash: "1 3", endpoint: "dot", hue: COLOR.textFaint, label: "חפיפה גאוגרפית", directed: false,
    requires: "גאוגרפיה אמיתית — מחרוזת עיר זהה אינה קשר" },
};

/* ── 4 · INTERACTION — owned by RING GEOMETRY, never by hue ───────────────
   Selection must not repaint an object, because repainting would overwrite
   whatever its fill or border already means. A ring is drawn OUTSIDE the mark
   and touches no other channel. */

export const INTERACTION = {
  default:  { ring: 0, ringColor: "transparent",   note: "ללא" },
  hover:    { ring: 1, ringColor: "#8fc0ff",       note: "טבעת דקה" },
  focus:    { ring: 2, ringColor: COLOR.accent,    note: "טבעת accent + היסט — :focus-visible" },
  selected: { ring: 2, ringColor: "#ffffff",       note: "טבעת לבנה" },
  /** The viewer's own position. A MARKER GLYPH beside the object, not a
   *  recolouring of it — so "mine" and "REAL" never compete for the border. */
  viewer:   { ring: 2, ringColor: "#7fe0ab",       note: "טבעת ירוקה + נקודה — אתה כאן" },
  disabled: { ring: 0, ringColor: "transparent",   note: "אטימות 0.35 + aria-disabled" },
} as const;

/* ── 5 · MAGNITUDE and CONFIDENCE — conditional channels ──────────────────
   Both are OFF unless the quantity actually exists. A thickness that encodes
   nothing is decoration, and an opacity ramp with no evidence behind it is a
   confidence claim PHILOS has not earned. */

export const MAGNITUDE = {
  channel: "size / stroke thickness",
  allowed_when: "a real recorded quantity exists (member count, amount, source_count)",
  otherwise: "constant size — never scaled to fill space",
} as const;

export const CONFIDENCE = {
  channel: "opacity",
  allowed_when: "an evidence record exists (VERIFIED vs CLAIMED)",
  scale: { VERIFIED: 1, CLAIMED: 0.62, UNVERIFIABLE: 0.38 },
  otherwise: "full opacity — absence of evidence is shown by the state tag, not by fading",
} as const;

/* ── 6 · TEMPORAL — owned by X POSITION; motion only for real change ──────*/

export const TEMPORAL = {
  channel: "x position on a shared time axis",
  direction: "slope of the line; an explicit ▲/▼ delta glyph on the last point",
  magnitude: "y position within ONE unit's own scale",
  /** The corpus rule PHILOS adopts verbatim: never a dual axis. */
  never: "dual y-axis. Two units → two stacked charts sharing one x axis",
  motion: "only when the underlying state actually changed; never ambient",
} as const;

/* ── 7 · The ownership table — the checkable claim ────────────────────────*/

export const CHANNEL_OWNERSHIP: { channel: string; owner: string; never: string }[] = [
  { channel: "shape",           owner: "ENTITY KIND",       never: "state, relation, selection" },
  { channel: "border dash",     owner: "DATA STATE (marks) · RELATION TYPE (edges)", never: "selection or magnitude" },
  { channel: "fill lightness",  owner: "POPULATION / magnitude ramp", never: "data state or entity kind" },
  { channel: "area",            owner: "RECORDED QUANTITY (source depth, sub-value count)", never: "importance or emphasis" },
  { channel: "endpoint marker", owner: "RELATION TYPE + direction", never: "state" },
  { channel: "ring geometry",   owner: "INTERACTION STATE",  never: "data state or relation" },
  { channel: "opacity",         owner: "EVIDENCE CONFIDENCE (only where evidence exists)", never: "emphasis or de-emphasis" },
  { channel: "x position",      owner: "TIME",               never: "category" },
  { channel: "hue",             owner: "third-cue reinforcement only", never: "the sole carrier of any distinction" },
  { channel: "text tag",        owner: "DATA STATE — always present", never: "omitted to save space" },
  { channel: "motion",          owner: "REAL state change",  never: "ambience or attention-getting" },
];

/** Where PHILOS knowingly departs from the Imagine corpus, and why. Recorded
 *  so the divergence is a decision on the record rather than an oversight. */
export const DELIBERATE_DIVERGENCES: { rule: string; philos: string; because: string }[] = [
  { rule: "Two font weights only (400/500); never 600–700",
    philos: "PHILOS uses 650/700 for surface titles",
    because: "the corpus targets widgets that must disappear into the claude.ai host UI; PHILOS is its own product and its type scale is canonical" },
  { rule: "Sentence case always; never ALL CAPS",
    philos: "NEED / ACTION / REAL / VERIFIED stay upper-case",
    because: "they are canonical epistemic terms, not styling — lower-casing them would make a term look like prose" },
  { rule: "role=\"img\" with <title>/<desc> as first children",
    philos: "interactive maps use role=\"group\" + aria-label",
    because: "role=\"img\" hides children; the spectrum has 255 keyboard-reachable nodes that must stay reachable" },
  { rule: "Transparent outer container, host provides background",
    philos: "surfaces paint their own background",
    because: "there is no host card here — a transparent surface fell through to the white body, a bug already fixed once" },
];
