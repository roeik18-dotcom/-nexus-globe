/**
 * PERSON LABEL — the one place a person becomes a string on screen, and the
 * one place second person is allowed to exist.
 *
 * THE DEFECT THIS FIXES. `p_you` was registered with
 * `payload.display_name: "את/ה"` — literally "you" — into the append-only log,
 * and `resolveViewer()` stamped the same constant onto every viewer. A roster
 * carrying that record therefore reads "את/ה" to EVERY reader, so User B
 * inspecting Roei's group sees a third person labelled as themselves. The
 * name is not wrong data about that person; it is a RENDERING decision that
 * was written into storage, where it cannot know who is reading.
 *
 * THE RULE, now enforced in one function: canonical person data is
 * viewer-independent. Second person is applied HERE, at render, against the
 * actual viewer — and a stored viewer-relative token is never echoed to
 * anyone else. It resolves to the person's id, marked UNRESOLVED_NAME, which
 * is honest: PHILOS genuinely does not know that person's name, and saying so
 * is better than borrowing the reader's identity for them.
 *
 * HISTORY IS NOT REWRITTEN. The event stays exactly as recorded — append-only
 * means a correction is a new record, and the correction PHILOS can make
 * without inventing a name for a real person is a projection rule, not a
 * fabricated `person.renamed` event carrying a name nobody supplied.
 */

/** Stored strings that mean "whoever is reading". Never rendered for a third
 *  party. Lowercased and trimmed before comparison. */
const VIEWER_RELATIVE_TOKENS = new Set([
  "את/ה", "אתה", "את", "אתם", "you", "me", "myself", "self", "current user", "אני",
]);

export function isViewerRelativeLabel(name: string | undefined | null): boolean {
  if (!name) return false;
  return VIEWER_RELATIVE_TOKENS.has(name.trim().toLowerCase());
}

export interface PersonLabel {
  /** What to draw. */
  text: string;
  /** Why it says that — so a screen can style UNRESOLVED_NAME as quiet. */
  status: "RECORDED_NAME" | "SECOND_PERSON" | "UNRESOLVED_NAME";
}

/**
 * Resolve one person to a label for ONE viewer.
 *
 * `viewerPersonIds` is every id that IS the reader (a viewer has both a
 * `person_id` and a `subject_id`, and either may appear on a roster).
 */
export function personLabel(
  person_id: string,
  stored_display_name: string | undefined,
  viewerPersonIds: readonly (string | undefined)[],
): PersonLabel {
  const isViewer = viewerPersonIds.some((v) => v && v === person_id);

  if (isViewerRelativeLabel(stored_display_name)) {
    // The stored string is a rendering token, not a name. Only the actual
    // reader may receive it; for anyone else PHILOS has no name to give.
    return isViewer
      ? { text: "את/ה", status: "SECOND_PERSON" }
      : { text: person_id, status: "UNRESOLVED_NAME" };
  }

  if (stored_display_name && stored_display_name.trim()) {
    return { text: stored_display_name.trim(), status: "RECORDED_NAME" };
  }

  return isViewer
    ? { text: "את/ה", status: "SECOND_PERSON" }
    : { text: person_id, status: "UNRESOLVED_NAME" };
}

/** Audit helper: canonical records that still carry viewer-relative language.
 *  Used by the data-quality layer to report the count rather than hide it. */
export function countViewerRelativeLabels(
  people: readonly { person_id: string; display_name?: string }[],
): number {
  return people.filter((p) => isViewerRelativeLabel(p.display_name)).length;
}
