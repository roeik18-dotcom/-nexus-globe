"use client";

/**
 * CanonOrientationLookup — /hub's first canon-aware view.
 *
 * Reads only. Calls `lookupCanonOrientationAction` (same-directory Server
 * Action, itself a thin wrapper around the same functions
 * `.../orientation/route.ts` calls) with a caller-supplied `canon_event_id`
 * + `asOf` — nothing is minted or defaulted here either.
 *
 * Terminology is preserved exactly as canon defines it: `Observation`,
 * `CellState`, `Need`, `stop_point`, `provenance`, `persisted_or_derived`,
 * `claimed_or_verified`, and the literal enum values (`domain` G/E/C,
 * `frame` I/R/S, `verification_state` not_applicable/claimed_only/
 * unverified/verified) are shown verbatim, not translated or renamed.
 *
 * Honesty rule, same discipline PhilosToday.tsx already applies to the
 * Value Group log: a stage this lookup cannot supply (every lookup here is
 * id-only, so `need`/`target`/`offer`/`transfer`/`effect`/`learning` are
 * never attempted — canon persists only Observation, there is no store to
 * look any of them up from) is shown as an explicit "not supplied" fact,
 * never hidden and never presented as though it were absent by accident.
 */

import { useState } from "react";

import {
  lookupCanonOrientationAction,
  type CanonOrientationLookupResult,
} from "./canonOrientationAction";

function nowIso(): string {
  return new Date().toISOString();
}

const PERSISTED_LABEL: Record<string, string> = {
  persisted: "persisted",
  derived: "derived",
  caller_supplied: "caller_supplied",
};

const CLAIMED_LABEL: Record<string, string> = {
  claimed: "claimed",
  verified: "verified",
  not_applicable: "not_applicable",
};

