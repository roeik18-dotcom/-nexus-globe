"use client";

/**
 * Materialize a Personal or Group value.
 *
 * The label and the reason are both free text and both required. That is the
 * mechanism, not friction: a value nobody worded and nobody justified is an
 * inference, and inference is exactly what this path exists to avoid. Nothing
 * here proposes a value from the contradiction inventory, from the group's
 * central value, or from anything else on screen.
 *
 * GROUP scope additionally demands an authority — who or what adopted it for
 * the group. Membership is not agreement, so "the group holds this" needs to
 * say who decided.
 */
import { useState, useTransition } from "react";

import { COLOR, FS, RADIUS } from "@/app/lib/philos/shell/designTokens";
import { declareValue, type DeclareValueResult } from "./valueDeclarationActions";

export default function DeclareValue({
  scope, holderId, holderLabel, declaredBy,
}: {
  scope: "PERSONAL" | "GROUP";
  holderId: string;
  holderLabel: string;
  declaredBy: string;
}) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<DeclareValueResult | null>(null);
  const [pending, start] = useTransition();

  if (result?.ok) {
    return (
      <div dir="rtl" style={S.done}>
        ✓ ערך {scope === "PERSONAL" ? "אישי" : "קבוצתי"} נוצר · DECLARED —{" "}
        <code style={S.code}>{result.value_id}</code>
      </div>
    );
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} style={S.ghost}>
        + הצהר ערך {scope === "PERSONAL" ? "אישי" : `של «${holderLabel}»`}
      </button>
    );
  }

  return (
    <form
      dir="rtl"
      action={(fd) => {
        fd.set("scope", scope);
        fd.set("holder_id", holderId);
        fd.set("declared_by", declaredBy);
        start(async () => setResult(await declareValue(fd)));
      }}
      style={S.form}
    >
      <input name="label" required placeholder="הערך, במילים שלך (חובה)" style={S.input} />
      <input name="evidence" required placeholder="למה זה ערך? (חובה — הנימוק הוא הראיה)" style={S.input} />
      {scope === "GROUP" ? (
        <input
          name="authorized_by"
          required
          placeholder="מי/מה אישר לקבוצה? (תפקיד · אירוע הצבעה · ישיבה)"
          style={S.input}
        />
      ) : null}
      <div style={S.row}>
        <button type="submit" disabled={pending} style={S.btn}>{pending ? "רושם…" : "הצהר · DECLARED"}</button>
        <button type="button" onClick={() => setOpen(false)} style={S.ghost}>ביטול</button>
      </div>
      <div style={S.fine}>
        נכתב כ-<b>DECLARED</b>, לא VERIFIED. אימות הוא רשומה נפרדת מאוחרת.
        {scope === "GROUP" ? " חברות אינה הסכמה — לכן נדרש מקור סמכות." : " ערך אישי אינו הופך אוטומטית לערך קבוצתי."}
      </div>
      {result && !result.ok ? <div style={S.err}>{result.message}</div> : null}
    </form>
  );
}

const S: Record<string, React.CSSProperties> = {
  form: { display: "flex", flexDirection: "column", gap: 6, border: `1px solid ${COLOR.border}`, borderRadius: RADIUS.md, padding: 10, marginTop: 6 },
  input: { background: "#0d1424", border: "1px solid #2a3f66", borderRadius: RADIUS.sm, padding: "6px 9px", fontSize: FS.meta, color: "#e8eefb" },
  row: { display: "flex", gap: 7, alignItems: "center" },
  btn: { background: "#a78bfa", color: "#02101f", border: "none", borderRadius: RADIUS.sm, padding: "5px 12px", fontSize: FS.meta, fontWeight: 700, cursor: "pointer" },
  ghost: { background: "transparent", color: COLOR.textDim, border: `1px solid ${COLOR.border}`, borderRadius: RADIUS.sm, padding: "5px 11px", fontSize: FS.base, cursor: "pointer" },
  fine: { fontSize: FS.base, color: COLOR.textFaint, lineHeight: 1.5 },
  done: { fontSize: FS.base, color: "#a78bfa", border: "1px solid rgba(167,139,250,0.35)", borderRadius: RADIUS.sm, padding: "6px 10px", marginTop: 6 },
  code: { fontFamily: "ui-monospace, monospace", fontSize: FS.base },
  err: { fontSize: FS.base, color: "#f2635c" },
};
