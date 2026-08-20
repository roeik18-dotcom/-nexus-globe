"use client";

/**
 * OrientationCore — Hub's master visual prototype (full composition rebuild,
 * per human visual review rejecting the earlier sparse radial version).
 *
 * THREE LAYERS, kept visually distinct throughout:
 *   MODEL      — the permanent conceptual structure (rings, labeled slots).
 *                Visible even when no live data exists — UNKNOWN != ABSENT.
 *   LIVE STATE — what is actually known about the selected subject now
 *                (canon Level/Stability, real Need/action-space checks).
 *   EVIDENCE   — why a live-state claim exists; surfaced only in the focus
 *                panel on click (timestamp, context, real quoted source).
 *
 * TEN_FORCE_STRUCTURE: the target model has 10 force slots. Only 6 are
 * `SOURCE_PROVEN` this pass (the real "מודל ששת הבניינים" found in the
 * external corpus — see `PHILOS-CORPUS-EXTRACTION-SAMPLE.md`). All 10
 * POSITIONS are rendered (the structure is real/target-real); the 4
 * unresolved ones are rendered as dashed "?" slots, never invented names.
 *
 * FUNCTIONAL COLOR (explicit user instruction for this screen, applied here
 * as chosen visual language — not claimed as independently source-verified
 * against `PHILOS-COLOR-SYSTEM-MASTER.md`, which was searched this session
 * and does not contain this exact 7-word mapping verbatim; that tension is
 * stated, not hidden): WHITE=evidence/reference, PURPLE=meaning/value,
 * BLUE=structure/cognition, GREEN=relationship, YELLOW=transition,
 * ORANGE=drive/capacity/momentum, RED=action. Every ring/element also
 * carries a non-color signal (label, position, dash pattern for UNKNOWN) —
 * color is never the only encoding.
 *
 * Self/World/Situation, Relationships/Group, Community/Values, System/
 * Resources, and World/Reality rings are all real STRUCTURAL positions
 * with NO live data source wired to them yet (none found in 52/2372 corpus
 * files read, and no product store exists for them) — rendered as
 * genuinely UNKNOWN rings, not hidden, not fabricated.
 */
import { useState, type ReactNode } from "react";
import type { OrientationCore as OrientationCoreData } from "@/app/lib/philos/orientationCore";
import type { KnownNeedResult, ActionSpaceSummary } from "@/app/lib/systemContext";
import { encodeSystemContextRef } from "@/app/lib/systemContext";

// ── functional color language (this screen, explicit instruction) ─────────
const WHITE = "#e8ecf5";   // evidence / reference
const PURPLE = "#b592e8";  // meaning / value
const BLUE = "#5b9cf6";    // structure / cognition
const GREEN = "#4fd1a5";   // relationship
const YELLOW = "#f2d34a";  // transition
const ORANGE = "#f2a154";  // drive / capacity / momentum
const RED = "#f2635c";     // action

const DOMAIN_COLOR: Record<"G" | "E" | "C", string> = { G: "#38bdf8", E: "#f472b6", C: "#a78bfa" };
const DOMAIN_WORD: Record<"G" | "E" | "C", string> = { G: "גוף", E: "רגש", C: "שכל" };
const DOMAINS: ("G" | "E" | "C")[] = ["G", "E", "C"];

function levelState(level: number): { label: string; color: string } {
  if (level < 0) return { label: "גירעון", color: RED };
  if (level > 0) return { label: "עודף", color: GREEN };
  return { label: "שיווי משקל", color: YELLOW };
}

// The real 6-force model found this pass, plus 4 real structural
// placeholders for the target 10-force model — never invented names.
const FORCES: { key: string; label: string; social: string; proven: boolean }[] = [
  { key: "mind", label: "מוח", social: "מדע · ידע · חוק", proven: true },
  { key: "heart", label: "לב", social: "קהילה · אמון · קשר", proven: true },
  { key: "body", label: "גוף", social: "כלכלה · משאבים", proven: true },
  { key: "id", label: "איד", social: "כוחות הישרדות · אינטרסים", proven: true },
  { key: "ego", label: "אגו", social: "מנגנוני איזון", proven: true },
  { key: "superego", label: "סופר־אגו", social: "ערכים קולקטיביים", proven: true },
  { key: "f7", label: "כוח 7", social: "לא ידוע — לא נמצא מקור", proven: false },
  { key: "f8", label: "כוח 8", social: "לא ידוע — לא נמצא מקור", proven: false },
  { key: "f9", label: "כוח 9", social: "לא ידוע — לא נמצא מקור", proven: false },
  { key: "f10", label: "כוח 10", social: "לא ידוע — לא נמצא מקור", proven: false },
];

