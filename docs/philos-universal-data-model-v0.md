# Philos Universal Data Model (PUDM) v0.1

**Status:** Candidate — structure designed, individual node types vary in evidence grade.
**Relation to existing specs:** This document is the meta model. All existing specs
(`philos-opm-spec.md`, `marketplace-core-v0.md`, `dimension-reading-proposal.md`, etc.)
can be described as projections of this model onto specific domains. PUDM was written
retroactively to encompass them — it does not imply the specs were designed from PUDM.

---

## Purpose

Every screen, agent, document, and algorithm in the Philos system operates on nodes,
relations, attributes, evidence, and dynamics. Without a shared vocabulary, each
subsystem invents its own. This document defines the common grammar.

The goal is not academic completeness. It is that any future component — a new View,
a new Agent, a new Research track — can be described as a projection of PUDM without
requiring a new ontology.

---

## §1  Core Principle: The 4-Layer Node

Every node in the system has exactly four layers. No node type is exempt.

| Layer | Question | Example (Person node) |
|---|---|---|
| **Identity** | What is it? | Name, unique ID, node type |
| **Properties** | What does it have? | Age, location, languages, roles |
| **Relations** | What is it connected to? | Communities, organizations, missions, values |
| **Dynamics** | What changes over time? | Migration, new missions, trust gain/loss |

This 4-layer structure is the foundational invariant of PUDM. A node that cannot
answer all four layers is incomplete, not absent.

---

## §2  Node Types

### §2.1  Taxonomy

Nodes are organized in a containment hierarchy (zoom levels). A node at level N can
contain nodes at level N+1. Containment is not exclusive — a Person belongs to both
a City and a Community.

| Zoom | Type | Symbol | Evidence Grade |
|---|---|---|---|
| 0 | **World** | 🌍 | Placeholder |
| 1 | **Continent** | 🌎 | Placeholder |
| 2 | **Country** | 🇺🇳 | Placeholder |
| 3 | **Region / City** | 🏙 | Placeholder |
| 4 | **Organization** | 🏢 | Placeholder |
| 5 | **Community** | 👥 | Placeholder |
| 6 | **Person** | 👤 | Candidate (OPM path) |
| 7 | **Mission** | 🎯 | Candidate (Marketplace path) |
| 8 | **Gap** | 🧩 | Candidate (Marketplace path) |
| 9 | **Value** | 💎 | Candidate (12 defined, not validated) |
| 10 | **Capability** | 📦 | Candidate |
| 11 | **Provider** | ⚡ | Candidate |
| 12 | **Document** | 📄 | Placeholder |
| 13 | **Idea** | 💡 | Placeholder |
| 14 | **Research** | 🔬 | Placeholder |
| 15 | **Agent** | 🤖 | Candidate (architecture defined) |
| 16 | **Task** | ✅ | Placeholder |
| 17 | **Event** | 📅 | Placeholder |
| 18 | **Measurement** | 📊 | Placeholder |

Zoom levels 0–5 (geographic/organizational hierarchy): **Not established.**
No data collection protocol exists. Listed for structural completeness only.

**Relation Entities (not zoom-level nodes):** `ValueCapabilityRelation` (VCR) and
`ProviderCapabilityRelation` (PCR) are first-class PUDM entities that own the
cross-links between Value → Capability and Capability → Provider. They are not
assigned a zoom level because they are edges, not containers. See §3.1.

### §2.2  Node Properties per Type

Each node type has a canonical set of Properties (layer 2). Only the most
developed types are specified here; others inherit the base schema.

**Base schema (all nodes):**
```
id:           string   — globally unique
type:         NodeType — from §2.1
createdAt:    timestamp
updatedAt:    timestamp
evidenceGrade: "Frozen" | "Candidate" | "Placeholder" | "Not established"
```

**Person (additional):**
```
displayName:  string
location:     CountryId | null
languages:    string[]
roles:        RoleId[]
opmState:     DimensionReading[]   — see dimension-reading-proposal.md
```

**Mission (additional):**
```
actor:        NodeId               — Person | Organization | Community
statement:    string               — what the actor is trying to achieve
horizon:      "immediate" | "medium" | "long"
gaps:         GapId[]
```

