"use client";

/**
 * The recovery screen for a render that could not resolve a viewer.
 *
 * Middleware redirects a request with NO cookie. It cannot redirect a request
 * whose cookie is present but whose session is gone — expired early, revoked,
 * or lost because sessions live in memory and the server restarted. Middleware
 * has no access to the session store, and giving it a way to guess would turn
 * a redirect into an authorisation check it is not allowed to be.
 *
 * So that case reaches the page, `resolveViewerContext()` throws exactly as it
 * should, and this catches it. Refusing to render is correct; showing a raw
 * 500 to someone whose session simply ended is not.
 */
import Link from "next/link";

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const identityFailure = /viewer could not be resolved|not readable by viewer/.test(error.message ?? "");

  return (
    <div dir="rtl" style={S.page}>
      <div style={S.card}>
        <div style={S.brand}>Φ PHILOS</div>
        {identityFailure ? (
          <>
            <div style={S.title}>הסשן הסתיים</div>
            <div style={S.body}>
              הבקשה נעצרה כי לא נפתרה זהות. זו התנהגות מכוונת — המערכת לא מציגה
              נתונים בלי לדעת של מי הם.
            </div>
            <Link href="/signin" style={S.action}>כניסה מחדש</Link>
          </>
        ) : (
          <>
            <div style={S.title}>שגיאה</div>
            <div style={{ ...S.body, fontFamily: "ui-monospace, monospace", direction: "ltr", unicodeBidi: "isolate" }}>
              {error.message}
            </div>
            <button onClick={reset} style={S.action}>נסה שוב</button>
          </>
        )}
      </div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#0a0e17", display: "grid", placeItems: "center", padding: 24, fontFamily: "system-ui, sans-serif" },
  card: { width: "100%", maxWidth: 460, display: "flex", flexDirection: "column", gap: 12, border: "1px solid rgba(120,150,220,0.16)", borderRadius: 16, padding: "26px 24px", background: "#0e1422" },
  brand: { fontSize: 18, fontWeight: 800, letterSpacing: 3, color: "#e6edf7" },
  title: { fontSize: 15, fontWeight: 700, color: "#e6edf7" },
  body: { fontSize: 12, color: "#8fa3c9", lineHeight: 1.8 },
  action: { alignSelf: "flex-start", cursor: "pointer", font: "inherit", fontSize: 12, fontWeight: 700, color: "#02101f", background: "#34d399", border: "none", borderRadius: 999, padding: "7px 16px", textDecoration: "none" },
};
