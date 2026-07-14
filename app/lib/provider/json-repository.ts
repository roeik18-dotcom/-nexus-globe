/**
 * JsonProviderRepository
 *
 * First storage adapter for ProviderRepository. Reads and writes a JSON
 * file at data/providers.json (project root).
 *
 * Suitable for: development, seeding, local research workflows.
 * Not suitable for: concurrent writes, production traffic, large datasets.
 *
 * To migrate to PostgreSQL: implement ProviderRepository with a Prisma
 * adapter and swap the import in the consuming API route. Nothing else changes.
 */

import path from "path";
import { readJsonStore, writeJsonStore, generateId, nowIso, paginate } from "../json-store";
import type { Provider, CreateProviderInput, UpdateProviderInput } from "./schema";
import type { ProviderRepository, ProviderQuery } from "./repository";

const DATA_PATH = path.join(process.cwd(), "data", "providers.json");

const read = () => readJsonStore<Provider>(DATA_PATH);
const write = (r: Provider[]) => writeJsonStore(DATA_PATH, r);

export class JsonProviderRepository implements ProviderRepository {
  async create(input: CreateProviderInput): Promise<Provider> {
    const store = read();
    const ts = nowIso();
    const provider: Provider = {
      ...input,
      id: generateId("prov"),
      type: "Provider",
      evidenceGrade: input.evidenceGrade ?? "Candidate",
      createdAt: ts,
      updatedAt: ts,
    };
    store.push(provider);
    write(store);
    return provider;
  }

  async get(id: string): Promise<Provider | null> {
    return read().find((p) => p.id === id) ?? null;
  }

  async update(id: string, updates: UpdateProviderInput): Promise<Provider> {
    const store = read();
    const idx = store.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error(`Provider not found: ${id}`);
    store[idx] = { ...store[idx], ...updates, updatedAt: nowIso() };
    write(store);
    return store[idx];
  }

  async delete(id: string): Promise<void> {
    const store = read();
    const idx = store.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error(`Provider not found: ${id}`);
    store.splice(idx, 1);
    write(store);
  }

  async search(query: ProviderQuery): Promise<Provider[]> {
    let results = read();

    if (query.domain !== undefined)
      results = results.filter((p) => p.context.domain === query.domain);
    if (query.providerType !== undefined)
      results = results.filter((p) => p.context.providerType === query.providerType);
    if (query.evidenceGrade !== undefined)
      results = results.filter((p) => p.evidenceGrade === query.evidenceGrade);

    return paginate(results, query.offset, query.limit);
  }
}
