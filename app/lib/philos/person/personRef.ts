/**
 * PHILOS — PersonRef: the ONE shared identity reference every product surface
 * consumes (STEP 1 of the Hub dependency order).
 *
 * Contract: `PHILOS-PERSON-CONTRACT.md` §1 — "Person = an identity anchor.
 * Nothing else." A `PersonRef` carries **no state, no score, no cell, no
 * domain, no config, and no 9-cell reference**. That exclusion is structural:
 * there is no field on this type that could hold one.
 *
 * ── WHAT THIS DOES NOT DO ────────────────────────────────────────────────
 *
 * **It does not merge the six person representations.** `Viewer`,
 * `ViewerIdentity`, `subject: string`, `PersonInstance`, `PersonView` and
 * `PersonCommunityLink` all stay exactly as they are. This is a *reference*
 * that points at the same person consistently — not a unification.
 *
 * **It is not the viewer.** Two identities exist and are deliberately
 * separate:
 *
 *   `person_roei`  the CANON SUBJECT (`subjectRegistry.ts`) — the id every
 *                  Observation/Need/Offer/Action/Effect is keyed by. Its own
 *                  module states it carries "zero attached data".
 *   `p_you`        the VIEWER (`viewer.ts::CURRENT_VIEWER`, display_name
 *                  "את/ה") — who is looking at the screen.
 *
 * They are joined by a real, checked bridge (`resolveShellIdentityLink()` →
 * `VERIFIED_SAME_PERSON`), and every surface already passes `subject` and
 * `identityLink` as two separate props. **`PersonRef` is the canon subject.**
 * Collapsing the two here would assert an identity equality that only the
 * bridge is entitled to state.
 *
 * **There are therefore two identity resolvers, answering two questions:**
 *   `resolvePersonRef()`        — WHO is the subject of this screen?
 *   `resolveShellIdentityLink()` — is that subject the same person as the viewer?
 * Neither replaces the other. Do not merge them.
 *
 * ── WHY `display_name` IS UNKNOWN HERE ───────────────────────────────────
 *
 * A canon subject has no recorded display name. The string "את/ה" belongs to
 * the VIEWER, resolved through `projectViewerIdentity`, and is rendered from
 * that path — not from this one.
 *
 * `display_name_source` needs a third value beyond `"event" | "local"`
 * because neither can express "this identity has no name record at all".
 * That third value is `"none"`, and it is the honest answer for every canon
 * subject today.
 *
 * A known defect in the viewer path, recorded here so it is never copied
 * onto a `PersonRef`: `viewerIdentity.ts` sets `display_name_source: "event"`
 * whenever a registration event exists, but falls back to the local name when
 * that event carries no `display_name` payload — so the flag can read
 * `"event"` while the value is in fact the local fallback. This module does
 * not propagate that flag, and does not fix it (out of scope).
 *
 * **A display name is never derived from `person_id`.** Turning
 * `"person_roei"` into a human name would invent personal data from an
 * identifier.
 */
import { classifySubject, type SubjectClassification } from "../subjectRegistry";
import { mayReadSubject, type ViewerContext } from "../identity/viewerContext";

/**
 * Where a display name came from.
 *   `"event"` — a real registration event recorded it.
 *   `"local"` — the local, unrecorded fallback (never shown as recorded).
 *   `"none"`  — no name record exists for this identity at all.
 */
export type DisplayNameSource = "event" | "local" | "none";

/**
 * The one shared identity reference. Every field is an identity fact or its
 * provenance — nothing else may be added here. In particular: no `level`,
 * no `state`, no `domain`, no `value`, no `config`, no cell.
 */
export interface PersonRef {
  /** The canon subject id every record is keyed by. */
  person_id: string;
  /** Real, checked classification (`subjectRegistry.ts::classifySubject`) —
   *  `real | demo | test | placeholder | system`. Never guessed into "real". */
  classification: SubjectClassification;
  /** `undefined` for every canon subject today — see the module header.
   *  Never derived from `person_id`. */
  display_name?: string;
  /** `"none"` for a canon subject: no name record exists for this identity. */
  display_name_source: DisplayNameSource;
}

/**
 * The ONE resolver for "who is the subject of this screen".
 *
 * Pure and synchronous — no store read, no I/O, no canon projection.
 *
 * THE CLIENT DOES NOT CHOOSE THE ACTING SUBJECT.
 * This function used to read `searchParams.subject` and fall back to
 * `REAL_CURRENT_SUBJECT`, and six pages — Hub, Brain, Dynamics, Globe,
 * Marketplace, Community — passed the raw query value in. Every read on those
 * pages was therefore scoped to whatever subject a URL named. With one human
 * in the system that was invisible; with two it is the whole product reading
 * as the wrong person.
 *
 * The viewer decides. A `?subject=` is honoured ONLY when it names someone
 * this viewer may read, which today means themselves; anything else THROWS.
 * It does not quietly narrow to the viewer either: a request that asked for
 * another person's records must not render a page full of a different
 * person's records under the name that was asked for.
 *
 * Deliberately NOT trimmed: an explicit empty `?subject=` still passes
 * through as `""` and resolves to no records, exactly as before.
 */
export function resolvePersonRef(viewer: ViewerContext, requested?: unknown): PersonRef {
  if (typeof requested === "string" && requested !== "" && !mayReadSubject(viewer, requested)) {
    throw new Error(
      `subject "${requested}" is not readable by viewer "${viewer.viewer_id}"; refusing to render another person's records`,
    );
  }
  const person_id = typeof requested === "string" ? requested : viewer.subject_id;
  return {
    person_id,
    classification: classifySubject(person_id),
    // No canon subject carries a recorded display name today. Stated, not
    // omitted, and never derived from `person_id`.
    display_name: undefined,
    display_name_source: "none",
  };
}
