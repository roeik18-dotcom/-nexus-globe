/**
 * DAY CHAIN — Action → Effect → Evidence → Learning, in one line.
 *
 * NOT A SECOND FLOW MAP. Hub and Dynamics already draw the operational flow;
 * repeating it here would be a third drawing of the same thing and would push
 * the actual state below the fold. This is four links and their counts, sized
 * to sit directly under Day Status so the chain is legible without scrolling.
 *
 * THE SAME DAY-SCOPED RECORDS. Every id shown comes from the projection's own
 * day-scoped fields — the chain hanging off an Action whose `day_ref` is this
 * day. Nothing is recomputed here, so this cannot disagree with the gates.
 *
 * IDS LIVE IN THE AUDIT DETAILS. The summary line answers "is the chain
 * complete"; the `<details>` answers "which records". Real ids, never
 * paraphrased, and UNKNOWN carries the reason the projection gave rather than
 * rendering a zero.
 */
import { COLOR, FS, RADIUS, SPACE, TYPE } from "../shell/designTokens";
import type { DayField, DaySession } from "./daySession";

type Link = { label: string; field: DayField<string[]> };

export default function DayChainSummary({ session }: { session: DaySession }) {
  const links: Link[] = [
    { label: "Action", field: session.action_refs },
    { label: "Effect", field: session.effect_refs },
    { label: "Evidence", field: session.evidence_refs },
    { label: "Learning", field: session.learning_refs },
  ];

  return (
    <section dir="rtl" style={S.wrap} aria-label="שרשרת היום">
      <div style={S.row}>
        <span style={S.eyebrow}>שרשרת · CHAIN</span>
        {links.map((l, i) => {
          const n = l.field.value?.length ?? 0;
          const ok = l.field.value !== null;
          /* A Learning that exists but rests on nothing independent is not
             UNKNOWN — the record is right there. Saying UNKNOWN would erase
             it; saying a count would imply it counts. It gets its own word. */
          const legacy = !ok && l.field.status === "UNSUPPORTED_LEGACY";
          return (
            <span key={l.label} style={S.seg}>
              <span style={{ ...S.node, borderColor: ok ? "#34d399" : "#fbbf24", color: ok ? COLOR.text : "#fbbf24" }}>
                {l.label}
                <b style={S.count}>{ok ? n : legacy ? `${l.field.refs.length} ללא ראיה` : "UNKNOWN"}</b>
              </span>
              {i < links.length - 1 && <span style={S.arrow}>←</span>}
            </span>
          );
        })}
      </div>

      <details style={S.details}>
        <summary style={S.summary}>מזהים · AUDIT — {session.day_id}</summary>
        <ul style={S.list}>
          {links.map((l) => (
            <li key={l.label} style={S.item}>
              <b style={S.k}>{l.label}</b>
              {l.field.value === null ? (
                <span style={S.unknown}>UNKNOWN — {l.field.unresolved_reason}</span>
              ) : (
                <span style={S.ids}>{l.field.value.join(" · ")}</span>
              )}
            </li>
          ))}
          <li style={S.item}>
            <b style={S.k}>State(t0)</b>
            {session.state_t0.value === null
              ? <span style={S.unknown}>UNKNOWN — {session.state_t0.unresolved_reason}</span>
              : <span style={S.ids}>{session.state_t0.value.join(" · ")}</span>}
          </li>
          <li style={S.item}>
            <b style={S.k}>State(t1)</b>
            {session.state_t1.value === null
              ? <span style={S.unknown}>UNKNOWN — {session.state_t1.unresolved_reason}</span>
              : <span style={S.ids}>{session.state_t1.value.join(" · ")}</span>}
          </li>
          <li style={S.item}>
            <b style={S.k}>Event/Observation</b>
            {session.event_observation_refs.value === null
              ? <span style={S.unknown}>UNKNOWN — {session.event_observation_refs.unresolved_reason}</span>
              : <span style={S.ids}>{session.event_observation_refs.value.join(" · ")}</span>}
          </li>
        </ul>
      </details>
    </section>
  );
}

const S = {
  wrap: {
    border: `1px solid ${COLOR.border}`,
    borderRadius: RADIUS.md,
    background: COLOR.bgRaised,
    padding: `${SPACE.sm}px ${SPACE.md}px`,
    marginBottom: SPACE.lg,
    display: "flex",
    flexDirection: "column" as const,
    gap: SPACE.xs,
  },
  row: { display: "flex", flexWrap: "wrap" as const, alignItems: "center", gap: SPACE.xs, minWidth: 0 },
  eyebrow: { ...TYPE.micro, color: COLOR.textFaint, marginInlineEnd: SPACE.xs },
  seg: { display: "flex", alignItems: "center", gap: SPACE.xs },
  node: {
    fontSize: FS.meta,
    border: "1px solid",
    borderRadius: RADIUS.pill,
    padding: `2px ${SPACE.sm}px`,
    display: "inline-flex",
    gap: SPACE.xs,
    alignItems: "baseline",
  },
  count: { fontSize: FS.meta, fontWeight: 800 },
  arrow: { color: COLOR.textFaint, fontSize: FS.meta },
  details: { marginTop: 2 },
  summary: { ...TYPE.micro, color: COLOR.textDim, cursor: "pointer" },
  list: { listStyle: "none", margin: `${SPACE.xs}px 0 0`, padding: 0, display: "flex", flexDirection: "column" as const, gap: 2 },
  item: { display: "flex", gap: SPACE.sm, flexWrap: "wrap" as const, minWidth: 0 },
  k: { fontSize: FS.meta, color: COLOR.textDim, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" },
  ids: { fontSize: FS.meta, color: COLOR.text, overflowWrap: "anywhere" as const, minWidth: 0 },
  unknown: { fontSize: FS.meta, color: "#fbbf24", overflowWrap: "anywhere" as const, minWidth: 0 },
} as const;
