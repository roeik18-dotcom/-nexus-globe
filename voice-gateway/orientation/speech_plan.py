"""SPEECH PLAN — the bridge between SELECTION and eventual speaking.

It does NOT speak and is NOT injected into any prompt in Phase 1. It only
organizes selected topics into fact / derived / unknown statements with full
provenance, enforcing the invariant that an UNKNOWN item can never be presented
as a FACT.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from .selector import TopicSelection
from .state import DomainItem, KnowledgeStatus


class UnknownAsFactError(ValueError):
    """Raised if code attempts to assert a non-FACT item as a fact."""


def as_fact_statement(item: DomainItem) -> str:
    """Return a fact statement — ONLY valid for FACT items. Guards UNKNOWN->FACT."""
    if item.status is not KnowledgeStatus.FACT:
        raise UnknownAsFactError(
            f"cannot assert {item.status.value} item as FACT: {item.text!r}"
        )
    return item.text


def as_unknown_statement(item: DomainItem) -> str:
    return f"לא ידוע/אין מקור: {item.text}" if item.text else "אין מידע זמין"


@dataclass
class SpeechPlan:
    context: str
    selections: list[TopicSelection] = field(default_factory=list)
    ordered_items: list[DomainItem] = field(default_factory=list)
    facts: list[str] = field(default_factory=list)
    derived: list[str] = field(default_factory=list)
    unknown: list[str] = field(default_factory=list)
    provenance: dict[str, list[str]] = field(default_factory=dict)   # domain_id -> source_refs
    reasons: dict[str, str] = field(default_factory=dict)            # domain_id -> selection_reason
    speech_constraints: dict = field(default_factory=dict)


def build_speech_plan(selections: list[TopicSelection], *, context: str,
                      constraints: dict | None = None) -> SpeechPlan:
    plan = SpeechPlan(context=context, selections=list(selections),
                      speech_constraints=constraints or {"max_domains": 3, "verbosity": "short"})
    for sel in selections:
        plan.provenance[sel.domain_id] = list(sel.source_refs)
        plan.reasons[sel.domain_id] = sel.selection_reason
        for item in sel.selected_items:
            plan.ordered_items.append(item)
            if item.status is KnowledgeStatus.FACT:
                plan.facts.append(as_fact_statement(item))          # guarded
            elif item.status is KnowledgeStatus.DERIVED:
                plan.derived.append(item.text)
            else:  # UNKNOWN — preserved, never promoted
                plan.unknown.append(as_unknown_statement(item))
    return plan
