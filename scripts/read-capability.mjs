// Smoke-test: read all Capability records through data/capabilities.json
// Run with: node scripts/read-capability.mjs
import { readFileSync } from "fs";
import { join } from "path";

const records = JSON.parse(
  readFileSync(join(process.cwd(), "data/capabilities.json"), "utf-8")
);

const VALID_GRADES   = ["Frozen", "Candidate", "Placeholder", "Not established"];
const VALID_SIGNALS  = ["Intent", "Behavior", "Outcomes"];
const VALID_MATURITY = ["emerging", "established", "proven"];

// IDs that must exist in values.json for cross-reference integrity
const VALUE_IDS_REFERENCED = [
  "capital", "trust", "knowledge", "execution",
  "community", "growth", "creativity",
];

// IDs that must exist in capabilities.json
const EXPECTED_IDS = [
  "cap_seed_funding_001",
  "cap_supply_chain_sourcing_001",
  "cap_community_growth_ops_001",
  "cap_brand_creative_direction_001",
];

let pass = true;

function check(label, ok) {
  console.log(`${ok ? "✓" : "✗"} ${label}`);
  if (!ok) pass = false;
}

// ─── Top-level checks ────────────────────────────────────────────────────────

check("store is array",                Array.isArray(records));
check("exactly 4 capability records",  records.length === 4);
check("all 4 expected IDs present",    EXPECTED_IDS.every(id => records.some(r => r.id === id)));

// ─── Cross-reference: every valueId referenced exists in values.json ─────────

const values = JSON.parse(
  readFileSync(join(process.cwd(), "data/values.json"), "utf-8")
);
const valueIdSet = new Set(values.map(v => v.id));

const allReferencedValueIds = records.flatMap(r => (r.addressesValues ?? []).map(v => v.valueId));
check(
  "all referenced valueIds exist in values.json",
  allReferencedValueIds.every(id => valueIdSet.has(id))
);
check(
  "all expected value IDs are referenced across capabilities",
  VALUE_IDS_REFERENCED.every(id => allReferencedValueIds.includes(id))
);

// ─── Per-record checks ───────────────────────────────────────────────────────

for (const r of records) {
  const p = r.id;

  check(`${p} — type = Capability`,         r.type === "Capability");
  check(`${p} — evidenceGrade valid`,        VALID_GRADES.includes(r.evidenceGrade));
  check(`${p} — createdAt present`,          typeof r.createdAt === "string" && r.createdAt.length > 0);
  check(`${p} — updatedAt present`,          typeof r.updatedAt === "string" && r.updatedAt.length > 0);

  check(`${p} — context.label`,              typeof r.context?.label === "string" && r.context.label.length > 0);
  check(`${p} — context.description`,        typeof r.context?.description === "string" && r.context.description.length > 0);
  check(`${p} — context.maturity valid`,     r.context?.maturity === null || VALID_MATURITY.includes(r.context?.maturity));

  check(`${p} — addressesValues is array`,   Array.isArray(r.addressesValues));
  check(`${p} — addressesValues non-empty`,  r.addressesValues.length > 0);
  check(`${p} — addressesValues ids only`,   r.addressesValues.every(
    v => Object.keys(v).length === 1 && typeof v.valueId === "string"
  ));

  check(`${p} — providers is array`,         Array.isArray(r.providers));
  check(`${p} — providers ids only`,         r.providers.every(
    p => Object.keys(p).length === 1 && typeof p.providerId === "string"
  ));

  check(`${p} — evidence signal valid`,      Array.isArray(r.evidence) &&
    r.evidence.every(e => VALID_SIGNALS.includes(e.signal)));

  // Capability must NOT contain Gap, Mission, or Provider-owned data
  check(`${p} — no gaps`,      r.gaps === undefined);
  check(`${p} — no missions`,  r.missions === undefined);
  check(`${p} — no actor`,     r.actor === undefined);
  check(`${p} — no missionId`, r.missionId === undefined);
}

console.log(`\n${pass ? "PASS — all capability records valid" : "FAIL — see ✗ above"}`);
if (!pass) process.exit(1);
