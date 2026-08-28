/**
 * ONE TASK, ONE SCREEN.
 *
 * The verification form used to live at the bottom of `/marketplace`, which
 * meant the person asked to check someone else's outcome first scrolled past
 * their OWN empty marketplace: a day strip reading 0/11, an unresolved
 * orientation panel, and every UNKNOWN a person with no records generates.
 * None of it was wrong — it was answering questions nobody had asked, about
 * the wrong person, ahead of the one question that mattered.
 *
 * This route renders nothing but the task. It deliberately does NOT import
 * `SystemShell`, `DayStatusStrip`, the orientation panel, the action/effect
 * projection or the real-data gap panel: the verifier is not being asked
 * about their own day, so their own day is not on screen.
 *
 * IT ALSO REFUSES BEFORE THE PERSON TYPES. Whether this viewer may verify
 * this Effect is knowable up front, so it is answered up front — by the same
 * `checkVerifierStanding` the writer calls, never by a second copy of the
 * rule that could drift from it. A screen that collects five fields and then
 * rejects them has wasted the person's testimony.
 */
import Link from "next/link";

import { resolveViewerContext } from "@/app/lib/philos/identity/viewerContext";
import { loadEffects } from "@/app/lib/philos/canon/effectStoreAccessor";
import { loadActions } from "@/app/lib/philos/canon/actionStoreAccessor";
import { loadVerifications } from "@/app/lib/philos/canon/outcomeVerificationStoreAccessor";
import { isEffectAdmissible } from "@/app/lib/philos/canon/effectStore";
import { isActionAdmissible } from "@/app/lib/philos/canon/actionStore";
import { checkVerifierStanding } from "@/app/lib/philos/canon/independentEvidence";
import VerifyEffectFocusedForm from "./VerifyEffectFocusedForm";

export const dynamic = "force-dynamic";

export const metadata = { title: "אימות תוצאה — Philos" };

/** Why this screen cannot proceed. Each one is a fact, not a validation error. */
type Block =
  | { kind: "effect_not_found" }
  | { kind: "effect_not_real" }
  | { kind: "action_not_found" }
  | { kind: "action_not_real" }
  | { kind: "already_verified"; at: string }
  | { kind: "verifier_is_subject" }
  | { kind: "verifier_is_actor" }
  | { kind: "verifier_id_missing" };

const BLOCK_TEXT: Record<Block["kind"], { title: string; body: string }> = {
  effect_not_found: {
    title: "התוצאה הזו לא קיימת",
    body: "המזהה שבכתובת אינו מתאים לשום תוצאה שנרשמה. כדאי לבדוק את הקישור.",
  },
  effect_not_real: {
    title: "התוצאה הזו אינה רשומה אמיתית",
    body: "אפשר לאמת רק תוצאה שנרשמה בפועל על ידי אדם, ולא רשומת הדגמה או רשומה שמקורה לא ידוע.",
  },
  action_not_found: {
    title: "הפעולה שהתוצאה מקושרת אליה אינה קיימת",
    body: "בלי הפעולה אי אפשר לדעת מי ביצע אותה, ולכן אי אפשר לוודא שהמאמת אינו אותו אדם.",
  },
  action_not_real: {
    title: "הפעולה המקושרת אינה רשומה אמיתית",
    body: "אותו נימוק: אימות נשען על פעולה שקרתה באמת.",
  },
  already_verified: {
    title: "התוצאה הזו כבר אומתה",
    body: "אימות נרשם פעם אחת בלבד. אחרת אפשר היה להמשיך ולנסות מאמתים עד שאחד מהם יסכים.",
  },
  verifier_is_subject: {
    title: "אי אפשר לאמת תוצאה שנוגעת למאמת עצמו",
    body: "האדם שהתוצאה מדברת עליו אינו יכול לאשר אותה בעצמו. אישור עצמי אינו מוסיף מידע — הוא חוזר על אותה טענה פעם שנייה.",
  },
  verifier_is_actor: {
    title: "אי אפשר לאמת תוצאה של פעולה שהמאמת ביצע",
    body: "מי שביצע את הפעולה ומי שבודק את תוצאתה חייבים להיות שני אנשים. אחרת אין כאן בדיקה, אלא דיווח כפול.",
  },
  verifier_id_missing: {
    title: "לא ניתן לזהות מי מאמת",
    body: "צריך להיות מחובר כדי לאמת. המערכת לוקחת את זהות המאמת מהחשבון המחובר בלבד.",
  },
};

