"use client";

/**
 * SOCIAL SCALE — the zoom control, as a control rather than three page loads.
 *
 * Community, Globe and World are one system at three scales, so changing
 * scale must behave like changing a view, not like leaving for another
 * product. Two things make that true:
 *
 *   `next/link` — the nav used plain `<a href>`, so every scale change was a
 *   FULL PAGE RELOAD: the shell was rebuilt, scroll was thrown away and the
 *   3D globe was torn down and reconstructed. That single detail is most of
 *   why the three read as three products.
 *
 *   `prefetch` — the next scale is fetched before it is asked for, so the
 *   transition has no blank frame in between.
 *
 * The SELECTION travels with the scale change: whatever record is selected
 * stays selected, because `sel` is carried on every href. Selecting an object
 * at GROUP and switching to NETWORK is one continuous act on one object.
 *
 * `useSelectedLayoutSegment` is deliberately NOT used to decide the active
 * scale — the three live under different route roots, so the pathname is the
 * only honest source.
 */
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { COLOR, PRODUCT_FAMILY_CUE, RADIUS, TYPE } from "./designTokens";

const SCALES = [
  { key: "community", label: "Community", level: "GROUP", href: "/hub/community" },
  { key: "globe", label: "Globe", level: "NETWORK", href: "/planet" },
  { key: "world", label: "World", level: "SYSTEM", href: "/world" },
] as const;

export default function SocialScaleNav() {
  const pathname = usePathname();
  const params = useSearchParams();
  const sel = params.get("sel");

  const activeKey = pathname.startsWith("/hub/community") ? "community"
    : pathname.startsWith("/planet") ? "globe"
    : pathname.startsWith("/world") ? "world" : undefined;

  return (
    <nav dir="rtl" style={S.bar} aria-label="SOCIAL scale">
      <span style={S.label}>SOCIAL</span>
      {SCALES.map((s) => {
        const here = s.key === activeKey;
        // The selection is the one thing that must survive a scale change.
        const href = sel ? `${s.href}?sel=${encodeURIComponent(sel)}` : s.href;
        return (
          <Link
            key={s.key}
            href={href}
            prefetch
            style={{ ...S.item, ...(here ? S.itemHere : null) }}
            aria-current={here ? "page" : undefined}
          >
            <b style={{ ...S.level, color: here ? "#02101f" : COLOR.textFaint }}>{s.level}</b>
            <span>{s.label}</span>
          </Link>
        );
      })}
      {sel ? <span style={S.sel} title={sel}>הבחירה נשמרת במעבר</span> : null}
    </nav>
  );
}

const S: Record<string, React.CSSProperties> = {
  bar: {
    display: "flex", alignItems: "center", gap: 4,
    border: `1px solid ${PRODUCT_FAMILY_CUE.borderActive}`,
    background: PRODUCT_FAMILY_CUE.bgActive,
    borderRadius: 11, padding: "3px 7px 3px 8px",
  },
  label: { ...TYPE.micro, fontSize: 8, letterSpacing: 1.4, color: PRODUCT_FAMILY_CUE.labelActive, whiteSpace: "nowrap" },
  item: {
    display: "inline-flex", alignItems: "baseline", gap: 5,
    fontSize: 11, color: COLOR.textDim, textDecoration: "none",
    padding: "4px 10px", borderRadius: RADIUS.sm,
  },
  itemHere: { background: PRODUCT_FAMILY_CUE.labelActive, color: "#02101f", fontWeight: 700 },
  level: { ...TYPE.micro, fontSize: 7.5, letterSpacing: 1 },
  sel: { ...TYPE.micro, fontSize: 7.5, color: COLOR.textFaint, marginInlineStart: 4 },
};
