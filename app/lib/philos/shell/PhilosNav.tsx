"use client";

/**
 * ONE NAVIGATION, FOUR FAMILIES, NINE DESTINATIONS.
 *
 * The header had grown three competing controls that all claimed the same
 * ground: a seven-lens role bar, a separate SOCIAL capsule, and a loose
 * HUMAN CONFIG button. "מערכת חברתית" appeared twice — once as a lens whose
 * href was the in-page anchor `#lens-green`, and once as the capsule that
 * actually navigated — so the more prominent of the two was the one that did
 * nothing. Human Config, which belongs to אדם, sat outside every family.
 *
 * Here every family is a heading and every child is a real route. Nothing in
 * this bar is an anchor, and nothing that looks clickable fails to navigate.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";

import { COLOR, COLOR_ROLE } from "./designTokens";

type Item = { label: string; href: string; match: (p: string) => boolean };
type Family = { id: string; label: string; hue: string; items: Item[] };

const at = (...prefixes: string[]) => (p: string) =>
  prefixes.some((x) => p === x || p.startsWith(x + "/") || p.startsWith(x + "?"));

export const FAMILIES: Family[] = [
  { id: "person", label: "אדם", hue: COLOR_ROLE.purple, items: [
    { label: "מרכז", href: "/hub", match: (p) => p === "/hub" },
    { label: "מוח", href: "/brain", match: at("/brain") },
    { label: "Human Config", href: "/hub/human-config", match: at("/hub/human-config") },
  ] },
  { id: "action", label: "פעולה", hue: COLOR_ROLE.red, items: [
    { label: "דינמיקה", href: "/dynamics", match: at("/dynamics") },
    { label: "שוק", href: "/marketplace", match: at("/marketplace") },
  ] },
  { id: "social", label: "מערכת חברתית", hue: COLOR_ROLE.green, items: [
    { label: "קהילה", href: "/hub/community", match: at("/hub/community") },
    { label: "גלובוס", href: "/planet", match: at("/planet") },
    { label: "עולם", href: "/world", match: at("/world") },
  ] },
  { id: "evidence", label: "מקור וראיות", hue: COLOR_ROLE.white, items: [
    /* The evidence surface is a REGION of Brain, not a terminal of its own.
       It keeps the fragment because that is honestly what it is — but it is
       filed under its family rather than competing as a top-level control. */
    { label: "ראיות", href: "/brain#evidence", match: () => false },
  ] },
];

export default function PhilosNav() {
  const pathname = usePathname() || "";
  return (
    <nav dir="rtl" aria-label="ניווט PHILOS" style={S.bar}>
      {FAMILIES.map((f) => (
        <div key={f.id} style={S.family} data-nav-family={f.id}>
          <span style={{ ...S.familyLabel, color: f.hue }}>{f.label}</span>
          <div style={S.items}>
            {f.items.map((it) => {
              const here = it.match(pathname);
              return (
                <Link key={it.href} href={it.href} data-nav-item={it.label}
                  aria-current={here ? "page" : undefined}
                  style={{ ...S.item,
                    color: here ? COLOR.text : COLOR.textDim,
                    fontWeight: here ? 700 : 500,
                    boxShadow: `inset 0 -2px 0 0 ${here ? f.hue : "transparent"}` }}>
                  {it.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

const S: Record<string, React.CSSProperties> = {
  bar: { display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: 18,
    paddingBlock: 6 },
  family: { display: "grid", gap: 2, minWidth: 0 },
  familyLabel: { fontSize: 10, fontWeight: 800, letterSpacing: 1.1 },
  items: { display: "flex", gap: 2, flexWrap: "wrap" },
  item: { fontSize: 14, padding: "5px 10px", borderRadius: 7,
    textDecoration: "none", whiteSpace: "nowrap" },
};
