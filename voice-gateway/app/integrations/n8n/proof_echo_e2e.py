"""Standalone proof harness for the Merlin -> n8n Echo ActionRequest contract.

Not part of the voice runtime and not imported by anything under service/ or
app.router — run manually to (re)generate live evidence that the adapter in
client.py behaves correctly against the local n8n instance:

    python3 -m app.integrations.n8n.proof_echo_e2e

Exercises, against the live n8n endpoint only (no mocks):
  1. valid echo request -> accepted, correlation_id round-trips
  2. bad auth -> rejected, controlled (no exception)
  3. timeout -> error, controlled (no exception, no hang)
  4. duplicate action_id -> deduped, no second execution
  5. malformed/unexpected upstream response is never trusted blindly
     (covered structurally in client.py's _parse_structured_result; the
     live server here always returns well-formed JSON, so this harness
     doesn't fake a bad response — client.py's parser is unit-tested
     separately for that in tests/test_n8n_action_client.py)

This script never imports app.router, app.domain_router, app.agents,
app.audio, or service/*. It performs no side effects beyond the HTTP calls.
"""

from __future__ import annotations

import asyncio
import uuid

from app.config import settings
from app.integrations.n8n.client import send_echo_action_request


def _report(label: str, result) -> None:
    print(f"\n=== {label} ===")
    print(f"  status:         {result.status}")
    print(f"  code:           {result.code}")
    print(f"  action_id:      {result.action_id}")
    print(f"  correlation_id: {result.correlation_id}")
    print(f"  http_status:    {result.http_status}")
    print(f"  message:        {result.message}")
    print(f"  result:         {result.result}")


async def main() -> None:
    # ── 1. valid echo request ────────────────────────────────────────────────
    corr = f"proof-corr-{uuid.uuid4()}"
    r1 = await send_echo_action_request(
        {"probe": "merlin-n8n-echo-proof", "phase": 1},
        correlation_id=corr,
        provenance_source="merlin-proof-harness",
    )
    _report("1. VALID ECHO", r1)
    assert r1.status == "accepted", f"expected accepted, got {r1.status}"
    assert r1.correlation_id == corr, "correlation_id did not round-trip end-to-end"
    print("  PASS: accepted + correlation_id matches end-to-end")

    # ── 2. bad auth ───────────────────────────────────────────────────────────
    good_token = settings.n8n_webhook_token
    settings.n8n_webhook_token = "definitely-not-the-real-token"
    try:
        r2 = await send_echo_action_request(
            {"probe": "bad-auth-test"},
            correlation_id=f"proof-corr-{uuid.uuid4()}",
            provenance_source="merlin-proof-harness",
        )
    finally:
        settings.n8n_webhook_token = good_token
    _report("2. BAD AUTH", r2)
    assert r2.status == "rejected" and r2.code == "bad_auth", f"expected rejected/bad_auth, got {r2.status}/{r2.code}"
    print("  PASS: bad auth handled as controlled rejection, no exception raised")

    # ── 3. timeout ────────────────────────────────────────────────────────────
    # 192.0.2.1 is TEST-NET-1 (RFC 5737) — reserved, non-routable. Connections
    # to it hang with no RST/response, which reliably exercises the timeout
    # path rather than racing a fast localhost response.
    good_url = settings.n8n_webhook_url
    settings.n8n_webhook_url = "http://192.0.2.1:5678/webhook/echo"
    try:
        r3 = await send_echo_action_request(
            {"probe": "timeout-test"},
            correlation_id=f"proof-corr-{uuid.uuid4()}",
            provenance_source="merlin-proof-harness",
            timeout_seconds=1.5,
        )
    finally:
        settings.n8n_webhook_url = good_url
    _report("3. TIMEOUT", r3)
    assert r3.status == "error" and r3.code in ("network_timeout", "network_error"), (
        f"expected error/network_timeout, got {r3.status}/{r3.code}"
    )
    print("  PASS: timeout handled as controlled error, no hang, no exception raised")

    # ── 4. duplicate action_id ───────────────────────────────────────────────
    fixed_action_id = f"proof-dup-{uuid.uuid4()}"
    r4a = await send_echo_action_request(
        {"probe": "duplicate-test"},
        action_id=fixed_action_id,
        correlation_id=f"proof-corr-{uuid.uuid4()}",
        provenance_source="merlin-proof-harness",
    )
    _report("4a. FIRST SEND (should accept)", r4a)
    r4b = await send_echo_action_request(
        {"probe": "duplicate-test"},
        action_id=fixed_action_id,
        correlation_id=f"proof-corr-{uuid.uuid4()}",
        provenance_source="merlin-proof-harness",
    )
    _report("4b. REPLAY (should dedupe)", r4b)
    assert r4a.status == "accepted", f"expected first send accepted, got {r4a.status}"
    assert r4b.status == "duplicate", f"expected replay duplicate, got {r4b.status}"
    print("  PASS: duplicate action_id deduped, no second execution")

    print("\nALL PROOF SCENARIOS PASSED")


if __name__ == "__main__":
    asyncio.run(main())
