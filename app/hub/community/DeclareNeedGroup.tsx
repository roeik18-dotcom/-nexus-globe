"use client";

/**
 * Attach an existing Need to this value group — by explicit declaration.
 *
 * Shown ONLY for Needs that currently carry no group. The reason field is
 * required and free-text: the person must say WHY it belongs, in their own
 * words. That requirement is the whole point — it is what makes the record a
 * statement rather than a guess, and it is why the resulting EntityLink may
 * be REAL. Nothing here reads the Need's text to propose an answer.
 */
import { useState, useTransition } from "react";

import { declareNeedGroup, type DeclareNeedGroupResult } from "./needGroupLinkActions";

export default function DeclareNeedGroup({
  need, group, subject,
}: {
  need: { need_id: string; desired_change: string };
  group: { group_id: string; label: string };
  subject: string;
}) {
  const [result, setResult] = useState<DeclareNeedGroupResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  if (result?.ok) {
    return (
      <div dir="rtl" style={S.done}>
        ✓ הוצהר · COMMUNITY_HAS_NEED = REAL — <code style={S.code}>{result.link_id}</code>
      </div>
    );
  }

  return (
    <div dir="rtl" style={S.box}>
      <div style={S.head}>
        <span style={S.needText}>{need.desired_change.slice(0, 90)}{need.desired_change.length > 90 ? "…" : ""}</span>
        <code style={S.code}>{need.need_id}</code>
      </div>
      <div style={S.state}>אין קשר לקבוצה — לא מוסק מהטקסט, גם אם הטקסט מזכיר קבוצה.</div>

      {!open ? (
        <button type="button" onClick={() => setOpen(true)} style={S.btnGhost}>
          שייך לקבוצה «{group.label}» — הצהרה מפורשת ←
        </button>
      ) : (
        <form
          action={(fd) => {
            fd.set("need_id", need.need_id);
            fd.set("group_id", group.group_id);
            fd.set("declared_by", subject);
            startTransition(async () => setResult(await declareNeedGroup(fd)));
          }}
          style={S.form}
        >
          <input
            name="evidence"
            required
            placeholder="למה ה-Need הזה שייך לקבוצה? (במילים שלך — חובה)"
            style={S.input}
          />
          <div style={S.row}>
            <button type="submit" disabled={pending} style={S.btn}>
              {pending ? "מצהיר…" : `הצהר · ${group.group_id}`}
            </button>
            <button type="button" onClick={() => setOpen(false)} style={S.btnGhost}>ביטול</button>
          </div>
          <div style={S.fine}>
            נכתבת רשומת הצהרה חדשה. ה-Need עצמו לא משתנה — הקנון סגור (§12), והלוג append-only.
          </div>
        </form>
      )}

      {result && !result.ok ? <div style={S.err}>{result.message}</div> : null}
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  box: { border: "1px solid rgba(251,191,36,0.3)", borderRadius: 10, padding: "9px 11px", background: "rgba(251,191,36,0.05)", marginBottom: 8 },
  head: { display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, flexWrap: "wrap" },
  needText: { fontSize: 13, color: "#dbe6f6", lineHeight: 1.5 },
  code: { fontSize: 12, fontFamily: "ui-monospace, monospace", color: "#7f97c2" },
  state: { fontSize: 12, color: "#8798b8", fontStyle: "italic", margin: "3px 0 6px" },
  form: { display: "flex", flexDirection: "column", gap: 6 },
  input: { background: "#0d1424", border: "1px solid #2a3f66", borderRadius: 7, padding: "6px 9px", fontSize: 13, color: "#e8eefb" },
  row: { display: "flex", alignItems: "center", gap: 7 },
  btn: { background: "#34d399", color: "#02101f", border: "none", borderRadius: 7, padding: "5px 12px", fontSize: 13, fontWeight: 700, cursor: "pointer" },
  btnGhost: { background: "transparent", color: "#9fb0d0", border: "1px solid #2a3f66", borderRadius: 7, padding: "5px 11px", fontSize: 13, cursor: "pointer" },
  fine: { fontSize: 12, color: "#6c86b5", lineHeight: 1.5 },
  done: { fontSize: 13, color: "#34d399", border: "1px solid rgba(52,211,153,0.35)", borderRadius: 8, padding: "7px 10px", marginBottom: 8, background: "rgba(52,211,153,0.06)" },
  err: { fontSize: 13, color: "#f2635c", marginTop: 5 },
};
