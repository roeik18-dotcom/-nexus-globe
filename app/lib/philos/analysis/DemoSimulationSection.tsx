/**
 * DEMO / SIMULATION BOUNDARY — one collapsed section, seven terminals.
 *
 * WHY THIS EXISTS. `PersonEventOrientationHeader` reads
 * `loadAcceptanceScenario()` and its own header calls itself "the top display
 * authority for the person". It was mounted at the top of all seven
 * terminals, so the first thing every screen said about the person was a test
 * fixture about a different one: the scenario is keyed
 * `scenario_person_sim_user`, not `person_roei` / `p_you`. A reader could not
 * tell the product's own data from its acceptance fixture, because the
 * fixture was in the more prominent position.
 *
 * WHAT CHANGED, AND WHAT DID NOT. Only the MOUNT POINT and a collapsed
 * wrapper. The scenario is not deleted, not moved, not edited, and not
 * re-classified — `PersonEventOrientationHeader` renders inside here exactly
 * as before, with the same props and the same tests. What changes is that it
 * now sits below the terminal's real content, behind a closed disclosure that
 * names it for what it is.
 *
 * NO CLIENT JAVASCRIPT. A native `<details>`, the same mechanism the header
 * itself and `shell/TerminalPage.tsx` already use. Nothing hydrates here, so
 * nothing can mismatch.
 *
 * REAL CHROME DOES NOT BELONG INSIDE. Hub and Brain passed `legacy={…}`
 * carrying a `SignOutButton` — real, non-scenario controls. Burying sign-out
 * inside a collapsed DEMO section would hide a real control behind a label
 * saying it is not the user's data. Those call sites hoist that chrome out
 * and pass only scenario content here.
 */
import type { ReactNode } from "react";

import PersonEventOrientationHeader from "./PersonEventOrientationHeader";
import type { TerminalName } from "./acceptanceScenario";
import { COLOR, FS, RADIUS, SPACE, TYPE } from "../shell/designTokens";

export const DEMO_SECTION_LABEL = "DEMO / SIMULATION — כלי בדיקה, אינו נתון המשתמש" as const;

/**
 * IS THE DEMONSTRATION TOOL ALLOWED ON THIS SCREEN?
 *
 * It had no condition of any kind: three terminals rendered it
 * unconditionally, so a person looking at their own REAL records was shown a
 * panel captioned "DEMO / SIMULATION" attached to the same page. On a screen
 * whose whole purpose is to distinguish what is real from what is not, that is
 * the one thing it must never do.
 *
 * OPT-IN, NEVER OPT-OUT. The flag must be set explicitly to show the tool, so
 * the safe state is the default and no new deployment can leak it. The demo
 * data and this component are untouched — only the decision to render.
 */
export function demoToolsEnabled(): boolean {
  return process.env.PHILOS_SHOW_DEMO === "1";
}

export default function DemoSimulationSection({
  terminal,
  legacy,
}: {
  terminal: TerminalName;
  /** Scenario-side legacy content only. Real chrome stays outside. */
  legacy?: ReactNode;
}) {
  /* Nothing at all on a REAL screen — not a collapsed disclosure, not a
     summary line. A collapsed "DEMO" caption is still a DEMO caption. */
  if (!demoToolsEnabled()) return null;
  return (
    <details dir="rtl" style={S.wrap}>
      <summary style={S.summary}>
        <span style={S.tag}>DEMO</span>
        <span style={S.label}>{DEMO_SECTION_LABEL}</span>
      </summary>
      <p style={S.note}>
        התוכן שלהלן הוא תרחיש קבלה לבדיקה בלבד. הוא אינו נספר במצב היום, אינו
        משפיע על שערי הסגירה, ואינו נתון של המשתמש הנוכחי.
      </p>
      <div style={S.body}>
        <PersonEventOrientationHeader terminal={terminal} legacy={legacy} />
      </div>
    </details>
  );
}

const S = {
  wrap: {
    border: `1px dashed ${COLOR.borderStrong}`,
    borderRadius: RADIUS.md,
    background: COLOR.bg,
    padding: `${SPACE.xs}px ${SPACE.md}px`,
    margin: `${SPACE.lg}px 0`,
  },
  summary: {
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: SPACE.sm,
    flexWrap: "wrap" as const,
    minWidth: 0,
  },
  tag: {
    ...TYPE.micro,
    color: "#fbbf24",
    border: "1px solid #fbbf24",
    borderRadius: RADIUS.pill,
    padding: `1px ${SPACE.sm}px`,
  },
  label: { fontSize: FS.meta, color: COLOR.textDim, fontWeight: 700, overflowWrap: "anywhere" as const },
  note: { fontSize: FS.meta, color: COLOR.textFaint, margin: `${SPACE.sm}px 0 0` },
  body: { marginTop: SPACE.sm },
} as const;
