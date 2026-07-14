// Smoke-test: read all Provider records and ProviderCapabilityRelations
// Run with: node scripts/read-provider.mjs
import { readFileSync } from "fs";
import { join } from "path";

const VALID_GRADES       = ["Frozen", "Candidate", "Placeholder", "Not established"];
const VALID_SIGNALS      = ["Intent", "Behavior", "Outcomes"];
const VALID_TYPES        = ["organization", "individual", "platform", "program"];
const VALID_PCR_TYPES    = ["can_deliver", "selected_for"];
const VALID_PCR_STATUSES = ["candidate", "active", "rejected", "historical"];

const EXPECTED_PROVIDER_IDS = [
  "prov_yc_001",
  "prov_antler_001",
  "prov_flexport_001",
  "prov_beehiiv_001",
  "prov_pentagram_001",
];

const EXPECTED_CAPABILITY_IDS = [
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

// ─── Provider records ────────────────────────────────────────────────────────

const providers = JSON.parse(
  readFileSync(join(process.cwd(), "data/providers.json"), "utf-8")
);

check("providers store is array",                 Array.isArray(providers));
check("exactly 5 provider records",               providers.length === 5);
check("all 5 expected IDs present",               EXPECTED_PROVIDER_IDS.every(id => providers.some(p => p.id === id)));

for (const p of providers) {
  const id = p.id;

  check(`${id} — type = Provider`,                p.type === "Provider");
  check(`${id} — evidenceGrade valid`,            VALID_GRADES.includes(p.evidenceGrade));
  check(`${id} — createdAt present`,              typeof p.createdAt === "string" && p.createdAt.length > 0);
  check(`${id} — updatedAt present`,              typeof p.updatedAt === "string" && p.updatedAt.length > 0);

  check(`${id} — context.label`,                  typeof p.context?.label === "string" && p.context.label.length > 0);
  check(`${id} — context.description`,            typeof p.context?.description === "string" && p.context.description.length > 0);
  check(`${id} — context.providerType valid`,     VALID_TYPES.includes(p.context?.providerType));

  check(`${id} — evidence signal valid`,          Array.isArray(p.evidence) &&
    p.evidence.every(e => VALID_SIGNALS.includes(e.signal)));

  // Provider must NOT contain capability links, value data, or mission data
  check(`${id} — no capabilityIds`,               p.capabilityIds === undefined);
  check(`${id} — no capabilities`,                p.capabilities === undefined);
  check(`${id} — no values`,                      p.values === undefined);
  check(`${id} — no missions`,                    p.missions === undefined);
  check(`${id} — no missionId`,                   p.missionId === undefined);
}

// ─── ProviderCapabilityRelation records ──────────────────────────────────────

const relations = JSON.parse(
  readFileSync(join(process.cwd(), "data/provider-capability-relations.json"), "utf-8")
);

const providerIdSet   = new Set(providers.map(p => p.id));
const capabilityIdSet = new Set(EXPECTED_CAPABILITY_IDS);

check("\nrelations store is array",               Array.isArray(relations));
check("exactly 5 relation records",               relations.length === 5);
check("all 4 capabilities referenced",            EXPECTED_CAPABILITY_IDS.every(
  id => relations.some(r => r.capabilityId === id)
));
check("all 5 providers referenced",               EXPECTED_PROVIDER_IDS.every(
  id => relations.some(r => r.providerId === id)
));

for (const rel of relations) {
  const id = rel.id;

  check(`${id} — type = ProviderCapabilityRelation`, rel.type === "ProviderCapabilityRelation");
  check(`${id} — providerId exists in providers.json`,  providerIdSet.has(rel.providerId));
  check(`${id} — capabilityId exists`,               capabilityIdSet.has(rel.capabilityId));
  check(`${id} — relationType valid`,                VALID_PCR_TYPES.includes(rel.relationType));
  check(`${id} — status valid`,                      VALID_PCR_STATUSES.includes(rel.status));
  check(`${id} — evidenceGrade valid`,               VALID_GRADES.includes(rel.evidenceGrade));
  check(`${id} — createdAt present`,                 typeof rel.createdAt === "string" && rel.createdAt.length > 0);
  check(`${id} — updatedAt present`,                 typeof rel.updatedAt === "string" && rel.updatedAt.length > 0);
  check(`${id} — evidence signal valid`,             Array.isArray(rel.evidence) &&
    rel.evidence.every(e => VALID_SIGNALS.includes(e.signal)));

  // can_deliver relations must NOT have missionId or gapId
  if (rel.relationType === "can_deliver") {
    check(`${id} — can_deliver: no missionId`,       rel.missionId === undefined);
    check(`${id} — can_deliver: no gapId`,           rel.gapId === undefined);
  }
}

console.log(`\n${pass ? "PASS — all provider and relation records valid" : "FAIL — see ✗ above"}`);
if (!pass) process.exit(1);
