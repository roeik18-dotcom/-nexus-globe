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

import fs from "fs";
import path from "path";
import type {
  Mission,
  CreateMissionInput,
  UpdateMissionInput,
} from "./schema";
import type { MissionRepository, MissionQuery } from "./repository";

const DATA_PATH = path.join(process.cwd(), "data", "missions.json");

// ─── File helpers ─────────────────────────────────────────────────────────────

function readStore(): Mission[] {
  if (!fs.existsSync(DATA_PATH)) return [];
  const raw = fs.readFileSync(DATA_PATH, "utf-8").trim();
  if (!raw || raw === "") return [];
  return JSON.parse(raw) as Mission[];
}

function writeStore(records: Mission[]): void {
  fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
  fs.writeFileSync(DATA_PATH, JSON.stringify(records, null, 2) + "\n", "utf-8");
}

function generateId(): string {
  return `mission_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function now(): string {
  return new Date().toISOString();
}

// ─── Implementation ───────────────────────────────────────────────────────────

export class JsonMissionRepository implements MissionRepository {
  async create(input: CreateMissionInput): Promise<Mission> {
    const store = readStore();
    const ts = now();
    const mission: Mission = {
      ...input,
      id: generateId(),
      type: "Mission",
      evidenceGrade: input.evidenceGrade ?? "Candidate",
      createdAt: ts,
      updatedAt: ts,
    };
    store.push(mission);
    writeStore(store);
    return mission;
  }

  async get(id: string): Promise<Mission | null> {
    const store = readStore();
    return store.find((m) => m.id === id) ?? null;
  }

  async update(id: string, updates: UpdateMissionInput): Promise<Mission> {
    const store = readStore();
    const idx = store.findIndex((m) => m.id === id);
    if (idx === -1) throw new Error(`Mission not found: ${id}`);
    const updated: Mission = {
      ...store[idx],
      ...updates,
      id,
      type: "Mission",
      createdAt: store[idx].createdAt,
      updatedAt: now(),
    };
    store[idx] = updated;
    writeStore(store);
    return updated;
  }

  async delete(id: string): Promise<void> {
    const store = readStore();
    const idx = store.findIndex((m) => m.id === id);
    if (idx === -1) throw new Error(`Mission not found: ${id}`);
    store.splice(idx, 1);
    writeStore(store);
  }

  async search(query: MissionQuery): Promise<Mission[]> {
    let results = readStore();

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
        m.requiredValues.some((v) => v.valueId === query.requiredValueId)
      );
    }

    const offset = query.offset ?? 0;
    const limit = query.limit ?? 50;
    return results.slice(offset, offset + limit);
  }
}
