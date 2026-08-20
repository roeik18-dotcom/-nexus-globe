/**
 * Value declaration store. Same shape and discipline as
 * `needGroupLinkStore.ts`: append-only, reject a duplicate id rather than
 * ignore it, a pure check gate separate from the store, JSONL in its OWN file
 * (`value-declarations.jsonl`).
 *
 * Outside closed canon on purpose. Canon closes Need/Action/Effect at §12/13/17
 * and says nothing about values as entities; a Personal or Group Value is a
 * social-layer fact, so it lives beside canon rather than inside it — the same
 * decision already made for person↔community links and Need↔group links.
 *
 * Append-only: a retraction or a verification is a NEW record, never an edit.
 */
import { existsSync, mkdirSync, readFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";

import { type ValueDeclaration, type ValueDeclarationError, validateValueDeclaration } from "./valueDeclaration";

export const VALUE_DECLARATION_STORE_FILENAME = "value-declarations.jsonl";

export interface ValueDeclarationRejection {
  code: "empty_append" | "duplicate_value_id" | "value_id_already_stored" | "invalid_declaration";
  value_id?: string;
  message: string;
  errors?: ValueDeclarationError[];
}

export type ValueDeclarationCheck = { ok: true } | { ok: false; rejections: ValueDeclarationRejection[] };

/** Pure and total. */
export function checkValueDeclarationAppend(
  stored: readonly ValueDeclaration[],
  incoming: readonly ValueDeclaration[],
): ValueDeclarationCheck {
  const rejections: ValueDeclarationRejection[] = [];
  if (incoming.length === 0) {
    return { ok: false, rejections: [{ code: "empty_append", message: "an append must carry at least one declaration" }] };
  }
  const storedIds = new Set(stored.map((r) => r?.value_id));
  const seen = new Set<string>();
  for (const r of incoming) {
    const id = r?.value_id;
    if (id !== undefined && storedIds.has(id)) {
      rejections.push({ code: "value_id_already_stored", value_id: id, message: `${id} is already stored; append-only` });
    }
    if (id !== undefined && seen.has(id)) {
      rejections.push({ code: "duplicate_value_id", value_id: id, message: `${id} appears twice in the same append` });
    }
    if (id !== undefined) seen.add(id);
    const v = validateValueDeclaration(r as ValueDeclaration);
    if (!v.valid) {
      rejections.push({ code: "invalid_declaration", value_id: id, message: "declaration failed structural validation", errors: v.errors });
    }
  }
  return rejections.length === 0 ? { ok: true } : { ok: false, rejections };
}

export class ValueDeclarationRejectedError extends Error {
  readonly rejections: readonly ValueDeclarationRejection[];
  constructor(rejections: readonly ValueDeclarationRejection[]) {
    super(`value declaration rejected: ${rejections.map((r) => r.message).join("; ")}`);
    this.name = "ValueDeclarationRejectedError";
    this.rejections = rejections;
  }
}

export interface ValueDeclarationStore {
  load(): Promise<ValueDeclaration[]>;
  append(records: readonly ValueDeclaration[]): Promise<ValueDeclaration[]>;
}

export function inValueOrder(records: readonly ValueDeclaration[]): ValueDeclaration[] {
  return [...records].sort((a, b) =>
    a.created_at === b.created_at ? a.value_id.localeCompare(b.value_id) : a.created_at.localeCompare(b.created_at),
  );
}

export class InMemoryValueDeclarationStore implements ValueDeclarationStore {
  private records: ValueDeclaration[];
  constructor(bootstrap: readonly ValueDeclaration[] = []) { this.records = [...bootstrap]; }
  async load() { return inValueOrder(this.records); }
  async append(incoming: readonly ValueDeclaration[]) {
    const c = checkValueDeclarationAppend(this.records, incoming);
    if (!c.ok) throw new ValueDeclarationRejectedError(c.rejections);
    this.records = [...this.records, ...incoming];
    return [...incoming];
  }
}

export class FileSystemValueDeclarationStore implements ValueDeclarationStore {
  private readonly filePath: string;
  constructor(dataDir: string) {
    mkdirSync(dataDir, { recursive: true });
    this.filePath = join(dataDir, VALUE_DECLARATION_STORE_FILENAME);
  }
  private readStored(): ValueDeclaration[] {
    if (!existsSync(this.filePath)) return [];
    const out: ValueDeclaration[] = [];
    readFileSync(this.filePath, "utf-8").split("\n").forEach((line, i) => {
      const t = line.trim();
      if (!t) return;
      try { out.push(JSON.parse(t) as ValueDeclaration); }
      catch { throw new Error(`unparseable value declaration on line ${i + 1} of ${this.filePath}; refusing a partial log`); }
    });
    return out;
  }
  async load() { return inValueOrder(this.readStored()); }
  async append(incoming: readonly ValueDeclaration[]) {
    const stored = this.readStored();
    const c = checkValueDeclarationAppend(stored, incoming);
    if (!c.ok) throw new ValueDeclarationRejectedError(c.rejections);
    appendFileSync(this.filePath, incoming.map((r) => JSON.stringify(r)).join("\n") + "\n", "utf-8");
    return [...incoming];
  }
}
