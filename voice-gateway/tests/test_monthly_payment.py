"""MONTHLY_PAYMENT — determinism, no-defaults, verification."""

import asyncio

from app.capabilities._framework import pipeline
from app.capabilities.registry import REGISTRY

run = asyncio.run
BASE = {"price": 120000, "down_payment": 20000, "apr": 6.0, "term_months": 60,
        "fees": [], "currency": "USD"}


def _run(overrides=None, **kw):
    inp = dict(BASE)
    if overrides:
        inp.update(overrides)
    return run(pipeline.execute(REGISTRY, "MONTHLY_PAYMENT", inp, **kw))


def test_known_amortization_value():
    # P=100000, apr 6% -> r=0.005, n=60. Standard result ~= 1933.28.
    sr = _run()
    assert sr.status == "accepted"
    assert abs(sr.result["monthly_payment"] - 1933.28) < 0.05
    assert sr.result["framework"]["verification"] == "verified"
    assert "formula_used" in sr.result
    # total_interest > 0 and total_paid > principal
    assert sr.result["total_interest"] > 0
    assert sr.result["total_paid"] > 100000


def test_zero_interest_is_linear():
    sr = _run({"apr": 0.0, "price": 12000, "down_payment": 0, "term_months": 12})
    assert sr.status == "accepted"
    assert abs(sr.result["monthly_payment"] - 1000.0) < 0.01
    assert abs(sr.result["total_interest"]) < 0.01


def test_financed_fee_increases_principal():
    with_fee = _run({"fees": [{"name": "orig", "amount": 1000, "financed": True}]})
    assert with_fee.result["breakdown"]["financed_fees"] == 1000
    assert with_fee.result["financed_principal"] == 101000


def test_upfront_fee_not_financed():
    sr = _run({"fees": [{"name": "doc", "amount": 300, "financed": False}]})
    assert sr.result["breakdown"]["upfront_fees"] == 300
    assert sr.result["financed_principal"] == 100000  # unchanged
    assert sr.status == "accepted"


def test_missing_required_input_is_typed_error_not_default():
    for drop in ("price", "down_payment", "apr", "term_months", "fees", "currency"):
        inp = dict(BASE)
        del inp[drop]
        sr = run(pipeline.execute(REGISTRY, "MONTHLY_PAYMENT", inp))
        assert sr.status == "rejected" and sr.code == "missing_input", drop


def test_range_validation():
    assert _run({"down_payment": 130000}).code == "malformed_request"  # down > price
    assert _run({"apr": -1}).code == "malformed_request"
    assert _run({"term_months": 0}).code == "malformed_request"
    assert _run({"price": 0}).code == "malformed_request"


def test_bad_fee_shape_rejected():
    sr = _run({"fees": [{"name": "x", "amount": 10}]})  # missing 'financed'
    assert sr.status == "rejected" and sr.code == "malformed_request"


def test_bool_not_accepted_as_number():
    sr = _run({"price": True})
    assert sr.status == "rejected"
