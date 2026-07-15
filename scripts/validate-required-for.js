#!/usr/bin/env node
// Phase 0 invariant checker for required_for VCR records.

const path = require("path");
const ROOT = path.resolve(__dirname, "..");

const vcrs      = require(path.join(ROOT, "data/value-capability-relations.json"));
const missions  = require(path.join(ROOT, "data/missions.json"));
const gaps      = require(path.join(ROOT, "data/gaps.json"));
const values    = require(path.join(ROOT, "data/values.json"));
const caps      = require(path.join(ROOT, "data/capabilities.json"));

const rfRecords   = vcrs.filter(r => r.relationType === "required_for");
const caRecords   = vcrs.filter(r => r.relationType === "can_address");

const missionIds  = new Set(missions.map(m => m.id));
const gapIds      = new Set(gaps.map(g => g.id));
const valueIds    = new Set(values.map(v => v.id));
const capIds      = new Set(caps.map(c => c.id));

// Gap → owning mission
const gapMission = new Map();
for (const m of missions) {
  for (const ref of m.gaps ?? []) gapMission.set(ref.gapId, m.id);
}

// Gap → Set of required valueIds
const gapReqValues = new Map();
for (const g of gaps) {
  gapReqValues.set(g.id, new Set((g.requiredValues ?? []).map(r => r.valueId)));
}

// Set of (valueId|capabilityId) pairs that have a can_address VCR
const canAddressKey = new Set(caRecords.map(r => `${r.valueId}|${r.capabilityId}`));

let errors = 0;
const seen = new Set(); // for duplicate-tuple check

for (const r of rfRecords) {
  const id = r.id ?? "(no id)";
  let ok = true;

  function fail(msg) { console.error(`[FAIL] ${id}: ${msg}`); errors++; ok = false; }

  // 1. missionId present and valid
  if (!r.missionId)               fail(`missing missionId`);
  else if (!missionIds.has(r.missionId)) fail(`unknown missionId ${r.missionId}`);

  // 2. gapId present and valid
  if (!r.gapId)                   fail(`missing gapId`);
  else if (!gapIds.has(r.gapId))  fail(`unknown gapId ${r.gapId}`);

  // 3. valueId present and valid
  if (!r.valueId)                       fail(`missing valueId`);
  else if (!valueIds.has(r.valueId))    fail(`unknown valueId ${r.valueId}`);

  // 4. capabilityId present and valid
  if (!r.capabilityId)                  fail(`missing capabilityId`);
  else if (!capIds.has(r.capabilityId)) fail(`unknown capabilityId ${r.capabilityId}`);

  if (!ok) continue; // skip derived checks if fields missing

  // 5. Gap belongs to declared Mission
  const owningMission = gapMission.get(r.gapId);
  if (owningMission !== r.missionId) {
    fail(`gapId ${r.gapId} belongs to ${owningMission ?? "(none)"}, not ${r.missionId}`);
  }

  // 6. valueId is in Gap.requiredValues
  const reqVals = gapReqValues.get(r.gapId);
  if (reqVals && !reqVals.has(r.valueId)) {
    fail(`valueId ${r.valueId} is not in gap ${r.gapId}.requiredValues`);
  }

  // 7. A matching can_address VCR exists for same (valueId, capabilityId)
  const caKey = `${r.valueId}|${r.capabilityId}`;
  if (!canAddressKey.has(caKey)) {
    fail(`no can_address VCR for (${r.valueId}, ${r.capabilityId})`);
  }

  // 8. No duplicate (missionId, gapId, valueId, capabilityId) tuple
  const tupleKey = `${r.missionId}|${r.gapId}|${r.valueId}|${r.capabilityId}`;
  if (seen.has(tupleKey)) {
    fail(`duplicate tuple (${tupleKey})`);
  }
  seen.add(tupleKey);
}

console.log(`\nChecked ${rfRecords.length} required_for records.`);
if (errors === 0) {
  console.log("✓  All Phase 0 invariants pass.");
} else {
  console.error(`✗  ${errors} violation(s) found.`);
  process.exit(1);
}
