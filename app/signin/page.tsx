import { DEV_IDENTITIES, devSignInEnabled } from "@/app/lib/philos/identity/devIdentities";
import { COLOR, FS, RADIUS, SPACE, STATUS, TYPE } from "@/app/lib/philos/shell/designTokens";
import { signInAsDevIdentity } from "./actions";

export const metadata = { title: "PHILOS — כניסה" };

/**
 * The sign-in screen.
 *
 * It says what it is. Picking a name from a list is not proving you are that
 * person, and a screen that looked like a real login while doing this would be
 * lying about the security of everything behind it.
 */
export default async function SignInPage() {
  const enabled = devSignInEnabled();

  return (
    <div dir="rtl" style={S.page}>
      <div style={S.card}>
        <div style={S.brand}>Φ PHILOS</div>

        {!enabled ? (
          <div style={S.disabled}>
            כניסת פיתוח מושבתת. הפעל <code style={S.code}>PHILOS_DEV_SIGNIN=1</code> כדי לבחור זהות מקומית,
            או חבר ספק אימות אמיתי.
          </div>
        ) : (
          <>
            <div style={S.warn}>
              <span style={{ ...TYPE.micro, color: STATUS.demo.text }}>כניסת פיתוח</span>
              <span style={{ fontSize: FS.tag, color: COLOR.textDim }}>
                בחירת שם מרשימה אינה הוכחה שאתה אותו אדם. אין כאן אימות — יש כאן סשן.
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: SPACE.sm }}>
              {DEV_IDENTITIES.map((id) => (
                <form key={id.key} action={signInAsDevIdentity.bind(null, id.key)}>
                  <button type="submit" style={S.identity}>
                    <span style={S.identityLabel}>{id.label}</span>
                    <span style={S.identityNote}>{id.note}</span>
                  </button>
                </form>
              ))}
            </div>
          </>
        )}
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
    width: "100%", maxWidth: 460, display: "flex", flexDirection: "column", gap: SPACE.md,
    border: `1px solid ${COLOR.border}`, borderRadius: RADIUS.lg, padding: "26px 24px",
    background: COLOR.bgRaised,
  },
  brand: { fontSize: 18, fontWeight: 800, letterSpacing: 3, color: COLOR.text },
  warn: {
    display: "flex", flexDirection: "column", gap: 4,
    border: `1px dashed ${STATUS.demo.border}`, background: STATUS.demo.bg,
    borderRadius: RADIUS.md, padding: "9px 12px",
  },
  identity: {
    width: "100%", textAlign: "start", cursor: "pointer",
    display: "flex", flexDirection: "column", gap: 3,
    border: `1px solid ${COLOR.border}`, borderRadius: RADIUS.md,
    background: "rgba(120,150,220,0.08)", padding: "12px 14px", color: COLOR.text,
    font: "inherit",
  },
  identityLabel: { fontSize: FS.read, fontWeight: 700, color: COLOR.text },
  identityNote: { fontSize: FS.tag, color: COLOR.textFaint, lineHeight: 1.6 },
  disabled: { fontSize: FS.meta, color: COLOR.textDim, lineHeight: 1.8 },
  code: { fontFamily: "ui-monospace, monospace", color: COLOR.text, direction: "ltr", unicodeBidi: "isolate" },
};
