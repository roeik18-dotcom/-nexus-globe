/**
 * Philos · Viewer resolution — the seam a session will land in.
 *
 * Every server render and every command asks this one function who is looking.
 * Today it answers with the single local viewer, because Philos has no sign-in:
 * PHILOS-SYSTEM-BLUEPRINT §6 records the Person schema as **missing** and §16
 * records the privacy rules as **missing and required before any second
 * participant**. Minting a per-browser identity now would create exactly that
 * second participant, ahead of the rules the blueprint says must come first, so
 * this deliberately does not do it.
 *
 * ── Why it is async when it has nothing to await ───────────────────────────
 * Because the thing that replaces it is not. A real resolution reads a cookie or
 * a session — `await cookies()` in Next 16, which is asynchronous and only legal
 * inside a request scope. Making the seam async now means the session lands in
 * THIS file and nowhere else; making it sync now would mean converting every
 * call site later, which is how a seam stops being a seam.
 *
 * Lives outside `app/lib/philos/` for the same reason the event store does: this
 * is where request-scoped, framework-aware code will go, and the domain layer
 * stays pure. The `Viewer` shape itself is domain (`philos/viewer.ts`).
 */

import { type Viewer } from "./philos/viewer";
import { resolveViewerContext } from "./philos/identity/viewerContext";

/**
 * Who is looking at this render.
 *
 * Callers must treat the result as the ONLY source of viewer identity — never a
 * person id passed in from a client, which would let a caller act as someone
 * else. `app/hub/actions.ts` takes no person parameter for that reason.
 */
export async function resolveViewer(): Promise<Viewer> {
  /* ONE AUTHORITY. This returned the `CURRENT_VIEWER` constant while
     `resolveViewerContext()` — written for the multi-user foundation —
     answered the same question from a provider. Two functions answering "who
     is acting" is the same defect as two functions answering "how many
     memberships": it does not matter that they agree today, only that nothing
     makes them agree tomorrow. Worse, this shape carries no `subject_id` at
     all, so no canon write could ever be bound through it.

     It is now a PROJECTION of the one context: the same identity, narrowed to
     the two fields the older call sites use. Those call sites keep working
     unchanged, and there is one place a session lands. */
  const ctx = await resolveViewerContext();
  /* The display name is resolved at RENDER, against the reader, by
     `person/personLabel.ts`. Stamping "את/ה" here put a rendering decision
     into the model: every record written through this seam carried a
     second-person string that any OTHER reader would then see applied to a
     third person. The viewer's id is the viewer-independent fact; the label
     is not this function's to decide. */
  return { person_id: ctx.person_id, display_name: ctx.person_id };
}

/* `CURRENT_VIEWER_DISPLAY_NAME = "את/ה"` stood here. It was the producer of
   the viewer-relative labels now sitting in the append-only log, so it is
   gone rather than merely unused: second person is applied by
   `person/personLabel.ts` at render, where the reader is known. */
