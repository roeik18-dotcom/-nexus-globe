# Capability Catalog

**[U]-sourced inventory**, organized into platform layers, subordinate to
[RFC-001 Roadmap](rfc-001-capability-roadmap.md). Each capability becomes an entry in
the Kernel's **Capability Registry** (LEVEL 1). Status is grounded, not aspirational:
**✓ exists · ◑ partial/unreliable · □ missing**.

## Interfaces (LEVEL 3)
| Capability | Status | Note |
|---|---|---|
| Voice Input (STT) | ◑ | works on strong audio; command-STT reliability open |
| Voice Output (TTS) | ✓ | OpenAI onyx |
| Internet Search / Web | □ | not built |

## Cognition (LEVEL 2)
| Capability | Status | Note |
|---|---|---|
| Language Model | ✓ | Claude Sonnet 4.5 (configurable) |
| Natural Language Understanding | ◑ | via LLM; no dedicated NLU layer |
| Intent Recognition | □ | no Intent layer yet (RFC-020 boundary) |
| Reasoning Engine | □ | Draft |
| Response Generation | ✓ | LLM streaming |
| Translation (Hebrew ↔ English) | ◑ | implicit in LLM; not a discrete capability |
| Task Planner | □ | Draft |
| Knowledge Base | ◑ | static prompt has projects; dynamic KG missing |

## Integrations (adapters)
| Capability | Status | Note |
|---|---|---|
| Claude Integration | ✓ | ClaudeAdapter |
| OpenAI Integration | ✓ | STT + TTS |
| (future engines: Deepgram/Google) | □ | enabled by ADR-001 |

## Memory & Context (LEVEL 1)
| Capability | Status | Note |
|---|---|---|
| Conversation Memory | ✓ | per-session history |
| Context Management | ◑ | context injection works; no Context Engine |
| Persistent / Long-Term Topics | ◑ | MemoryStore (139) exists; dynamic recall empty |
| Recurring Topics | □ | needs Change-Log (Layer 2) |

## Instructions & Config (governed by RFC-000 / prompts)
| Capability | Status | Note |
|---|---|---|
| Core Instructions | ✓ | `prompts/base.md` + persona |
| Persistent Instructions | ✓ | `prompts/merlin.md` (persona + projects) |
| Daily Startup Prompt | □ | the "Morning Brief" / daily-review vision |

## Runtime & Cross-cutting
| Capability | Status | Note |
|---|---|---|
| Scheduling Engine / Automation | □ | Kernel Scheduler (LEVEL 1) |
| Self-Diagnostics | ◑ | evidence-based debug; not self-reporting yet |
| Observability | ◑ | OBS-001 spec + partial telemetry |
| Telemetry | ◑ | wake/command capture exists (duplicated — see ADR-004) |

## Reading the catalog
- **✓ (7):** the working spine — LLM, TTS, adapters, conversation memory, core/persistent
  instructions, response generation.
- **◑ (9):** exist but incomplete/unreliable — STT, context, memory recall, observability.
- **□ (7):** genuinely missing — Web, Intent, Reasoning, Planner, dynamic KG, Scheduler,
  Daily Brief.

**Most ◑ and □ items depend on the same missing foundation: a running Kernel (Event
Store, Context Engine, Capability Registry).** The catalog confirms the Runtime-2/10
assessment — the "what" is well-mapped; the "running host" is the gap.

*v0.1 — 2026-07-31. Feeds the Capability Registry (LEVEL 1).*
