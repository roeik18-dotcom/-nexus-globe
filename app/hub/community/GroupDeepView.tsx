"use client";
/**
 * SELECTED GROUP — the operational system, with `0` and `NO DATA` kept apart.
 *
 * This distinction is the whole point of the panel. A group whose budget was
 * measured and came out empty is a group in trouble; a group whose needs were
 * never recordable is a group nobody asked. Rendering both as "0" would state
 * a measurement that never happened — the same UNKNOWN ≠ 0 rule the rest of
 * PHILOS runs on, applied to the one place a reader is most likely to draw a
 * conclusion from a number.
 *
 * Today every group returns NO DATA for needs, offers and actions: the event
 * log has no `need.declared` / `offer.declared` / `action.recorded` type at
 * group scale, so the projection cannot produce them. That is a channel gap,
 * and the panel says so in those words rather than showing three zeros.
 */
import { COLOR, FS, RADIUS, SPACE } from "@/app/lib/philos/shell/designTokens";
import type { RegistryEntry } from "@/app/lib/philos/community/valueGroupRegistry";
import type { ViewerGroupRelation } from "@/app/lib/philos/community/viewerGroupOverlay";
import type { GroupOperationalState } from "@/app/lib/philos/community/groupOperationalState";
import { personLabel } from "@/app/lib/philos/person/personLabel";

type Cell = { measured: true; value: string; detail?: string } | { measured: false; because: string };

const measured = (v: string, detail?: string): Cell => ({ measured: true, value: v, detail });
const noData = (because: string): Cell => ({ measured: false, because });

function Stage({ label, cell }: { label: string; cell: Cell }) {
  return (
    <div style={{ display: "flex", gap: SPACE.md, alignItems: "baseline", padding: `7px 0`,
      borderTop: `1px solid ${COLOR.border}` }}>
      <span style={{ fontSize: FS.tag, letterSpacing: ".06em", color: COLOR.textFaint, minWidth: 96 }}>{label}</span>
      {cell.measured ? (
        <>
          <span style={{ fontSize: FS.read, color: COLOR.text, fontVariantNumeric: "tabular-nums" }}>{cell.value}</span>
          {cell.detail ? <span style={{ fontSize: FS.meta, color: COLOR.textDim }}>{cell.detail}</span> : null}
        </>
      ) : (
        <span style={{ display: "inline-flex", alignItems: "center", gap: SPACE.sm }}>
          <span style={{ fontSize: FS.meta, padding: "2px 8px", borderRadius: RADIUS.sm,
            background: "rgba(240,180,92,0.12)", border: "1px solid rgba(240,180,92,0.4)", color: "#f0b45c" }}>
            אין נתון
          </span>
          <span style={{ fontSize: FS.meta, color: COLOR.textDim }}>{cell.because}</span>
        </span>
      )}
    </div>
  );
}

