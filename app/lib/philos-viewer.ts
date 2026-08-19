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

import { CURRENT_VIEWER, type Viewer } from "./philos/viewer";

/**
 * Who is looking at this render.
 *
 * Callers must treat the result as the ONLY source of viewer identity — never a
 * person id passed in from a client, which would let a caller act as someone
 * else. `app/hub/actions.ts` takes no person parameter for that reason.
 */
export async function resolveViewer(): Promise<Viewer> {
  return CURRENT_VIEWER;
}
