/**
 * Objective temperament dimensions — a real, curated subset of the Human
 * Config source (§23), Section "תודעה, הכרה ואדם", Heading "ממדי מזג —
 * פרמטרים לאבחון" (temperament dimensions / diagnostic parameters).
 *
 * Verified directly against the real workbook this pass: that Heading has
 * exactly 10 rows — 2 are decorative separators (`===`/`---`) and 1 is the
 * heading's own label row, leaving exactly 7 real parameter rows. The
 * product request's own example list additionally named "attention span,
 * persistence, distractibility" — checked, and NONE of those three exist
 * as rows under this Heading in the real source. They are NOT added here;
 * inventing them to match the example list would be exactly the
 * fabrication this session's standing rule forbids. Only the 7 real rows
 * are represented.
 *
 * Each parameter is translated into the requested objective LOW↔HIGH /
 * SLOW↔FAST style opposition-range form — a direct English label for the
 * real Hebrew concept (not a reinterpretation), with the real Canonical_ID
 * cited so `/hub/human-config` can link back to the exact source row.
 *
 * No subject's position on any of these ranges is known. `position` is
 * ALWAYS `unknown()` here — this file defines the instrument, not a
 * reading. A real reading requires a real Observation, which does not
 * exist for any subject in canon today.
 */
import type { MissionDimension } from "../mission/missionOrientation";

export interface TemperamentRange {
  parameter_id: string;
  canonical_id: string;
  label_he: string;
  label: string;
  low: string;
  high: string;
  section: string;
  heading: string;
}

export const TEMPERAMENT_DIMENSIONS: TemperamentRange[] = [
  { parameter_id: "temperament_activity_level", canonical_id: "CAN-SRC-000376", label_he: "רמת פעילות", label: "ACTIVITY LEVEL", low: "LOW", high: "HIGH", section: "תודעה, הכרה ואדם", heading: "ממדי מזג — פרמטרים לאבחון" },
  { parameter_id: "temperament_pace", canonical_id: "CAN-SRC-000377", label_he: "קצב", label: "PACE", low: "SLOW", high: "FAST", section: "תודעה, הכרה ואדם", heading: "ממדי מזג — פרמטרים לאבחון" },
  { parameter_id: "temperament_response_intensity", canonical_id: "CAN-SRC-000378", label_he: "עוצמת התגובה", label: "RESPONSE INTENSITY", low: "WEAK", high: "STRONG", section: "תודעה, הכרה ואדם", heading: "ממדי מזג — פרמטרים לאבחון" },
  { parameter_id: "temperament_response_threshold", canonical_id: "CAN-SRC-000379", label_he: "סף התגובה", label: "RESPONSE THRESHOLD", low: "LOW", high: "HIGH", section: "תודעה, הכרה ואדם", heading: "ממדי מזג — פרמטרים לאבחון" },
  { parameter_id: "temperament_approach_withdrawal", canonical_id: "CAN-SRC-000380", label_he: "התקרבות או התרחקות", label: "APPROACH ↔ WITHDRAW", low: "WITHDRAW", high: "APPROACH", section: "תודעה, הכרה ואדם", heading: "ממדי מזג — פרמטרים לאבחון" },
  { parameter_id: "temperament_adaptability", canonical_id: "CAN-SRC-000381", label_he: "יכולת הסתגלות", label: "ADAPTABILITY", low: "STABLE", high: "VARIABLE", section: "תודעה, הכרה ואדם", heading: "ממדי מזג — פרמטרים לאבחון" },
  { parameter_id: "temperament_mood_quality", canonical_id: "CAN-SRC-000382", label_he: "איכות מצב הרוח", label: "MOOD QUALITY", low: "NEGATIVE", high: "POSITIVE", section: "תודעה, הכרה ואדם", heading: "ממדי מזג — פרמטרים לאבחון" },
];

export interface RangeReading {
  range: TemperamentRange;
  position: MissionDimension<number>;
  intensity: MissionDimension<number>;
  stability: MissionDimension<"stable" | "variable">;
  direction: MissionDimension<"toward_low" | "toward_high" | "stable">;
  contradiction: MissionDimension<string>;
}

/** Every real dimension, with a genuinely unknown reading — no subject
 *  has a real Observation tied to any of these Canonical_IDs yet. */
export function buildUnknownTemperamentReadings(): RangeReading[] {
  return TEMPERAMENT_DIMENSIONS.map((range) => ({
    range,
    position: { value: null, status: "unknown" },
    intensity: { value: null, status: "unknown" },
    stability: { value: null, status: "unknown" },
    direction: { value: null, status: "unknown" },
    contradiction: { value: null, status: "unknown" },
  }));
}
