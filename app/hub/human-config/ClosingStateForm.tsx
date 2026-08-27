"use client";

/**
 * THE MANUAL CLOSING-STATE FORM.
 *
 * The only route to a State(t1) was the `level + 1` transition rule the screen
 * itself labels experimental — the new level derived by arithmetic rather than
 * read by a person. A day closed that way is closed on a number nobody
 * observed.
 *
 * Here the person supplies the three things only they can know — what the
 * level actually is, how sure they are, and what it rests on. The server
 * supplies the three things they must not be able to choose: the subject, the
 * REAL provenance, and the causal link, derived from the Action and Effect
 * that were actually recorded.
 */
import { useState, useTransition } from "react";

import { recordClosingState } from "@/app/lib/philos/canon/closingStateAction";
import { COLOR, FS, RADIUS, SPACE } from "@/app/lib/philos/shell/designTokens";

export interface ChainChoice { id: string; label: string }

export default function ClosingStateForm({
  parameters, actions, effects,
}: {
  parameters: readonly { domain_id: string; parameter_id: string; label: string }[];
  actions: readonly ChainChoice[];
  effects: readonly ChainChoice[];
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  if (actions.length === 0 || effects.length === 0) {
    return (
      <section dir="rtl" style={S.card}>
        <h3 style={S.title}>מצב סיום ליום</h3>
        <p style={S.note}>
          כדי לרשום מצב סיום צריך שתהיה פעולה ותוצאה מקושרת אליה — הן מה שהמצב
          החדש נובע מהן. {actions.length === 0 ? "טרם נרשמה פעולה." : "טרם נרשמה תוצאה מקושרת."}
        </p>
      </section>
    );
  }

  return (
    <section dir="rtl" style={S.card}>
      <h3 style={S.title}>מצב סיום ליום</h3>
      <p style={S.note}>
        מה המצב שלך בסוף היום. אתה קובע את הערך, את מידת הביטחון ואת מה שזה
        מבוסס עליו. הקישור לפעולה ולתוצאה נקבע על ידי המערכת מהרשומות עצמן —
        אין כאן חישוב אוטומטי של הערך.
      </p>
      <form
        action={(fd) => start(async () => {
          const r = await recordClosingState(fd);
          setOk(r.ok);
          setMsg(r.ok ? `נרשם מצב סיום ${r.state_id}` : r.message);
        })}
        style={S.form}
      >
        <select name="parameter_id" required style={S.input} defaultValue=""
          onChange={(e) => {
            const p = parameters.find((x) => x.parameter_id === e.target.value);
            const hidden = e.currentTarget.form?.elements.namedItem("domain_id") as HTMLInputElement | null;
            if (hidden && p) hidden.value = p.domain_id;
          }}>
          <option value="" disabled>— בחר פרמטר —</option>
          {parameters.map((p) => (
            <option key={p.parameter_id} value={p.parameter_id}>{p.label}</option>
          ))}
        </select>
        <input type="hidden" name="domain_id" defaultValue={parameters[0]?.domain_id ?? ""} />

        <input name="level" type="number" step="any" required placeholder="level — הערך בסוף היום" style={S.input} />
        <input name="confidence" type="number" step="any" min="0" max="1" required
               placeholder="confidence (0–1) — כמה אתה בטוח" style={S.input} />
        <input name="evidence" required placeholder="evidence — על מה זה מבוסס?" style={S.input} />

        <select name="action_id" required style={S.input} defaultValue="">
          <option value="" disabled>— בחר את הפעולה של היום —</option>
          {actions.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
        </select>
        <select name="effect_id" required style={S.input} defaultValue="">
          <option value="" disabled>— בחר את התוצאה שלה —</option>
          {effects.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
        </select>

        <button type="submit" disabled={pending} style={S.button}>
          {pending ? "…" : "רשום מצב סיום"}
        </button>
      </form>
      {msg ? <div style={ok ? S.ok : S.err}>{msg}</div> : null}
    </section>
  );
}

const S: Record<string, React.CSSProperties> = {
  card: { border: `1px solid ${COLOR.border}`, borderRadius: RADIUS.lg,
    background: COLOR.bgRaised, padding: SPACE.md, display: "grid", gap: 8,
    gridTemplateColumns: "minmax(0, 1fr)" },
  title: { fontSize: 17, fontWeight: 800, color: COLOR.text, margin: 0 },
  note: { fontSize: 14, lineHeight: 1.6, color: COLOR.textDim, margin: 0 },
  form: { display: "grid", gap: 6, gridTemplateColumns: "minmax(0, 1fr)" },
  input: { background: "#0b1120", color: COLOR.text, border: `1px solid ${COLOR.border}`,
    borderRadius: 8, padding: "8px 10px", fontSize: FS.read, minWidth: 0 },
  button: { background: "#3b82f6", color: "#04121f", border: "none", borderRadius: 8,
    padding: "9px 14px", fontWeight: 800, fontSize: FS.read, cursor: "pointer" },
  ok: { fontSize: 13, color: "#34d399" },
  err: { fontSize: 13, color: "#f2635c" },
};
