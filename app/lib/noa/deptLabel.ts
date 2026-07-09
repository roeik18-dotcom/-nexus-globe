// PHILOS NEXUS · canon department labels.
//
// Internal department KEYS are stable identifiers (Physical/Emotional/Rational/ID/EGO/SUPEREGO).
// Every VISIBLE rendering must go through deptLabel so the product shows the Nexus
// canon names instead — which are distinct from the Dimension names (Physical/Emotional/Rational).
//
// Dimension → what the person has (resource)
// Department → where load is registered and processed (engine)
//   Physical dept → Body   · Emotional dept → Heart  · Rational dept → Mind
//   ID → Drive            · EGO → Navigation         · SUPEREGO → Values

export const DEPT_LABEL: Record<string, string> = {
  Physical: 'Body',
  Emotional: 'Heart',
  Rational: 'Mind',
  ID: 'Drive',
  EGO: 'Navigation',
  SUPEREGO: 'Values',
};

/** Map an internal department key to its visible canon name. */
export function deptLabel(dept: string | null | undefined): string {
  return dept ? (DEPT_LABEL[dept] ?? dept) : '—';
}
