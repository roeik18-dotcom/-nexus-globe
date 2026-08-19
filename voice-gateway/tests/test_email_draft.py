"""EMAIL_DRAFT — read-only, explicit recipients only, no send path."""

import asyncio

from app.capabilities._framework import pipeline
from app.capabilities.registry import REGISTRY

run = asyncio.run
BASE = {
    "to": ["a@example.com"],
    "subject": "Hello",
    "body": "Just a test draft.",
}


def _run(overrides=None, **kw):
    inp = dict(BASE)
    if overrides:
        inp.update(overrides)
    return run(pipeline.execute(REGISTRY, "EMAIL_DRAFT", inp, **kw))


def test_basic_draft_is_accepted_and_never_sent():
    sr = _run()
    assert sr.status == "accepted"
    assert sr.result["send_status"] == "not_sent"
    assert sr.result["to"] == ["a@example.com"]
    assert sr.result["framework"]["verification"] == "verified"


def test_explicit_recipients_only_no_inference_from_body():
    sr = _run({"body": "please cc bob@example.com and charlie@example.com on this"})
    assert sr.status == "accepted"
    # body text mentioning addresses must never become recipients
    assert sr.result["to"] == ["a@example.com"]
    assert sr.result["cc"] == []
    assert sr.result["bcc"] == []


def test_missing_to_is_rejected():
    sr = _run({"to": []})
    assert sr.status == "rejected"
    assert sr.result is None


def test_invalid_address_rejects_whole_draft():
    sr = _run({"to": ["not-an-address"]})
    assert sr.status == "rejected"


def test_invalid_address_in_cc_also_rejects():
    sr = _run({"cc": ["also-not-an-address"]})
    assert sr.status == "rejected"


def test_recipients_deduplicated_case_insensitively():
    sr = _run({"to": ["A@example.com", "a@example.com", "b@example.com"]})
    assert sr.status == "accepted"
    assert sr.result["to"] == ["a@example.com", "b@example.com"]


def test_recipient_cannot_appear_in_two_roles():
    sr = _run({"to": ["a@example.com"], "cc": ["a@example.com"]})
    assert sr.status == "rejected"


def test_attachments_are_references_only():
    sr = _run({"attachments": [{"filename": "report.pdf", "reference": "/local/path/report.pdf"}]})
    assert sr.status == "accepted"
    assert sr.result["attachments"] == [{"filename": "report.pdf", "reference": "/local/path/report.pdf"}]


def test_inline_data_uri_attachment_rejected():
    sr = _run({"attachments": [{"filename": "x.png", "reference": "data:image/png;base64,AAAA"}]})
    assert sr.status == "rejected"


def test_missing_subject_or_body_rejected():
    sr1 = _run({"subject": ""})
    assert sr1.status == "rejected"
    sr2 = _run({"body": ""})
    assert sr2.status == "rejected"


def test_no_send_path_field_ever_present():
    sr = _run()
    assert "message_id" not in sr.result
    assert "sent_at" not in sr.result
    assert sr.result["capability_scope"] == "read_only_draft_no_send_path"


def test_input_cannot_set_control_fields():
    for bad_key in ("side_effecting", "approval_required", "approval", "action_type"):
        inp = dict(BASE, **{bad_key: True})
        sr = run(pipeline.execute(REGISTRY, "EMAIL_DRAFT", inp))
        assert sr.status == "rejected" and sr.code == "malformed_request", bad_key


def test_registry_resolves_email_draft_intent():
    assert REGISTRY.resolve_intent("please draft an email to the team") == "EMAIL_DRAFT"


def test_duplicate_action_id_returns_same_draft():
    pipeline.reset_idempotency_store()
    aid = "act-email-draft-dup-1"
    first = _run(action_id=aid)
    second = _run(action_id=aid)
    assert first.status == "accepted"
    assert second.status == "duplicate"
    assert second.result["draft_id"] == first.result["draft_id"]
