"use client";

/**
 * One submit button for a match-request server action, with the server's own
 * answer rendered where the button was.
 *
 * WHY A CLIENT COMPONENT AT ALL. `requestMatchApprovalAction` and
 * `decideMatchRequestAction` both return a result object, and a plain
 * `<form action={...}>` may only take an action returning `void` — the
 * result would be discarded and a refusal would look identical to a
 * success. Since the server is the real authority gate, its refusals are
 * exactly the messages a person needs to see. This follows the pattern
 * `hub/community/DeclareNeedGroup.tsx` already established for the same
 * problem: `useTransition`, call the action, render what came back.
 *
 * IT ADDS NO AUTHORITY OF ITS OWN. It submits fields and displays a reply.
 * Every gate — candidate re-derivation, group derivation, REAL-leadership —
 * runs server-side inside the action on every submit, whether or not this
 * component chose to render.
 */
import { useState, useTransition } from "react";

import { COLOR, FS, RADIUS } from "@/app/lib/philos/shell/designTokens";

type ActionResult = { ok: true } | { ok: false; message: string };

export default function MatchRequestButton({
  action, fields, label, tone, done,
}: {
  action: (fd: FormData) => Promise<ActionResult>;
  fields: Record<string, string>;
  label: string;
  tone: "accent" | "approve" | "reject";
  /** Shown in place of the button after the server confirms. */
  done: string;
}) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  if (result?.ok) return <span style={{ fontSize: FS.tag, color: "#34d399" }}>✓ {done}</span>;

  const color = tone === "approve" ? "#34d399" : tone === "reject" ? "#f2635c" : COLOR.accent;

  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          const fd = new FormData();
          for (const [k, v] of Object.entries(fields)) fd.set(k, v);
          startTransition(async () => setResult(await action(fd)));
        }}
        style={{
          padding: "4px 12px", borderRadius: RADIUS.sm, fontSize: FS.tag, fontWeight: 600,
          cursor: pending ? "progress" : "pointer", background: "transparent",
          border: `1px solid ${color}`, color, opacity: pending ? 0.55 : 1,
        }}
      >
        {pending ? "…" : label}
      </button>
      {/* THE SERVER'S REFUSAL, VERBATIM. Not re-worded, not softened — it is
          the authority model's own account of why nothing was written. */}
      {result && !result.ok ? (
        <span style={{ fontSize: FS.meta, color: "#fc8a84", maxWidth: "44ch" }}>{result.message}</span>
      ) : null}
    </span>
  );
}
