/**
 * JsonValueCapabilityRelationRepository
 *
 * First storage adapter for ValueCapabilityRelationRepository. Reads and writes
 * a JSON file at data/value-capability-relations.json (project root).
 *
 * Suitable for: development, seeding, local research workflows.
 * Not suitable for: concurrent writes, production traffic, large datasets.
 *
 * To migrate to PostgreSQL: implement ValueCapabilityRelationRepository with a
 * Prisma adapter and swap the import in the consuming code. Nothing else changes.
 */

import path from "path";
import { readJsonStore, writeJsonStore, generateId, nowIso, paginate } from "../json-store";
import type {
  ValueCapabilityRelation,
  CreateRelationInput,
  UpdateRelationInput,
} from "./schema";
import type { ValueCapabilityRelationRepository, RelationQuery } from "./repository";

const DATA_PATH = path.join(process.cwd(), "data", "value-capability-relations.json");

const read = () => readJsonStore<ValueCapabilityRelation>(DATA_PATH);
const write = (r: ValueCapabilityRelation[]) => writeJsonStore(DATA_PATH, r);

export class JsonValueCapabilityRelationRepository
  implements ValueCapabilityRelationRepository
{
  async create(input: CreateRelationInput): Promise<ValueCapabilityRelation> {
    const store = read();
    const ts = nowIso();
    const relation: ValueCapabilityRelation = {
      ...input,
      id: generateId("vcr"),
      type: "ValueCapabilityRelation",
      evidenceGrade: input.evidenceGrade ?? "Candidate",
      createdAt: ts,
      updatedAt: ts,
    };
    store.push(relation);
    write(store);
    return relation;
  }

  async get(id: string): Promise<ValueCapabilityRelation | null> {
    return read().find((r) => r.id === id) ?? null;
  }

  async update(id: string, updates: UpdateRelationInput): Promise<ValueCapabilityRelation> {
    const store = read();
    const idx = store.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error(`ValueCapabilityRelation not found: ${id}`);
    store[idx] = { ...store[idx], ...updates, updatedAt: nowIso() };
    write(store);
    return store[idx];
  }

  async delete(id: string): Promise<void> {
    const store = read();
    const idx = store.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error(`ValueCapabilityRelation not found: ${id}`);
    store.splice(idx, 1);
    write(store);
  }

  async search(query: RelationQuery): Promise<ValueCapabilityRelation[]> {
    let results = read();

    if (query.valueId !== undefined)
      results = results.filter((r) => r.valueId === query.valueId);
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