**Gap (additional):**
```
mission:      MissionId
description:  string
requiredValues: ValueId[]
severity:     number | null        — Placeholder; no measurement protocol
```

**Value (additional):**
```
label:        string               — one of the 12 Candidate values
grade:        "Candidate"          — fixed at this version
```
Value does NOT store capability references. Cross-links are owned by
ValueCapabilityRelation (§3.1). God Object rule: Nodes do not carry
foreign-key arrays; Relations own all cross-references.

**Capability (additional):**
```
label:        string               — capability name
domain:       string               — primary domain (Finance, Operations, etc.)
description:  string               — what this capability delivers
grade:        "Candidate"
```
Capability does NOT store value or provider references. Cross-links are owned
by ValueCapabilityRelation and ProviderCapabilityRelation. See §3.1.

**Provider (additional):**
```
label:        string               — provider name
description:  string               — what the provider offers
domain:       string               — primary domain
providerType: "program" | "platform" | "organization" | "individual"
website:      string | null
grade:        "Candidate"
```
Provider does NOT store capability references. Links are owned by
ProviderCapabilityRelation. See §3.1. (God Object rule.)

**Agent (additional):**
```
capabilities: CapabilityId[]
toolGateway:  ToolGatewayId        — see dimension-reading-proposal.md §6
credentialAccess: "none"           — Agents never hold secrets directly
```

---

## §3  Relation Types

Relations are directed. The source and target are both NodeIds. Every relation
carries an `evidenceGrade` independently of the nodes it connects.

| Relation | Direction | Semantics | Grade |
|---|---|---|---|
| `requires` | Mission → Gap | This mission has this unresolved gap | Candidate |
| `needs` | Gap → Value | Closing this gap requires this value | Candidate |
| `contains` | Geographic/Org → sub-node | Spatial or membership containment | Placeholder |
| `connects` | Node ↔ Node | Undirected peer relationship | Placeholder |
| `produces` | Person/Org/Agent → Document/Research/Idea | Creation relation | Placeholder |
| `trusts` | Node → Node | Directed trust with score and decay | Placeholder |
| `enables` | Value → Outcome | Value flow closes a gap | Placeholder |
| `executes` | Agent → Task | Agent takes ownership of task | Candidate |
| `delegates` | Person/Agent → Agent | Work handoff via Tool Gateway | Candidate |

Note: `covers` (Capability → Value) and `provides` (Provider → Capability) from v0.1
are superseded by the Relation Entities in §3.1 (VCR and PCR), which express the same
cross-links with richer relationType semantics and first-class identity.

### §3.1  Relation Entities (VCR and PCR)

Relation Entities are first-class PUDM entities. They are not simple directed edges —
they carry their own identity, evidence grade, and relationType semantics. They own all
cross-references between Nodes; Nodes do not store foreign-key arrays (God Object rule).

**ValueCapabilityRelation (VCR)**

A VCR asserts that a Capability can address, is required for, or has been selected to
close a Value — with scope that depends on relationType.

```
id:           string
type:         "ValueCapabilityRelation"
evidenceGrade: Grade
valueId:      string               — source Value
capabilityId: string               — target Capability
relationType: "can_address" | "required_for" | "selected_for"
missionId:    string | null        — required for required_for and selected_for
gapId:        string | null        — required for required_for and selected_for
evidence:     EvidenceObject[]
```

| relationType | Scope | missionId/gapId | Semantics |
|---|---|---|---|
| `can_address` | Taxonomic | Must be null | Capability can address this Value in general — no mission context required |
| `required_for` | Contextual | Required | Capability is required to close this specific Gap in this Mission |
| `selected_for` | Execution | Required | Capability has been selected for this Mission/Gap **(DEFERRED — no write path yet)** |

**ProviderCapabilityRelation (PCR)**

A PCR asserts that a Provider can deliver, or has been selected to deliver, a Capability.

```
id:           string
type:         "ProviderCapabilityRelation"
evidenceGrade: Grade
capabilityId: string               — source Capability
providerId:   string               — target Provider
relationType: "can_deliver" | "selected_for"
missionId:    string | null        — required only for selected_for
gapId:        string | null        — required only for selected_for
evidence:     EvidenceObject[]
```

