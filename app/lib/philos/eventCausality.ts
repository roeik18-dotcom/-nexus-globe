/**
 * Dynamics Layer — Step 1: causality validation for the event envelope.
 *
 * PHILOS-DYNAMICS-LAYER.md §1–§2, §8. This module validates the `caused_by`
 * field added to `PhilosEvent`. It does NOT project anything — no
 * `projectDynamics`, no edges, no UI, no inference. Its only job is to guard the
 * data contract so nothing downstream can build a ripple on a causal set that is
 * self-referential, duplicated, dangling, cyclic, or time-reversed.
 *
 * Two axes are deliberately kept apart, and neither is decided here — both belong
 * to Step 2 (`projectDynamics`):
 *   • edge_origin    — explicit (declared via caused_by) vs inferred (guessed)
 *   • evidence_level — self_report, system_inference, …
 * A validated `caused_by` link is a DECLARATION, never verified causation. This
 * module refuses to launder the one into the other: it checks that a declaration
 * is well-formed, never that the causation it asserts is true.
 */
import type { PhilosEvent } from "./events";

/** The closed set of things that can be wrong with a `caused_by` declaration. */
export const CAUSALITY_DIAGNOSTIC_CODES = [
  "self_reference",
  "duplicate_parent",
  "invalid_parent_id",
  "missing_parent",
  "causal_cycle",
  "parent_after_child",
  "invalid_timestamp",
] as const;

export type CausalityDiagnosticCode = (typeof CAUSALITY_DIAGNOSTIC_CODES)[number];

export type DiagnosticSeverity = "error" | "warning";

/**
 * `lenient` — the log may be partial (a window, or events from another store);
 * a `caused_by` pointing outside it is an unresolved WARNING, not a failure.
 * `strict` — the log is treated as closed; every parent must resolve, so a
 * dangling reference is an ERROR.
 */
export type CausalityMode = "lenient" | "strict";

export interface CausalityDiagnostic {
  code: CausalityDiagnosticCode;
  severity: DiagnosticSeverity;
  /** The event whose caused_by is at fault. */
  event_id: string;
  /** The specific parent id implicated, when the code concerns one parent. */
  parent_id?: string;
  /** For causal_cycle: the loop as a closed path of event_ids (start … start). */
  cycle?: string[];
  message: string;
}

export interface CausalityReport {
  /** True when there are no error-severity diagnostics. Warnings do not fail. */
  ok: boolean;
  mode: CausalityMode;
  diagnostics: CausalityDiagnostic[];
  errors: CausalityDiagnostic[];
  warnings: CausalityDiagnostic[];
}

/** Honest tri-state reading of one event's causal declaration (§2). */
export type CausalDeclaration = "unknown" | "declared_none" | "declared";

export function causalDeclaration(e: PhilosEvent): CausalDeclaration {
  // A non-array (absent, or malformed parsed-JSON such as null/string/number)
  // reads as "unknown" — we cannot claim to know the causes. Never throws, and
  // agrees with causalParents so the two readers never diverge on bad input.
  if (!Array.isArray(e.caused_by)) return "unknown";
  return e.caused_by.length === 0 ? "declared_none" : "declared";
}

/** The declared parents, normalized to an array. Absent/malformed → [] — never invents, never throws. */
export function causalParents(e: PhilosEvent): string[] {
  return Array.isArray(e.caused_by) ? e.caused_by : [];
}

/**
 * A causality timestamp is usable only if it is UNAMBIGUOUS: it must carry an
 * explicit timezone (a trailing `Z` or `±HH:MM`) AND parse to a real instant.
 * Offsetless strings are rejected rather than read in the host's local timezone
 * (which would make the verdict machine-dependent), and unparseable strings are
 * rejected rather than silently no-op'd — the two failure modes the Step-1 review
 * surfaced. Nothing is ever compared as a raw string, and `instant()` is called
 * only after this gate passes.
 */
const TZ_SUFFIX = /(?:Z|[+-]\d{2}:\d{2})$/;

/**
 * Exported because the append boundary (`eventStore.ts`) must apply the SAME
 * gate before a new event enters the log. Two readings of "is this timestamp
 * usable" would be one reading too many: an event admitted by a laxer writer
 * check would later be un-orderable here, and the diagnostic would surface at
 * read time, on data nobody can fix without a correcting event.
 */
