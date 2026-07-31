# RFC-000A — Glossary (authoritative)

> Subordinate to [RFC-000](system-constitution.md). This is the **single
> authoritative source** for the meaning of every core term. No component may use a
> term below with any other meaning, and **no new core term enters the system before
> it is defined here** (RFC-000 §3). Term drift causes more architectural debt than
> bad code — this document is a first-class asset.
>
> Each entry is one canonical definition. Changes follow RFC-000 §12 (Change Control).

| Term | Definition |
|---|---|
| **Event** | An immutable, timestamped record of something that happened. The primary source of truth; State is derived from Events (RFC-000 INV-5). |
| **Entity** | Any addressable thing with a stable, unique Identifier: Person, Project, Task, Goal, Conversation, Decision, Evidence, Action, Agent, Device, Location, Value, Rule. |
| **State** | The current view of the system, **derived** by replaying Events. Never a hidden primary store (AX-3, INV-5). |
| **Context** | The relevant subset of State + Orientation assembled for a single turn/decision. Ephemeral; not itself a source of truth. |
| **Orientation** | The Philos meaning/direction layer that precedes action (AX-5). Defined by **locked Philos theory** (tension-flow, 3·6·9, geometric/supernova models); **referenced, not redefined** here (INV-9). Canonical source: `____` [U]. |
| **Goal** | A desired future State an Entity is working toward. May have dependencies, deadlines, and status; distinct from a Task (a Goal is the "what/why", a Task is a unit of "how"). |
| **Capability** | A declared thing an Agent can do, with typed inputs and outputs. The unit of what the system *can* perform. |
| **Intent** | An operator's expressed desire for an outcome, before it is turned into a Decision or Plan. Perception/Cognition interpret Intent; Planning converts it to Actions. |
| **Knowledge** | Validated, structured information in the Knowledge Graph — typed Entities and typed relations, with evidence and temporal links. Distinct from raw Memory. |
| **Memory** | Persisted recall, by kind: working, episodic, semantic, project, conversation. Memory feeds Knowledge but is not automatically authoritative. |
| **Evidence** | A referenceable observation or source that supports a claim. Required by every Decision (INV-2) and by the Verification Policy (RFC-000 §11). |
| **Decision** | A recorded choice that references Evidence · Context · Time · Confidence · Author · Version (INV-2). No orphan decisions. |
| **Task** | A bounded unit of work with an owner, status, and (optionally) dependencies and a deadline. The executable granularity beneath a Goal. |
| **Project** | A long-lived Entity grouping Goals, Tasks, Decisions, and Knowledge under one effort (e.g. Merlin, Philos, Music). |
| **Mission** | The standing purpose that spans Projects — the system's reason to exist (RFC-000 §1). Above any single Project. |
| **Agent** | A bounded unit that owns Capabilities and communicates **only** through contracts and the Event Bus (RFC-000 §8). Never reaches into another Agent's internals. |
| **Runtime** | An executing environment that hosts Agents and enforces the Layer Contracts. Two named runtimes: **Merlin Runtime** (voice + execution) and **Philos Runtime** (orientation + knowledge), joined by the Integration Layer. |

## Relationships between core terms (quick map)
```
Event ──derives──► State ──subset+Orientation──► Context ──informs──► Decision
Intent ──interpreted──► Decision ──produces──► Action ──emits──► Event
Evidence ──required-by──► Decision       Memory ──feeds──► Knowledge ──queried-by──► Context
Goal ──decomposes-into──► Task           Project ──groups──► {Goal, Task, Decision, Knowledge}
Mission ──spans──► Project               Agent ──owns──► Capability ──runs-in──► Runtime
```

## Pending [U] confirmations
- Canonical **Orientation / Philos** source document (row above).
- Whether **Mission** is singular (one system mission) or plural (per-track missions).

*RFC-000A v0.1 — 2026-07-31. Authoritative glossary, subordinate to RFC-000.*
