"use client";
/**
 * THE VALUE SPECTRUM — the whole landscape on one screen, not 223 rows.
 *
 * Two orthogonal encodings, both carrying real facts and neither decorative:
 *
 *   AREA  = how well described  — family area ∝ its sub-value count,
 *           cell area ∝ how many belief traditions cite that exact value.
 *   FILL  = who organised around it — 0 groups / 1 group / many.
 *
 * The product's actual state is legible in one look precisely because the two
 * disagree: a densely described landscape with almost no population. A card
 * list of the three existing groups could not show that; it would report a
 * community of three interests.
 *
 * RTL: the SVG pins `direction: ltr` because SVG text-anchor mirrors under
 * RTL and drops labels on the wrong side of their cells. Hebrew strings still
 * render right-to-left inside each label — only the coordinate system is
 * pinned. The surrounding page stays RTL.
 */
import { useMemo, useState } from "react";
import { COLOR, FS, RADIUS, SPACE } from "@/app/lib/philos/shell/designTokens";
import { STATE, INTERACTION } from "@/app/lib/philos/shell/visualGrammar";
import { layoutSpectrum, populationOf, type CellLayout, type FamilyLayout } from "@/app/lib/philos/community/spectrumLayout";
import type { ValueGroupUniverse } from "@/app/lib/philos/community/valueGroupUniverse";

export interface SpectrumGroupRef {
  group_id: string;
  name: string;
  provenance: "REAL" | "DEMO";
  mine: boolean;
  mapped: boolean;
}

/* POPULATION — the map's ONLY fill ramp: sequential, one hue, light→dark, per
   the visualization corpus's "sequential is the safe default" rule. Fill is
   spent entirely here, which is why data state has to live on the outline and
   on a word instead (see visualGrammar.ts). */
const POP_FILL = {
  NONE: "#161d2e",
  ONE:  "#25537f",
  MANY: "#3183d4",
} as const;
const POP_LABEL = { NONE: "ללא קבוצה", ONE: "קבוצה אחת", MANY: "כמה קבוצות" } as const;

/* Data state on a group chip. Dash pattern is the primary cue and the tag is
   always drawn — hue is the third cue and never carries the distinction alone. */
const PROV = {
  REAL: { stroke: STATE.REAL.hue, dash: STATE.REAL.dash, label: STATE.REAL.tag },
  DEMO: { stroke: STATE.DEMO.hue, dash: STATE.DEMO.dash, label: STATE.DEMO.tag },
} as const;

/* SURFACE GAP, not a stroke. Every cell previously carried a 1px outline, so
   223 outlines competed with the fills they surrounded and the map read as a
   spreadsheet of boxes. The corpus rule is explicit — "2px surface-colour gap
   between touching marks. Never a stroke around a mark." Gaps are structure;
   outlines were noise. */
const CELL_GAP = 2;
const FAMILY_GUTTER = 5;
const HAIRLINE = 0.5;

