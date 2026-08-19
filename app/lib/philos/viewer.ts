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

export const CURRENT_VIEWER: Viewer = {
  person_id: "p_you",
  display_name: "את/ה",
};