export default function GroupDeepView({
  entry, relation, state, viewerIds, joinEvents,
}: {
  entry: RegistryEntry;
  relation: ViewerGroupRelation;
  /** The operational spine for this group, or null when it has no events. */
  state: GroupOperationalState | null;
  /** Every id that IS the reader. Second person is applied against these. */
  viewerIds: readonly (string | undefined)[];
  /**
   * `member.joined` events for the SELECTED entity, straight from the shared
   * projection — the same authority the spine above renders. Passed rather
   * than recomputed so this panel can never publish a second answer to a
   * question the projection already answers. Carries its own group id so a
   * reader inspecting a DIFFERENT group in this panel is not shown the
   * selected entity's figure.
   */
  joinEvents?: { group_id: string; count: number };
}) {
  const g = entry.group;
  /** Only when the projection is describing THIS group. */
  const joinEventCount = joinEvents?.group_id === g.group_id ? joinEvents.count : undefined;
  const b = state?.budget ?? g.budget;
  // Roster names go through the label resolver so a stored viewer-relative
  // string can never be echoed to a different reader.
  const named = (person_id: string, display_name?: string) =>
    personLabel(person_id, display_name, viewerIds);
  const roles = state && state.channels.members === "MEASURED"
    ? state.members.filter((m) => m.role && m.active).map((m) => ({ person_id: m.person_id, display_name: m.display_name, role: m.role }))
    : g.members.filter((m) => m.role).map((m) => ({ person_id: m.person_id, display_name: m.display_name, role: m.role }));
  const memberCount = state && state.channels.members === "MEASURED"
    ? state.members.filter((m) => m.active).length
    : g.members.length;
  const ch = state?.channels;
  /** A dimension with events reports its state; without them it reports NO
   *  DATA. This is the whole 0-vs-unknown distinction, in one helper. */
  const fromSpine = <T,>(dim: keyof NonNullable<typeof ch>, measured: () => T, absent: string): Cell =>
    ch && ch[dim] === "MEASURED"
      ? (measured() as unknown as Cell)
      : noData(absent);

  return (
    <section style={{ padding: SPACE.lg, background: COLOR.bgCard, border: `1px solid ${COLOR.borderStrong}`, borderRadius: RADIUS.md }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: SPACE.md, alignItems: "baseline" }}>
        <h3 style={{ fontSize: FS.head, fontWeight: 650, margin: 0, color: COLOR.text }}>{g.name}</h3>
        <span style={{ fontSize: FS.tag, padding: "2px 8px", borderRadius: RADIUS.pill,
          border: `1px ${g.provenance === "DEMO" ? "dashed #f0b45c" : "solid #4ade80"}`,
          color: g.provenance === "DEMO" ? "#f0b45c" : "#4ade80" }}>{g.provenance}</span>
        <span style={{ fontSize: FS.meta, color: relation === "NONE" ? COLOR.textFaint : "#7fe0ab" }}>
          {relation === "NONE" ? "אינך חבר — בדיקה בלבד" : `היחס שלך: ${relation}`}
        </span>
        <span style={{ fontSize: FS.meta, color: COLOR.textFaint, marginInlineStart: "auto" }}>{g.source}</span>
      </div>

      <div style={{ marginTop: SPACE.md }}>
        {/* THE TAXONOMY QUESTION IS NOT A VERDICT ON THE CANONICAL FAMILY.
            This row read "לא ממופה — 16 מועמדים" while the shared spine above
            published the family as F03. Two resolvers, opposite-sounding
            answers, and nothing on screen said they answer different
            questions: the spine DERIVES the family from the base-value
            registry; this MATCHES the group's free-text label against the 223
            sub-values. The label now carries the store and the sentence says
            the family is settled elsewhere — the same "מאגר אחר, לא סתירה"
            form the four spine-shadowed rows below already use. */}
        <Stage label="ערך · התאמת תת-ערך" cell={
          g.value_mapping_status === "RESOLVED" && g.primary_subvalue_id
            ? measured(g.primary_subvalue_id, `${g.central_value_label} · משפחה ${g.value_family_id ?? "—"}`)
            : g.central_value_label
              ? measured(g.central_value_label,
                  `התאמה לאחד מ-223 תת-הערכים פתוחה — ${entry.mapping.candidates.length} מועמדים, נדרשת הכרעה. `
                  + `משפחת הערך הקנונית נגזרת בשדרה למעלה — מאגר אחר, לא סתירה.`)
              : noData("הקבוצה לא הצהירה ערך מרכזי")} />
        {/* 9 AND 6 IN ONE SENTENCE. The roster is 9; only some of those nine
            carry a `member.joined` event, and this subtitle used to attribute
            all nine to that stream. The split is READ FROM the same projection
            the shared spine publishes — never recomputed here — so the panel
            and the surface cannot drift apart. Absent for any group that is
            not the selected entity, because the projection describes that one
            entity and the reader may be inspecting another. */}
        <Stage label="חברים · מסונפים" cell={measured(String(memberCount),
          joinEventCount !== undefined
            ? `מסונפים דרך group.opened (מייסד), leader.appointed (ממונה) או member.joined. `
              + `מתוכם ${joinEventCount} באירוע member.joined; היתר מייסד וממונים, שאין להם אירוע הצטרפות.`
            : ch?.members === "MEASURED" ? "מאירועי MEMBER_JOINED בשדרה התפעולית" : "כל דרכי הסינוף, לא רק member.joined")} />
        <Stage label="תפקידים" cell={roles.length > 0
          ? measured(`${roles.length} / ${memberCount}`,
              roles.map((r) => `${named(r.person_id, r.display_name).text}: ${r.role}`).join(" · "))
          : noData("אין אירוע מינוי תפקיד ליותר מ-0 חברים — לא נרשם, לא 'אין תפקידים'")} />
        <Stage label="תקציב" cell={b
          ? measured(`${b.available.toLocaleString()} ${b.currency}`, `התקבל ${b.received.toLocaleString()} · הוצא ${b.spent.toLocaleString()} · מחויב ${b.committed.toLocaleString()}`)
          : noData("לא נרשם אף אירוע כספי")} />
        {/* INTENTS, UNDER THE NAME "INTENTS".
            `money_flow_count` is `allocations + transfers` — the identical
            expression the shared projection computes as `fundingDecisionCount`
            and deliberately does NOT publish as movement, because it counts
            intents, double counts an executed allocation against its own
            transfer, and omits inbound receipts. Rendering it as "תנועות כסף"
            asserted exactly what the projection's own sentence denies. The
            number is kept — a funding decision is a real fact — under the name
            that fact actually has. The executed count stays the spine's 3. */}
        <Stage label="החלטות מימון" cell={g.money_flow_count !== undefined
          ? measured(String(g.money_flow_count),
              "הקצאות והעברות מתועדות — כוונות מימון, לא כסף שזז. "
              + "תנועות התקציב שבוצעו בפועל נספרות בשדרה למעלה.")
          : noData("אין אירועי allocation/transfer")} />
        {/* The three the spine exists for. The channel now EXISTS — so the
            honest answer when a group has no such events is "no events for
            this group", not "no channel". Different sentence, different fact. */}
        {/* ── THE FOUR SPINE-SHADOWED ROWS ──────────────────────────────────
            These four read ONE store: the group's own operational event log.
            The shared spine 300px above reads the CANONICAL stores — need↔group
            links, action.inputs — and for this group they answer differently:
            the spine says NEED 1 / MATCH 1 / ACTION 1 and this panel said "אין
            נתון" to all three. Both were true and the screen read as broken,
            because the labels were identical and the store was named nowhere.
            The labels now carry the store. Same numbers, no contradiction. */}
        <Stage label="צרכים · יומן תפעולי" cell={fromSpine("needs", () => {
          const open = state!.needs.filter((n) => n.status === "OPEN").length;
          return measured(String(state!.needs.length),
            `${open} פתוחים · ${state!.needs.filter((n) => n.status === "RESOLVED").length} נפתרו`);
        }, "היומן התפעולי ריק. הצורך הקנוני מופיע בשרשרת למעלה — מאגר אחר, לא סתירה")} />
        <Stage label="משאבים · יומן תפעולי" cell={fromSpine("resources", () => {
          const avail = state!.resources.filter((r) => r.status === "AVAILABLE").length;
          return measured(String(state!.resources.length), `${avail} זמינים`);
        }, "היומן התפעולי ריק. משאב אינו ניתן לקישור לקבוצה כלל — פער מבני, ראה השרשרת")} />
        <Stage label="התאמות · יומן תפעולי" cell={fromSpine("matches", () => measured(
          String(state!.matches.length),
          `${state!.matches.filter((m) => m.status === "ACCEPTED").length} אושרו — מועמדת ≠ מאושרת ≠ פעולה`,
        ), "אין אירוע MATCH_* קנוני. ההתאמה שמומשה מופיעה בשרשרת למעלה כנגזרת")} />
        <Stage label="פעולות · יומן תפעולי" cell={fromSpine("actions", () => measured(
          String(state!.actions.length),
          `${state!.actions.filter((a) => a.status === "COMPLETED").length} הושלמו · ${state!.actions.filter((a) => a.status === "IN_PROGRESS").length} בביצוע`,
        ), "היומן התפעולי ריק. הפעולה הקנונית מופיעה בשרשרת למעלה — action.inputs, מאגר אחר")} />
        <Stage label="מתחים · יומן תפעולי" cell={fromSpine("tensions", () => measured(String(state!.tensions.length)),
          "אין אף מתח מתועד לקבוצה הזאת")} />
        <Stage label="השפעות" cell={g.effect_count !== undefined
          ? measured(String(g.effect_count), "impact.recorded")
          : noData("לא נרשמה אף השפעה")} />
        <Stage label="ראיות" cell={g.evidence_count !== undefined
          ? measured(String(g.evidence_count), `מתוך ${g.effect_count ?? 0} השפעות — CLAIMED ≠ VERIFIED`)
          : noData("אף השפעה לא אומתה")} />
        <Stage label="מגמה" cell={g.event_count !== undefined
          ? measured(
              state && state.counts.events > 0
                ? `${g.event_count} + ${state.counts.events} תפעוליים`
                : `${g.event_count} אירועים`,
              g.geography ? `אזור ${g.geography} · סטטוס ${g.status}` : `סטטוס ${g.status}`)
          : noData("אין היסטוריית אירועים")} />
        {state && state.unrecognised.length > 0 ? (
          <Stage label="לא מוכר" cell={measured(String(state.unrecognised.length),
            "סוגי אירוע שהבילד הזה לא מכיר — נשמרו ונספרו, לא נמחקו")} />
        ) : null}
      </div>
    </section>
  );
}
