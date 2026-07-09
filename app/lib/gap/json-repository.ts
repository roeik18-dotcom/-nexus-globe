/**
 * JsonGapRepository
 *
 * First storage adapter for GapRepository. Reads and writes a JSON file
 * at data/gaps.json (project root).
 *
 * Suitable for: development, seeding, local research workflows.
 * Not suitable for: concurrent writes, production traffic, large datasets.
 *
 * To migrate to PostgreSQL: implement GapRepository with a Prisma adapter
 * and swap the import in the consuming API route. Nothing else changes.
 */

import path from "path";
import { readJsonStore, writeJsonStore, generateId, nowIso, paginate } from "../json-store";
import type { Gap, CreateGapInput, UpdateGapInput } from "./schema";
import type { GapRepository, GapQuery } from "./repository";

const DATA_PATH = path.join(process.cwd(), "data", "gaps.json");

const read = () => readJsonStore<Gap>(DATA_PATH);
const write = (r: Gap[]) => writeJsonStore(DATA_PATH, r);

export class JsonGapRepository implements GapRepository {
  async create(input: CreateGapInput): Promise<Gap> {
    const store = read();
    const ts = nowIso();
    const gap: Gap = {
      ...input,
      id: generateId("gap"),
      type: "Gap",
      evidenceGrade: input.evidenceGrade ?? "Candidate",
      createdAt: ts,
      updatedAt: ts,
    };
    store.push(gap);
    write(store);
    return gap;
  }

  async get(id: string): Promise<Gap | null> {
    return read().find((g) => g.id === id) ?? null;
  }

  async update(id: string, updates: UpdateGapInput): Promise<Gap> {
    const store = read();
    const idx = store.findIndex((g) => g.id === id);
    if (idx === -1) throw new Error(`Gap not found: ${id}`);
    store[idx] = { ...store[idx], ...updates, updatedAt: nowIso() };
    write(store);
    return store[idx];
  }

  async delete(id: string): Promise<void> {
    const store = read();
    const idx = store.findIndex((g) => g.id === id);
    if (idx === -1) throw new Error(`Gap not found: ${id}`);
    store.splice(idx, 1);
    write(store);
  }

  async search(query: GapQuery): Promise<Gap[]> {
    let results = read();

    if (query.missionId !== undefined) {
      results = results.filter((g) => g.context.missionId === query.missionId);
    }
    if (query.status !== undefined) {
      results = results.filter((g) => g.state.status === query.status);
    }
    if (query.requiredValueId !== undefined) {
      results = results.filter((g) =>
        (g.requiredValues ?? []).some((v) => v.valueId === query.requiredValueId)
      );
    }

    return paginate(results, query.offset, query.limit);
  }
}
