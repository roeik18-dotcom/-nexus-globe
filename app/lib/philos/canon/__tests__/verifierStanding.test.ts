/**
 * THE SCREEN AND THE WRITER MUST REFUSE THE SAME PEOPLE.
 *
 * `/verify/[effectId]` decides whether to show the form at all, before the
 * person has typed anything. That decision has to agree with the writer's,
 * or a verifier fills in five fields and is rejected afterwards — or worse,
 * is shown a refusal for a verification that would actually have been
 * accepted. Both call `checkVerifierStanding`; these tests pin the rule and
 * the agreement.
 */
import { describe, expect, it } from "vitest";

import { checkVerifierStanding, checkIndependentEvidence } from "../independentEvidence";
import type { OutcomeVerification } from "../outcomeVerification";

const SUBJECT = "person_roei";
const ACTOR = "person_roei";
const OUTSIDER = "person_bet";

describe("checkVerifierStanding", () => {
  it("admits an outsider who is neither the subject nor the actor", () => {
    expect(checkVerifierStanding({ verifier: OUTSIDER, subject: SUBJECT, actor: ACTOR }))
      .toEqual({ ok: true });
  });

  it("refuses the subject", () => {
    expect(checkVerifierStanding({ verifier: SUBJECT, subject: SUBJECT, actor: ACTOR }))
      .toEqual({ ok: false, refusal: "verifier_is_subject" });
  });

  it("refuses the actor even when the Effect is about someone else", () => {
    expect(checkVerifierStanding({ verifier: ACTOR, subject: "person_other", actor: ACTOR }))
      .toEqual({ ok: false, refusal: "verifier_is_actor" });
  });

  it("refuses when nobody is named", () => {
    expect(checkVerifierStanding({ verifier: undefined, subject: SUBJECT, actor: ACTOR }))
      .toEqual({ ok: false, refusal: "verifier_id_missing" });
    expect(checkVerifierStanding({ verifier: "   ", subject: SUBJECT, actor: ACTOR }))
      .toEqual({ ok: false, refusal: "verifier_id_missing" });
  });

  // FAILS CLOSED. An Action that cannot be resolved leaves the actor unknown,
  // and an unknown actor cannot be shown to be somebody else.
  it("refuses when the actor cannot be resolved", () => {
    expect(checkVerifierStanding({ verifier: OUTSIDER, subject: SUBJECT, actor: undefined }))
      .toEqual({ ok: false, refusal: "verifier_is_actor" });
  });
});

describe("the screen's answer and the writer's answer are the same answer", () => {
  const verification = (verifier_id: string | undefined): OutcomeVerification => ({
    statement: "confirmed", provenance: "third_party_review",
    verifier_type: "third_party", confidence: 0.8,
    time: new Date().toISOString(), method: "direct_observation",
    ...(verifier_id === undefined ? {} : { verifier_id }),
  });

  const cases: Array<{ verifier: string | undefined; subject: string; actor: string | undefined }> = [
    { verifier: OUTSIDER, subject: SUBJECT, actor: ACTOR },
    { verifier: SUBJECT, subject: SUBJECT, actor: ACTOR },
    { verifier: ACTOR, subject: "person_other", actor: ACTOR },
    { verifier: undefined, subject: SUBJECT, actor: ACTOR },
    { verifier: OUTSIDER, subject: SUBJECT, actor: undefined },
  ];

  it.each(cases)("agree for %o", (c) => {
    const standing = checkVerifierStanding(c);
    const full = checkIndependentEvidence({
      verification: verification(c.verifier),
      subject: c.subject,
      actor: c.actor,
      concerns_subject_internal_state: false,
    });
    expect(full.independent).toBe(standing.ok);
    if (!standing.ok && !full.independent) expect(full.refusal).toBe(standing.refusal);
  });
});
