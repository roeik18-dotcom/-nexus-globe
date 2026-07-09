// Smoke-test: read all Value records through data/values.json
// Run with: node scripts/read-value.mjs
import { readFileSync } from "fs";
import { join } from "path";

const records = JSON.parse(
  readFileSync(join(process.cwd(), "data/values.json"), "utf-8")
);

const VALID_GRADES = ["Frozen", "Candidate", "Placeholder", "Not established"];
const VALID_SIGNALS = ["Intent", "Behavior", "Outcomes"];
const EXPECTED_IDS = [
  "capital", "trust", "knowledge", "creativity", "community",
  "growth", "health", "justice", "learning", "security", "execution", "care",
];

// IDs referenced by missions.json
const MISSION_VALUE_IDS = ["capital", "creativity", "community", "knowledge", "trust", "growth"];
// IDs referenced by gaps.json
const GAP_VALUE_IDS = ["capital", "trust", "knowledge", "community", "growth", "creativity"];

let pass = true;

function check(label, ok) {
  console.log(`${ok ? "✓" : "✗"} ${label}`);
  if (!ok) pass = false;
}

// ─── Top-level checks ────────────────────────────────────────────────────────

check("store is array",                  Array.isArray(records));
check("exactly 12 value records",        records.length === 12);
check("all 12 expected IDs present",     EXPECTED_IDS.every(id => records.some(r => r.id === id)));
check("all mission-referenced IDs live", MISSION_VALUE_IDS.every(id => records.some(r => r.id === id)));
check("all gap-referenced IDs live",     GAP_VALUE_IDS.every(id => records.some(r => r.id === id)));

// ─── Per-record checks ───────────────────────────────────────────────────────

for (const r of records) {
  const p = r.id;

  check(`${p} — type = Value`,          r.type === "Value");
  check(`${p} — evidenceGrade valid`,   VALID_GRADES.includes(r.evidenceGrade));
  check(`${p} — createdAt present`,     typeof r.createdAt === "string" && r.createdAt.length > 0);
  check(`${p} — updatedAt present`,     typeof r.updatedAt === "string" && r.updatedAt.length > 0);

  check(`${p} — context.label`,         typeof r.context?.label === "string" && r.context.label.length > 0);
  check(`${p} — context.description`,   typeof r.context?.description === "string" && r.context.description.length > 0);

  check(`${p} — capabilities is array`, Array.isArray(r.capabilities));
  check(`${p} — capabilities ids only`, r.capabilities.every(
    c => Object.keys(c).length === 1 && typeof c.capabilityId === "string"
  ));

  check(`${p} — evidence signal valid`, Array.isArray(r.evidence) &&
    r.evidence.every(e => VALID_SIGNALS.includes(e.signal)));

  // Value must NOT contain Gap, Mission, or Provider data
  check(`${p} — no gaps`,           r.gaps === undefined);
  check(`${p} — no missions`,       r.missions === undefined);
  check(`${p} — no providers`,      r.providers === undefined);
  check(`${p} — no actor`,          r.actor === undefined);
}

console.log(`\n${pass ? "PASS — all value records valid" : "FAIL — see ✗ above"}`);
if (!pass) process.exit(1);