export default function ValueSpectrumMap({
  universe, groups, selectedFamily, selectedSubvalue, selectedGroup,
  onSelectFamily, onSelectSubvalue, onSelectGroup,
}: {
  universe: ValueGroupUniverse;
  groups: readonly SpectrumGroupRef[];
  selectedFamily: string | null;
  selectedSubvalue: string | null;
  selectedGroup: string | null;
  onSelectFamily: (id: string | null) => void;
  onSelectSubvalue: (id: string | null) => void;
  onSelectGroup: (id: string | null) => void;
}) {
  const [hover, setHover] = useState<{ kind: "family" | "cell"; id: string } | null>(null);
  const W = 1180, H = 620;
  const layout = useMemo(() => layoutSpectrum(universe, W, H), [universe]);

  const focused = selectedFamily ? layout.families.filter((f) => f.family_id === selectedFamily) : layout.families;
  const unmapped = groups.filter((g) => !g.mapped);

  const hoveredCell = hover?.kind === "cell"
    ? layout.families.flatMap((f) => f.cells).find((c) => c.subvalue_id === hover.id) : null;
  const hoveredFam = hover?.kind === "family"
    ? layout.families.find((f) => f.family_id === hover.id) : null;

  const cellFill = (c: CellLayout) => POP_FILL[populationOf(c.group_count)];
  const isSel = (c: CellLayout) => c.subvalue_id === selectedSubvalue;

  return (
    <div>
      {/* LEGEND — names every channel actually in use. A channel the reader
          cannot name is a channel they will read as decoration. */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: SPACE.lg, alignItems: "center",
        marginBottom: SPACE.sm, fontSize: FS.meta, color: COLOR.textDim }}>
        <span style={{ color: COLOR.textFaint }}>שטח = עומק תיעוד · מילוי = אכלוס · מסגרת מקווקוות = מקור</span>
        {(["NONE", "ONE", "MANY"] as const).map((p) => (
          <span key={p} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 14, height: 14, background: POP_FILL[p], border: `1px solid ${COLOR.border}`, borderRadius: 3 }} />
            {POP_LABEL[p]}
          </span>
        ))}
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 14, height: 14, border: `1.5px solid ${PROV.REAL.stroke}`, borderRadius: 3 }} />REAL
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 14, height: 14, border: `1.5px dotted ${PROV.DEMO.stroke}`, borderRadius: 3 }} />DEMO
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 14, height: 14, borderRadius: 3, border: `2px solid ${INTERACTION.viewer.ringColor}` }} />אתה כאן
        </span>
        {selectedFamily || selectedSubvalue || selectedGroup ? (
          <button onClick={() => { onSelectFamily(null); onSelectSubvalue(null); onSelectGroup(null); }}
            style={{ minBlockSize: 32, padding: "4px 12px", borderRadius: RADIUS.pill, cursor: "pointer",
              background: "transparent", border: `1px solid ${COLOR.borderStrong}`, color: COLOR.text, fontSize: FS.meta }}>
            איפוס לכל היקום
          </button>
        ) : null}
      </div>

      <div style={{ position: "relative", overflowX: "auto" }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="group"
          aria-label={`ספקטרום הערכים — ${universe.coverage.family_count} משפחות, ${universe.coverage.subvalue_count} תת-ערכים`}
          style={{ direction: "ltr", display: "block", minWidth: 720,
            background: COLOR.bg, borderRadius: RADIUS.md, border: `1px solid ${COLOR.border}` }}>
          {focused.map((f: FamilyLayout) => {
            const dim = selectedFamily !== null && f.family_id !== selectedFamily;
            const scale = selectedFamily === f.family_id ? { x: 0, y: 0, w: W, h: H } : f;
            return (
              <g key={f.family_id} opacity={dim ? 0.25 : 1}>
                {/* LEVEL 1 · FAMILY — a region, separated from its neighbours
                    by a gutter rather than boxed by a border. The only stroke
                    is a hairline base rule under the header, which reads as
                    structure instead of as a card edge. */}
                <rect x={scale.x + FAMILY_GUTTER / 2} y={scale.y + FAMILY_GUTTER / 2}
                  width={Math.max(0, scale.w - FAMILY_GUTTER)} height={Math.max(0, scale.h - FAMILY_GUTTER)}
                  rx={4} fill="#0c1220" />
                <line x1={scale.x + FAMILY_GUTTER / 2} y1={scale.y + 17}
                  x2={scale.x + scale.w - FAMILY_GUTTER / 2} y2={scale.y + 17}
                  stroke={f.group_count > 0 ? "#3d6fa8" : "rgba(120,150,220,0.18)"} strokeWidth={HAIRLINE} />
                {/* Family label. The id + leaf count always fits and always
                    renders; the NAME is drawn only where the region is wide
                    enough to hold it without colliding with the id beside it.
                    A clipped label that overlaps its neighbour is worse than
                    no label — the name is one hover or one click away. */}
                {(() => {
                  const idW = 40 + String(f.subvalue_count).length * 7;
                  const room = scale.w - idW - 12;
                  const chars = Math.floor(room / 7);
                  // 12px is the product-wide floor and the map does not get an
                  // exemption. A cell too small for a 12px label gets NO label
                  // rather than an unreadable one — the name stays one hover,
                  // one Tab, or one click away, and every cell carries it as an
                  // aria-label regardless of whether it is drawn.
                  if (chars < 4) return null;
                  return (
                    <text x={scale.x + scale.w - 6} y={scale.y + 13} textAnchor="end"
                      fontSize={12} fill={f.group_count > 0 ? "#cfe0ff" : COLOR.textDim}>
                      {f.name_he.length > chars ? f.name_he.slice(0, chars - 1) + "…" : f.name_he}
                    </text>
                  );
                })()}
                <text x={scale.x + 6} y={scale.y + 13} textAnchor="start" fontSize={12} fill={COLOR.textFaint}>
                  {f.family_id} · {f.subvalue_count}
                </text>
                {/* Clickable family surface, keyboard-reachable. */}
                <rect x={scale.x} y={scale.y} width={scale.w} height={Math.min(17, scale.h)}
                  fill="transparent" style={{ cursor: "pointer" }} tabIndex={0} role="button"
                  aria-label={`משפחת ערך ${f.name_he}: ${f.subvalue_count} תת-ערכים, ${f.group_count} קבוצות`}
                  onMouseEnter={() => setHover({ kind: "family", id: f.family_id })}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover({ kind: "family", id: f.family_id })}
                  onBlur={() => setHover(null)}
                  onClick={() => onSelectFamily(selectedFamily === f.family_id ? null : f.family_id)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelectFamily(selectedFamily === f.family_id ? null : f.family_id); } }} />
                {/* A family with zero sub-values says so, rather than reading
                    as a rendering failure. */}
                {f.subvalue_count === 0 ? (
                  <text x={scale.x + scale.w / 2} y={scale.y + scale.h / 2 + 4} textAnchor="middle"
                    fontSize={12} fill={COLOR.textFaint}>{scale.w > 96 ? "0 תת-ערכים" : "0"}</text>
                ) : null}
                {(selectedFamily === f.family_id
                  ? layoutSpectrum({ ...universe, families: [{ ...universe.families.find((x) => x.family_id === f.family_id)! }] } as never, W, H).families[0].cells
                  : f.cells
                ).map((c) => (
                  <g key={c.subvalue_id}>
                    {/* LEVEL 3 · OCCUPANCY — fill lightness only. Interaction
                        is a ring drawn OUTSIDE the mark, so selecting a cell
                        never repaints the value its fill is carrying. */}
                    {isSel(c) || hover?.id === c.subvalue_id ? (
                      <rect x={c.x + CELL_GAP / 2 - 1.5} y={c.y + CELL_GAP / 2 - 1.5}
                        width={Math.max(0, c.w - CELL_GAP + 3)} height={Math.max(0, c.h - CELL_GAP + 3)}
                        rx={3} fill="none" pointerEvents="none"
                        stroke={isSel(c) ? INTERACTION.selected.ringColor : INTERACTION.hover.ringColor}
                        strokeWidth={isSel(c) ? INTERACTION.selected.ring : INTERACTION.hover.ring} />
                    ) : null}
                    <rect x={c.x + CELL_GAP / 2} y={c.y + CELL_GAP / 2}
                      width={Math.max(0, c.w - CELL_GAP)} height={Math.max(0, c.h - CELL_GAP)} rx={2}
                      fill={cellFill(c)}
                      tabIndex={0} role="button" style={{ cursor: "pointer" }}
                      aria-label={`תת-ערך ${c.name_he}, ${c.source_count} מקורות, ${c.group_count} קבוצות`}
                      onMouseEnter={() => setHover({ kind: "cell", id: c.subvalue_id })}
                      onMouseLeave={() => setHover(null)}
                      onFocus={() => setHover({ kind: "cell", id: c.subvalue_id })}
                      onBlur={() => setHover(null)}
                      onClick={() => onSelectSubvalue(selectedSubvalue === c.subvalue_id ? null : c.subvalue_id)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelectSubvalue(selectedSubvalue === c.subvalue_id ? null : c.subvalue_id); } }} />
                    {/* Same 12px floor. `w/6.6` is the widest label 12px type
                        fits in this cell; below 4 characters there is nothing
                        legible to say, so the cell stays a pure area/fill mark
                        and reports itself through hover, focus and aria. */}
                    {/* Population is a fill ramp, and a ramp alone fails in
                        grayscale at these sizes. A populated cell also carries
                        a dot — redundant encoding of the SAME meaning, which is
                        allowed; a second meaning on this channel would not be. */}
                    {c.group_count > 0 && c.w > 10 && c.h > 10 ? (
                      <circle cx={c.x + c.w - 6} cy={c.y + 6} r={2.5} fill="#cfe6ff" pointerEvents="none" />
                    ) : null}
                    {(() => {
                      const chars = Math.floor(c.w / 6.6);
                      if (c.h < 22 || chars < 4) return null;
                      return (
                        <text x={c.x + c.w / 2} y={c.y + c.h / 2 + 4} textAnchor="middle" fontSize={12}
                          fill={c.group_count > 0 ? "#eaf2ff" : COLOR.textDim} pointerEvents="none">
                          {c.name_he.length > chars ? c.name_he.slice(0, chars - 1) + "…" : c.name_he}
                        </text>
                      );
                    })()}
                  </g>
                ))}
              </g>
            );
          })}
        </svg>

        {/* HOVER / FOCUS READOUT — concise, and it never covers the map. */}
        <div aria-live="polite" style={{ minHeight: 40, marginTop: SPACE.sm, padding: `${SPACE.sm}px ${SPACE.md}px`,
          background: COLOR.bgCard, border: `1px solid ${COLOR.border}`, borderRadius: RADIUS.md,
          fontSize: FS.base, color: COLOR.text }}>
          {hoveredCell ? (
            <>
              <strong>{hoveredCell.name_he}</strong>{" "}
              <span style={{ color: COLOR.textFaint }}>{hoveredCell.subvalue_id} · {hoveredCell.family_id}</span>
              {" — "}{hoveredCell.source_count} מסורות מצטטות · {hoveredCell.group_count === 0
                ? <span style={{ color: COLOR.textFaint }}>אין קבוצה סביב הערך הזה</span>
                : <span style={{ color: "#7fe0ab" }}>{hoveredCell.group_count} קבוצות</span>}
            </>
          ) : hoveredFam ? (
            <><strong>{hoveredFam.name_he}</strong> <span style={{ color: COLOR.textFaint }}>{hoveredFam.family_id}</span>
              {" — "}{hoveredFam.content_he} · {hoveredFam.subvalue_count} תת-ערכים · {hoveredFam.group_count} קבוצות</>
          ) : (
            <span style={{ color: COLOR.textDim }}>רחף או נווט עם Tab על משפחה או תת-ערך. לחיצה על משפחה פותחת אותה.</span>
          )}
        </div>
      </div>

      {/* GROUPS OFF THE MAP. Unmapped is not deleted — it is a named lane
          beside the spectrum, because a group with no canonical value still
          exists and still has members, a budget and effects. */}
      {unmapped.length > 0 ? (
        <div style={{ marginTop: SPACE.md, padding: SPACE.md, background: COLOR.bgCard,
          border: `1px dashed ${COLOR.borderStrong}`, borderRadius: RADIUS.md }}>
          <div style={{ fontSize: FS.section, fontWeight: 600, color: COLOR.text, marginBottom: 4 }}>
            מחוץ למפה — {unmapped.length} קבוצות ללא מיפוי ערך קנוני
          </div>
          <div style={{ fontSize: FS.meta, color: COLOR.textDim, marginBottom: SPACE.sm, maxWidth: "70ch" }}>
            הערך שהן מצהירות אינו זהה לאף אחד מ-{universe.coverage.subvalue_count} תת-הערכים. הן קיימות, פעילות, ובעלות תקציב — אבל אין להן עדיין מקום קנוני בספקטרום.
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: SPACE.sm }}>
            {unmapped.map((g) => {
              const p = PROV[g.provenance];
              const sel = selectedGroup === g.group_id;
              return (
                <button key={g.group_id} onClick={() => onSelectGroup(sel ? null : g.group_id)}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, minBlockSize: 32,
                    padding: `4px ${SPACE.md}px`, borderRadius: RADIUS.pill, cursor: "pointer",
                    background: "transparent",
                    // Border style carries STATE; the selection ring is a separate
                    // outline so selecting never overwrites provenance.
                    border: `1.5px ${g.provenance === "DEMO" ? "dotted" : "solid"} ${p.stroke}`,
                    outline: sel ? `${INTERACTION.selected.ring}px solid ${INTERACTION.selected.ringColor}`
                      : g.mine ? `${INTERACTION.viewer.ring}px solid ${INTERACTION.viewer.ringColor}` : "none",
                    outlineOffset: 2,
                    color: COLOR.text, fontSize: FS.meta }}>
                  {g.name}
                  <span style={{ fontSize: FS.tag, color: p.stroke }}>{p.label}</span>
                  {g.mine ? <span style={{ fontSize: FS.tag, color: INTERACTION.viewer.ringColor }}>· אתה כאן</span> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