export default function CanonOrientationLookup() {
  const [canonEventId, setCanonEventId] = useState("");
  const [asOf, setAsOf] = useState(nowIso());
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<CanonOrientationLookupResult | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canonEventId.trim()) return;
    setPending(true);
    try {
      const r = await lookupCanonOrientationAction(canonEventId.trim(), asOf.trim());
      setResult(r);
    } finally {
      setPending(false);
    }
  }

  return (
    <section style={S.card}>
      <div style={S.cardHead}>
        <h2 style={S.cardTitle}>Canon — Observation → CellState → Need</h2>
        <span style={S.hint}>קריאה בלבד · לפי canon_event_id</span>
      </div>

      {/* Static, lookup-independent — verbatim from PERSISTENCE_POLICY.md's
          own table. Shown before any search so persisted-vs-derived is a
          known fact about the whole system, not something you must already
          have a canon_event_id to discover. */}
      <ul style={S.legend}>
        <li style={S.legendItem}><b>Observation</b> — persisted (append-only, JSONL)</li>
        <li style={S.legendItem}><b>CellState</b> — derived (single-Observation only, never cached)</li>
        <li style={S.legendItem}><b>Need / Offer</b> — persisted (canon needStore/offerStore)</li>
        <li style={S.legendItem}><b>Target</b> — caller_supplied, not persisted</li>
        <li style={S.legendItem}><b>Transfer</b> — caller_supplied candidate, never persisted, never executed</li>
        <li style={S.legendItem}><b>Action / Effect / Learning</b> — persisted (canon actionStore/effectStore/learningStore)</li>
        <li style={S.legendItem}><b>Learning</b> — derived, gated (never written back)</li>
      </ul>

      <form onSubmit={onSubmit} style={S.form}>
        <input
          style={S.input}
          placeholder="canon_event_id"
          value={canonEventId}
          onChange={(e) => setCanonEventId(e.target.value)}
          dir="ltr"
        />
        <input
          style={S.input}
          placeholder="asOf (ISO 8601, explicit offset)"
          value={asOf}
          onChange={(e) => setAsOf(e.target.value)}
          dir="ltr"
        />
        <button type="submit" style={S.button} disabled={pending || !canonEventId.trim()}>
          {pending ? "טוען…" : "חפש"}
        </button>
      </form>

      {result === null && (
        <div style={S.placeholder}>
          הכנס canon_event_id כדי לראות את ה-Observation, ה-CellState הנגזר ממנו,
          וה-stop_point של השרשרת.
        </div>
      )}

      {result !== null && !result.ok && (
        <div style={S.placeholder}>
          {result.error === "not_found" && "לא נמצא Observation עם canon_event_id הזה."}
          {result.error === "invalid_as_of" && "asOf חייב להיות ISO 8601 עם offset מפורש."}
          {result.error === "read_failed" && "קריאה מה-canon store נכשלה."}
        </div>
      )}

      {result !== null && result.ok && (
        <div style={S.body}>
          {/* Headline: exactly what Merlin's own orientation handoff sees */}
          {result.handoff?.current_state ? (
            <div style={S.headline}>
              <span style={S.headlineLabel}>CellState (derived)</span>
              <span style={S.headlineValue}>
                domain={result.handoff.current_state.domain} frame={result.handoff.current_state.frame}{" "}
                level={result.handoff.current_state.level} stability={result.handoff.current_state.stability}
              </span>
            </div>
          ) : (
            <div style={S.placeholder}>
              אין CellState נגזר — stop_point:{" "}
              {JSON.stringify((result.handoff ?? result.fallback)?.stop_point)}
            </div>
          )}

          <div style={S.row}>
            <span style={S.rowLabel}>verification_state</span>
            <span style={S.badge}>
              {(result.handoff ?? result.fallback)?.verification_state}
            </span>
          </div>

          <div style={S.row}>
            <span style={S.rowLabel}>Need</span>
            <span style={S.rowValue}>
              {result.handoff?.open_need
                ? JSON.stringify(result.handoff.open_need)
                : "not supplied — this lookup is id-only; canon persists only Observation, so there is no Need to look up by id (PERSISTENCE_POLICY.md)"}
            </span>
          </div>

          <div style={S.row}>
            <span style={S.rowLabel}>provenance</span>
            {((result.handoff ?? result.fallback)?.provenance ?? []).length > 0 ? (
              <ul style={S.provList}>
                {(result.handoff ?? result.fallback)!.provenance.map((p, i) => (
                  <li key={i} style={S.provItem}>{p}</li>
                ))}
              </ul>
            ) : (
              <span style={S.rowValue}>—</span>
            )}
          </div>

          {/* Full 9-stage §24 evidentiary trail, verbatim off PhilosVerticalSliceResult */}
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>stage</th>
                <th style={S.th}>attempted</th>
                <th style={S.th}>persisted_or_derived</th>
                <th style={S.th}>claimed_or_verified</th>
                <th style={S.th}>reason</th>
              </tr>
            </thead>
            <tbody>
              {result.trail.map((row) => (
                <tr key={row.stage}>
                  <td style={S.td}>{row.stage}</td>
                  <td style={S.td}>{String(row.attempted)}</td>
                  <td style={S.td}>
                    {row.attempted ? PERSISTED_LABEL[row.persisted_or_derived] : "—"}
                  </td>
                  <td style={S.td}>
                    {row.attempted ? CLAIMED_LABEL[row.claimed_or_verified] : "—"}
                  </td>
                  <td style={S.td}>{row.attempted ? row.canon_basis : row.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

const S: Record<string, React.CSSProperties> = {
  card: { background: "rgba(18,24,38,0.7)", border: "1px solid rgba(90,120,180,0.14)", borderRadius: 16, padding: "16px 18px", marginTop: 16 },
  cardHead: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 },
  cardTitle: { fontSize: 15, fontWeight: 700, margin: 0, color: "#f0f4fc" },
  hint: { fontSize: 12, color: "#5f7aa6" },

  legend: { listStyle: "none", margin: "0 0 14px", padding: "10px 12px", display: "flex", flexDirection: "column", gap: 4, borderRadius: 10, background: "rgba(90,120,180,0.06)", border: "1px solid rgba(90,120,180,0.14)" },
  legendItem: { fontSize: 13, color: "#8aa0c8", lineHeight: 1.6 },

  form: { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 },
  input: { flex: "1 1 220px", background: "rgba(7,11,20,0.6)", border: "1px solid rgba(90,120,180,0.25)", borderRadius: 8, padding: "8px 10px", color: "#e8edf6", fontSize: 13, fontFamily: "ui-monospace, monospace" },
  button: { padding: "8px 18px", borderRadius: 8, border: "1px solid rgba(110,160,240,0.3)", background: "linear-gradient(90deg, rgba(70,120,200,0.25), rgba(52,211,153,0.16))", color: "#eaf1ff", fontSize: 13, fontWeight: 600, cursor: "pointer" },

  placeholder: { fontSize: 13, lineHeight: 1.7, color: "#7f93b5", minHeight: 44 },

  body: { display: "flex", flexDirection: "column", gap: 10 },
  headline: { display: "flex", flexDirection: "column", gap: 4, padding: "10px 12px", borderRadius: 10, background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.2)" },
  headlineLabel: { fontSize: 13, color: "#34D399", fontWeight: 700, letterSpacing: "0.5px" },
  headlineValue: { fontSize: 15, color: "#e8edf6", fontFamily: "ui-monospace, monospace" },

  row: { display: "flex", flexDirection: "column", gap: 4 },
  rowLabel: { fontSize: 13, color: "#5f7aa6", fontFamily: "ui-monospace, monospace" },
  rowValue: { fontSize: 13, color: "#a9bcdc", lineHeight: 1.6 },
  badge: { alignSelf: "flex-start", fontSize: 13, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: "rgba(90,120,180,0.15)", color: "#cdd8ec", fontFamily: "ui-monospace, monospace" },

  provList: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 3 },
  provItem: { fontSize: 13, color: "#8aa0c8", fontFamily: "ui-monospace, monospace" },

  table: { width: "100%", borderCollapse: "collapse", marginTop: 6 },
  th: { textAlign: "left", fontSize: 12, color: "#5f7aa6", fontWeight: 600, padding: "6px 8px", borderBottom: "1px solid rgba(90,120,180,0.18)" },
  td: { fontSize: 13, color: "#cdd8ec", padding: "6px 8px", borderBottom: "1px solid rgba(90,120,180,0.08)", fontFamily: "ui-monospace, monospace" },
};
