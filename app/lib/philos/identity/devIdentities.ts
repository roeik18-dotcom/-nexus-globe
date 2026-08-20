/**
 * DEVELOPMENT IDENTITIES — the people a dev sign-in may issue a session for.
 *
 * This exists so two real viewers can be exercised end to end before there is
 * anything to authenticate against. It is NOT a user directory and must never
 * become one: picking a name from a list is not proving you are that person,
 * so the whole affordance is gated and says so on the screen it renders.
 *
 * THE GATE. `PHILOS_DEV_SIGNIN=1` and nothing else. Absent means the dev
 * sign-in refuses — the same rule as the viewer mode: a missing variable must
 * never open a door. When a real sign-in lands it replaces the CALLER of
 * `issueSession`; this file is deleted rather than extended, because the
 * moment it has a password field it has become the thing it was avoiding.
 */
import type { ViewerContext } from "./viewerContext";

export interface DevIdentity {
  key: string;
  label: string;
  note: string;
  viewer: Omit<ViewerContext, "source">;
}

export const DEV_IDENTITIES: readonly DevIdentity[] = [
  {
    key: "roei",
    label: "רועי",
    note: "המשתמש האמיתי — חבר בקבוצת ערך, עם רשומות קנוניות",
    viewer: { viewer_id: "person_roei", subject_id: "person_roei", person_id: "p_you" },
  },
  {
    key: "bet",
    label: "משתמש ב׳",
    note: "משתמש שני — בלי קבוצה, בלי ערכים, בלי רשומות. המצב שבו משתמש חדש מגיע",
    viewer: { viewer_id: "person_bet", subject_id: "person_bet", person_id: "p_bet" },
  },
];

export interface DevSignInEnv { PHILOS_DEV_SIGNIN?: string }

export function devSignInEnabled(env: DevSignInEnv = process.env as DevSignInEnv): boolean {
  return env.PHILOS_DEV_SIGNIN === "1";
}

export function devIdentity(key: string): DevIdentity | undefined {
  return DEV_IDENTITIES.find((d) => d.key === key);
}
