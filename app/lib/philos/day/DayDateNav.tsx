/**
 * DAY DATE NAV — read-only movement between days.
 *
 * VIEWING IS NOT WRITING. Every control here is a plain link. Following one
 * re-runs the same read-only projection for a different date; no server
 * action is invoked, nothing is appended, and no day is created by being
 * looked at. That is why a wrong `?date=` is harmless — the worst it can do
 * is render a day that nobody opened, which is exactly what that day is.
 *
 * ONLY TODAY IS WRITABLE. The Opening and Closing forms are hidden on any
 * other date (`DayPanels.tsx` checks `isToday`), because backdating an act a
 * person did not perform on that day would put a false record in an
 * append-only log — and the log has no correction, only more records.
 */
import Link from "next/link";

import { COLOR, FS, RADIUS, SPACE, TYPE } from "../shell/designTokens";

export default function DayDateNav({
  date,
  today,
  previous,
  next,
  basePath = "/hub",
}: {
  date: string;
  today: string;
  previous: string;
  next: string;
  basePath?: string;
}) {
  const isToday = date === today;
  return (
    <nav dir="rtl" style={S.wrap} aria-label="ניווט בין ימים">
      <span style={S.eyebrow}>יום נצפה</span>

      <Link href={`${basePath}?date=${previous}`} style={S.btn}>← {previous}</Link>

      <span style={{ ...S.current, borderColor: isToday ? COLOR.accent : "#fbbf24" }}>
        {date}{isToday ? "" : " · צפייה בלבד"}
      </span>

      <Link href={`${basePath}?date=${next}`} style={S.btn}>{next} →</Link>

      {!isToday && (
        <Link href={basePath} style={S.today}>חזרה להיום ({today})</Link>
      )}

      {!isToday && (
        <span style={S.note}>
          תצוגה בלבד — פתיחה וסגירה זמינות רק ליום הנוכחי. צפייה אינה כותבת דבר.
        </span>
      )}
    </nav>
  );
}

const S = {
  wrap: {
    display: "flex",
    flexWrap: "wrap" as const,
    alignItems: "center",
    gap: SPACE.sm,
    border: `1px solid ${COLOR.border}`,
    borderRadius: RADIUS.md,
    background: COLOR.bgRaised,
    padding: `${SPACE.xs}px ${SPACE.md}px`,
    marginBottom: SPACE.sm,
    minWidth: 0,
  },
  eyebrow: { ...TYPE.micro, color: COLOR.textFaint },
  btn: {
    fontSize: FS.meta,
    color: COLOR.accent,
    textDecoration: "none",
    fontWeight: 700,
    border: `1px solid ${COLOR.border}`,
    borderRadius: RADIUS.sm,
    padding: `2px ${SPACE.sm}px`,
  },
  current: {
    fontSize: FS.meta,
    color: COLOR.text,
    fontWeight: 700,
    border: "1px solid",
    borderRadius: RADIUS.pill,
    padding: `2px ${SPACE.sm}px`,
  },
  today: { fontSize: FS.meta, color: COLOR.textDim, textDecoration: "none" },
  note: { fontSize: FS.meta, color: "#fbbf24", overflowWrap: "anywhere" as const, minWidth: 0 },
} as const;
