"""One correlated TRACE_ID per microphone-derived user turn.

A single mic turn spans capture → STT → route → prompt build → LLM → TTS →
playback, and (on a barge-in) the *next* capture. Those steps run in one
asyncio task, so a `contextvars.ContextVar` set at capture start is visible to
every `get_trace_id()` reader downstream in the same turn — domain_router,
context_builder, stream_response — with no signature threading.

The PortAudio callback threads (play_with_barge_in, record_utterance) do NOT
inherit the context var, so the trace id is passed to those explicitly.

This is observability only: nothing here changes routing, retrieval, audio, or
prompt content. It exists so a live microphone trace can prove that the
transcript which produced an answer came from the user's speech and not from
Merlin's own playback.
"""
from __future__ import annotations

import contextvars

_trace_id: contextvars.ContextVar[str] = contextvars.ContextVar("merlin_trace_id", default="")
_seq = 0


def new_trace_id(kind: str = "mic") -> str:
    """Mint + install a fresh trace id for the current turn. Monotonic counter
    only (no wall-clock/random) so it is deterministic within a process run."""
    global _seq
    _seq += 1
    tid = f"T{_seq:04d}-{kind}"
    _trace_id.set(tid)
    return tid


def set_trace_id(tid: str) -> None:
    _trace_id.set(tid or "")


def get_trace_id() -> str:
    return _trace_id.get()


# The domain the router selected for the CURRENT turn. Published by
# domain_router.route() (the single router entry) and read by the adapter to
# scope conversation history — so it stays a single-source-of-truth value, not a
# second routing execution. Runtime-only; never persisted.
_route_domain: contextvars.ContextVar[str] = contextvars.ContextVar("merlin_route_domain", default="")


def set_route_domain(domain: str) -> None:
    _route_domain.set(domain or "")


def get_route_domain() -> str:
    return _route_domain.get()
