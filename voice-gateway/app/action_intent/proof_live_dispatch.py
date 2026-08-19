"""Live proof harness for the action-intent gate wired into MerlinAdapter.

Calls MerlinAdapter().respond(text, session_id) directly — the exact same
method merlin_service.py calls after STT produces text — for every category
in the acceptance matrix. Not part of the voice runtime; run manually:

    python3 -m app.action_intent.proof_live_dispatch

Requires: local n8n running (from the prior phase) and a valid
ANTHROPIC_API_KEY in .env for the non-dispatch categories, which fall
through to the real Claude call exactly as they do in production — that is
the point of the proof (the existing pipeline must be completely intact).

Never touches service/*, app.router, app.domain_router's classification
logic, or Philos files. Only imports app.adapters.merlin (production code)
and app.action_intent (this phase's new code).
"""

from __future__ import annotations

import asyncio
import logging
import uuid

from app.action_intent import dispatch as dispatch_module
from app.action_intent.gate import ActionIntentDecision, classify_action_intent
from app.adapters.merlin import MerlinAdapter
from app.config import settings

logging.basicConfig(level=logging.INFO, format="%(name)s %(message)s")

_real_send_echo = dispatch_module.send_echo_action_request
_dispatch_calls: list[dict] = []


async def _counting_send_echo(inputs, **kwargs):
    result = await _real_send_echo(inputs, **kwargs)
    _dispatch_calls.append({"inputs": inputs, "kwargs": kwargs, "result": result})
    return result


dispatch_module.send_echo_action_request = _counting_send_echo


async def _run_turn(adapter: MerlinAdapter, text: str) -> str:
    chunks = []
    async for chunk in adapter.respond(text, f"proof-session-{uuid.uuid4()}"):
        chunks.append(chunk)
    return "".join(chunks)


async def main() -> None:
    adapter = MerlinAdapter()

    print("\n" + "=" * 70)
    print("A/B/C/D/E — EXPLICIT DISPATCH: \"בדיקת n8n\"")
    print("=" * 70)
    before = len(_dispatch_calls)
    reply = await _run_turn(adapter, "בדיקת n8n")
    after = len(_dispatch_calls)
    print(f"  reply: {reply}")
    print(f"  dispatch calls this turn: {after - before}")
    assert after - before == 1, "expected exactly one dispatch for explicit test phrase"
    last = _dispatch_calls[-1]["result"]
    print(f"  action_id={last.action_id} correlation_id={last.correlation_id} status={last.status}")
    assert last.status == "accepted"
    explicit_dispatch_count = after - before

    print("\n" + "=" * 70)
    print("F — GENERAL/EXPLANATORY QUERIES ABOUT n8n (must NOT dispatch)")
    print("=" * 70)
    general_queries = ["מה זה n8n?", "איך n8n עובד?", "תסביר לי על אוטומציות"]
    before = len(_dispatch_calls)
    for q in general_queries:
        reply = await _run_turn(adapter, q)
        print(f"  {q!r} -> ({len(reply)} chars) {reply[:80]!r}...")
    general_dispatch_count = len(_dispatch_calls) - before
    assert general_dispatch_count == 0, "general/explanatory n8n queries must not dispatch"

    print("\n" + "=" * 70)
    print("G — PHILOS QUERY (must NOT dispatch)")
    print("=" * 70)
    before = len(_dispatch_calls)
    reply = await _run_turn(adapter, "פילוס ו-n8n")
    print(f"  reply: {reply[:120]!r}...")
    philos_dispatch_count = len(_dispatch_calls) - before
    assert philos_dispatch_count == 0

    print("\n" + "=" * 70)
    print("H — MUSIC QUERY (must NOT dispatch)")
    print("=" * 70)
    before = len(_dispatch_calls)
    reply = await _run_turn(adapter, "מה מצב קונפיג המוזיקה שלי")
    print(f"  reply: {reply[:120]!r}...")
    music_dispatch_count = len(_dispatch_calls) - before
    assert music_dispatch_count == 0

    print("\n" + "=" * 70)
    print("I — HUMAN CONFIG QUERY (must NOT dispatch)")
    print("=" * 70)
    before = len(_dispatch_calls)
    reply = await _run_turn(adapter, "מה קונפיג האדם שלי")
    print(f"  reply: {reply[:120]!r}...")
    human_dispatch_count = len(_dispatch_calls) - before
    assert human_dispatch_count == 0

    print("\n" + "=" * 70)
    print("J — MALFORMED/FAILED n8n (bad auth) THROUGH LIVE DISPATCH")
    print("=" * 70)
    good_token = settings.n8n_webhook_token
    settings.n8n_webhook_token = "wrong-token-for-proof"
    try:
        reply = await _run_turn(adapter, "בדיקת n8n")
    finally:
        settings.n8n_webhook_token = good_token
    print(f"  reply: {reply}")
    assert "נכשל" in reply or "דחה" in reply, "expected a controlled failure message, not a crash"

    print("\n" + "=" * 70)
    print("10 — NO DUPLICATE EXECUTION (same action_id forced twice via dispatch())")
    print("=" * 70)
    decision = ActionIntentDecision(True, classify_action_intent("בדיקת n8n").intent, "forced")
    fixed_id = f"proof-live-dup-{uuid.uuid4()}"
    r1 = await dispatch_module.dispatch(decision, "proof-dup-session", action_id=fixed_id)
    r2 = await dispatch_module.dispatch(decision, "proof-dup-session", action_id=fixed_id)
    print(f"  first:  {r1}")
    print(f"  second: {r2}")
    assert "כפול" in r2 or "כבר בוצעה" in r2, "expected the second call to report deduped, not a fresh accept"

    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)
    print(f"  EXPLICIT_TEST_DISPATCH_COUNT = {explicit_dispatch_count}")
    print(f"  GENERAL_QUERY_DISPATCH_COUNT = {general_dispatch_count}")
    print(f"  PHILOS_QUERY_DISPATCH_COUNT  = {philos_dispatch_count}")
    print(f"  MUSIC_QUERY_DISPATCH_COUNT   = {music_dispatch_count}")
    print(f"  HUMAN_QUERY_DISPATCH_COUNT   = {human_dispatch_count}")
    print("\nALL LIVE DISPATCH PROOF SCENARIOS PASSED")


if __name__ == "__main__":
    asyncio.run(main())
