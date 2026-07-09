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

import fs from "fs";
import path from "path";
import type { Gap, CreateGapInput, UpdateGapInput } from "./schema";
import type { GapRepository, GapQuery } from "./repository";

const DATA_PATH = path.join(process.cwd(), "data", "gaps.json");

// ─── File helpers ─────────────────────────────────────────────────────────────

function readStore(): Gap[] {
  if (!fs.existsSync(DATA_PATH)) return [];
  const raw = fs.readFileSync(DATA_PATH, "utf-8").trim();
  if (!raw || raw === "") return [];
  return JSON.parse(raw) as Gap[];
}

function writeStore(records: Gap[]): void {
  fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
  fs.writeFileSync(DATA_PATH, JSON.stringify(records, null, 2) + "\n", "utf-8");
}

function generateId(): string {
  return `gap_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function now(): string {
  return new Date().toISOString();
}

// ─── Implementation ───────────────────────────────────────────────────────────

export class JsonGapRepository implements GapRepository {
  async create(input: CreateGapInput): Promise<Gap> {
    const store = readStore();
    const ts = now();
    const gap: Gap = {
      ...input,
      id: generateId(),
      type: "Gap",
      evidenceGrade: input.evidenceGrade ?? "Candidate",
      createdAt: ts,
      updatedAt: ts,
    };
    store.push(gap);
    writeStore(store);
    return gap;
  }

  async get(id: string): Promise<Gap | null> {
    const store = readStore();
    return store.find((g) => g.id === id) ?? null;
  }

  async update(id: string, updates: UpdateGapInput): Promise<Gap> {
    const store = readStore();
    const idx = store.findIndex((g) => g.id === id);
    if (idx === -1) throw new Error(`Gap not found: ${id}`);
    const updated: Gap = {
      ...store[idx],
      ...updates,
      id,
      type: "Gap",
      createdAt: store[idx].createdAt,
      updatedAt: now(),
    };
    store[idx] = updated;
    writeStore(store);
    return updated;
  }

  async delete(id: string): Promise<void> {
    const store = readStore();
    const idx = store.findIndex((g) => g.id === id);
    if (idx === -1) throw new Error(`Gap not found: ${id}`);
    store.splice(idx, 1);
    writeStore(store);
  }

  async search(query: GapQuery): Promise<Gap[]> {
    let results = readStore();

    if (query.missionId !== undefined) {
      results = results.filter((g) => g.context.missionId === query.missionId);
    }
    if (query.status !== undefined) {
      results = results.filter((g) => g.state.status === query.status);
    }
    if (query.requiredValueId !== undefined) {
      results = results.filter((g) =>
        g.requiredValues.some((v) => v.valueId === query.requiredValueId)
      );
    }

    const offset = query.offset ?? 0;
    const limit = query.limit ?? 50;
    return results.slice(offset, offset + limit);
  }
}
