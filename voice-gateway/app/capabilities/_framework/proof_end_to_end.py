"""Live proof of the full framework chain — the same path a wired Merlin turn
would take, minus the (collision-sensitive, separately-owned) intent gate:

    intent text -> registry.resolve_intent -> pipeline.execute -> capability
        -> verification -> StructuredResult -> Merlin-style reply

Run:  python3 -m app.capabilities._framework.proof_end_to_end
Pure/offline: touches no network, no n8n, no Merlin service, no bookmark code.
"""

from __future__ import annotations

import asyncio
import logging

from app.capabilities._framework import pipeline
from app.capabilities.registry import REGISTRY

logging.basicConfig(level=logging.INFO, format="%(name)s %(message)s")


def _reply(sr) -> str:
    if sr.status != "accepted":
        return f"[{sr.status}/{sr.code}] {sr.message}"
    r = sr.result or {}
    fv = (r.get("framework") or {}).get("verification")
    return f"[accepted] framework_verification={fv} keys={sorted(k for k in r if k not in ('provenance', 'framework'))}"


async def main() -> None:
    ok = True

    print("=" * 70, "\nMONTHLY_PAYMENT — intent -> registry -> pipeline -> verify -> result")
    intent = "compute the monthly payment"
    at = REGISTRY.resolve_intent(intent)
    print(f"  resolve_intent({intent!r}) -> {at}")
    sr = await pipeline.execute(REGISTRY, at, {
        "price": 120000, "down_payment": 20000, "apr": 6.0,
        "term_months": 60, "fees": [{"name": "origination", "amount": 500, "financed": True}],
        "currency": "USD",
    })
    print("  reply:", _reply(sr))
    print(f"  action_id={sr.action_id} correlation_id={sr.correlation_id}")
    ok = ok and sr.status == "accepted" and sr.result["framework"]["verification"] == "verified"
    print(f"  monthly_payment={sr.result['monthly_payment']} total_paid={sr.result['total_paid']} "
          f"total_interest={sr.result['total_interest']}")

    print("=" * 70, "\nTABLE_REPORT — pure transform, sourced cells + one unknown")
    at = REGISTRY.resolve_intent("build a report")
    print(f"  resolve_intent -> {at}")
    sr2 = await pipeline.execute(REGISTRY, at, {
        "title": "Demo", "summary": "two rows",
        "columns": ["item", "price"],
        "sources": [{"id": "s1", "url": "https://example.test/a"}],
        "rows": [
            [{"value": "widget", "source": "s1"}, {"value": 9.99, "source": "s1"}],
            [{"value": "gadget", "source": "s1"}, {"unknown": True}],
        ],
        "generated_at": "2026-08-12T12:00:00Z",
    })
    print("  reply:", _reply(sr2))
    ok = ok and sr2.status == "accepted" and sr2.result["verification_status"] == "partial"
    print(f"  unknown_cells={sr2.result['unknown_cells']} of {sr2.result['cell_count']}")

    print("=" * 70, "\nSECURITY — unknown action_type + control-field injection rejected")
    bad1 = await pipeline.execute(REGISTRY, "DELETE_EVERYTHING", {"x": 1})
    print(f"  unknown action_type -> {bad1.status}/{bad1.code}")
    bad2 = await pipeline.execute(REGISTRY, "MONTHLY_PAYMENT",
                                  {"price": 1, "down_payment": 0, "apr": 0, "term_months": 1,
                                   "fees": [], "currency": "USD", "side_effecting": True})
    print(f"  input tries side_effecting=True -> {bad2.status}/{bad2.code}")
    ok = ok and bad1.status == "rejected" and bad2.status == "rejected"

    print("=" * 70)
    print("ALL FRAMEWORK PROOF SCENARIOS PASSED" if ok else "PROOF FAILED")
    raise SystemExit(0 if ok else 1)


if __name__ == "__main__":
    asyncio.run(main())
