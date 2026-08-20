/**
 * RED + WHITE inside the social family — internal roles, not terminals.
 *
 * The Colour Source Lock gives RED "Action / Maximum-energy" and WHITE
 * "Reference / Zero-energy · principles, axioms, definitions, evidence".
 * Both roles are real inside Community/Globe/World, and neither had any
 * representation there. This exposes them WITHOUT creating a RED terminal
 * or a WHITE terminal, and without touching each surface's own colour.
 *
 * What each means per surface — deliberately different, because the same
 * canonical role does different work at each scope:
 *
 *   COMMUNITY  RED   = real group-linked Actions/Effects
 *              WHITE = evidence/provenance behind membership and effects
 *   GLOBE      RED   = real actions/flows attached to real entities
 *              WHITE = provenance behind the nodes and edges drawn
 *   WORLD      RED   = interventions with verified wider-system relevance
 *              WHITE = the evidence boundary on external/system claims
 *
 * Hard lines: RED != Need (a need is not an action) · RED != Momentum
 * (that is ORANGE, and it stays UNKNOWN system-wide) · WHITE is not a
 * confidence score. Counts render only from real records; with none, the
 * role shows UNKNOWN rather than 0-as-if-checked.
 *
 * This is PRODUCT ORGANIZATION. It is not a canonical causal colour flow —
 * the Source Lock defines no relation between colours at all.
 */
import { FS, COLOR, COLOR_ROLE, RADIUS, SPACE, TYPE } from "./designTokens";

export interface SocialRoleCounts {
  /** RED — real Actions/Effects at this surface's scope. `null` = not resolved. */
  action: number | null;
  /** WHITE — real evidence/provenance records at this scope. */
  evidence: number | null;
  /**
   * GREEN — real SOCIAL RELATIONS at this scope: recorded person↔group and
   * group↔group edges (MEMBER_OF / CONTRIBUTES_TO / BENEFITS_FROM /
   * AFFECTED_BY), never a relation inferred from shared value, shared
   * contradiction or taxonomy overlap. Similarity is not a relation.
   */
  relations?: number | null;
  /**
   * PURPLE — MEANING / VALUE INTERPRETATION at this scope: value-family
   * attributions and value-emergence readings. These are INTERPRETED, not
   * measured, which is exactly why they carry their own role rather than
   * being folded into WHITE (evidence) or GREEN (relations).
   */
  meaning?: number | null;
}

const MEANING: Record<"community" | "globe" | "world", { red: string; white: string; green: string; purple: string }> = {
  community: {
    red: "Action/Effect אמיתיים המקושרים לקבוצה",
    white: "ראיה ופרובננס לחברות, ליחסי ערך-קבוצה ולהשפעות",
    green: "קשרים חברתיים מתועדים — חברות ויחסי אדם↔קבוצה",
    purple: "פרשנות ערך — משפחת ערך וצמיחת-ערך מניגוד",
  },
  globe: {
    red: "פעולות/זרימות אמיתיות הקשורות לישויות אמיתיות",
    white: "פרובננס לצמתים ולקשתות שמצוירים בפועל",
    green: "קשתות מאומתות שמצוירות בפועל — לפי סוג יחס",
    purple: "ערכי הקבוצות שהצמתים נושאים",
  },
  world: {
    red: "התערבויות עם רלוונטיות מערכתית מאומתת",
    white: "גבול הראיה לטענות חיצוניות/מערכתיות",
    green: "מבנים חברתיים מאומתים ברמת המערכת",
    purple: "פרשנות ערך ברמת המערכת",
  },
};

export default function SocialRoleStrip({
  surface, counts,
}: { surface: "community" | "globe" | "world"; counts: SocialRoleCounts }) {
  const m = MEANING[surface];
  return (
    <div dir="rtl" style={S.strip}>
      <span style={S.eyebrow}>תפקידים פנימיים · INTERNAL ROLES</span>

      <Role glyph="🔴" name="RED" canonical="Action / Maximum-energy"
            meaning={m.red} value={counts.action} hex={COLOR_ROLE.red} />
      <Role glyph="⚪" name="WHITE" canonical="Reference / Zero-energy"
            meaning={m.white} value={counts.evidence} hex={COLOR_ROLE.white} />
      <Role glyph="🟢" name="GREEN" canonical="Human expression / Connection"
            meaning={m.green} value={counts.relations ?? null} hex={COLOR_ROLE.green} />
      <Role glyph="🟣" name="PURPLE" canonical="Meaning / Vision"
            meaning={m.purple} value={counts.meaning ?? null} hex={COLOR_ROLE.purple} />

      <span style={S.note}>
        תפקידים בתוך המסוף — לא מסופים חדשים, ולא זרימה סיבתית בין צבעים.
        RED אינו Need ואינו תנופה (זה ORANGE). WHITE אינו ציון ביטחון.
        GREEN הוא קשר מתועד בלבד — דמיון ערכי אינו קשר. PURPLE הוא פרשנות, לא מדידה.
      </span>
    </div>
  );
}

function Role({ glyph, name, canonical, meaning, value, hex }: {
  glyph: string; name: string; canonical: string; meaning: string; value: number | null; hex: string;
}) {
  const has = value !== null && value > 0;
  return (
    <span title={`${canonical}\n${meaning}`} style={{
      ...S.role,
      borderColor: has ? `${hex}66` : COLOR.border,
      background: has ? `${hex}12` : "transparent",
      opacity: has ? 1 : 0.7,
    }}>
      <span style={{ fontSize: FS.meta }}>{glyph}</span>
      <span style={{ ...TYPE.micro, fontSize: FS.base, color: has ? hex : COLOR.textFaint }}>{name}</span>
      <b style={{ fontSize: FS.read, fontFamily: "ui-monospace, monospace", color: has ? COLOR.text : "#8798b8" }}>
        {value === null ? "UNKNOWN" : value}
      </b>
      <span style={{ fontSize: FS.base, color: COLOR.textFaint }}>{meaning}</span>
    </span>
  );
}

const S: Record<string, React.CSSProperties> = {
  strip: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 7, background: "rgba(90,120,180,0.04)", border: `1px solid ${COLOR.border}`, borderRadius: RADIUS.md, padding: `${SPACE.sm}px ${SPACE.md}px`, marginBottom: SPACE.md },
  eyebrow: { ...TYPE.micro, fontSize: FS.base, color: COLOR.textFaint },
  role: { display: "inline-flex", alignItems: "center", gap: 5, border: "1px solid", borderRadius: RADIUS.sm, padding: "4px 9px" },
  note: { fontSize: FS.base, color: COLOR.textFaint, flex: 1, minWidth: 220, lineHeight: 1.5 },
};
