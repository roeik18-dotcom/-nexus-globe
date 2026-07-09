// Smoke-test: read Mission record #1 through JsonMissionRepository
// Run with: node --experimental-vm-modules scripts/read-mission.mjs
import { readFileSync } from "fs";
import { join } from "path";

const record = JSON.parse(
  readFileSync(join(process.cwd(), "data/missions.json"), "utf-8")
)[0];

// Validate required fields per MissionSchema v0.1
const checks = [
  ["id",             typeof record.id === "string"],
  ["type",           record.type === "Mission"],
  ["evidenceGrade",  ["Frozen","Candidate","Placeholder","Not established"].includes(record.evidenceGrade)],
  ["state.status",   ["active","completed","abandoned","paused"].includes(record.state?.status)],
  ["state.horizon",  ["immediate","medium","long"].includes(record.state?.horizon)],
  ["actor has id",   typeof record.context?.actor?.id === "string"],
  ["actor has type", ["Person","Organization","Community"].includes(record.context?.actor?.type)],
  ["no displayName", record.context?.actor?.displayName === undefined],
  ["statement",      typeof record.context?.statement === "string" && record.context.statement.length > 0],
  ["gaps = ids only",      record.gaps.every(g => Object.keys(g).length === 1 && typeof g.gapId === "string")],
  ["values = ids only",    record.requiredValues.every(v => Object.keys(v).length === 1 && typeof v.valueId === "string")],
  ["no capabilities",      record.capabilities === undefined],
  ["no providers",         record.providers === undefined],
  ["evidence signal valid",record.evidence.every(e => ["Intent","Behavior","Outcomes"].includes(e.signal))],
  ["timeline present",     record.timeline !== undefined],
  ["relatedMissions []",   Array.isArray(record.relations?.relatedMissions)],
];

let pass = true;
for (const [label, ok] of checks) {
  console.log(`${ok ? "✓" : "✗"} ${label}`);
  if (!ok) pass = false;
}

console.log(`\n${pass ? "PASS — schema valid" : "FAIL — see ✗ above"}`);
if (!pass) process.exit(1);
