/**
 * SOCIAL SYSTEM — the family's shared ZOOM HIERARCHY.
 *
 * Community, Globe and World are three ZOOM LEVELS onto the same social/value
 * system, not three independent applications:
 *
 *   COMMUNITY  GROUP    people · values · value groups · needs · actions · evidence
 *   GLOBE      NETWORK  verified relations between people/groups/actions/resources
 *   WORLD      SYSTEM   wider structures · system relevance · evidence/reference
 *
 * WHAT THIS IS: a PRODUCT PROJECTION hierarchy — a statement about scope of
 * view, so the user knows where they are standing inside the family.
 *
 * WHAT THIS IS NOT — and the arrows must never be read as any of these:
 *   · NOT a causal chain. Nothing derives Network from Group.
 *   · NOT a new canon relation. No record, edge or state is created here.
 *   · NOT an L3→L4→L5 equivalence. The L-layers are a SOURCE model with their
 *     own §12 definitions; the surface a layer is *shown* on is a product
 *     decision, and the two are only aligned where the source already says so.
 *   · NOT a colour flow. The Source Lock defines no relation between colours.
 *
 * It deliberately does NOT navigate. The nav capsule in `SystemShell` is the
 * one place you change surface; duplicating it here would produce two
 * competing navigations. This orients, it does not route.
 *
 * Colour discipline: the strip uses the neutral/product tint, never a member's
 * canonical role — `PRODUCT_FAMILY_CUE ≠ CANONICAL_COLOR_ROLE`.
 */
import { FS, COLOR, PRODUCT_FAMILY_CUE, RADIUS, SPACE, TYPE } from "./designTokens";

export type SocialSurface = "community" | "globe" | "world";

const ZOOM: { key: SocialSurface; label: string; level: string; scope_he: string }[] = [
  { key: "community", label: "Community", level: "GROUP",   scope_he: "אנשים · ערכים · קבוצות-ערך · צרכים · פעולות · ראיות" },
  { key: "globe",     label: "Globe",     level: "NETWORK", scope_he: "קשרים מאומתים בין אנשים/קבוצות/פעולות/משאבים" },
  { key: "world",     label: "World",     level: "SYSTEM",  scope_he: "מבנים רחבים · רלוונטיות מערכתית · ראיה/ייחוס" },
];

export default function SocialZoomStrip({ surface }: { surface: SocialSurface }) {
  return (
    <section dir="rtl" style={S.band} aria-label="SOCIAL SYSTEM — zoom hierarchy">
      <span style={S.eyebrow}>מערכת חברתית · SOCIAL SYSTEM</span>
      <div style={S.row}>
        {ZOOM.map((z, i) => {
          const here = z.key === surface;
          return (
            <div key={z.key} style={S.cellWrap}>
              {i > 0 ? <span style={S.arrow} aria-hidden>→</span> : null}
              <div style={{ ...S.cell, ...(here ? S.cellHere : null) }} title={z.scope_he}>
                <span style={{ ...S.level, ...(here ? S.levelHere : null) }}>{z.level}</span>
                <span style={{ ...S.label, ...(here ? S.labelHere : null) }}>{z.label}</span>
              </div>
            </div>
          );
        })}
        <span style={S.note}>
          זום מוצר — היכן אתה עומד במשפחה. לא שרשרת סיבתית, לא יחס קנוני, ולא זרימת צבע.
        </span>
      </div>
    </section>
  );
}

const S = {
  band: {
    display: "flex", alignItems: "center", gap: SPACE.md, flexWrap: "wrap" as const,
    border: `1px solid ${PRODUCT_FAMILY_CUE.borderIdle}`,
    background: PRODUCT_FAMILY_CUE.bgIdle,
    borderRadius: RADIUS.md, padding: "6px 12px", marginBottom: SPACE.sm,
  },
  eyebrow: { ...TYPE.micro, letterSpacing: 1.4, color: PRODUCT_FAMILY_CUE.label, whiteSpace: "nowrap" as const },
  row: { display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" as const, flex: 1 },
  cellWrap: { display: "flex", alignItems: "center", gap: 2 },
  arrow: { ...TYPE.micro, color: COLOR.textFaint, padding: "0 3px" },
  cell: { display: "flex", alignItems: "baseline", gap: 5, padding: "3px 9px", borderRadius: RADIUS.sm, border: "1px solid transparent" },
  cellHere: { background: PRODUCT_FAMILY_CUE.bgActive, border: `1px solid ${PRODUCT_FAMILY_CUE.borderActive}` },
  level: { ...TYPE.micro, letterSpacing: 1.2, color: COLOR.textFaint },
  levelHere: { color: PRODUCT_FAMILY_CUE.labelActive, fontWeight: 700 },
  label: { fontSize: FS.meta, color: COLOR.textFaint },
  labelHere: { color: COLOR.text, fontWeight: 600 },
  note: { ...TYPE.micro, fontSize: FS.base, color: COLOR.textFaint, marginInlineStart: "auto", maxWidth: 420, textAlign: "start" as const },
} as const;