export default async function VerifyEffectPage({
  params,
}: {
  params: Promise<{ effectId: string }>;
}) {
  const { effectId } = await params;
  const viewer = await resolveViewerContext();

  const [effects, actions, verifications] = await Promise.all([
    loadEffects(), loadActions(), loadVerifications(),
  ]);

  const effectRecord = effects.find((r) => r.effect?.effect_id === effectId);
  const effect = effectRecord?.effect;
  const actionRecord = effect
    ? actions.find((r) => r.action?.action_id === effect.action_ref)
    : undefined;
  const existing = verifications.find((r) => r.effect_id === effectId);

  const block: Block | null =
    !effectRecord || !effect ? { kind: "effect_not_found" }
    : !isEffectAdmissible(effectRecord) ? { kind: "effect_not_real" }
    : !actionRecord ? { kind: "action_not_found" }
    : !isActionAdmissible(actionRecord) ? { kind: "action_not_real" }
    : existing ? { kind: "already_verified", at: existing.recorded_at }
    : (() => {
        /* THE SAME FUNCTION THE WRITER CALLS. Not a copy of its logic. */
        const standing = checkVerifierStanding({
          verifier: viewer.subject_id,
          subject: effect.subject,
          actor: actionRecord.action.owner,
        });
        return standing.ok ? null : { kind: standing.refusal } as Block;
      })();

  return (
    <main dir="rtl" style={S.page}>
      <div style={S.card}>
        <h1 style={S.h1}>אימות תוצאה של אדם אחר</h1>

        {/* WHO IS WHO, in words, before anything else. The whole rule turns on
            these two people being different, so the screen says who they are
            rather than leaving it to be inferred from an id in a corner. */}
        <div style={S.who}>
          <div style={S.whoRow}>
            <span style={S.whoLabel}>המאמת/ת</span>
            <span style={S.whoValue}>{viewer.subject_id}</span>
            <span style={S.whoNote}>— לפי החשבון המחובר</span>
          </div>
          <div style={S.whoRow}>
            <span style={S.whoLabel}>הנבדק</span>
            <span style={S.whoValue}>{effect?.subject ?? "לא ידוע"}</span>
            <span style={S.whoNote}>— האדם שהתוצאה נוגעת אליו</span>
          </div>
          {actionRecord ? (
            <div style={S.whoRow}>
              <span style={S.whoLabel}>מבצע הפעולה</span>
              <span style={S.whoValue}>{actionRecord.action.owner}</span>
              <span style={S.whoNote}>— מי שעשה את הפעולה שהתוצאה נובעת ממנה</span>
            </div>
          ) : null}
        </div>

        {block ? (
          <div style={S.block} role="alert" data-verify-block={block.kind}>
            <div style={S.blockTitle}>{BLOCK_TEXT[block.kind].title}</div>
            <p style={S.blockBody}>{BLOCK_TEXT[block.kind].body}</p>
            {block.kind === "already_verified" ? (
              <p style={S.blockMeta}>נרשם ב־{block.at.slice(0, 16).replace("T", " ")}</p>
            ) : null}
            <p style={S.blockBody}>
              הטופס אינו מוצג, מפני שאי אפשר לרשום אימות במצב הזה. זה לא כשל טכני — זה הכלל עצמו.
            </p>
          </div>
        ) : effect && actionRecord ? (
          <>
            {/* THE MATERIAL BEING CHECKED — the claim, and the action it came
                from. Nothing else about either person appears on this screen. */}
            <section style={S.claim}>
              <div style={S.claimLabel}>מה נטען שקרה</div>
              <p style={S.claimText}>{effect.claimed_outcome.statement}</p>
              <div style={S.claimMeta}>
                נרשם ב־{effect.time.slice(0, 10)} · לפי {effect.claimed_outcome.method}
              </div>
            </section>

            <section style={S.claim}>
              <div style={S.claimLabel}>הפעולה שהתוצאה מקושרת אליה</div>
              <p style={S.claimText}>{actionRecord.action.reversibility}</p>
              <div style={S.claimMeta}>
                {actionRecord.action.type} · {actionRecord.action.mechanism_scope} ·
                נרשמה ב־{actionRecord.action.time.slice(0, 10)}
              </div>
            </section>

            <VerifyEffectFocusedForm
              effectId={effectId}
              concernsInternalState={effect.concerns_subject_internal_state}
              subject={effect.subject}
            />
          </>
        ) : null}

        <div style={S.foot}>
          <Link href="/hub" style={S.link}>חזרה למרכז</Link>
        </div>
      </div>
    </main>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh", background: "#070b14", color: "#e8edf6",
    padding: "clamp(16px, 4vw, 48px) clamp(12px, 4vw, 24px)",
    display: "flex", justifyContent: "center", alignItems: "flex-start",
    fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
  },
  card: {
    width: "100%", maxWidth: 640, minWidth: 0,
    display: "flex", flexDirection: "column", gap: 18,
  },
  h1: { fontSize: "clamp(20px, 5vw, 26px)", fontWeight: 800, margin: 0, lineHeight: 1.3 },
  who: {
    display: "grid", gap: 8, background: "rgba(90,120,180,0.07)",
    border: "1px solid #1e2942", borderRadius: 10, padding: "12px 14px",
  },
  whoRow: { display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 8, minWidth: 0 },
  whoLabel: { fontSize: 12, color: "#8fa3c9", fontWeight: 700, minWidth: 84 },
  whoValue: { fontSize: 14, fontWeight: 700, overflowWrap: "anywhere" },
  whoNote: { fontSize: 12, color: "#6c86b5" },
  claim: {
    background: "rgba(90,120,180,0.06)", border: "1px solid #1e2942",
    borderRadius: 10, padding: "12px 14px", minWidth: 0,
  },
  claimLabel: { fontSize: 12, color: "#8fa3c9", fontWeight: 700, marginBottom: 6 },
  claimText: { margin: 0, fontSize: 15, lineHeight: 1.6, overflowWrap: "anywhere" },
  claimMeta: { marginTop: 8, fontSize: 12, color: "#6c86b5", overflowWrap: "anywhere" },
  block: {
    background: "rgba(242,99,92,0.08)", border: "1px solid rgba(242,99,92,0.35)",
    borderRadius: 10, padding: "14px 16px", display: "grid", gap: 8,
  },
  blockTitle: { fontSize: 16, fontWeight: 800, color: "#f2635c" },
  blockBody: { margin: 0, fontSize: 14, lineHeight: 1.6, color: "#e8edf6" },
  blockMeta: { margin: 0, fontSize: 12, color: "#8fa3c9" },
  foot: { paddingBlockStart: 4 },
  link: { fontSize: 13, color: "#5b9cf6" },
};
