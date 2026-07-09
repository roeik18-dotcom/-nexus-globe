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
| 10 | **Capability Domain** | 📦 | Candidate |
| 11 | **Provider** | ⚡ | Placeholder |
| 12 | **Document** | 📄 | Placeholder |
| 13 | **Idea** | 💡 | Placeholder |
| 14 | **Research** | 🔬 | Placeholder |
| 15 | **Agent** | 🤖 | Candidate (architecture defined) |
| 16 | **Task** | ✅ | Placeholder |
| 17 | **Event** | 📅 | Placeholder |
| 18 | **Measurement** | 📊 | Placeholder |

Zoom levels 0–5 (geographic/organizational hierarchy): **Not established.**
No data collection protocol exists. Listed for structural completeness only.

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
capabilityDomains: CapabilityDomainId[]
```

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
| `provides` | Provider → Capability | This entity can deliver this capability | Placeholder |
| `covers` | Capability → Value | This capability addresses this value | Candidate |
| `contains` | Geographic/Org → sub-node | Spatial or membership containment | Placeholder |
| `connects` | Node ↔ Node | Undirected peer relationship | Placeholder |
| `produces` | Person/Org/Agent → Document/Research/Idea | Creation relation | Placeholder |
| `trusts` | Node → Node | Directed trust with score and decay | Placeholder |
| `enables` | Value → Outcome | Value flow closes a gap | Placeholder |
| `executes` | Agent → Task | Agent takes ownership of task | Candidate |
| `delegates` | Person/Agent → Agent | Work handoff via Tool Gateway | Candidate |

**Invariant R1:** `needs` relations may only be created when a Gap node exists.
A Mission may not connect directly to a Value without a Gap intermediary.
This enforces the Marketplace architecture invariant: Mission → Gap → Value → Capability → Provider.

**Invariant R2:** `trusts` relations require at least one Behavior-grade evidence signal
before the score is written. Intent-only trust is disallowed (§7 Marketplace Core v0).

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
| **Globe** | Country, City, Organization | `contains`, `connects` | `/globe` | Placeholder |
| **OPM** | Person, Gap, Dimension | `requires`, state transitions | `/nexus` | Candidate |
| **Marketplace** | Mission, Gap, Value, Capability, Provider | `requires`, `needs`, `covers`, `provides` | `/nexus` (panels) | Candidate |
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
                                               └─ 📦 Capability Domain
                                                    └─ 📄 Document / 💡 Idea / 🔬 Research / 🤖 Agent
```

A View may enter the hierarchy at any level and zoom in or out. The Digital Reality
Graph (V2) is the only planned View that spans all levels simultaneously.

**Current implementation:** `/world` enters at the Value level (zoom 9) and renders
upward to Mission actors and downward to Capability Domains. Geographic levels (0–5)
are not rendered in V1.

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
| `marketplace-core-v0.md` | Mission → Gap → Value → Capability → Provider chain; Invariants I1–I5 |
| `marketplace-dynamics-v0.md` | `needs` and `covers` relation dynamics; matching engine |
| `transition-engine-v0.md` | State transition Dynamics for Person and Mission nodes |
| `dimension-reading-proposal.md` | OPM → Marketplace interface; Entity 11 proposal |
| `research-charter.md` | §4 Evidence Model (imported without modification) |
| `nexus-ontology-v1.md` | OPM internal vocabulary (Departments, Dimensions, Burden Flow); PUDM §2 Person node |
| `human-pattern-engine-v0.md` | Pattern matching across Person and Case nodes |
| `philos-reality-flow-v0.md` | Layer 0 physics axioms; substrate for Data Physics §5.2 |

---

## §10  Version Notes

v0.1 — Initial draft. Node types enumerated. 4-layer model defined. Data Physics
specified as Candidate constraints. Evidence model imported from Research Charter.
Geographic and Provider node types remain Placeholder pending open questions in §8.

Next version target (v0.2): resolve Q1–Q3; specify Trust dynamics with at least one
falsifiable constraint; promote Provider node to Candidate grade.
