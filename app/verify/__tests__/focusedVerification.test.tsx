/**
 * THE SUCCESS SCREEN AND THE FOCUSED FORM — what the verifier actually sees.
 *
 * The form lives on its own route precisely so none of the day/community
 * shell reaches it. These tests assert the rendered markup, and they assert
 * the FORBIDDEN words as hard as the required ones: if `SystemShell`,
 * `DayStatusStrip` or an orientation panel ever gets imported into this
 * route, the leak test fails before anyone sees it on screen.
 */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import VerifyEffectFocusedForm, { VerificationRecorded } from "../[effectId]/VerifyEffectFocusedForm";

const VERIFIER = "person_bet";
const EFFECT = "effect_fixture_000001";

describe("VerificationRecorded — the screen after a successful submit", () => {
  const html = renderToStaticMarkup(
    React.createElement(VerificationRecorded, { verifier_id: VERIFIER, effect_id: EFFECT }),
  );

  it("says plainly that it landed", () => {
    expect(html).toContain("האימות נרשם");
  });

  it("says what changed — the outcome is now evidence", () => {
    expect(html).toContain("ראיה");
  });

  it("names who it was recorded under, so a wrong identity is visible", () => {
    expect(html).toContain(VERIFIER);
    expect(html).toContain(EFFECT);
  });

  it("tells them not to resubmit, because a second attempt is refused", () => {
    expect(html).toContain("פעם אחת בלבד");
  });

  it("is announced to assistive tech rather than only coloured green", () => {
    expect(html).toContain('role="status"');
    expect(html).toContain("data-verify-done");
  });
});

describe("the focused form asks for the verifier's own words and nothing else", () => {
  const html = renderToStaticMarkup(
    React.createElement(VerifyEffectFocusedForm, {
      effectId: EFFECT, concernsInternalState: false, subject: "person_roei",
    }),
  );

  it("renders exactly the five testimony fields", () => {
    for (const name of ["statement", "method", "provenance", "verifier_type", "confidence"]) {
      expect(html).toContain(`name="${name}"`);
    }
  });

  // The whole design turns on identity coming from the session. A field here
  // would be an invitation to submit as somebody else.
  it("offers NO field through which a verifier identity could be supplied", () => {
    expect(html).not.toContain('name="verifier_id"');
    expect(html).not.toContain('name="subject"');
  });

  // THE SILENT-FAILURE REGRESSION, at the markup level.
  // A client closure renders `javascript:throw` and does nothing without JS;
  // browser-enforced `required` refuses the submit before our code runs.
  // Both produced a dead button and no message.
  // Bound to an imported SERVER action, never an inline client closure. Only
  // the former gets Next's `method="POST"` + `$ACTION_*` progressive-
  // enhancement markup, which this isolated renderer cannot produce — so the
  // binding is asserted at the source, and the POST itself was verified
  // against the running server.
  it("binds the form to a server action, not an inline client closure", () => {
    const raw = readFileSync(
      join(process.cwd(), "app", "verify", "[effectId]", "VerifyEffectFocusedForm.tsx"), "utf8");
    /* CODE ONLY. The header comment quotes the broken `action={(formData) =>`
       pattern on purpose, to record what this must never go back to; matching
       prose would fail on the very sentence that documents the rule. */
    const code = raw
      .split("\n")
      .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
      .join("\n");
    expect(code).toContain("verifyEffectFormAction");
    expect(code).toContain("useActionState");
    expect(code).toContain("action={action}");
    expect(code).not.toMatch(/action=\{\s*\(/);      // no inline closure
    expect(code).not.toMatch(/action=\{async\s*\(/); // nor an async one
  });

  it("carries effect_id as a field, so a native POST still identifies the outcome", () => {
    expect(html).toContain('name="effect_id"');
  });

  it("disables browser validation, which would refuse the submit silently", () => {
    expect(html).toContain("noValidate");
    // No `required` ATTRIBUTE reaches the markup — the server decides, and
    // says so in words, rather than the browser refusing without a trace.
    expect(html).not.toContain("required=");
  });

  it("does not offer `self` as a kind of verification", () => {
    expect(html).not.toContain('value="self"');
  });

  it("hides the consent box when the outcome is not about an inner state", () => {
    expect(html).not.toContain('name="subject_consent"');
  });

  it("shows the consent box, with its reason, when it IS about an inner state", () => {
    const withInternal = renderToStaticMarkup(
      React.createElement(VerifyEffectFocusedForm, {
        effectId: EFFECT, concernsInternalState: true, subject: "person_roei",
      }),
    );
    expect(withInternal).toContain('name="subject_consent"');
    expect(withInternal).toContain("אדם מבחוץ אינו רשאי לקבוע");
  });
});

describe("the verify route imports no day/community shell", () => {
  const routeDir = join(process.cwd(), "app", "verify", "[effectId]");
  /* IMPORT LINES ONLY. The page's header comment names these modules on
     purpose, to record what it deliberately does not pull in; scanning prose
     would fail on the very sentence that documents the rule. */
  const imports = ["page.tsx", "VerifyEffectFocusedForm.tsx"]
    .flatMap((f) => readFileSync(join(routeDir, f), "utf8").split("\n"))
    .filter((l) => /^\s*import\b/.test(l) || /\bfrom\s+["\']/.test(l))
    .join("\n");

  it.each([
    "SystemShell",
    "DayStatusStrip",
    "RealOrientationPanel",
    "RealDataGapPanel",
    "ActionEffectPanel",
    "PhilosNav",
    "CommunityPrototype",
  ])("does not import %s", (mod) => {
    expect(imports).not.toContain(mod);
  });

  it("renders no UNKNOWN / UNRESOLVED audit vocabulary", () => {
    const html = renderToStaticMarkup(
      React.createElement(VerifyEffectFocusedForm, {
        effectId: EFFECT, concernsInternalState: true, subject: "person_roei",
      }),
    );
    for (const token of ["UNKNOWN", "UNRESOLVED", "MET", "CARRY-FORWARD", "FULL GATE AUDIT"]) {
      expect(html).not.toContain(token);
    }
  });
});
