// PHILOS NEXUS — user profile (personal anchor)

import type { DominantForce } from "./philos";

export type Gender = "m" | "f" | "x";

export type BaseValues = {
  emotional: number; // 0..10
  rational:  number;
  physical:  number;
  ego:       number;
  social:    number;
  id:        number;
};

// numeric conflict axes — 0..1 where 0 = full left side, 1 = full right side
export type ConflictBars = {
  emotion_logic:       number; // 0 emotion ←→ 1 logic
  ego_social:          number; // 0 ego ←→ 1 social
  action_avoidance:    number; // 0 avoidance ←→ 1 action
  personal_collective: number; // 0 personal ←→ 1 collective
};

export type UserProfile = {
  id: string;
  name: string;
  age: number;
  gender: Gender;

  location: string;        // free-text city/country
  lat: number;
  lng: number;

  baseValues: BaseValues;

  personalVsSocial: number;   // -10 (fully personal) .. +10 (fully social)
  growthCoefficient: number;  // -1 .. +1

  personalBase: string;       // free text: "what anchors you"
  socialRole:   string;       // free text: "role in your community"
  coreConflicts: string[];    // free tags
  conflictBars: ConflictBars; // numeric axes

  createdAt: number;
  updatedAt: number;
};

const KEY = "philos.profile";

export function loadProfile(): UserProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as UserProfile;
  } catch {
    return null;
  }
}

export function saveProfile(p: UserProfile) {
  localStorage.setItem(KEY, JSON.stringify(p));
}

export function clearProfile() {
  localStorage.removeItem(KEY);
}

export function emptyBaseValues(): BaseValues {
  return { emotional: 5, rational: 5, physical: 5, ego: 5, social: 5, id: 5 };
}

export function emptyConflictBars(): ConflictBars {
  return { emotion_logic: 0.5, ego_social: 0.5, action_avoidance: 0.5, personal_collective: 0.5 };
}

export function newProfile(): UserProfile {
  return {
    id: (globalThis.crypto?.randomUUID?.() ?? String(Date.now() + Math.random())),
    name: "",
    age: 30,
    gender: "x",
    location: "",
    lat: 32.0853,
    lng: 34.7818,
    baseValues: emptyBaseValues(),
    personalVsSocial: 0,
    growthCoefficient: 0.2,
    personalBase: "",
    socialRole: "",
    coreConflicts: [],
    conflictBars: emptyConflictBars(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/** strongest force in baseValues */
export function dominantBaseForce(p: UserProfile): DominantForce {
  const entries = Object.entries(p.baseValues) as [DominantForce, number][];
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0];
}