export const hasUnambiguousTimestamp = (ts: unknown): ts is string =>
  typeof ts === "string" && TZ_SUFFIX.test(ts) && !Number.isNaN(Date.parse(ts));

const isValidTimestamp = hasUnambiguousTimestamp;

/** Absolute instant of a validated ISO-8601 timestamp; offset-aware. */
const instant = (ts: string): number => Date.parse(ts);

/**
 * Structural checks on ONE event, independent of the rest of the log:
 * `invalid_parent_id`, `self_reference`, `duplicate_parent`. These are always
 * errors regardless of validation mode — they are wrong on their face, without
 * needing any other event to compare against.
 */
export function validateEventCausality(event: PhilosEvent): CausalityDiagnostic[] {
  const out: CausalityDiagnostic[] = [];
  // Treat caused_by as unknown: the validator's job is to guard runtime data
  // (e.g. parsed JSON) that may not honor the string[] type.
  const causedBy: unknown = event.caused_by;
  if (causedBy === undefined) return out; // absent = unknown, nothing to check
  if (!Array.isArray(causedBy)) {
    // Malformed container (null / string / number). Guard it so the validator
    // never crashes on the very data it exists to check (§8.3 "never crash");
    // the whole field is invalid, reported as one diagnostic.
    out.push({
      code: "invalid_parent_id",
      severity: "error",
      event_id: event.event_id,
      parent_id: String(causedBy),
      message: "caused_by is not an array",
    });
    return out;
  }

  const seen = new Set<string>();
  for (const raw of causedBy as readonly unknown[]) {
    if (typeof raw !== "string" || raw.length === 0) {
      out.push({
        code: "invalid_parent_id",
        severity: "error",
        event_id: event.event_id,
        parent_id: typeof raw === "string" ? raw : String(raw),
        message: "caused_by contains an empty or non-string parent id",
      });
      continue;
    }
    if (raw === event.event_id) {
      out.push({
        code: "self_reference",
        severity: "error",
        event_id: event.event_id,
        parent_id: raw,
        message: `event ${event.event_id} lists itself as a cause`,
      });
      continue;
    }
    if (seen.has(raw)) {
      out.push({
        code: "duplicate_parent",
        severity: "error",
        event_id: event.event_id,
        parent_id: raw,
        message: `caused_by lists ${raw} more than once`,
      });
      continue;
    }
    seen.add(raw);
  }
  return out;
}

/**
 * Validate the causal structure of a whole event set.
 *
 * Runs the per-event structural checks, then the set-level checks that need the
 * id map: `missing_parent` (severity by mode), `parent_after_child` (instant-
 * aware — cause must not be after effect), and `causal_cycle` (the traced graph
 * must be a DAG). Cross-group causality is deliberately NOT checked here — it is
 * allowed; visibility gating belongs to the Step-2 projection, not to structural
 * validation.
 *
 * Deterministic: diagnostics follow input order for per-event checks and a
 * canonical order for cycles, so the same input yields a deep-equal report.
 */
