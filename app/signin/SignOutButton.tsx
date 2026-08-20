import { resolveViewerMode } from "@/app/lib/philos/identity/viewerMode";
import { COLOR, FS, RADIUS, TYPE } from "@/app/lib/philos/shell/designTokens";
import { signOut } from "./actions";

/**
 * Sign out. Renders ONLY in SESSION mode: in LOCAL_DEV there is no session to
 * end, and a button that appears to log you out while doing nothing is worse
 * than no button.
 */
export default async function SignOutButton() {
  if (resolveViewerMode() !== "SESSION") return null;
  return (
    <form action={signOut} style={{ display: "inline-flex" }}>
      <button type="submit" style={S.button}>
        יציאה
      </button>
    </form>
  );
}

const S: Record<string, React.CSSProperties> = {
  button: {
    ...TYPE.micro, fontSize: FS.tag, cursor: "pointer", font: "inherit",
    fontWeight: 700, letterSpacing: 1,
    color: COLOR.textFaint, background: "transparent",
    border: `1px solid ${COLOR.border}`, borderRadius: RADIUS.pill,
    padding: "3px 11px",
  },
};