// ── ring geometry (MESO view) ───────────────────────────────────────────
const W = 1000;
const H = 1000;
const CENTER = { x: W / 2, y: H / 2 };

const R_DOMAIN = 90;
const R_FORCE = 175;
const R_LENS = 250;
const R_REL = 320;
const R_COMMUNITY = 390;
const R_SYSTEM = 455;
const R_WORLD = 490;

const RINGS: { r: number; label: string; color: string; note?: string }[] = [
  // Primary label states only what's SOURCE_PROVEN (6) — the "10" target
  // structure is real but UNRESOLVED for positions 7-10 and stays in the
  // click-triggered inspector text only, per the explicit product rule:
  // never present "10 forces" as established truth in the primary view.
  { r: R_FORCE, label: "6 כוחות מאומתים", color: ORANGE },
  { r: R_LENS, label: "עצמי · עולם · סיטואציה", color: PURPLE },
  { r: R_REL, label: "קשרים · אנשים · קבוצה", color: GREEN },
  { r: R_COMMUNITY, label: "קהילה · ערכים", color: PURPLE },
  { r: R_SYSTEM, label: "מערכת · משאבים · מבנים", color: BLUE },
  { r: R_WORLD, label: "עולם · מציאות רחבה", color: WHITE },
];

const LENS = [
  { key: "lens_self", label: "עצמי" },
  { key: "lens_world", label: "עולם" },
  { key: "lens_situation", label: "סיטואציה" },
];

function ringPos(r: number, i: number, count: number, offset = 0): { x: number; y: number } {
  const angle = -Math.PI / 2 + offset + (i * 2 * Math.PI) / count;
  return { x: CENTER.x + r * Math.cos(angle), y: CENTER.y + r * Math.sin(angle) };
}

type FocusKey = "human" | "G" | "E" | "C" | string; // force key or lens key etc

