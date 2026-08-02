/**
 * visual — the small math/colour kit behind the Living Field renderer.
 * Deterministic noise (same world every load), easing, and a curated field
 * palette. No data semantics live here; this is purely how the world looks.
 */

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
export const smoothstep = (a: number, b: number, x: number) => {
  const k = clamp((x - a) / (b - a || 1e-6), 0, 1);
  return k * k * (3 - 2 * k);
};
export const easeOutCubic = (k: number) => 1 - (1 - k) ** 3;

export function hash32(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  // FNV alone leaves neighbouring keys ("sx11", "sx12") correlated in the high
  // bits — scattered points then land on visible diagonals. Avalanche them.
  h ^= h >>> 16; h = Math.imul(h, 2246822507);
  h ^= h >>> 13; h = Math.imul(h, 3266489909);
  h ^= h >>> 16;
  return h >>> 0;
}
/** stable 0..1 from any string — used for phases, jitter, bow direction */
export const rand01 = (s: string) => hash32(s) / 4294967296;

// ── value noise (seeded once, identical every session) ──────────────────────
const P = new Uint8Array(512);
{
  const perm = new Uint8Array(256);
  for (let i = 0; i < 256; i++) perm[i] = i;
  let s = 0x9e3779b9;
  for (let i = 255; i > 0; i--) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const j = s % (i + 1);
    const tmp = perm[i]; perm[i] = perm[j]; perm[j] = tmp;
  }
  for (let i = 0; i < 512; i++) P[i] = perm[i & 255];
}
const fade = (t: number) => t * t * (3 - 2 * t);
const cell = (ix: number, iy: number) => (P[(ix + P[iy & 255]) & 255] / 255) * 2 - 1;

export function noise2(x: number, y: number) {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = fade(x - x0), fy = fade(y - y0);
  const a = cell(x0, y0), b = cell(x0 + 1, y0), c = cell(x0, y0 + 1), d = cell(x0 + 1, y0 + 1);
  return lerp(lerp(a, b, fx), lerp(c, d, fx), fy);
}
export function fbm(x: number, y: number, oct = 3) {
  let v = 0, amp = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { v += amp * noise2(x * f, y * f); f *= 2.03; amp *= 0.5; }
  return v;
}
/** divergence-free flow — what makes the field swirl instead of drift */
export function curl(x: number, y: number, e = 0.8) {
  const n1 = fbm(x, y + e), n2 = fbm(x, y - e), n3 = fbm(x + e, y), n4 = fbm(x - e, y);
  return { x: (n1 - n2) / (2 * e), y: -(n3 - n4) / (2 * e) };
}

export function rgba(hex: string, a: number) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map(c => c + c).join("") : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/**
 * Community hues stay inside one analogous family (teal → blue → violet →
 * magenta). Overlapping territories then blend toward light instead of mud —
 * the failure mode of hashing hue across the full wheel.
 */
export const FIELD_PALETTE = [
  "#2ad4c8", "#22a8e0", "#3d7bf0", "#5b6ef5", "#7a5cf0",
  "#9b53e8", "#c04fd8", "#d854b0", "#2f8fd8", "#6b62ff",
];
export const commColor = (name: string) => FIELD_PALETTE[hash32("field:" + name) % FIELD_PALETTE.length];
