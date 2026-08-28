/**
 * THE SAME TWO IDS, ON EVERY TERMINAL, SAYING DIFFERENT TRUE THINGS.
 *
 * One component, seven interpretations, so a surface cannot drift into
 * claiming more than it knows. The ids are always printed — including on
 * Planet and World, where the honest reading is that nothing beyond the
 * records themselves is established. Hiding them there would make a person's
 * own record look absent; printing them without the caveat would turn one
 * reported outcome into world impact.
 */
import React from "react";

import { COLOR, FS, RADIUS, SPACE, TYPE } from "../shell/designTokens";
import {
  readingFor, type ActionEffectPair, type ProjectionTerminal,
} from "./actionEffectProjection";
import { SystemDrawer } from "@/app/lib/philos/shell/SystemDrawer";

export default function ActionEffectPanel({
  terminal, pairs, legacyCount = 0,
}: {
  terminal: ProjectionTerminal;
  pairs: readonly ActionEffectPair[];
  /** Records with no origin, reported beside the REAL ones, never merged. */
  legacyCount?: number;
}) {
  const real = pairs.filter((p) => p.action_origin === "REAL");
  const legacy = pairs.filter((p) => p.action_origin !== "REAL");
  /* THE AUTHORITATIVE PAIR LEADS. Store order is append order, so a legacy
     record written months ago sat above the record the person just made — the
     first thing they saw about their own work was UNKNOWN/UNKNOWN. REAL first,
     legacy after and visually secondary; nothing is hidden, only ordered. */
  const ordered = [...real, ...legacy];

  return (
    <section dir="rtl" data-action-effect-panel={terminal} style={S.card}>
      <div style={S.head}>
        <span style={S.eyebrow}>פעולה → תוצאה · ACTION → EFFECT</span>
        {/* THE HEADLINE IS A SENTENCE, NOT A PROVENANCE TALLY.
            `2 REAL · 1 ללא record_origin` is the store describing itself. The
            same two numbers, said the way a person would say them; the raw
            provenance tags stay on each row inside the drawer. */}
        <span style={S.count}>
          {real.length === 0 ? "עדיין לא נרשמה פעולה" : `${real.length} פעולות שנרשמו`}
          {legacy.length > 0 ? ` · ${legacy.length} ישנות, לא נספרות` : ""}
        </span>
      </div>

      {pairs.length === 0 ? (
        <div style={S.empty}>אין פעולה רשומה לצופה זה — לא נמצאה רשומה ב-actionStore.</div>
      ) : (
        ordered.map((p) => {
          const isReal = p.action_origin === "REAL";
          const r = readingFor(terminal, p);
          return (
            <div key={p.action_id}
                 style={isReal ? S.row : { ...S.row, opacity: 0.72 }}
                 data-pair-origin={isReal ? "REAL" : "LEGACY"}
                 data-pair-action={p.action_id}
                 data-pair-effect={p.effect_id ?? ""}>
              <div style={S.ids}>
                <code style={{ ...S.id, color: isReal ? "#34d399" : "#8798b8" }}>{p.action_id}</code>
                <span style={S.arrow}>→</span>
                {p.effect_id
                  ? <code style={{ ...S.id, color: p.effect_origin === "REAL" ? "#34d399" : "#8798b8" }}>{p.effect_id}</code>
                  : <span style={S.noEffect}>אין תוצאה מקושרת</span>}
              </div>
              {/* WHAT IT DOES NOT KNOW stays open — that is the honest limit
                  a person needs, and it is written in words. */}
              <div style={S.doesNot}>◦ {r.does_not_know}</div>
              {/* Provenance tags, scope and the resolver's own reason are the
                  system's vocabulary, not the person's. Folded, never cut. */}
              <SystemDrawer id={`pair-${p.action_id}`} title="מקור ופרטי מערכת" note="provenance · scope">
                {/* Names the raw record ids — kept, but not as the headline. */}
                <div style={S.knows}>{r.knows}</div>
                <div style={S.ids}>
                  <span style={{ ...S.originTag, color: isReal ? "#34d399" : "#fbbf24" }}>
                    {p.action_origin}{p.effect_origin ? ` / ${p.effect_origin}` : ""}
                  </span>
                  <span style={S.scope}>{p.scope}</span>
                </div>
                {r.unresolved_reason ? (
                  <div style={S.unresolved}>UNRESOLVED — {r.unresolved_reason}</div>
                ) : null}
              </SystemDrawer>
            </div>
          );
        })
      )}

      {legacyCount > 0 ? (
        <div style={S.legacy}>
          {legacyCount} רשומות ישנות שמקורן לא תועד — מוצגות בנפרד ואינן סוגרות שלב.
        </div>
      ) : null}
    </section>
  );
}

const S: Record<string, React.CSSProperties> = {
  card: { border: `1px solid ${COLOR.border}`, borderRadius: RADIUS.lg,
    background: COLOR.bgRaised, padding: SPACE.md, display: "grid", gap: 10 },
  head: { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap" },
  eyebrow: { ...TYPE.micro, color: COLOR.textFaint, letterSpacing: 1 },
  count: { fontSize: FS.tag, fontWeight: 800, color: COLOR.text },
  empty: { fontSize: 13, color: COLOR.textDim },
  row: { display: "grid", gap: 4, paddingBlock: 8, borderTop: `1px solid ${COLOR.border}` },
  ids: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
  id: { fontSize: 12, fontWeight: 700 },
  arrow: { color: COLOR.textFaint },
  noEffect: { fontSize: 12, color: "#fbbf24" },
  originTag: { fontSize: 10, fontWeight: 800, letterSpacing: 0.6, padding: "1px 6px",
    borderRadius: 999, border: `1px solid ${COLOR.border}` },
  scope: { fontSize: 10, fontWeight: 700, color: COLOR.textFaint, letterSpacing: 0.6 },
  knows: { fontSize: 12.5, color: COLOR.text, lineHeight: 1.5 },
  doesNot: { fontSize: 12, color: "#fbbf24", lineHeight: 1.5 },
  unresolved: { fontSize: 11, fontWeight: 700, color: "#f2635c", letterSpacing: 0.4 },
  legacy: { fontSize: 11.5, color: COLOR.textDim, borderTop: `1px solid ${COLOR.border}`, paddingBlockStart: 8 },
};
