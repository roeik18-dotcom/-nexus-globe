// Smoke-test: read all Gap records through data/gaps.json
// Run with: node --experimental-vm-modules scripts/read-gap.mjs
import { readFileSync } from "fs";
import { join } from "path";

const records = JSON.parse(
  readFileSync(join(process.cwd(), "data/gaps.json"), "utf-8")
);

const VALID_GRADES = ["Frozen", "Candidate", "Placeholder", "Not established"];
const VALID_SIGNALS = ["Intent", "Behavior", "Outcomes"];
const VALID_STATUS = ["open", "closed", "deferred"];
const VALID_SEVERITY = ["critical", "significant", "moderate", "minor", null];
const MISSION_ID = "mission_1751000000000_f3a9k2b";
const EXPECTED_IDS = [
  "gap_capital_seed_001",
  "gap_supply_chain_001",
  "gap_community_launch_001",
  "gap_brand_creative_001",
];

let pass = true;

function check(label, ok) {
  console.log(`${ok ? "✓" : "✗"} ${label}`);
  if (!ok) pass = false;
}

// ─── Top-level checks ────────────────────────────────────────────────────────

check("store is array",            Array.isArray(records));
check("exactly 4 gap records",     records.length === 4);
check("all expected IDs present",  EXPECTED_IDS.every(id => records.some(r => r.id === id)));

// ─── Per-record checks ───────────────────────────────────────────────────────

for (const r of records) {
  const prefix = r.id;

  check(`${prefix} — type = Gap`,           r.type === "Gap");
  check(`${prefix} — evidenceGrade valid`,  VALID_GRADES.includes(r.evidenceGrade));
  check(`${prefix} — createdAt present`,    typeof r.createdAt === "string" && r.createdAt.length > 0);
  check(`${prefix} — updatedAt present`,    typeof r.updatedAt === "string" && r.updatedAt.length > 0);

  check(`${prefix} — state.status valid`,   VALID_STATUS.includes(r.state?.status));
  check(`${prefix} — state.severity valid`, VALID_SEVERITY.includes(r.state?.severity));

  check(`${prefix} — context.missionId`,    r.context?.missionId === MISSION_ID);
  check(`${prefix} — context.description`,  typeof r.context?.description === "string" && r.context.description.length > 0);

  check(`${prefix} — requiredValues = ids only`,
    Array.isArray(r.requiredValues) &&
    r.requiredValues.length > 0 &&
    r.requiredValues.every(v => Object.keys(v).length === 1 && typeof v.valueId === "string")
  );

  check(`${prefix} — evidence signal valid`,
    Array.isArray(r.evidence) &&
    r.evidence.every(e => VALID_SIGNALS.includes(e.signal))
  );

  check(`${prefix} — timeline present`,     r.timeline !== undefined);
  check(`${prefix} — timeline.openedAt`,    typeof r.timeline?.openedAt === "string");

  // Gap must NOT contain Mission data or capability/provider refs
  check(`${prefix} — no missionStatement`,  r.missionStatement === undefined);
  check(`${prefix} — no actor`,             r.actor === undefined);
  check(`${prefix} — no capabilities`,      r.capabilities === undefined);
  check(`${prefix} — no providers`,         r.providers === undefined);
}

console.log(`\n${pass ? "PASS — all gap records valid" : "FAIL — see ✗ above"}`);
if (!pass) process.exit(1);
