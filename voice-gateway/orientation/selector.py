"""SELECTION ENGINE — deterministic TopicSelector.

No LLM decides eligibility. Given domain STATE + POLICY + context, it produces a
ranked, self-explaining list of TopicSelections. Same input -> same output.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from .policy import DomainPolicy, Proactivity
from .state import DomainItem, DomainState, KnowledgeStatus

DAY_OPENING = "day_opening"
CONVERSATION = "conversation"

# scoring weights (fixed, deterministic)
W_PRIORITY = 10.0
W_PROACTIVITY = 3.0
W_BLOCKER = 35.0
W_OPEN_LOOP = 15.0
W_CONFIDENCE = 5.0
W_EXPLICIT = 1000.0


@dataclass
class TopicSelection:
    domain_id: str
    selected_items: list[DomainItem] = field(default_factory=list)
    score: float = 0.0
    selection_reason: str = ""
    source_refs: list[str] = field(default_factory=list)
    confidence: float | None = None
    freshness: float | None = None            # age in seconds of the underlying data
    explicit_user_request: bool = False
    eligible_for_proactive_speech: bool = False


def _fresh_ok(state: DomainState, policy: DomainPolicy, now: float) -> bool:
    if policy.freshness_requirement is None:
        return True
    if state.last_updated is None:
        return False                          # requirement set but no timestamp => cannot prove fresh
    return (now - state.last_updated) <= policy.freshness_requirement


def _order_items(state: DomainState, max_items: int) -> list[DomainItem]:
    # blockers first, then open loops, then the rest — stable within each band.
    def key(i: DomainItem):
        return (0 if i.is_blocker else 1, 0 if i.open else 1)
    return sorted(state.items, key=key)[:max_items]


class TopicSelector:
    """Deterministic domain selection. Stateless — all inputs are passed in."""

    def select(
        self,
        states: dict[str, DomainState],
        policies: dict[str, DomainPolicy],
        *,
        context: str = CONVERSATION,
        now: float,
        last_spoken: dict[str, float] | None = None,
        explicit_request: str | None = None,
    ) -> list[TopicSelection]:
        last_spoken = last_spoken or {}
        out: list[TopicSelection] = []

        for domain_id, policy in policies.items():
            state = states.get(domain_id) or DomainState(domain_id=domain_id, status=KnowledgeStatus.UNKNOWN)
            explicit = explicit_request == domain_id

            # HARD gate: disabled domains are never selected (even on explicit request).
            if not policy.enabled:
                continue

            inclusion_ok = policy.day_opening_inclusion if context == DAY_OPENING else policy.conversation_inclusion
            last = last_spoken.get(domain_id)
            in_cooldown = last is not None and (now - last) < policy.cooldown_seconds
            fresh_ok = _fresh_ok(state, policy, now)

            proactive_ok = (
                inclusion_ok
                and policy.proactivity > Proactivity.OFF
                and not in_cooldown
                and fresh_ok
            )

            if not explicit and not proactive_ok:
                continue  # not eligible to be surfaced on its own

            # ---- score ----
            score = policy.priority * W_PRIORITY
            score += int(policy.proactivity) * W_PROACTIVITY
            if state.blockers:
                score += W_BLOCKER
            if state.has_open_loop:
                score += W_OPEN_LOOP
            score += (state.confidence if state.confidence is not None else 0.5) * W_CONFIDENCE
            if explicit:
                score += W_EXPLICIT

            reason = (
                f"enabled priority={policy.priority} proactivity={policy.proactivity.name} "
                f"open_loops={len(state.open_items)} blockers={len(state.blockers)} "
                f"confidence={state.confidence if state.confidence is not None else 'NA'} "
                f"fresh={fresh_ok} cooldown={'yes' if in_cooldown else 'no'} "
                f"explicit={explicit} context={context} score={score:.1f}"
            )

            items = _order_items(state, policy.max_items)
            srcs = []
            for s in ([state.source] + [i.source for i in items]):
                if s and s not in srcs:
                    srcs.append(s)

            out.append(TopicSelection(
                domain_id=domain_id,
                selected_items=items,
                score=score,
                selection_reason=reason,
                source_refs=srcs,
                confidence=state.confidence,
                freshness=state.age_seconds(now),
                explicit_user_request=explicit,
                eligible_for_proactive_speech=(proactive_ok and not explicit),
            ))

        # deterministic ordering: score desc, then priority desc, then id asc
        out.sort(key=lambda t: (-t.score, -policies[t.domain_id].priority, t.domain_id))
        return out

    def select_top(self, *args, limit: int = 3, **kw) -> list[TopicSelection]:
        return self.select(*args, **kw)[:limit]
