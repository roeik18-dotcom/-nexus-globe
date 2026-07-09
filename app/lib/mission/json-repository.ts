/**
 * JsonMissionRepository
 *
 * First storage adapter for MissionRepository. Reads and writes a JSON file
 * at data/missions.json (project root).
 *
 * Suitable for: development, seeding, local research workflows.
 * Not suitable for: concurrent writes, production traffic, large datasets.
 *
 * To migrate to PostgreSQL: implement MissionRepository with a Prisma adapter
 * and swap the import in the consuming API route. Nothing else changes.
 */

import path from "path";
import { readJsonStore, writeJsonStore, generateId, nowIso, paginate } from "../json-store";
import type { Mission, CreateMissionInput, UpdateMissionInput } from "./schema";
import type { MissionRepository, MissionQuery } from "./repository";

const DATA_PATH = path.join(process.cwd(), "data", "missions.json");

const read = () => readJsonStore<Mission>(DATA_PATH);
const write = (r: Mission[]) => writeJsonStore(DATA_PATH, r);

export class JsonMissionRepository implements MissionRepository {
  async create(input: CreateMissionInput): Promise<Mission> {
    const store = read();
    const ts = nowIso();
    const mission: Mission = {
      ...input,
      id: generateId("mission"),
      type: "Mission",
      evidenceGrade: input.evidenceGrade ?? "Candidate",
      createdAt: ts,
      updatedAt: ts,
    };
    store.push(mission);
    write(store);
    return mission;
  }

  async get(id: string): Promise<Mission | null> {
    return read().find((m) => m.id === id) ?? null;
  }

  async update(id: string, updates: UpdateMissionInput): Promise<Mission> {
    const store = read();
    const idx = store.findIndex((m) => m.id === id);
    if (idx === -1) throw new Error(`Mission not found: ${id}`);
    store[idx] = { ...store[idx], ...updates, updatedAt: nowIso() };
    write(store);
    return store[idx];
  }

  async delete(id: string): Promise<void> {
    const store = read();
    const idx = store.findIndex((m) => m.id === id);
    if (idx === -1) throw new Error(`Mission not found: ${id}`);
    store.splice(idx, 1);
    write(store);
  }

  async search(query: MissionQuery): Promise<Mission[]> {
    let results = read();

    if (query.status !== undefined) {
      results = results.filter((m) => m.state.status === query.status);
    }
    if (query.actorId !== undefined) {
      results = results.filter((m) => m.context.actor.id === query.actorId);
    }
    if (query.horizon !== undefined) {
      results = results.filter((m) => m.state.horizon === query.horizon);
    }
    if (query.requiredValueId !== undefined) {
      results = results.filter((m) =>
        (m.requiredValues ?? []).some((v) => v.valueId === query.requiredValueId)
      );
    }

    return paginate(results, query.offset, query.limit);
  }
}
