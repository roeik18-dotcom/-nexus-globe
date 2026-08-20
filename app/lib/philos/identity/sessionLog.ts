/**
 * DURABLE SESSIONS — append-only JSONL, the same discipline every other store
 * in this repository uses.
 *
 * Sessions lived in a Map, so a restart logged everyone out and a revocation
 * was forgotten along with the session it revoked. Both halves matter: the
 * first is an annoyance, the second is a security hole. A revoked token that
 * survives a restart as "unknown" happens to fail closed today only because
 * the issuance is forgotten too — if issuance were persisted and revocation
 * were not, revoking would become temporary.
 *
 * APPEND-ONLY, LIKE THE REST. Issue appends. Revoke appends. Nothing is ever
 * edited in place, which is the same rule canon records follow: a correction
 * is a new record, never a mutation. Resolution folds the log.
 *
 * RAW TOKENS ARE NEVER STORED. The log holds sha256(token). Anyone who reads
 * the file gets digests, and a digest cannot be presented as a bearer token.
 * Lookup is by digest, so this costs nothing.
 *
 * ITS OWN DIRECTORY. Sessions are operational state, not canon, so they do
 * not go in `.philos-canon-data` beside Needs and Observations — a session is
 * not something the system OBSERVED. Same architecture, separate storage.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";

import type { ViewerContext } from "./viewerContext";

export const SESSION_LOG_FILENAME = "sessions.jsonl";

export type SessionLogEntry =
  | {
      type: "issued";
      token_digest: string;
      viewer: Omit<ViewerContext, "source">;
      issued_at: string;
      expires_at: string;
    }
  | { type: "revoked"; token_digest: string; revoked_at: string };

/** sha256 hex. The ONE place a token becomes a lookup key. */
export function tokenDigest(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** The resolved state of one token, after folding every entry for it. */
export interface SessionState {
  viewer: Omit<ViewerContext, "source">;
  issued_at: string;
  expires_at: string;
  revoked_at?: string;
}

export interface SessionLog {
  append(entry: SessionLogEntry): Promise<void>;
  /** Folded state for one digest, or null when the log has never seen it. */
  read(tokenDigest: string): Promise<SessionState | null>;
  /** Every digest the log knows. Diagnostics and tests only. */
  digests(): Promise<string[]>;
}

/** Folds a list of entries into per-digest state. Revocation is sticky:
 *  once revoked, a later `issued` for the SAME digest cannot resurrect it —
 *  and cannot occur anyway, since a digest is 32 random bytes. */
function fold(entries: readonly SessionLogEntry[]): Map<string, SessionState> {
  const out = new Map<string, SessionState>();
  for (const e of entries) {
    if (e.type === "issued") {
      const existing = out.get(e.token_digest);
      out.set(e.token_digest, {
        viewer: e.viewer,
        issued_at: e.issued_at,
        expires_at: e.expires_at,
        // A revocation already recorded is NOT undone by a later issuance.
        revoked_at: existing?.revoked_at,
      });
    } else {
      const existing = out.get(e.token_digest);
      if (existing) out.set(e.token_digest, { ...existing, revoked_at: e.revoked_at });
      // A revocation for a digest we never issued is recorded as a no-op:
      // there is nothing to revoke, and inventing a record would be inventing
      // a session that never existed.
    }
  }
  return out;
}

export class InMemorySessionLog implements SessionLog {
  private readonly entries: SessionLogEntry[] = [];
  async append(entry: SessionLogEntry) { this.entries.push(entry); }
  async read(digest: string) { return fold(this.entries).get(digest) ?? null; }
  async digests() { return [...fold(this.entries).keys()]; }
}

export class FileSystemSessionLog implements SessionLog {
  private readonly filePath: string;
  constructor(private readonly dir: string) {
    this.filePath = join(dir, SESSION_LOG_FILENAME);
  }

  private load(): SessionLogEntry[] {
    if (!existsSync(this.filePath)) return [];
    const out: SessionLogEntry[] = [];
    for (const line of readFileSync(this.filePath, "utf-8").split("\n")) {
      if (!line.trim()) continue;
      try { out.push(JSON.parse(line) as SessionLogEntry); }
      catch { /* an unparseable line is skipped, never guessed at */ }
    }
    return out;
  }

  async append(entry: SessionLogEntry) {
    if (!existsSync(this.dir)) mkdirSync(this.dir, { recursive: true });
    appendFileSync(this.filePath, JSON.stringify(entry) + "\n", "utf-8");
  }

  /* Read from DISK every time. A cache here would mean a revocation written by
     one process is invisible to another, which is the failure this whole file
     exists to remove. Session logs are small and reads are rare. */
  async read(digest: string) { return fold(this.load()).get(digest) ?? null; }
  async digests() { return [...fold(this.load()).keys()]; }
}

let _log: SessionLog | null = null;

export function setSessionLog(log: SessionLog): void { _log = log; }

export function sessionLog(): SessionLog {
  if (_log === null) {
    const dir = process.env.PHILOS_SESSION_DIR ?? join(process.cwd(), ".philos-session-data");
    _log = new FileSystemSessionLog(dir);
  }
  return _log;
}

/** Drop the singleton so the next call rebuilds it from disk — this is what a
 *  restart does, and it is how the restart tests reproduce one honestly. */
export function resetSessionLogForRestart(): void { _log = null; }
