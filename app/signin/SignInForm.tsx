"use client";

import { useActionState } from "react";

import { COLOR, FS, RADIUS, SPACE, TYPE } from "@/app/lib/philos/shell/designTokens";
import { signInAction, type SignInFormState } from "./actions";

/**
 * The credential form. Two fields, both submitted to the server as a CLAIM:
 * an account name and a secret. Neither is an identity, and there is no third
 * field through which one could be supplied.
 */
export default function SignInForm({ hint, returnTo }: { hint?: string; returnTo?: string }) {
  const [state, action, pending] = useActionState<SignInFormState, FormData>(signInAction, {});

  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: SPACE.sm }}>
      {/* The destination the person was heading for, carried through the
          credential exchange. Re-validated server-side; a value edited here
          buys nothing that `resolveReturnTo` would accept. */}
      {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
      <label style={S.label}>
        חשבון
        <input name="account" autoComplete="username" required style={S.input} dir="ltr" />
      </label>
      <label style={S.label}>
        סיסמה
        <input name="secret" type="password" autoComplete="current-password" required style={S.input} dir="ltr" />
      </label>
      {state.error ? <div style={S.error} role="alert">{state.error}</div> : null}
      <button type="submit" disabled={pending} style={{ ...S.submit, opacity: pending ? 0.6 : 1 }}>
        {pending ? "בודק…" : "כניסה"}
      </button>
      {hint ? <div style={S.hint}>{hint}</div> : null}
    </form>
  );
}

const S: Record<string, React.CSSProperties> = {
  label: { ...TYPE.micro, display: "flex", flexDirection: "column", gap: 5, fontSize: FS.tag, color: COLOR.textFaint },
  input: {
    font: "inherit", fontSize: FS.read, color: COLOR.text, background: "rgba(0,0,0,0.28)",
    border: `1px solid ${COLOR.border}`, borderRadius: RADIUS.md, padding: "9px 11px",
  },
  error: { fontSize: FS.meta, color: "#fc8a84", lineHeight: 1.6 },
  submit: {
    font: "inherit", fontSize: FS.read, fontWeight: 700, cursor: "pointer",
    color: "#02101f", background: "#34d399", border: "none",
    borderRadius: RADIUS.pill, padding: "9px 16px", marginTop: 4,
  },
  hint: { fontSize: FS.tag, color: COLOR.textFaint, lineHeight: 1.8, marginTop: 2 },
};