| relationType | Scope | missionId/gapId | Semantics |
|---|---|---|---|
| `can_deliver` | Taxonomic | Must be null | Provider can deliver this Capability in general |
| `selected_for` | Execution | Required | Provider is engaged for this specific Mission/Gap **(DEFERRED — no write path yet)** |

**Invariant R1:** `needs` relations may only be created when a Gap node exists.
A Mission may not connect directly to a Value without a Gap intermediary.
This enforces the core chain: Mission → Gap → Value → [VCR] → Capability → [PCR] → Provider.

**Invariant R2:** `trusts` relations require at least one Behavior-grade evidence signal
before the score is written. Intent-only trust is disallowed (§7 Marketplace Core v0).

**Invariant G-1:** VCR `can_address` relations must not carry missionId or gapId.
PCR `can_deliver` relations must not carry missionId or gapId. Taxonomic relations are
context-free; adding mission/gap context contaminates the taxonomy.

**Invariant G-2 (DEFERRED):** `selected_for` relationType on VCR and PCR requires
Behavior-grade or Outcomes-grade evidence on the relation instance before it is written.
Intent-only evidence is insufficient for `selected_for`. *Not yet enforced at the write
layer because no write API exists for PCR or VCR. Activates the moment any `selected_for`
write path or `POST /provider-capability-relations` endpoint appears.*

---

## §4  Evidence Model

Evidence grades and types are defined in `docs/research-charter.md` (Grade: Frozen).
PUDM imports them without modification.

### §4.1  Grades (from Research Charter)

| Grade | Meaning |
|---|---|
| **Frozen** | Methodology locked; no changes without evidence review |
| **Candidate** | Designed and internally consistent; not empirically validated |
| **Placeholder** | Structural slot; no measurement protocol exists yet |
| **Not established** | No evidence path defined |

### §4.2  Signal Types (from Marketplace Core v0 §7)

| Type | Strength | Update rule |
|---|---|---|
| Intent | Weak prior | May inform but never alone update a score |
| Behavior | Medium update | Requires observed action, not stated intention |
| Outcomes | Strongest | Measured result; highest weight in trust/value scores |

**Invariant E1:** No variable may be updated on Intent signal alone.
This is a hard constraint inherited from Marketplace Core v0 Invariant I5.

### §4.3  Evidence on Relations

Every relation instance carries:
```
evidenceGrade:  Grade
signalType:     SignalType | null
source:         NodeId | null
observedAt:     timestamp | null
```

A `trusts` relation with no `observedAt` and `signalType = "Intent"` is valid
structurally but carries zero update weight.

---

## §5  Dynamics Model

Dynamics (layer 4 of every node) describes what changes over time.
This is distinct from Properties (what a node has at a point in time).

### §5.1  Dynamics Types

| Type | Applies to | Examples |
|---|---|---|
| **State transition** | Person, Mission, Task | OPM dimension shift; Mission status change |
| **Relation formation** | All | New `trusts`, `connects`, `requires` edge created |
| **Relation decay** | All | Trust score declining; `covers` weakened by counter-evidence |
| **Production** | Person, Org, Agent | New Document, Idea, or Research node emitted |
| **Containment shift** | Person, Org | Person moves to a different City or Community |
| **Value activation** | Gap, Mission | A Gap closes as a Value becomes available |
| **Evidence upgrade** | Any node or relation | Grade advances: Placeholder → Candidate → Frozen |
| **Evidence downgrade** | Any node or relation | Contradicting signal weakens a prior claim |

### §5.2  Data Physics

For each data type, the following physics rules govern behavior.
These are design constraints, not implemented algorithms. Grade: Candidate.

**Trust data:**
- Created: first Behavior-grade signal between two nodes
- Increases: additional Outcome-grade signals
- Decreases: contradicting Behavior signals; time decay (rate TBD)
- Transfers: not directly; a node's trust score is local to a relation pair
- Merges: not applicable (trust is relational, not aggregable across pairs)

**Value data (the 12 Candidate values):**
- Created: by Gap → Value `needs` relation
- Changes: evidence that a different value is actually required shifts the edge
- Activates: when a Provider with matching Capability is reachable
- Splits: a single stated Gap may reveal multiple required Values on analysis
- Does not merge: two Values do not collapse into one

