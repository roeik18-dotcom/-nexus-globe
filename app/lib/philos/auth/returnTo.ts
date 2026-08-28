/**
 * WHERE SIGN-IN IS ALLOWED TO SEND YOU BACK TO.
 *
 * A person who follows a verification link while signed out is bounced to
 * `/signin`. Without this, sign-in dropped them on a fixed page and the link
 * they were sent \u2014 the whole reason they signed in \u2014 was gone. So the
 * destination travels with them.
 *
 * A destination that arrives in a URL is attacker-controlled. `returnTo` is
 * therefore a CLAIM, validated here, and the same function is used by the
 * middleware that writes it, the page that renders it, and the action that
 * follows it \u2014 three places that must never disagree about what is safe.
 *
 * ONLY SAME-ORIGIN PATHS. The rejections below are the ways a string can look
 * internal and not be:
 *   `//evil.com`        protocol-relative \u2014 the browser reads it as absolute
 *   `/\\evil.com`        backslash, which browsers normalise to `/`
 *   `https://evil.com`  plainly absolute
 *   `/signin`           would bounce sign-in back to itself, forever
 * Percent-encoding is decoded BEFORE the checks, so `%2f%2fevil.com` cannot
 * smuggle a second slash past them.
 */

/** Where a signed-in person lands when no valid destination was carried. */
export const DEFAULT_AFTER_SIGN_IN = "/hub/community";

export function isSafeReturnTo(raw: unknown): raw is string {
  if (typeof raw !== "string" || raw === "") return false;

  /* Decode first: the checks below must see what the browser will see, not
     the escaped form. A malformed escape is itself disqualifying. */
  let value: string;
  try {
    value = decodeURIComponent(raw);
  } catch {
    return false;
  }

  if (!value.startsWith("/")) return false;      // absolute, or relative-to-here
  if (value.startsWith("//")) return false;      // protocol-relative
  if (value.includes("\\")) return false;        // browsers normalise this to "/"
  // Control characters, including the CR/LF that could split a header.
  if (/[\u0000-\u001f\u007f]/.test(value)) return false;
  if (value.startsWith("/signin")) return false; // self-redirect loop

  return true;
}

/** The destination to use, given whatever arrived. Never throws. */
export function resolveReturnTo(raw: unknown): string {
  return isSafeReturnTo(raw) ? decodeURIComponent(raw) : DEFAULT_AFTER_SIGN_IN;
}
