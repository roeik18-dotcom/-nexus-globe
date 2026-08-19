"""MONTHLY_PAYMENT — a pure, offline, deterministic loan calculator.

No network. No invented financial assumptions: every input is required and any
missing/invalid value is a typed error (never a default APR, term, or fee).
Output is a transparent breakdown with the exact formula used. It computes; it
never recommends.
"""

from __future__ import annotations

from typing import Any, Mapping

from app.capabilities._framework.models import (
    ActionSpec, ApprovalPolicy, Executor, Idempotency, InputField,
    SideEffect, ValidationError,
)

ACTION_TYPE = "MONTHLY_PAYMENT"

_NUM = (int, float)
_FORMULA = ("M = P·r / (1 − (1 + r)^−n);  r = APR/100/12;  "
            "P = price − down_payment + financed_fees;  "
            "total_paid = M·n + upfront_fees;  total_interest = M·n − P")


def _num(v: Any, name: str) -> float:
    if isinstance(v, bool) or not isinstance(v, _NUM):
        raise ValidationError(f"{name} must be a number")
    return float(v)


def _parse_fees(raw: Any) -> tuple[float, float, list[dict]]:
    """Return (financed_total, upfront_total, normalized_fees). Fees are explicit:
    each is {name, amount, financed}. Absent fees would be a missing input (the
    registry marks `fees` required), so an empty list must be passed on purpose."""
    if not isinstance(raw, list):
        raise ValidationError("fees must be a list (use [] for no fees)")
    financed = upfront = 0.0
    norm: list[dict] = []
    for i, fee in enumerate(raw):
        if not isinstance(fee, Mapping) or "name" not in fee or "amount" not in fee or "financed" not in fee:
            raise ValidationError(f"fee[{i}] must be {{name, amount, financed}}")
        if not isinstance(fee["name"], str):
            raise ValidationError(f"fee[{i}].name must be a string")
        if not isinstance(fee["financed"], bool):
            raise ValidationError(f"fee[{i}].financed must be a boolean")
        amt = _num(fee["amount"], f"fee[{i}].amount")
        if amt < 0:
            raise ValidationError(f"fee[{i}].amount must be >= 0")
        if fee["financed"]:
            financed += amt
        else:
            upfront += amt
        norm.append({"name": fee["name"], "amount": amt, "financed": fee["financed"]})
    return financed, upfront, norm


def _amortize(principal: float, monthly_rate: float, n: int) -> float:
    if monthly_rate == 0:
        return principal / n
    factor = (1 + monthly_rate) ** (-n)
    return principal * monthly_rate / (1 - factor)


def handler(inputs: Mapping[str, Any], request: Any = None) -> dict[str, Any]:
    """Pure/offline: `request` is accepted for the generic handler signature and
    deliberately unused (no correlation needed for an in-process calculation)."""
    price = _num(inputs["price"], "price")
    down = _num(inputs["down_payment"], "down_payment")
    apr = _num(inputs["apr"], "apr")
    term = inputs["term_months"]
    currency = inputs["currency"]

    if isinstance(term, bool) or not isinstance(term, int):
        raise ValidationError("term_months must be an integer")
    if not isinstance(currency, str) or not currency.strip():
        raise ValidationError("currency must be a non-empty string")
    if price <= 0:
        raise ValidationError("price must be > 0")
    if down < 0 or down > price:
        raise ValidationError("down_payment must be between 0 and price")
    if apr < 0:
        raise ValidationError("apr must be >= 0")
    if term < 1:
        raise ValidationError("term_months must be >= 1")

    financed_fees, upfront_fees, fees = _parse_fees(inputs["fees"])
    principal = price - down + financed_fees
    monthly_rate = apr / 100.0 / 12.0
    monthly = _amortize(principal, monthly_rate, term)
    total_of_payments = monthly * term
    total_paid = total_of_payments + upfront_fees
    total_interest = total_of_payments - principal

    return {
        "currency": currency,
        "monthly_payment": round(monthly, 2),
        "total_paid": round(total_paid, 2),
        "total_interest": round(total_interest, 2),
        "financed_principal": round(principal, 2),
        "breakdown": {
            "price": round(price, 2),
            "down_payment": round(down, 2),
            "financed_fees": round(financed_fees, 2),
            "upfront_fees": round(upfront_fees, 2),
            "interest": round(total_interest, 2),
            "fees": fees,
        },
        "monthly_rate": monthly_rate,
        "term_months": term,
        "formula_used": _FORMULA,
    }


def verify(inputs: Mapping[str, Any], result: Mapping[str, Any]) -> tuple[bool, str]:
    """Independent recomputation via a full amortization schedule — checks that
    summing month-by-month reproduces the reported totals (tolerance for rounding)."""
    try:
        principal = float(result["financed_principal"])
        monthly = float(result["monthly_payment"])
        r = float(result["monthly_rate"])
        n = int(result["term_months"])
        upfront = float(result["breakdown"]["upfront_fees"])
    except (KeyError, TypeError, ValueError):
        return False, "result missing fields for verification"

    balance = principal
    paid_interest = 0.0
    for _ in range(n):
        interest = balance * r
        paid_interest += interest
        principal_component = monthly - interest
        balance -= principal_component
    # last balance should be ~0; totals should reconcile
    tol = max(0.05, n * 0.01)
    total_paid_expected = monthly * n + upfront
    ok = (
        abs(balance) <= tol
        and abs(paid_interest - float(result["total_interest"])) <= tol
        and abs(total_paid_expected - float(result["total_paid"])) <= tol
    )
    return ok, ("schedule reconciles" if ok else f"schedule residual balance={balance:.4f}")


SPEC = ActionSpec(
    action_type=ACTION_TYPE,
    capability="monthly_payment",
    executor=Executor.LOCAL,
    side_effect=SideEffect.READ_ONLY,
    approval_policy=ApprovalPolicy.NONE,
    idempotency=Idempotency.PURE,
    timeout_s=1.0,
    max_retries=0,
    required_inputs=(
        InputField("price", _NUM),
        InputField("down_payment", _NUM),
        InputField("apr", _NUM),
        InputField("term_months", (int,)),
        InputField("fees", (list,)),
        InputField("currency", (str,)),
    ),
    output_fields=("monthly_payment", "total_paid", "total_interest", "breakdown", "formula_used"),
    verification="independent_amortization_recompute",
    provenance_requirements=("inputs_only_no_external_assumptions",),
    intent_patterns=("monthly payment", "החזר חודשי", "תשלום חודשי", "loan payment"),
    handler=handler,
    verifier=verify,
)
