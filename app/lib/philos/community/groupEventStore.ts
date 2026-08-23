/**
 * GROUP EVENT STORE — append-only JSONL, one file, and the ingestion surface
 * an external dataset enters through without a code change.
 *
 * Same discipline as every other canon store: a duplicate id is REJECTED
 * rather than merged (two records claiming one identity is the bug, not the
 * fix), a malformed line is reported with its line number rather than
 * silently skipped, and a correction is a NEW event — nothing here edits.
 *
 * A missing file is an empty history, not an error and not a reason to
 * substitute anything. Today it is exactly that: zero group operational
 * events exist, because none have ever been recordable.
 */
import { existsSync, readFileSync, appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { validateGroupEvent, type GroupEvent, type EventRejection } from "./groupEvent";

export const GROUP_EVENT_STORE_FILENAME = "group-events.jsonl";

export interface GroupEventLoad {
  events: GroupEvent[];
  rejected: (EventRejection & { line: number })[];
}

function dir(): string {
  return process.env.PHILOS_CANON_DIR ?? join(process.cwd(), ".philos-canon-data");
}

/** Pure. Parses JSONL; every failure is reported, never fatal. */
export function parseGroupEvents(text: string): GroupEventLoad {
  const events: GroupEvent[] = [];
  const rejected: (EventRejection & { line: number })[] = [];
  const seen = new Set<string>();
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t) continue;
    let o: unknown;
    try { o = JSON.parse(t); } catch { rejected.push({ line: i + 1, because: "JSON לא תקין" }); continue; }
    const v = validateGroupEvent(o);
    if (!v.ok) { rejected.push({ line: i + 1, ...v.rejection }); continue; }
    if (seen.has(v.event.event_id)) {
      rejected.push({ line: i + 1, event_id: v.event.event_id, because: "event_id כפול — נדחה, לא ממוזג" });
      continue;
    }
    seen.add(v.event.event_id);
    events.push(v.event);
  }
  return { events, rejected };
}

export function loadGroupEvents(d = dir()): GroupEventLoad {
  const p = join(d, GROUP_EVENT_STORE_FILENAME);
  if (!existsSync(p)) return { events: [], rejected: [] };
  return parseGroupEvents(readFileSync(p, "utf8"));
}

export class GroupEventRejectedError extends Error {
  readonly rejections: readonly EventRejection[];
  constructor(rejections: readonly EventRejection[]) {
    super(`group event append rejected: ${rejections.map((r) => r.because).join("; ")}`);
    this.name = "GroupEventRejectedError";
    this.rejections = rejections;
  }
}

/** Append-only. Validates against BOTH the incoming batch and what is already
 *  stored before writing anything — a partial append is worse than none. */
export function appendGroupEvents(incoming: readonly unknown[], d = dir()): GroupEvent[] {
  const rejections: EventRejection[] = [];
  if (incoming.length === 0) rejections.push({ because: "append ריק" });
  const stored = new Set(loadGroupEvents(d).events.map((e) => e.event_id));
  const batch = new Set<string>();
  const ok: GroupEvent[] = [];
  for (const raw of incoming) {
    const v = validateGroupEvent(raw);
    if (!v.ok) { rejections.push(v.rejection); continue; }
    if (stored.has(v.event.event_id)) { rejections.push({ event_id: v.event.event_id, because: "כבר קיים בחנות — append-only" }); continue; }
    if (batch.has(v.event.event_id)) { rejections.push({ event_id: v.event.event_id, because: "מופיע פעמיים באותו append" }); continue; }
    batch.add(v.event.event_id);
    ok.push(v.event);
  }
  if (rejections.length > 0) throw new GroupEventRejectedError(rejections);
  mkdirSync(d, { recursive: true });
  appendFileSync(join(d, GROUP_EVENT_STORE_FILENAME), ok.map((e) => JSON.stringify(e)).join("\n") + "\n");
  return ok;
}