export function validateCausality(
  events: readonly PhilosEvent[],
  mode: CausalityMode = "lenient",
): CausalityReport {
  const diagnostics: CausalityDiagnostic[] = [];

  const byId = new Map<string, PhilosEvent>();
  for (const e of events) byId.set(e.event_id, e);

  // 1) per-event structural checks (input order).
  for (const e of events) diagnostics.push(...validateEventCausality(e));

  // 2) reference + temporal checks (need the id map).
  const flaggedTs = new Set<string>(); // invalid_timestamp at most once per event
  const flagBadTimestamp = (evt: PhilosEvent): void => {
    if (flaggedTs.has(evt.event_id)) return;
    flaggedTs.add(evt.event_id);
    diagnostics.push({
      code: "invalid_timestamp",
      severity: "error",
      event_id: evt.event_id,
      message: `timestamp "${String(evt.timestamp)}" is unparseable or lacks an explicit timezone offset`,
    });
  };
  for (const e of events) {
    if (!Array.isArray(e.caused_by)) continue; // absent or malformed; structural check handled it
    const checked = new Set<string>();
    for (const raw of e.caused_by as readonly unknown[]) {
      if (typeof raw !== "string" || raw.length === 0) continue; // invalid_parent_id already flagged
      const parentId = raw;
      if (parentId === e.event_id) continue; // self_reference already flagged
      if (checked.has(parentId)) continue; // duplicate already flagged; resolve once
      checked.add(parentId);

      const parent = byId.get(parentId);
      if (parent === undefined) {
        diagnostics.push({
          code: "missing_parent",
          severity: mode === "strict" ? "error" : "warning",
          event_id: e.event_id,
          parent_id: parentId,
          message:
            mode === "strict"
              ? `caused_by references ${parentId}, absent from a closed log`
              : `caused_by references ${parentId}, not present in this (partial) log`,
        });
        continue;
      }
      // Timestamp gate: a cause or effect whose timestamp is ambiguous (no offset)
      // or unparseable cannot be ordered. Flag it and skip the comparison — never
      // fall back to a host-local or raw-string ordering, and never emit
      // parent_after_child off a timestamp we could not trust.
      const parentOk = isValidTimestamp(parent.timestamp);
      const childOk = isValidTimestamp(e.timestamp);
      if (!parentOk) flagBadTimestamp(parent);
      if (!childOk) flagBadTimestamp(e);
      if (!parentOk || !childOk) continue;

      if (instant(parent.timestamp) > instant(e.timestamp)) {
        diagnostics.push({
          code: "parent_after_child",
          severity: "error",
          event_id: e.event_id,
          parent_id: parentId,
          message: `cause ${parentId} (${parent.timestamp}) is after effect ${e.event_id} (${e.timestamp})`,
        });
      }
    }
  }

  // 3) cycles over resolved, non-self edges.
  for (const cycle of findCycles(byId)) {
    diagnostics.push({
      code: "causal_cycle",
      severity: "error",
      event_id: cycle[0],
      cycle,
      message: `causal cycle: ${cycle.join(" → ")}`,
    });
  }

  const errors = diagnostics.filter((d) => d.severity === "error");
  const warnings = diagnostics.filter((d) => d.severity === "warning");
  return { ok: errors.length === 0, mode, diagnostics, errors, warnings };
}

/**
 * Detect cycles in the caused_by graph via a three-colour DFS. Reports at least
 * one cycle per back-edge found — enough to prove the graph is not a DAG (D3) and
 * to name the events involved — but does NOT enumerate every distinct simple
 * cycle, which the module's contract does not require. Only resolved, non-self
 * parent edges participate; dangling and self references are reported by the
 * other checks and must not be double-counted as cycles. Each reported cycle is
 * returned once (deduped by canonical rotation) as a closed path.
 */
function findCycles(byId: Map<string, PhilosEvent>): string[][] {
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const state = new Map<string, number>();
  const stack: string[] = [];
  const found: string[][] = [];

  const parentsOf = (id: string): string[] => {
    const e = byId.get(id);
    if (!e || !Array.isArray(e.caused_by)) return [];
    const out: string[] = [];
    for (const p of e.caused_by as readonly unknown[]) {
      if (typeof p === "string" && p.length > 0 && p !== id && byId.has(p)) out.push(p);
    }
    return out;
  };

  const visit = (id: string): void => {
    state.set(id, GRAY);
    stack.push(id);
    for (const parent of parentsOf(id)) {
      const s = state.get(parent) ?? WHITE;
      if (s === GRAY) {
        const idx = stack.indexOf(parent);
        if (idx >= 0) found.push([...stack.slice(idx), parent]); // …parent … back to parent
      } else if (s === WHITE) {
        visit(parent);
      }
    }
    stack.pop();
    state.set(id, BLACK);
  };

  // byId preserves input insertion order, so traversal (and dedup) is deterministic.
  for (const id of byId.keys()) {
    if ((state.get(id) ?? WHITE) === WHITE) visit(id);
  }
  return dedupeCycles(found);
}

/** Collapse rotations/repeats of the same loop to one canonical closed path. */
function dedupeCycles(cycles: string[][]): string[][] {
  const seen = new Set<string>();
  const out: string[][] = [];
  for (const cyc of cycles) {
    const nodes = cyc.slice(0, -1); // drop the repeated closing node
    if (nodes.length === 0) continue;
    let minIdx = 0;
    for (let i = 1; i < nodes.length; i++) if (nodes[i] < nodes[minIdx]) minIdx = i;
    const rotated = [...nodes.slice(minIdx), ...nodes.slice(0, minIdx)];
    const key = rotated.join(">");
    if (!seen.has(key)) {
      seen.add(key);
      out.push([...rotated, rotated[0]]); // present as a closed loop: A → B → A
    }
  }
  return out;
}
