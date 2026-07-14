/**
 * JsonProviderCapabilityRelationRepository
 *
 * First storage adapter for ProviderCapabilityRelationRepository. Reads and
 * writes a JSON file at data/provider-capability-relations.json (project root).
 *
 * Suitable for: development, seeding, local research workflows.
 * Not suitable for: concurrent writes, production traffic, large datasets.
 *
 * To migrate to PostgreSQL: implement ProviderCapabilityRelationRepository with
 * a Prisma adapter and swap the import in consuming code. Nothing else changes.
 */

import path from "path";
import { readJsonStore, writeJsonStore, generateId, nowIso, paginate } from "../json-store";
import type {
  ProviderCapabilityRelation,
  CreatePcrInput,
  UpdatePcrInput,
} from "./schema";
import type { ProviderCapabilityRelationRepository, PcrQuery } from "./repository";

const DATA_PATH = path.join(process.cwd(), "data", "provider-capability-relations.json");

const read = () => readJsonStore<ProviderCapabilityRelation>(DATA_PATH);
const write = (r: ProviderCapabilityRelation[]) => writeJsonStore(DATA_PATH, r);

export class JsonProviderCapabilityRelationRepository
  implements ProviderCapabilityRelationRepository
{
  async create(input: CreatePcrInput): Promise<ProviderCapabilityRelation> {
    const store = read();
    const ts = nowIso();
    const relation: ProviderCapabilityRelation = {
      ...input,
      id: generateId("pcr"),
      type: "ProviderCapabilityRelation",
      evidenceGrade: input.evidenceGrade ?? "Candidate",
      createdAt: ts,
      updatedAt: ts,
    };
    store.push(relation);
    write(store);
    return relation;
  }

  async get(id: string): Promise<ProviderCapabilityRelation | null> {
    return read().find((r) => r.id === id) ?? null;
  }

  async update(id: string, updates: UpdatePcrInput): Promise<ProviderCapabilityRelation> {
    const store = read();
    const idx = store.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error(`ProviderCapabilityRelation not found: ${id}`);
    store[idx] = { ...store[idx], ...updates, updatedAt: nowIso() };
    write(store);
    return store[idx];
  }

  async delete(id: string): Promise<void> {
    const store = read();
    const idx = store.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error(`ProviderCapabilityRelation not found: ${id}`);
    store.splice(idx, 1);
    write(store);
  }

  async search(query: PcrQuery): Promise<ProviderCapabilityRelation[]> {
    let results = read();

    if (query.providerId !== undefined)
      results = results.filter((r) => r.providerId === query.providerId);
    if (query.capabilityId !== undefined)
      results = results.filter((r) => r.capabilityId === query.capabilityId);
    if (query.missionId !== undefined)
      results = results.filter((r) => r.missionId === query.missionId);
    if (query.gapId !== undefined)
      results = results.filter((r) => r.gapId === query.gapId);
    if (query.relationType !== undefined)
      results = results.filter((r) => r.relationType === query.relationType);
    if (query.status !== undefined)
      results = results.filter((r) => r.status === query.status);
    if (query.evidenceGrade !== undefined)
      results = results.filter((r) => r.evidenceGrade === query.evidenceGrade);

    return paginate(results, query.offset, query.limit);
  }
}
