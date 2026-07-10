/**
 * JsonValueRepository
 *
 * First storage adapter for ValueRepository. Reads and writes a JSON file
 * at data/values.json (project root).
 *
 * Suitable for: development, seeding, local research workflows.
 * Not suitable for: concurrent writes, production traffic, large datasets.
 *
 * To migrate to PostgreSQL: implement ValueRepository with a Prisma adapter
 * and swap the import in the consuming API route. Nothing else changes.
 */

import path from "path";
import { readJsonStore, writeJsonStore, generateId, nowIso, paginate } from "../json-store";
import type { Value, CreateValueInput, UpdateValueInput } from "./schema";
import type { ValueRepository, ValueQuery } from "./repository";

const DATA_PATH = path.join(process.cwd(), "data", "values.json");

const read = () => readJsonStore<Value>(DATA_PATH);
const write = (r: Value[]) => writeJsonStore(DATA_PATH, r);

export class JsonValueRepository implements ValueRepository {
  async create(input: CreateValueInput): Promise<Value> {
    const store = read();
    const ts = nowIso();
    const value: Value = {
      ...input,
      id: generateId("value"),
      type: "Value",
      evidenceGrade: input.evidenceGrade ?? "Candidate",
      createdAt: ts,
      updatedAt: ts,
    };
    store.push(value);
    write(store);
    return value;
  }

  async get(id: string): Promise<Value | null> {
    return read().find((v) => v.id === id) ?? null;
  }

  async update(id: string, updates: UpdateValueInput): Promise<Value> {
    const store = read();
    const idx = store.findIndex((v) => v.id === id);
    if (idx === -1) throw new Error(`Value not found: ${id}`);
    store[idx] = { ...store[idx], ...updates, updatedAt: nowIso() };
    write(store);
    return store[idx];
  }

  async delete(id: string): Promise<void> {
    const store = read();
    const idx = store.findIndex((v) => v.id === id);
    if (idx === -1) throw new Error(`Value not found: ${id}`);
    store.splice(idx, 1);
    write(store);
  }

  async search(query: ValueQuery): Promise<Value[]> {
    let results = read();

    if (query.domain !== undefined) {
      results = results.filter((v) => v.context.domain === query.domain);
    }
    if (query.evidenceGrade !== undefined) {
      results = results.filter((v) => v.evidenceGrade === query.evidenceGrade);
    }
    return paginate(results, query.offset, query.limit);
  }
}
