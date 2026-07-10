/**
 * JsonCapabilityRepository
 *
 * First storage adapter for CapabilityRepository. Reads and writes a JSON
 * file at data/capabilities.json (project root).
 *
 * Suitable for: development, seeding, local research workflows.
 * Not suitable for: concurrent writes, production traffic, large datasets.
 *
 * To migrate to PostgreSQL: implement CapabilityRepository with a Prisma
 * adapter and swap the import in the consuming API route. Nothing else changes.
 */

import path from "path";
import { readJsonStore, writeJsonStore, generateId, nowIso, paginate } from "../json-store";
import type { Capability, CreateCapabilityInput, UpdateCapabilityInput } from "./schema";
import type { CapabilityRepository, CapabilityQuery } from "./repository";

const DATA_PATH = path.join(process.cwd(), "data", "capabilities.json");

const read = () => readJsonStore<Capability>(DATA_PATH);
const write = (r: Capability[]) => writeJsonStore(DATA_PATH, r);

export class JsonCapabilityRepository implements CapabilityRepository {
  async create(input: CreateCapabilityInput): Promise<Capability> {
    const store = read();
    const ts = nowIso();
    const capability: Capability = {
      ...input,
      id: generateId("cap"),
      type: "Capability",
      evidenceGrade: input.evidenceGrade ?? "Candidate",
      createdAt: ts,
      updatedAt: ts,
    };
    store.push(capability);
    write(store);
    return capability;
  }

  async get(id: string): Promise<Capability | null> {
    return read().find((c) => c.id === id) ?? null;
  }

  async update(id: string, updates: UpdateCapabilityInput): Promise<Capability> {
    const store = read();
    const idx = store.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error(`Capability not found: ${id}`);
    store[idx] = { ...store[idx], ...updates, updatedAt: nowIso() };
    write(store);
    return store[idx];
  }

  async delete(id: string): Promise<void> {
    const store = read();
    const idx = store.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error(`Capability not found: ${id}`);
    store.splice(idx, 1);
    write(store);
  }

  async search(query: CapabilityQuery): Promise<Capability[]> {
    let results = read();

    if (query.domain !== undefined) {
      results = results.filter((c) => c.context.domain === query.domain);
    }
    if (query.evidenceGrade !== undefined) {
      results = results.filter((c) => c.evidenceGrade === query.evidenceGrade);
    }
    if (query.providerId !== undefined) {
      results = results.filter((c) =>
        (c.providers ?? []).some((p) => p.providerId === query.providerId)
      );
    }

    return paginate(results, query.offset, query.limit);
  }
}
