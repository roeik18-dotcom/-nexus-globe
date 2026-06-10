// PHILOS NEXUS · canon department labels.
//
// The chain's internal department KEYS (ID/EGO/SUPEREGO) are Freudian and remain
// as internal identifiers only. Every VISIBLE rendering must go through deptLabel
// so the product shows the Philos canon vectors instead:
//   ID → Drive · EGO → Personal · SUPEREGO → Social   (Physical/Emotional/Rational unchanged)
// Person (אדם) is the orientation reference point; these are influence vectors
// relative to the Person. Freud terms may remain only in code/comments, never in UI.

export const DEPT_LABEL: Record<string, string> = {
  Physical: 'Physical',
  Emotional: 'Emotional',
  Rational: 'Rational',
  ID: 'Drive',
  EGO: 'Personal',
  SUPEREGO: 'Social',
};

/** Map an internal department key to its visible canon label (never shows Freud terms). */
export function deptLabel(dept: string | null | undefined): string {
  return dept ? (DEPT_LABEL[dept] ?? dept) : '—';
}