**Mission data:**
- Created: by a Person/Org/Community node's explicit statement
- Changes: horizon shifts; Gaps close or open
- Terminates: Mission is achieved (all Gaps resolved) or abandoned
- Does not split: one actor, one Mission per record (multiple Missions allowed per actor)

**Research/Document data:**
- Created: by a `produces` relation from a Person, Org, or Agent
- Evidence grade: assigned at creation, upgradeable
- Splits: a document may spawn child Ideas or Research nodes
- Does not decay by default (archival)

**Agent data:**
- Created: by explicit agent definition (capabilities, gateway, role)
- Capabilities change: only by updated agent definition, not by self-modification
- Credentials: never stored on the Agent node; always fetched via Tool Gateway
- Terminates: task completion or explicit shutdown

---

## §6  View Types (Projections)

A View is a read-only projection of PUDM onto a specific lens. Views do not modify
the underlying model. Every current and planned screen in Philos is a View.

| View | Primary nodes | Primary relations | Current route | Grade |
|---|---|---|---|---|
| **Globe** | Country, City, Organization | `contains`, `connects` | Not built | Placeholder |
| **OPM** | Person, Gap, Dimension | `requires`, state transitions | `/nexus` | Candidate |
| **PUDM** | All node and relation entity types | All | `/pudm` | Candidate |
| **Marketplace / Graph Explorer** | Mission, Gap, Value, Capability, Provider, VCR, PCR | `requires`, `needs`, VCR relationType, PCR relationType | `/marketplace` | Candidate |
| **World (Potential Map)** | All node types | All relation types (dashed = potential) | `/world` | Candidate |
| **Lab** | Document, Research, Simulation | `produces` | `/lab` | Candidate |
| **Network** | Person, Community, Organization | `trusts`, `connects` | Not built | Placeholder |
| **Agent Map** | Agent, Task, Tool Gateway | `executes`, `delegates` | Not built | Placeholder |
| **Research Graph** | Research, Idea, Document | `produces`, evidence upgrades | Not built | Placeholder |
| **Digital Reality Graph** | All node types, all zoom levels | All relation types | Not built — V2 | Not established |

**Projection rule:** A View may only display data that exists as nodes and relations
in PUDM. Views do not invent data. If a node does not exist in the model, it does
not appear in a View, even as a placeholder.

---

## §7  Zoom Architecture

The containment hierarchy in §2.1 defines the legal zoom path:

```
🌍 World
  └─ 🌎 Continent
       └─ 🇺🇳 Country
            └─ 🏙 City / Region
                 └─ 🏢 Organization
                      └─ 👥 Community
                           └─ 👤 Person
                                └─ 🎯 Mission
                                     └─ 🧩 Gap
                                          └─ 💎 Value
                                               └─[VCR]─ 📦 Capability
                                                            └─[PCR]─ ⚡ Provider
                                                                         └─ 📄 Document / 💡 Idea / 🔬 Research / 🤖 Agent
```

A View may enter the hierarchy at any level and zoom in or out. The Digital Reality
Graph (V2) is the only planned View that spans all levels simultaneously.

**Relation Entities in the zoom tree:** VCR and PCR are not zoom-level nodes — they are
the edges between Value–Capability and Capability–Provider. `[VCR]` and `[PCR]` in the
tree above indicate that these cross-links are owned by Relation Entities, not stored
as arrays on the source nodes.

**Current implementation:** `/world` enters at the Value level (zoom 9) and renders
upward to Mission actors and downward to Capabilities (via VCR) and Providers (via PCR).
Geographic levels (0–5) are not rendered in V1. `/marketplace` is the Graph Explorer:
full read-only traversal of Mission → Gap → Value → [VCR] → Capability → [PCR] →
Provider, with Node Inspector (Value, Capability, Provider) and Relation Inspector
(VCR, PCR) panels.

---

## §8  Open Questions

These must be resolved before any Placeholder-grade node type is implemented.

