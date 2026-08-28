import { activateAuth, DEV_ACCOUNT_SECRETS } from "@/app/lib/philos/auth/bootstrap";
import { COLOR, FS, RADIUS, SPACE, STATUS, TYPE } from "@/app/lib/philos/shell/designTokens";
import SignInForm from "./SignInForm";
import { isSafeReturnTo } from "@/app/lib/philos/auth/returnTo";

export const metadata = { title: "PHILOS — כניסה" };

/**
 * The sign-in screen.
 *
 * In a development runtime it prints the fixture credentials, because a dev
 * password that is hidden invites someone to reuse it somewhere real. In any
 * other runtime there is no hint and — with no credential source connected —
 * no account that can succeed, which is stated rather than hidden behind a
 * form that silently rejects everything.
 */
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const mode = await activateAuth();
  /* Validated here too, not just on submit: a rejected value must never be
     rendered back into the page, and the note below must not promise a
     return the action would refuse to make. */
  const { returnTo: rawReturnTo } = await searchParams;
  const returnTo = isSafeReturnTo(rawReturnTo) ? rawReturnTo : undefined;

  return (
    <div dir="rtl" style={S.page}>
      <div style={S.card}>
        <div style={S.brand}>Φ PHILOS</div>

        {mode === "DEV_PASSWORD" ? (
          <div style={S.warn}>
            <span style={{ ...TYPE.micro, color: STATUS.demo.text }}>סביבת פיתוח</span>
            <span style={{ fontSize: FS.tag, color: COLOR.textDim, lineHeight: 1.8 }}>
              חשבונות בדיקה עם סיסמאות מפורסמות. הן עובדות רק בסביבת פיתוח.
            </span>
          </div>
        ) : (
          <div style={S.warn}>
            <span style={{ ...TYPE.micro, color: STATUS.unknown.text }}>ספק אימות לא מחובר</span>
            <span style={{ fontSize: FS.tag, color: COLOR.textDim, lineHeight: 1.8 }}>
              אין מקור אישורים מוגדר, ולכן אף חשבון לא יתקבל. זו התנהגות מכוונת —
              לא מסך שבור.
            </span>
          </div>
        )}

        {/* Say where they will land. A person who arrived from a link should
            not have to guess whether signing in will take them back to it. */}
        {returnTo ? (
          <div style={S.warn} data-return-to={returnTo}>
            <span style={{ ...TYPE.micro, color: STATUS.demo.text }}>המשך לאחר הכניסה</span>
            <span style={{ fontSize: FS.tag, color: COLOR.textDim, lineHeight: 1.8 }}>
              נחזיר אותך לדף שביקשת: <span dir="ltr">{decodeURIComponent(returnTo)}</span>
            </span>
          </div>
        ) : null}

        <SignInForm
          returnTo={returnTo}
          hint={
            mode === "DEV_PASSWORD"
              ? Object.entries(DEV_ACCOUNT_SECRETS).map(([a, s]) => `${a} · ${s}`).join("   |   ")
              : undefined
          }
        />
      </div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh", background: COLOR.bg, display: "grid", placeItems: "center",
    padding: SPACE.lg, fontFamily: "system-ui, -apple-system, sans-serif",
  },
  card: {
    width: "100%", maxWidth: 420, display: "flex", flexDirection: "column", gap: SPACE.md,
    border: `1px solid ${COLOR.border}`, borderRadius: RADIUS.lg, padding: "26px 24px",
    background: COLOR.bgRaised,
  },
  brand: { fontSize: 18, fontWeight: 800, letterSpacing: 3, color: COLOR.text },
  warn: {
    display: "flex", flexDirection: "column", gap: 4,
    border: `1px dashed ${STATUS.demo.border}`, background: STATUS.demo.bg,
    borderRadius: RADIUS.md, padding: "9px 12px",
  },
};
