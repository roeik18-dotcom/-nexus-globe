"""Commerce comparison family — SHOP_SEARCH, PRICE_COMPARE, PRODUCT_COMPARE.

READ-ONLY comparison only. There is deliberately NO purchase, checkout, cart,
order, or payment path anywhere in this package, and all three registry entries
are READ_ONLY with approval_policy=NONE, so none of them can become
side-effecting.

Merchant/provider payloads are UNTRUSTED DATA: only whitelisted scalar fields
are ever read (see identity.sanitize_offer); everything else — including any
action_type / approval / side_effecting / capability / instruction key a
merchant page might carry — is dropped before inspection.

Identity is the correctness constraint of this family: an offer is only ever
compared against another offer with the SAME (canonical_product_id, variant_key).
Different variants are never merged, and a missing cost component stays unknown
(never silently 0).
"""