export default function OrientationCore({
  core,
  knownNeeds,
  actionSpace,
}: {
  core: OrientationCoreData;
  knownNeeds: KnownNeedResult;
  actionSpace: ActionSpaceSummary;
}) {
  const [focused, setFocused] = useState<FocusKey | null>(null);
  const [zoom, setZoom] = useState<"meso" | "micro">("meso");

  const domainMark = (d: "G" | "E" | "C") => core[d];
  const domainPrior = (d: "G" | "E" | "C") => (d === "G" ? core.priorG : d === "E" ? core.priorE : core.priorC);

  const effectiveR_domain = zoom === "micro" ? 200 : R_DOMAIN;
  const humanR = zoom === "micro" ? 70 : 40;
  const viewBox = zoom === "micro" ? `260 260 480 480` : `0 0 ${W} ${H}`;

  return (
    <div dir="rtl" style={{ fontFamily: "system-ui", background: "#080b13", color: "#e6ebf5", padding: 16, borderRadius: 12, border: "1px solid #1e2740" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div>
          <div style={{ fontSize: 12, letterSpacing: 1, color: BLUE }}>אוריינטציה נוכחית — המודל, המצב החי, הראיה</div>
          <div style={{ fontSize: 15, color: "#7f97c2", marginTop: 2 }}>נושא: {core.subject}</div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            onClick={() => setZoom("meso")}
            style={{ fontSize: 12, padding: "5px 10px", borderRadius: 14, border: `1px solid ${zoom === "meso" ? BLUE : "#2a3f66"}`, background: "transparent", color: zoom === "meso" ? BLUE : "#7f97c2", cursor: "pointer" }}
          >
            תצוגת מערכת
          </button>
          <button
            onClick={() => setZoom("micro")}
            style={{ fontSize: 12, padding: "5px 10px", borderRadius: 14, border: `1px solid ${zoom === "micro" ? BLUE : "#2a3f66"}`, background: "transparent", color: zoom === "micro" ? BLUE : "#7f97c2", cursor: "pointer" }}
          >
            זום פנימי — אדם
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start", marginTop: 10 }}>
        <svg viewBox={viewBox} width="100%" style={{ minHeight: "72vh", maxHeight: "82vh" }} role="img" aria-label="מפת אוריינטציה">
          {/* MODEL LAYER — permanent structural rings, always visible */}
          {zoom === "meso" &&
            RINGS.map((ring) => (
              <circle key={ring.label} cx={CENTER.x} cy={CENTER.y} r={ring.r} fill="none" stroke={`${ring.color}33`} strokeWidth={1} strokeDasharray="2 6" />
            ))}
          {zoom === "meso" &&
            RINGS.map((ring) => (
              <text key={`t-${ring.label}`} x={CENTER.x} y={CENTER.y - ring.r - 6} fill={`${ring.color}99`} fontSize={11} textAnchor="middle">
                {ring.label}
              </text>
            ))}

          {/* Two-directional story: inward influence, outward action */}
          {zoom === "meso" && (
            <>
              <path d={`M ${CENTER.x - R_SYSTEM} ${CENTER.y - 40} Q ${CENTER.x - R_LENS} ${CENTER.y - 10} ${CENTER.x - R_DOMAIN - 10} ${CENTER.y}`} fill="none" stroke={YELLOW} strokeWidth={2} markerEnd="url(#arrowIn)" opacity={0.7} />
              <text x={CENTER.x - R_REL} y={CENTER.y - 60} fill={YELLOW} fontSize={11} textAnchor="middle">פנימה — כוחות משפיעים</text>

              <path d={`M ${CENTER.x + R_DOMAIN + 10} ${CENTER.y + 10} Q ${CENTER.x + R_LENS} ${CENTER.y + 40} ${CENTER.x + R_SYSTEM} ${CENTER.y + 70}`} fill="none" stroke={RED} strokeWidth={2} markerEnd="url(#arrowOut)" opacity={0.7} />
              <text x={CENTER.x + R_REL} y={CENTER.y + 95} fill={RED} fontSize={11} textAnchor="middle">החוצה — פעולה והשפעה</text>

              <defs>
                <marker id="arrowIn" markerWidth={8} markerHeight={8} refX={6} refY={4} orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill={YELLOW} /></marker>
                <marker id="arrowOut" markerWidth={8} markerHeight={8} refX={6} refY={4} orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill={RED} /></marker>
              </defs>
            </>
          )}

          {/* FORCE ring — 10 slots, 6 proven, 4 UNKNOWN */}
          {zoom === "meso" &&
            FORCES.map((f, i) => {
              const p = ringPos(R_FORCE, i, FORCES.length);
              const isFocused = focused === f.key;
              const color = f.proven ? ORANGE : "#3a4d70";
              return (
                <g key={f.key} onClick={() => setFocused(isFocused ? null : f.key)} style={{ cursor: "pointer" }}>
                  <line x1={CENTER.x} y1={CENTER.y} x2={p.x} y2={p.y} stroke="#1e2740" strokeWidth={1} strokeDasharray="2 4" />
                  <circle cx={p.x} cy={p.y} r={isFocused ? 24 : 19} fill={f.proven ? `${ORANGE}22` : "none"} stroke={color} strokeWidth={isFocused ? 2.5 : 1.5} strokeDasharray={f.proven ? undefined : "3 3"} />
                  <text x={p.x} y={p.y + 3} fill={f.proven ? "#f2e6d8" : "#6c86b5"} fontSize={f.proven ? 9.5 : 9} textAnchor="middle">
                    {f.proven ? f.label : "?"}
                  </text>
                </g>
              );
            })}

          {/* SELF / WORLD / SITUATION lens ring — real structural slots, all UNKNOWN (no source/data yet) */}
          {zoom === "meso" &&
            LENS.map((l, i) => {
              const p = ringPos(R_LENS, i, LENS.length, Math.PI / 6);
              const isFocused = focused === l.key;
              return (
                <g key={l.key} onClick={() => setFocused(isFocused ? null : l.key)} style={{ cursor: "pointer" }}>
                  <circle cx={p.x} cy={p.y} r={isFocused ? 22 : 17} fill="none" stroke={PURPLE} strokeWidth={isFocused ? 2.5 : 1.5} strokeDasharray="3 3" />
                  <text x={p.x} y={p.y + 3} fill={`${PURPLE}dd`} fontSize={10} textAnchor="middle">{l.label}</text>
                </g>
              );
            })}

          {/* outer UNKNOWN rings — clickable labels only, honest structural placeholders */}
          {zoom === "meso" &&
            [
              { key: "rel", r: R_REL, label: "יחסים", color: GREEN },
              { key: "community", r: R_COMMUNITY, label: "קהילה", color: PURPLE },
              { key: "system", r: R_SYSTEM, label: "מערכת", color: BLUE },
              { key: "world", r: R_WORLD, label: "עולם", color: WHITE },
            ].map((o, i) => {
              const p = ringPos(o.r, i, 4, Math.PI / 4);
              const isFocused = focused === o.key;
              return (
                <g key={o.key} onClick={() => setFocused(isFocused ? null : o.key)} style={{ cursor: "pointer" }}>
                  <circle cx={p.x} cy={p.y} r={isFocused ? 14 : 10} fill="none" stroke={`${o.color}88`} strokeWidth={1.5} strokeDasharray="2 3" />
                </g>
              );
            })}

          {/* center — human */}
          <g onClick={() => setFocused(focused === "human" ? null : "human")} style={{ cursor: "pointer" }}>
            <circle cx={CENTER.x} cy={CENTER.y} r={humanR} fill="#111726" stroke={BLUE} strokeWidth={2} />
            <text x={CENTER.x} y={CENTER.y} fill="#dbe6f6" fontSize={zoom === "micro" ? 15 : 12} textAnchor="middle" dominantBaseline="middle">אדם</text>
          </g>

          {/* Body/Emotion/Cognition ring — LIVE STATE overlay on the MODEL */}
          {DOMAINS.map((d, i) => {
            const p = ringPos(effectiveR_domain, i, 3, 0);
            const cx = zoom === "micro" ? CENTER.x + (p.x - CENTER.x) : p.x;
            const cy = zoom === "micro" ? CENTER.y + (p.y - CENTER.y) : p.y;
            const m = domainMark(d);
            const prior = domainPrior(d);
            const isFocused = focused === d;
            const known = m !== undefined;
            const color = known ? DOMAIN_COLOR[d] : "#3a4d70";
            const nodeR = zoom === "micro" ? 70 : 42;
            return (
              <g key={d} onClick={() => setFocused(isFocused ? null : d)} style={{ cursor: "pointer" }}>
                <line x1={CENTER.x} y1={CENTER.y} x2={cx} y2={cy} stroke="#1e2740" strokeWidth={2} />
                {!known ? (
                  <circle cx={cx} cy={cy} r={nodeR} fill="none" stroke={color} strokeWidth={1.5} strokeDasharray="4 4" />
                ) : (
                  <circle cx={cx} cy={cy} r={isFocused ? nodeR + 6 : nodeR} fill={`${color}22`} stroke={color} strokeWidth={isFocused ? 3 : 2} />
                )}
                <text x={cx} y={cy - 8} fill={known ? "#f2f6fc" : "#6c86b5"} fontSize={zoom === "micro" ? 16 : 13} fontWeight={700} textAnchor="middle">
                  {DOMAIN_WORD[d]}
                </text>
                <text x={cx} y={cy + 12} fill={known ? "#9fb0d0" : "#6c86b5"} fontSize={zoom === "micro" ? 12 : 9} textAnchor="middle">
                  {known ? levelState(m!.level).label : "לא ידוע"}
                </text>
                {known && prior ? (
                  <text x={cx} y={cy + (zoom === "micro" ? 32 : 24)} fill="#7b8ca6" fontSize={zoom === "micro" ? 10 : 8} textAnchor="middle">
                    {m!.level - prior.level >= 0 ? "▲" : "▼"} מאז {prior.observed_at.slice(0, 10)}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>

        <div style={{ flex: "1 1 220px", minWidth: 240 }}>
          <FocusContent
            focused={focused}
            core={core}
            knownNeeds={knownNeeds}
            actionSpace={actionSpace}
            domainColor={DOMAIN_COLOR}
            domainWord={DOMAIN_WORD}
          />
        </div>
      </div>
    </div>
  );
}

function FocusContent({
  focused, core, knownNeeds, actionSpace, domainColor, domainWord,
}: {
  focused: FocusKey | null;
  core: OrientationCoreData;
  knownNeeds: KnownNeedResult;
  actionSpace: ActionSpaceSummary;
  domainColor: Record<"G" | "E" | "C", string>;
  domainWord: Record<"G" | "E" | "C", string>;
}) {
  if (focused && DOMAINS.includes(focused as "G" | "E" | "C")) {
    const d = focused as "G" | "E" | "C";
    const m = core[d];
    if (!m) {
      return <Panel title={domainWord[d]} border="#3a4d70">אין תצפית אמיתית עבור ממד זה — לא ידוע.</Panel>;
    }
    return (
      <Panel title={domainWord[d]} border={domainColor[d]}>
        <div>מצב: <b style={{ color: levelState(m.level).color }}>{levelState(m.level).label}</b> (level {m.level})</div>
        <div style={{ marginTop: 2 }}>יציבות: {m.stability}</div>
        <div style={{ fontSize: 12, color: "#7b8ca6", marginTop: 6 }}>ראיה: {m.context} · {m.observed_at}</div>
        <a href={`/dynamics?ctx=${encodeURIComponent(encodeSystemContextRef({ kind: "canon_observation", canon_event_id: m.canon_event_id }))}`} style={{ display: "inline-block", marginTop: 8, fontSize: 13, color: BLUE }}>
          פתח ב-Dynamics →
        </a>
      </Panel>
    );
  }

  const force = FORCES.find((f) => f.key === focused);
  if (force) {
    return (
      <Panel title={force.label} border={force.proven ? ORANGE : "#3a4d70"}>
        {force.proven ? (
          <>
            <div>ברמת קבוצה/חברה: {force.social}</div>
            <div style={{ fontSize: 12, color: YELLOW, marginTop: 8 }}>מקור: קורפוס PHILOS חיצוני · REVIEW_REQUIRED — לא קנוני, לא מחושב, לא מקושר לנתון אמיתי.</div>
          </>
        ) : (
          <div style={{ color: "#7b8ca6", fontStyle: "italic" }}>לא ידוע — לא נמצא מקור עבור המיקום המבני הזה (מתוך מודל יעד של 10 כוחות; רק 6 אומתו במקור).</div>
        )}
      </Panel>
    );
  }

  if (focused === "lens_self" || focused === "lens_world" || focused === "lens_situation") {
    return (
      <Panel title={LENS.find((l) => l.key === focused)?.label ?? ""} border={PURPLE}>
        <div style={{ color: "#7b8ca6", fontStyle: "italic" }}>
          עדשת אוריינטציה אמיתית — אך לא נמצא מקור/נתון שמקשר אותה למידע חי עדיין. אינה זהה ל"אישי/יחסי/מערכתי" (Frame קנוני) — לא הוכחה זהות בין השניים.
        </div>
      </Panel>
    );
  }

  if (focused === "rel" || focused === "community" || focused === "system" || focused === "world") {
    const labels: Record<string, string> = { rel: "יחסים · אנשים · קבוצה", community: "קהילה · ערכים", system: "מערכת · משאבים · מבנים", world: "עולם · מציאות רחבה" };
    return (
      <Panel title={labels[focused]} border="#3a4d70">
        <div style={{ color: "#7b8ca6", fontStyle: "italic" }}>מבנה אמיתי במודל היעד — אין עדיין נתון חי או מנגנון מחובר לרמה הזו ב-Hub.</div>
      </Panel>
    );
  }

  if (focused === "human") {
    return (
      <Panel title="אדם" border={BLUE}>
        <div>נושא: {core.subject}</div>
        <div style={{ marginTop: 8 }}>
          <span style={{ color: "#6c86b5" }}>צורך: </span>
          {!knownNeeds.checked ? "לא ניתן לבדוק" : knownNeeds.needs.length > 0 ? `${knownNeeds.needs.length} צרכים אמיתיים` : "נבדק — אין צורך רשום"}
        </div>
        <div>
          <span style={{ color: "#6c86b5" }}>מרחב פעולה: </span>
          {actionSpace.admissible ? "כשיר" : `חסום — חסר ${actionSpace.blockers.join(", ")}`}
        </div>
      </Panel>
    );
  }

  return <div style={{ fontSize: 13, color: "#7b8ca6", fontStyle: "italic" }}>לחץ על אדם, ממד, כוח, עדשה או טבעת כדי לראות פרטים.</div>;
}

function Panel({ title, border, children }: { title: string; border: string; children: ReactNode }) {
  return (
    <div style={{ background: "#111726", border: `1px solid ${border}`, borderRadius: 8, padding: "10px 14px", fontSize: 13, lineHeight: 1.6 }}>
      <div style={{ fontWeight: 700, color: "#f2f6fc", marginBottom: 4 }}>{title}</div>
      {children}
    </div>
  );
}
