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
import { SELECTED_GROUP_PARAM } from "@/app/lib/philos/community/selectedGroupContext";

import { FS, COLOR, PRODUCT_FAMILY_CUE, TERMINAL, TYPE } from "./designTokens";

const SCALES = [
  { key: "community", label: "Community", level: "GROUP", href: "/hub/community" },
  { key: "globe", label: "Globe", level: "NETWORK", href: "/planet" },
  { key: "world", label: "World", level: "SYSTEM", href: "/world" },
] as const;

export default function SocialScaleNav({ selectedGroup }: { selectedGroup?: string }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const sel = params.get("sel");
  /* THE SELECTED ENTITY, not just the selected record. `sel` carries a
     highlighted row; `group` carries the living entity the three lenses are
     lenses OF. Only `sel` travelled, so Community → Globe → World kept a
     highlight and dropped the subject — the three went back to being three
     dashboards at exactly the moment the user changed lens. The server
     resolves it (URL param, else the viewer's own group) and hands it down,
     because a client control cannot know which group the loader chose. */
  const group = params.get(SELECTED_GROUP_PARAM) ?? selectedGroup ?? null;

  const activeKey = pathname.startsWith("/hub/community") ? "community"
    : pathname.startsWith("/planet") ? "globe"
    : pathname.startsWith("/world") ? "world" : undefined;

  return (
    <nav dir="rtl" style={S.bar} aria-label="SOCIAL scale">
      <span style={S.label}>SOCIAL</span>
      {SCALES.map((s) => {
        const here = s.key === activeKey;
        // The selection is the one thing that must survive a scale change.
        const q = [
          sel ? `sel=${encodeURIComponent(sel)}` : null,
          group ? `${SELECTED_GROUP_PARAM}=${encodeURIComponent(group)}` : null,
        ].filter(Boolean);
        const href = q.length > 0 ? `${s.href}?${q.join("&")}` : s.href;
        return (
          <Link
            key={s.key}
            href={href}
            prefetch
            style={{
              ...S.item,
              /* NO BACKGROUND ON THE ACTIVE MEMBER. A tint of any strength is
                 still a filled area with four straight edges, and on a dark
                 ground even 6% white reads as a rectangle sitting inside the
                 capsule — the last remaining box. Selection is carried by the
                 underline, the weight and the colour, none of which can bound
                 a region. */
              ...(here ? {
                ...S.itemHere,
                boxShadow: `inset 0 -2px 0 0 ${TERMINAL[s.key].accent}`,
              } : null),
            }}
            aria-current={here ? "page" : undefined}
          >
            <b style={{ ...S.level, color: here ? TERMINAL[s.key].accent : COLOR.textFaint }}>{s.level}</b>
            <span>{s.label}</span>
          </Link>
        );
      })}
      {/* INSIDE THE ONE BOX. Moving this out was wrong: the top green area is
          ONE control — the family label, the three scales and the note that
          the selected entity travels with the lens all belong to the same
          surface. Taking it out produced exactly the extra box the change was
          meant to remove. */}
      {group || sel ? (
        <span style={S.sel} title={group ?? sel ?? ""}>
          {group ? "הישות הנבחרת עוברת עם העדשה" : "הבחירה נשמרת במעבר"}
        </span>
      ) : null}
    </nav>
  );
}

const S: Record<string, React.CSSProperties> = {
  bar: {
    /* The three scale members plus the SOCIAL label sum to ~491px, which is
       wider than a phone. Fixed, the whole PAGE scrolled sideways — measured
       at 375px, invisible at desktop. The band wraps instead: it is a control
       strip, so a second row is correct and a sideways page is not. */
    /* ONE SURFACE. `gap: 4` put a visible break between every member and the
       padding held them off the edges, so the capsule read as a tray holding
       four separate tabs rather than as one control. The container owns the
       border, the fill and the single radius; `overflow: hidden` clips the
       members to it so nothing needs a radius of its own. */
    display: "flex", alignItems: "stretch", gap: 0, flexWrap: "wrap", maxWidth: "100%",
    border: `1px solid ${PRODUCT_FAMILY_CUE.borderActive}`,
    background: PRODUCT_FAMILY_CUE.bgActive,
    borderRadius: 11, padding: 0, overflow: "hidden",
  },
  label: { ...TYPE.micro, fontSize: FS.base, letterSpacing: 1.4, color: PRODUCT_FAMILY_CUE.labelActive,
    whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", padding: "6px 10px" },
  item: {
    /* NO radius, NO border, NO background of its own. A member is a region of
       the one surface, not a tile sitting on it. */
    display: "inline-flex", alignItems: "center", gap: 5,
    fontSize: FS.meta, color: COLOR.textDim, textDecoration: "none",
    padding: "7px 12px", borderRadius: 0, background: "transparent",
  },
  /* PRODUCT_FAMILY_CUE != CANONICAL_COLOR_ROLE, enforced at the pixel.
     The CAPSULE carries the family cue — its border, its background, its
     SOCIAL label. The ACTIVE MEMBER carries its OWN canonical accent from
     `TERMINAL`, overridden at the call site. This used to fill the active
     member with `PRODUCT_FAMILY_CUE.labelActive`, which meant standing on
     /world painted World as a solid GREEN pill — the family cue rendered as
     if it were the member's canonical role, and specifically the one member
     whose role is WHITE. The two cues are now expressed by two different
     parts of the control and can no longer be mistaken for each other. */
  /* THE ACTIVE MEMBER IS NOT ANOTHER BOX.
     It used to be filled with its own canonical accent, which drew a second
     rounded green rectangle inside the green capsule — four boxes wherever
     you stood. Selection is now weight, brightness and an inset underline:
     unmistakable, and incapable of becoming a rectangle. */
  itemHere: { color: "#eafff6", fontWeight: 700 },
  level: { ...TYPE.micro, fontSize: FS.base, letterSpacing: 1 },
  /* A region of the one surface, like every other member: no box, no radius,
     no background — only padding so it sits on the same baseline. */
  sel: { ...TYPE.micro, fontSize: FS.base, color: COLOR.textFaint,
    display: "inline-flex", alignItems: "center", padding: "7px 12px",
    borderRadius: 0, background: "transparent", whiteSpace: "nowrap" },
};
