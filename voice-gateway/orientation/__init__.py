"""Merlin Orientation Domain Core (Phase 1).

SOURCE DATA -> DOMAIN REGISTRY -> DOMAIN STATE -> DOMAIN POLICY -> SELECTION ENGINE -> SPEECH PLAN

Pure knowledge/policy/selection logic. Touches NO audio/wake/barge/TTS/STT code and
is not injected into any prompt yet. RuntimeControlState is untouched — policy lives
in its own store, knowledge lives in DomainState.
"""
from .policy import DomainPolicy, Proactivity
from .state import DomainItem, DomainState, KnowledgeStatus
from .domains import (
    Domain, all_domains, domain_ids, get_domain, default_policies, day_opening_domain_map,
)
from .selector import TopicSelector, TopicSelection, DAY_OPENING, CONVERSATION
from .speech_plan import SpeechPlan, build_speech_plan, as_fact_statement, UnknownAsFactError
from .day_opening_bridge import status_to_state, day_opening_to_states

__all__ = [
    "DomainPolicy", "Proactivity", "DomainItem", "DomainState", "KnowledgeStatus",
    "Domain", "all_domains", "domain_ids", "get_domain", "default_policies", "day_opening_domain_map",
    "TopicSelector", "TopicSelection", "DAY_OPENING", "CONVERSATION",
    "SpeechPlan", "build_speech_plan", "as_fact_statement", "UnknownAsFactError",
    "status_to_state", "day_opening_to_states",
]
