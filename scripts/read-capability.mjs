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

  check(`${p} — evidence signal valid`,      Array.isArray(r.evidence) &&
    r.evidence.every(e => VALID_SIGNALS.includes(e.signal)));

  // Capability must NOT contain cross-node references (God Object check)
  check(`${p} — no addressesValues`, r.addressesValues === undefined);
  check(`${p} — no providers`,       r.providers === undefined);
  check(`${p} — no gaps`,            r.gaps === undefined);
  check(`${p} — no missions`,        r.missions === undefined);
  check(`${p} — no actor`,           r.actor === undefined);
  check(`${p} — no missionId`,       r.missionId === undefined);
}

// ─── Cross-reference: validate value-capability-relations.json ────────────────

const VALID_RELATION_TYPES = ["can_address", "required_for", "selected_for"];
const VALID_STATUSES       = ["candidate", "active", "rejected", "historical"];

const relations = JSON.parse(
  readFileSync(join(process.cwd(), "data/value-capability-relations.json"), "utf-8")
);

const capabilityIdSet = new Set(records.map(r => r.id));
const values = JSON.parse(
  readFileSync(join(process.cwd(), "data/values.json"), "utf-8")
);
const valueIdSet = new Set(values.map(v => v.id));

check("relations store is array",          Array.isArray(relations));
check("at least 1 relation record",        relations.length >= 1);
check("all 4 capabilities referenced",     EXPECTED_IDS.every(id => relations.some(r => r.capabilityId === id)));

for (const rel of relations) {
  const p = rel.id;
  check(`${p} — type = ValueCapabilityRelation`,   rel.type === "ValueCapabilityRelation");
  check(`${p} — valueId exists in values.json`,    valueIdSet.has(rel.valueId));
  check(`${p} — capabilityId exists`,              capabilityIdSet.has(rel.capabilityId));
  check(`${p} — relationType valid`,               VALID_RELATION_TYPES.includes(rel.relationType));
  check(`${p} — status valid`,                     VALID_STATUSES.includes(rel.status));
  check(`${p} — evidenceGrade valid`,              VALID_GRADES.includes(rel.evidenceGrade));
  check(`${p} — createdAt present`,                typeof rel.createdAt === "string" && rel.createdAt.length > 0);
  check(`${p} — updatedAt present`,                typeof rel.updatedAt === "string" && rel.updatedAt.length > 0);
  check(`${p} — evidence signal valid`,            Array.isArray(rel.evidence) &&
    rel.evidence.every(e => VALID_SIGNALS.includes(e.signal)));
}

console.log(`\n${pass ? "PASS — all capability and relation records valid" : "FAIL — see ✗ above"}`);
if (!pass) process.exit(1);
