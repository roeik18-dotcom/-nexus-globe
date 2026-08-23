/**
 * Who is looking at the screen.
 *
 * A placeholder with a deliberate shape. Philos has no sessions, no sign-in and
 * no Person entity — PHILOS-SYSTEM-BLUEPRINT §6 records the 12-layer person
 * schema as **missing**, and §16's privacy rules are a prerequisite before any
 * second participant exists. So the viewer is one constant, defined once.
 *
 * It lives in its own module rather than inline in a component for two reasons:
 * the identity a command writes into an event must not be a string a screen
 * happened to pass, and when the session layer lands there is exactly one place
 * that has to change. Until then this is honest about what it is: a single
 * local user, not an authenticated identity.
 */

export interface Viewer {
  person_id: string;
  display_name: string;
}

/**
 * The identity every viewer used to be. Kept only as a TYPE anchor now — the
 * constant it carried stamped a second-person display name onto whoever was
 * looking, which is how a real person came to be stored under a label that
 * means "whoever is reading". Identity comes from
 * `identity/viewerContext.ts`; the label comes from `person/personLabel.ts`
 * at render, where the reader is known. Nothing imports a viewer constant.
 */
export const LEGACY_VIEWER_PERSON_ID = "p_you";
