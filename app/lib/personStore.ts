/**
 * Nexus — Raw Data Layer · L1 Person store.
 *
 * The thinnest real slice of the Raw Data Layer: a Person entity persisted in
 * localStorage. Facts only (profile-level) — no graph, no orientation, no
 * scores, no backend, no server. Browser-safe (SSR-guarded). Does not touch the
 * Noa chain or computeNoaChain.
 *
 * Storage:
 *   nexus.persons.v1          → { [id]: Person }
 *   nexus.currentPersonId.v1  → string (the active person's id)
 *
 * Privacy: stores only profile-level facts (name, location, languages, values,
 * needs, skills). Never store sensitive medical/legal/private details here.
 */

export interface Person {
  id: string;
  name: string;
  country: string;
  city: string;
  languages: string[];
  values: string[];
  primaryValue: string;
  needs: string[];
  skills: string[];
  // Current dimension scores (0–100). V1/approximate — derived from intake, not
  // measured. Higher = more resourced; lower = where support is most needed.
  physical: number;
  emotional: number;
  rational: number;
  // Raw intake answers (the L2 seed for this person), or null if not from intake.
  intake: PersonIntake | null;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

/** Raw intake answers — selection only, fed into the existing chain (no new engine). */
export interface PersonIntake {
  tensionDept: string; // Q1 — where it hurts most (one of the 6 departments)
  needDim: string;     // Q2 — what they most need (Physical | Emotional | Rational)
  values: string[];    // Q3 — chosen core values
}

/** Input to create a person — `values` is the one required field (value-based identity). */
export interface PersonInput {
  name?: string;
  country?: string;
  city?: string;
  languages?: string[];
  values: string[];
  primaryValue?: string;
  needs?: string[];
  skills?: string[];
  physical?: number;
  emotional?: number;
  rational?: number;
  intake?: PersonIntake | null;
}

const PERSONS_KEY = "nexus.persons.v1";
const CURRENT_KEY = "nexus.currentPersonId.v1";

// ── browser-safe storage access (returns null on server / when unavailable) ──
function ls(): Storage | null {
  if (typeof window === "undefined") return null;
  try { return window.localStorage; } catch { return null; }
}
function readAll(): Record<string, Person> {
  const s = ls(); if (!s) return {};
  try {
    const raw = s.getItem(PERSONS_KEY);
    if (!raw) return {};
    const map = JSON.parse(raw) as Record<string, Partial<Person>>;
    // Backward-compat: fill fields added after a person was first stored.
    const out: Record<string, Person> = {};
    for (const [id, p] of Object.entries(map)) out[id] = normalize(p);
    return out;
  } catch { return {}; }
}
function writeAll(map: Record<string, Person>): void {
  const s = ls(); if (!s) return;
  try { s.setItem(PERSONS_KEY, JSON.stringify(map)); } catch { /* quota / disabled */ }
}
function setCurrentId(id: string): void {
  const s = ls(); if (!s) return;
  try { s.setItem(CURRENT_KEY, id); } catch { /* ignore */ }
}

function genId(): string {
  const c = (typeof crypto !== "undefined" && "randomUUID" in crypto)
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  return `person_${c}`;
}
function nowISO(): string { return new Date().toISOString(); }
function dedupe(a: string[]): string[] { return [...new Set(a)]; }

/** Neutral default when a dimension score is unknown. */
const DEFAULT_SCORE = 50;
function clampScore(n: number | undefined, fallback = DEFAULT_SCORE): number {
  if (typeof n !== "number" || Number.isNaN(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Fill any fields missing from an older stored record (non-destructive). */
function normalize(p: Partial<Person>): Person {
  const values = Array.isArray(p.values) && p.values.length ? dedupe(p.values) : [];
  return {
    id: p.id ?? genId(),
    name: p.name ?? "Anonymous",
    country: p.country ?? "",
    city: p.city ?? "",
    languages: p.languages ?? [],
    values,
    primaryValue: p.primaryValue && values.includes(p.primaryValue) ? p.primaryValue : (values[0] ?? ""),
    needs: p.needs ?? [],
    skills: p.skills ?? [],
    physical: clampScore(p.physical),
    emotional: clampScore(p.emotional),
    rational: clampScore(p.rational),
    intake: p.intake ?? null,
    createdAt: p.createdAt ?? nowISO(),
    updatedAt: p.updatedAt ?? p.createdAt ?? nowISO(),
  };
}

/** Create a Person, persist it, and set it as the current person. */
export function createPerson(input: PersonInput): Person {
  if (!input || !Array.isArray(input.values) || input.values.length === 0) {
    throw new Error("createPerson: at least one value is required");
  }
  const values = dedupe(input.values);
  const ts = nowISO();
  const person: Person = {
    id: genId(),
    name: (input.name ?? "").trim() || "Anonymous",
    country: input.country ?? "",
    city: input.city ?? "",
    languages: input.languages ?? [],
    values,
    primaryValue: input.primaryValue && values.includes(input.primaryValue) ? input.primaryValue : values[0],
    needs: input.needs ?? [],
    skills: input.skills ?? [],
    physical: clampScore(input.physical),
    emotional: clampScore(input.emotional),
    rational: clampScore(input.rational),
    intake: input.intake ?? null,
    createdAt: ts,
    updatedAt: ts,
  };
  const map = readAll();
  map[person.id] = person;
  writeAll(map);
  setCurrentId(person.id);
  return person;
}

/** Look up a person by id, or null. */
export function getPerson(id: string): Person | null {
  return readAll()[id] ?? null;
}

/** The current (active) person, or null. */
export function getCurrentPerson(): Person | null {
  const s = ls(); if (!s) return null;
  let id: string | null = null;
  try { id = s.getItem(CURRENT_KEY); } catch { return null; }
  return id ? getPerson(id) : null;
}

/** Patch an existing person (keeps id/createdAt; bumps updatedAt). Returns null if not found. */
export function updatePerson(id: string, patch: Partial<PersonInput>): Person | null {
  const map = readAll();
  const cur = map[id];
  if (!cur) return null;
  const values = patch.values ? dedupe(patch.values) : cur.values;
  let primaryValue = patch.primaryValue ?? cur.primaryValue;
  if (!values.includes(primaryValue)) primaryValue = values[0] ?? "";
  const next: Person = {
    ...cur,
    name: patch.name !== undefined ? (patch.name.trim() || cur.name) : cur.name,
    country: patch.country ?? cur.country,
    city: patch.city ?? cur.city,
    languages: patch.languages ?? cur.languages,
    values,
    primaryValue,
    needs: patch.needs ?? cur.needs,
    skills: patch.skills ?? cur.skills,
    physical: patch.physical !== undefined ? clampScore(patch.physical) : cur.physical,
    emotional: patch.emotional !== undefined ? clampScore(patch.emotional) : cur.emotional,
    rational: patch.rational !== undefined ? clampScore(patch.rational) : cur.rational,
    intake: patch.intake !== undefined ? patch.intake : cur.intake,
    updatedAt: nowISO(),
  };
  map[id] = next;
  writeAll(map);
  return next;
}

/** Remove a person; clears the current pointer if it referenced them. */
export function clearPerson(id: string): void {
  const map = readAll();
  if (map[id]) { delete map[id]; writeAll(map); }
  const s = ls(); if (!s) return;
  try { if (s.getItem(CURRENT_KEY) === id) s.removeItem(CURRENT_KEY); } catch { /* ignore */ }
}

/** All persons, oldest first. */
export function listPersons(): Person[] {
  return Object.values(readAll()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