| # | Question | Blocks |
|---|---|---|
| Q1 | What is the minimum schema for a Country node? | Geographic zoom levels |
| Q2 | How is a Provider node created — by self-declaration or by evidence? | `provides` relation, Marketplace path |
| Q3 | What constitutes a Behavior-grade signal for the `trusts` relation? | Trust dynamics, Invariant R2 |
| Q4 | How does a Gap close — threshold on Value availability, or explicit actor action? | Value activation dynamics |
| Q5 | What is the identity scheme for Agents — local per-session or persistent global? | Agent node lifecycle |
| Q6 | How does Evidence downgrade propagate — does a weakened relation weaken its parent node? | Evidence cascade rules |

---

## §9  Relation to Existing Specifications

| Spec | PUDM Mapping |
|---|---|
| `philos-opm-spec.md` | Person node Dynamics layer; Gap and Dimension as OPM projections |
| `marketplace-core-v0.md` | Mission → Gap → Value → [VCR] → Capability → [PCR] → Provider chain; Invariants I1–I5 |
| `marketplace-dynamics-v0.md` | `needs` relation dynamics; `covers` superseded by VCR Relation Entity (§3.1); matching engine |
| `transition-engine-v0.md` | State transition Dynamics for Person and Mission nodes |
| `dimension-reading-proposal.md` | OPM → Marketplace interface; Entity 11 proposal |
| `research-charter.md` | §4 Evidence Model (imported without modification) |
| `nexus-ontology-v1.md` | OPM internal vocabulary (Departments, Dimensions, Burden Flow); PUDM §2 Person node |
| `human-pattern-engine-v0.md` | Pattern matching across Person and Case nodes |
| `philos-reality-flow-v0.md` | Layer 0 physics axioms; substrate for Data Physics §5.2 |

---

## §10  Architecture Contracts

Eight contracts must hold at any valid PUDM system state. All are satisfied as of v0.2.
Contract G-2 is deferred because no write API exists for PCR or VCR.

| # | Contract | Status |
|---|---|---|
| C-1 | Mission → Gap → Value chain: a Value may not be linked to a Mission without a Gap intermediary (Invariant R1) | **Satisfied** |
| C-2 | God Object rule: Nodes do not store foreign-key arrays to other Node types | **Satisfied** |
| C-3 | Relations own cross-references: VCR owns Value → Capability links; PCR owns Capability → Provider links | **Satisfied** |
| C-4 | VCR `can_address` carries no missionId or gapId (Invariant G-1) | **Satisfied** — all current VCRs are `can_address` with null context |
| C-5 | PCR `can_deliver` carries no missionId or gapId (Invariant G-1) | **Satisfied** — all current PCRs are `can_deliver` with null context |
| C-6 | No `selected_for` VCR entries exist in the data store | **Satisfied** — zero `selected_for` VCR entries |
| C-7 | No `selected_for` PCR entries exist in the data store | **Satisfied** — zero `selected_for` PCR entries |
| G-2 | PCR `selected_for` write path must enforce Behavior/Outcomes evidence requirement before accepting a write (Invariant G-2) | **DEFERRED** — no write API exists; activates on `POST /provider-capability-relations` or any `selected_for` write path |

---

## §11  Version Notes

v0.1 — Initial draft. Node types enumerated. 4-layer model defined. Data Physics
specified as Candidate constraints. Evidence model imported from Research Charter.
Geographic and Provider node types remain Placeholder pending open questions in §8.

v0.2 — Added Relation Entities (§3.1): ValueCapabilityRelation (VCR) and
ProviderCapabilityRelation (PCR) as first-class PUDM entities with full schemas and
relationType semantics. Updated §2.1 taxonomy: Capability promoted from "Capability
Domain" (Placeholder) to "Capability" (Candidate); Provider promoted to Candidate.
Removed `covers` and `provides` simple-edge relations (superseded by VCR and PCR).
Added God Object rule: Nodes do not store cross-reference arrays. Added Invariants G-1
and G-2. Updated §2.2: Value, Capability, and Provider node schemas now explicit;
`capabilityDomains[]` removed from Value. Updated §6 View Types: Marketplace / Graph
Explorer at `/marketplace`; PUDM view at `/pudm`; Globe route corrected to Not built.
Added §10 Architecture Contracts (8 total; G-2 deferred). Updated zoom tree (§7) to
show [VCR] and [PCR] edges. Updated §9 spec mapping to reflect new chain notation.
