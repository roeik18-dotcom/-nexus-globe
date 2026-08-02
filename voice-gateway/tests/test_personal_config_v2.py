"""Schema v2 dual-read — the frozen invariants I1–I18.

Source of truth: `voice-gateway/profiles/SCHEMA-V2.md`. If a test here and that
document disagree, the document wins until a new dated freeze supersedes it.

The through-line: v2 exists so a profile can say "known state, unknown date" and
"checked by whom" without the loader filling either in. Every test below is one
way that guarantee could be lost.
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from mos.personal_config import (  # noqa: E402
    SCHEMA_VERSION,
    load_file,
    load_personal_config,
    project,
)

# ── fixtures ─────────────────────────────────────────────────────────────────

V2_HEAD = """owner: test-user
layer: music
schema_version: 2
note: synthetic
sources:
  src_a:
    storage_root: dropbox
    relative_path: music/notes.rtf
    source_kind: rtf
    content_sha256: null
entries:
"""


def entry(**over) -> str:
    """One valid v2 entry, overridable per test."""
    e = {
        "id": "e1", "section": "current_expression", "type": "preference",
        "status": "active", "value": "Psytrance / Progressive.",
        "source_confidence": "high", "interpretation_confidence": "high",
        "privacy": "private", "shareability": "private_only",
        "valid_from": "null", "valid_until": "null",
        "date_confidence": "unknown", "date_precision": "unknown",
        "domain_scope": "music", "universality": "personal",
        "philos_relevance": "none", "order": "120",
        "verification_status": "source_confirmed",
    }
    e.update({k: ("null" if v is None else v) for k, v in over.items()})
    lines = [f"  - id: {e.pop('id')}"]
    for k, v in e.items():
        lines.append(f"    {k}: {v}")
    lines.append("    canonical_sources:")
    lines.append("      - source_id: src_a")
    lines.append("        evidence_ref: 'the vision section'")
    lines.append("        evidence_precision: paragraph")
    lines.append("    usage: { merlin_context: true, morning_brief: false, "
                 "music_assistant: true, philos_core: false, public_profile: false }")
    return "\n".join(lines) + "\n"


def write(tmp: Path, body: str, name: str = "music.yaml") -> Path:
    p = tmp / name
    p.write_text(body, encoding="utf-8")
    return p


def load(tmp: Path, body: str):
    return load_file(write(tmp, body))


def problems(lf) -> str:
    return " | ".join(e.problem for e in lf.errors)


# ── dispatch and v1 preservation ─────────────────────────────────────────────


class TestDispatch:
    def test_v1_still_loads_exactly_as_before(self):
        """The real v1 profiles must be untouched by v2 support."""
        st, _ = load_personal_config(Path(__file__).resolve().parent.parent / "profiles")
        assert st.schema_version == 1
        assert st.is_valid
        assert len(st.person) == 14 and len(st.music) == 6

    def test_a_v2_file_is_accepted(self, tmp_path):
        lf = load(tmp_path, V2_HEAD + entry())
        assert lf.parsed, problems(lf)
        assert lf.schema_version == 2
        assert len(lf.entries) == 1

    def test_an_unknown_version_is_refused_with_a_reason(self, tmp_path):
        lf = load(tmp_path, V2_HEAD.replace("schema_version: 2", "schema_version: 7"))
        assert not lf.parsed
        assert lf.entries == ()
        assert "unsupported version 7" in problems(lf)

    def test_v1_entry_shape_inside_a_v2_file_is_rejected(self, tmp_path):
        """Req 3 — one file, one shape. A v1 entry here is a mistake, not a mix."""
        v1_shaped = (
            "  - id: e1\n    type: preference\n    statement: v1 shape\n"
            "    confidence: stated\n    privacy: public\n"
            "    valid_from: null\n    valid_until: null\n"
            "    usage: { merlin: true, founder_principle_candidate: false, philos_core: false }\n"
        )
        lf = load(tmp_path, V2_HEAD + v1_shaped)
        assert lf.errors, "a v1-shaped entry in a v2 file must be reported"

    def test_v2_only_fields_are_absent_on_v1_entries_not_defaulted(self):
        """SCHEMA-V2 §14 — a default would answer a question v1 never asked."""
        st, _ = load_personal_config(Path(__file__).resolve().parent.parent / "profiles")
        for e in st.person + st.music:
            assert e.verification_status is None
            assert e.status is None
            assert e.date_precision is None


# ── I4 · I14 — the Philos gate ───────────────────────────────────────────────


class TestPhilosGate:
    def test_philos_core_true_is_rejected_in_v2_too(self, tmp_path):
        body = V2_HEAD + entry().replace("philos_core: false", "philos_core: true")
        lf = load(tmp_path, body)
        assert lf.errors, "usage.philos_core: true must never validate"

    def test_accepted_core_requires_explicit_promotion(self, tmp_path):
        """I4 — philos_core true demands philos_relevance accepted_core."""
        body = V2_HEAD + entry(philos_relevance="accepted_core")
        lf = load(tmp_path, body)
        # accepted_core alone must not silently authorise the surface
        for e in lf.entries:
            assert e.usage.get("philos_core") is not True


# ── I5 · I15 — projection routing ────────────────────────────────────────────


class TestProjectionRouting:
    def test_historical_goes_only_to_the_historical_projection(self, tmp_path):
        lf = load(tmp_path, V2_HEAD + entry(status="historical", section="legacy_expression", order="70"))
        st = project([lf])
        assert len(st.routines_history) == 1
        assert st.music == ()

    def test_archived_enters_neither_projection(self, tmp_path):
        lf = load(tmp_path, V2_HEAD + entry(status="archived"))
        st = project([lf])
        assert st.music == ()
        assert st.routines_history == ()

    def test_needs_review_is_out_of_the_canonical_active_projection(self, tmp_path):
        lf = load(tmp_path, V2_HEAD + entry(verification_status="needs_review"))
        st = project([lf])
        assert st.music == (), "a candidate must not read as confirmed config"

    def test_an_active_confirmed_entry_does_reach_the_projection(self, tmp_path):
        st = project([load(tmp_path, V2_HEAD + entry())])
        assert len(st.music) == 1

    def test_an_entry_lands_in_exactly_one_place(self, tmp_path):
        """One routing mechanism, not several: no entry is counted twice or lost."""
        body = V2_HEAD + entry(id="a") + entry(id="b", status="historical",
                                               section="legacy_expression", order="70")
        body += entry(id="c", status="archived")
        body += entry(id="d", verification_status="needs_review", order="130")
        lf = load(tmp_path, body)
        st = project([lf])
        placed = [e.id for e in
                  st.person + st.music + st.routines_history + st.daily_opening
                  + st.projects + st.archived + st.review_candidates + st.unverified
                  + st.inferred + st.disputed]
        assert sorted(placed) == ["a", "b", "c", "d"]
        assert len(placed) == len(set(placed)), "an entry was routed to two buckets"

    def test_archived_wins_over_needs_review_deterministically(self, tmp_path):
        """Both-at-once must resolve one way, always the same way."""
        lf = load(tmp_path, V2_HEAD + entry(
            status="archived", verification_status="needs_review"))
        st = project([lf])
        assert len(st.archived) == 1 and st.review_candidates == ()

    def test_withheld_entries_are_not_reported_as_an_empty_profile(self, tmp_path):
        """The absence rule, applied to v2 lifecycle.

        A file of nothing but archived and needs_review entries projects nothing —
        but data EXISTS and was deliberately withheld. Calling that empty lets a
        later layer conclude "Roei has declared nothing" when the truth is
        "nothing has been confirmed yet". Same conflation SourceCoverage exists
        to prevent, one layer down.
        """
        body = V2_HEAD + entry(id="gone", status="archived")
        body += entry(id="candidate", verification_status="needs_review", order="130")
        st = project([load(tmp_path, body)])
        assert st.total_entries == 0
        assert not st.is_empty, "withheld entries are not an absence of entries"

    def test_a_genuinely_empty_profile_is_still_empty(self, tmp_path):
        st = project([load(tmp_path, V2_HEAD.replace("entries:\n", "entries: []\n"))])
        assert st.is_empty


# ── I6 · I17 — dates ─────────────────────────────────────────────────────────


class TestDates:
    def test_a_date_requires_date_confidence_dated(self, tmp_path):
        """I6 — a non-null valid_until with date_confidence: unknown is a lie."""
        lf = load(tmp_path, V2_HEAD + entry(valid_until='"2023-01-01"', date_confidence="unknown"))
        assert lf.errors, "a dated value with unknown date_confidence must be reported"

    def test_historical_with_null_dates_is_valid(self, tmp_path):
        """The decision this schema exists for: known state, unknown date."""
        lf = load(tmp_path, V2_HEAD + entry(
            status="historical", section="legacy_expression", order="70",
            valid_from=None, valid_until=None,
            date_confidence="unknown", date_precision="unknown",
        ))
        assert lf.parsed and not lf.errors, problems(lf)

    def test_date_precision_is_independent_of_evidence_precision(self, tmp_path):
        """I17 — a paragraph-level citation can still yield only a year."""
        lf = load(tmp_path, V2_HEAD + entry(
            valid_from='"2023"', date_confidence="dated", date_precision="year"))
        assert lf.parsed, problems(lf)

    def test_unknown_date_confidence_forbids_a_precision(self, tmp_path):
        lf = load(tmp_path, V2_HEAD + entry(date_confidence="unknown", date_precision="year"))
        assert lf.errors, "precision without confidence must be reported"


# ── I8 — portable sources ────────────────────────────────────────────────────


class TestPortableSources:
    def test_an_absolute_path_in_a_source_is_invalid(self, tmp_path):
        body = V2_HEAD.replace("relative_path: music/notes.rtf",
                               "relative_path: /Users/roei/Dropbox/music/notes.rtf") + entry()
        lf = load(tmp_path, body)
        assert lf.errors, "an absolute path must never appear in profile data"

    def test_an_unresolvable_source_id_is_reported(self, tmp_path):
        body = V2_HEAD + entry().replace("source_id: src_a", "source_id: src_missing")
        lf = load(tmp_path, body)
        assert lf.errors, "a canonical_sources source_id must resolve in the registry"

    def test_a_missing_storage_root_is_explicit(self, tmp_path):
        body = V2_HEAD.replace("    storage_root: dropbox\n", "") + entry()
        lf = load(tmp_path, body)
        assert lf.errors or lf.warnings, "a missing storage_root must be stated, not ignored"


# ── I10 · I11 · I12 — evidence precision ─────────────────────────────────────


class TestEvidencePrecision:
    def test_null_evidence_ref_is_allowed_only_at_document_or_ocr_pending(self, tmp_path):
        bad = V2_HEAD + entry().replace(
            "        evidence_ref: 'the vision section'", "        evidence_ref: null")
        lf = load(tmp_path, bad)
        assert lf.errors, "null evidence_ref at paragraph precision must be reported"

    def test_ocr_pending_forces_needs_review(self, tmp_path):
        body = V2_HEAD + entry().replace(
            "evidence_precision: paragraph", "evidence_precision: ocr_pending")
        lf = load(tmp_path, body)
        # I11: either rejected, or coerced to needs_review — never silently confirmed
        if lf.entries:
            assert lf.entries[0].verification_status == "needs_review"
        else:
            assert lf.errors


# ── I9 · I11 — order bands ───────────────────────────────────────────────────


class TestOrderBands:
    def test_order_outside_its_section_band_is_reported(self, tmp_path):
        lf = load(tmp_path, V2_HEAD + entry(section="core_identity", order="500"))
        assert lf.errors, "core_identity must sit in 10–50"

    def test_order_inside_its_band_is_accepted(self, tmp_path):
        lf = load(tmp_path, V2_HEAD + entry(section="core_identity", order="20"))
        assert lf.parsed and not lf.errors, problems(lf)


# ── I14 — cross-links warn, never fail ───────────────────────────────────────


class TestCrossLinks:
    def test_a_forward_cross_link_warns_but_loads(self, tmp_path):
        body = V2_HEAD + entry() + (
            "    cross_links:\n"
            "      - to: person\n        entry: not-written-yet\n        relation: related_to\n"
        )
        lf = load(tmp_path, body)
        assert lf.parsed, problems(lf)
        assert len(lf.entries) == 1, "a forward reference must not drop the entry"


# ── enum discipline ──────────────────────────────────────────────────────────


class TestEnums:
    @pytest.mark.parametrize("field,bad", [
        ("status", "retired"), ("section", "nonsense"), ("privacy", "public"),
        ("universality", "cosmic"), ("verification_status", "probably"),
        ("philos_relevance", "core"), ("date_precision", "century"),
    ])
    def test_an_unknown_enum_value_is_reported(self, tmp_path, field, bad):
        lf = load(tmp_path, V2_HEAD + entry(**{field: bad}))
        assert lf.errors, f"{field}={bad} must be rejected"

    @pytest.mark.parametrize("field,stale", [
        ("verification_status", "source_backed"),
        ("verification_status", "user_confirmed"),
        ("date_precision", "day"),
    ])
    def test_the_superseded_vocabulary_is_refused(self, tmp_path, field, stale):
        """A freeze that still accepts the old words is not a freeze.

        These three were real values in the pre-freeze draft. Silently accepting
        them would let a stale profile load and read as though it had been
        authored against the frozen schema.
        """
        lf = load(tmp_path, V2_HEAD + entry(**{field: stale}))
        assert lf.errors, f"the superseded value {field}={stale} must be refused"


# ── §8 · I3 — redaction is a policy LIST ─────────────────────────────────────


class TestRedaction:
    """`redaction` is a POLICY LIST (SCHEMA-V2 §4/§8), never the pre-freeze dict.

    Merged from two classes that had drifted apart in this file — the second
    shadowed the first, so half these assertions never ran. Every unique case from
    both is kept.
    """

    def test_a_valid_policy_list_is_accepted(self, tmp_path):
        lf = load(tmp_path, V2_HEAD + entry(redaction="[never_verbatim, external_models_blocked]"))
        assert lf.parsed and not lf.errors, problems(lf)
        assert lf.entries[0].redaction == ("never_verbatim", "external_models_blocked")

    def test_every_frozen_policy_is_accepted(self, tmp_path):
        lf = load(tmp_path, V2_HEAD + entry(
            redaction="[paraphrase, never_verbatim, never_aloud, external_models_blocked]"))
        assert lf.parsed and not lf.errors, problems(lf)

    def test_the_old_dict_shape_is_refused(self, tmp_path):
        """The pre-freeze shape, with its real field names — not a strawman."""
        lf = load(tmp_path, V2_HEAD + entry(
            redaction="{ required_for_logs: true, required_for_external_models: true }"))
        assert lf.errors, "the superseded dict shape must be refused"

    def test_none_cannot_coexist_with_another_policy(self, tmp_path):
        """`none` means no constraint; alongside a constraint it is a contradiction."""
        lf = load(tmp_path, V2_HEAD + entry(redaction="[none, never_verbatim]"))
        assert lf.errors, "none alongside another policy must be refused"

    def test_none_alone_is_fine(self, tmp_path):
        lf = load(tmp_path, V2_HEAD + entry(redaction="[none]"))
        assert lf.parsed and not lf.errors, problems(lf)

    def test_an_unknown_policy_is_refused(self, tmp_path):
        lf = load(tmp_path, V2_HEAD + entry(redaction="[shred_it]"))
        assert lf.errors

    def test_duplicate_policies_are_refused(self, tmp_path):
        lf = load(tmp_path, V2_HEAD + entry(redaction="[paraphrase, paraphrase]"))
        assert lf.errors, "duplicate redaction policies must be refused"

# ── no automatic migration ───────────────────────────────────────────────────


class TestNoAutoMigration:
    def test_loading_never_writes_to_the_profile(self, tmp_path):
        p = write(tmp_path, V2_HEAD + entry())
        before = p.read_bytes()
        load_file(p)
        load_personal_config(tmp_path, ("music.yaml",))
        assert p.read_bytes() == before, "the loader must never rewrite a profile"

    def test_schema_version_constant_still_declares_v1_as_the_default(self):
        assert SCHEMA_VERSION == 1


# ── graft alignment with SCHEMA-V2.md @ 8d299b0 (verification / date / redaction) ──


class TestVerificationStates:
    FINAL = ["unverified", "self_confirmed", "human_confirmed",
             "source_confirmed", "inferred", "disputed", "needs_review"]

    @pytest.mark.parametrize("state", FINAL)
    def test_every_final_verification_state_is_accepted(self, tmp_path, state):
        lf = load(tmp_path, V2_HEAD + entry(verification_status=state))
        assert lf.parsed and not lf.errors, problems(lf)

    @pytest.mark.parametrize("stale", ["source_backed", "user_confirmed"])
    def test_stale_verification_states_are_rejected(self, tmp_path, stale):
        lf = load(tmp_path, V2_HEAD + entry(verification_status=stale))
        assert lf.errors, f"{stale} was removed by 8d299b0 and must be rejected"


class TestDatePrecisionStates:
    @pytest.mark.parametrize("prec,conf,vf", [
        ("unknown", "unknown", None),
        ("exact", "dated", "2023"),
        ("month", "dated", "2023"),
        ("year", "dated", "2023"),
        ("approximate", "dated", "2023"),
    ])
    def test_every_final_date_precision_is_accepted(self, tmp_path, prec, conf, vf):
        kw = {"date_precision": prec, "date_confidence": conf}
        if vf is not None:
            kw["valid_from"] = f'"{vf}"'
        lf = load(tmp_path, V2_HEAD + entry(**kw))
        assert lf.parsed and not lf.errors, problems(lf)

    def test_stale_day_precision_is_rejected(self, tmp_path):
        lf = load(tmp_path, V2_HEAD + entry(
            date_precision="day", date_confidence="dated", valid_from='"2023"'))
        assert lf.errors, "'day' was removed by 8d299b0 and must be rejected"


class TestUnverifiedProjection:
    def test_unverified_is_out_of_the_canonical_active_projection(self, tmp_path):
        st = project([load(tmp_path, V2_HEAD + entry(verification_status="unverified"))])
        assert st.music == (), "an unverified claim must not read as confirmed config"
        assert len(st.unverified) == 1

    def test_unverified_is_counted_apart_from_needs_review(self, tmp_path):
        """I18 — "never checked" and "flagged for a human" are different facts.

        `unverified` is the schema's default (§14), so folding it into
        `review_candidates` would make that count grow with every unreviewed entry
        and stop meaning "someone asked for a human to look at this".
        """
        body = V2_HEAD + entry(id="never-checked", verification_status="unverified")
        body += entry(id="flagged", verification_status="needs_review", order="130")
        st = project([load(tmp_path, body)])
        assert [e.id for e in st.unverified] == ["never-checked"]
        assert [e.id for e in st.review_candidates] == ["flagged"]
        assert st.summary()["unverified"] == 1
        assert st.summary()["review_candidates"] == 1

    @pytest.mark.parametrize("state", ["self_confirmed", "human_confirmed",
                                       "source_confirmed"])
    def test_only_the_three_confirmed_states_reach_the_projection(self, tmp_path, state):
        """SCHEMA-V2 §9.1 / I15 — the admission allowlist, exhaustively."""
        st = project([load(tmp_path, V2_HEAD + entry(verification_status=state))])
        assert len(st.music) == 1, f"{state} is on the allowlist (§9.1)"

    @pytest.mark.parametrize("state,bucket", [
        ("unverified", "unverified"), ("needs_review", "review_candidates"),
        ("inferred", "inferred"), ("disputed", "disputed"),
    ])
    def test_every_other_state_is_withheld_into_its_own_bucket(self, tmp_path, state, bucket):
        """v2.1 — `inferred` is a guess and `disputed` is contested; neither is canon.

        Each lands in a SEPARATE bucket. One "withheld" number would say how much is
        missing without saying what to do about it: a guess needs evidence, a
        contested claim needs resolving, an unchecked one needs looking at.
        """
        st = project([load(tmp_path, V2_HEAD + entry(verification_status=state))])
        assert st.music == (), f"{state} must not read as current config (§9.1)"
        assert [e.id for e in getattr(st, bucket)] == ["e1"]
        assert st.summary()[bucket] == 1
        assert st.summary()["withheld_total"] == 1

    def test_an_unconfirmed_historical_entry_is_withheld_from_history_too(self, tmp_path):
        """The verification gate precedes status routing.

        An unconfirmed claim about the past is still unconfirmed; the historical
        projection is a record, not a holding pen for things we never checked.
        """
        st = project([load(tmp_path, V2_HEAD + entry(
            status="historical", section="legacy_expression", order="70",
            verification_status="inferred"))])
        assert st.routines_history == ()
        assert len(st.inferred) == 1

    def test_a_v1_entry_is_never_subject_to_the_v2_allowlist(self):
        """v1 has no `verification_status`; applying the allowlist would erase it all."""
        st, _ = load_personal_config(Path(__file__).resolve().parent.parent / "profiles")
        assert len(st.person) == 14 and len(st.music) == 6
        assert st.withheld_total == 0


class TestDiagnosticsPrivacy:
    def test_summary_never_carries_the_statement_value(self, tmp_path):
        import json
        marker = "PRIVATE_MARKER_9f3a"
        # `sensitive` carries its own redaction requirement (I3), supplied here so
        # this stays a test about diagnostics rather than one about admission.
        st = project([load(tmp_path, V2_HEAD + entry(
            value=f"'{marker}'", privacy="sensitive",
            redaction="[external_models_blocked]"))])
        assert marker not in json.dumps(st.summary(), ensure_ascii=False, default=str)

    def test_a_validation_error_never_echoes_the_value(self, tmp_path):
        import json
        marker = "PRIVATE_MARKER_bad"
        st = project([load(tmp_path, V2_HEAD + entry(value=f"'{marker}'", section="nonsense"))])
        assert marker not in json.dumps(st.summary(), ensure_ascii=False, default=str)


# ── Unit A — cross-field correctness (§2 · I3 · I17 · philos_relevance) ───────
#
# Every rule below is a CROSS-FIELD one: each field is individually legal and the
# combination is not. That is the class of error the loader did not previously
# catch — shape was validated, coupling was not.


class TestFileLevelOwner:
    """§2 — `owner` is the file-level answer to "whose profile is this" (I1)."""

    def test_a_v2_file_without_owner_is_reported(self, tmp_path):
        lf = load(tmp_path, V2_HEAD.replace("owner: test-user\n", "") + entry())
        assert lf.errors, "a v2 file with no owner must be reported"
        assert any(e.location == "owner" for e in lf.errors), problems(lf)

    def test_a_v2_file_with_owner_loads(self, tmp_path):
        lf = load(tmp_path, V2_HEAD + entry())
        assert lf.parsed and not lf.errors, problems(lf)

    def test_an_empty_owner_is_not_an_owner(self, tmp_path):
        lf = load(tmp_path, V2_HEAD.replace("owner: test-user", 'owner: ""') + entry())
        assert lf.errors, "an empty owner string must be reported"

    def test_v1_is_untouched_by_the_v2_owner_rule(self, tmp_path):
        """v1 behaviour is frozen — the v2 requirement must not reach back."""
        body = (
            "layer: person\nschema_version: 1\nentries:\n"
            "  - id: a\n    type: fact\n    statement: x\n"
            "    confidence: stated\n    privacy: private\n"
            "    valid_from: null\n    valid_until: null\n"
            "    usage: { merlin: true }\n"
        )
        lf = load(tmp_path, body)
        assert lf.parsed and not lf.errors, problems(lf)


class TestDatePrecisionRequiresConfidence:
    """I17 — `date_precision != unknown` ⇒ `date_confidence: dated`.

    The explicit-`unknown` case was already covered. The gap was ABSENCE: a
    precision stated with no confidence field at all asserts exactness nobody
    vouched for, which is the same error the explicit case exists to stop.
    """

    def test_a_precision_with_no_date_confidence_at_all_is_reported(self, tmp_path):
        body = V2_HEAD + entry(date_precision="exact").replace(
            "    date_confidence: unknown\n", "")
        lf = load(tmp_path, body)
        assert lf.errors, "date_precision without any date_confidence must be reported"

    def test_a_precision_with_dated_confidence_is_accepted(self, tmp_path):
        lf = load(tmp_path, V2_HEAD + entry(
            date_precision="exact", date_confidence="dated"))
        assert lf.parsed and not lf.errors, problems(lf)

    def test_unknown_precision_with_no_date_confidence_stays_legal(self, tmp_path):
        """Absence is only an error when a precision is claimed alongside it."""
        body = V2_HEAD + entry().replace("    date_confidence: unknown\n", "")
        lf = load(tmp_path, body)
        assert lf.parsed and not lf.errors, problems(lf)


class TestPrivacyRedactionCoupling:
    """I3 — `privacy: sensitive` ⇒ `redaction` includes `external_models_blocked`."""

    def test_sensitive_with_no_redaction_at_all_is_reported(self, tmp_path):
        """§8 — absent `redaction` means `[none]`, so omitting it is not a bypass."""
        lf = load(tmp_path, V2_HEAD + entry(privacy="sensitive"))
        assert lf.errors, "sensitive with no redaction must be reported"

    def test_sensitive_with_redaction_none_is_reported(self, tmp_path):
        lf = load(tmp_path, V2_HEAD + entry(privacy="sensitive", redaction="[none]"))
        assert lf.errors, "sensitive with redaction [none] must be reported"

    def test_sensitive_with_the_block_is_accepted(self, tmp_path):
        lf = load(tmp_path, V2_HEAD + entry(
            privacy="sensitive", redaction="[external_models_blocked]"))
        assert lf.parsed and not lf.errors, problems(lf)

    def test_sensitive_with_the_block_among_others_is_accepted(self, tmp_path):
        lf = load(tmp_path, V2_HEAD + entry(
            privacy="sensitive",
            redaction="[never_verbatim, never_aloud, external_models_blocked]"))
        assert lf.parsed and not lf.errors, problems(lf)

    def test_private_needs_no_block(self, tmp_path):
        """The rule binds `sensitive` only — `private` is local-only by class."""
        lf = load(tmp_path, V2_HEAD + entry(privacy="private"))
        assert lf.parsed and not lf.errors, problems(lf)

    def test_a_malformed_redaction_reports_shape_once_not_twice(self, tmp_path):
        """A list that failed shape validation must not also be read as `[none]`."""
        lf = load(tmp_path, V2_HEAD + entry(privacy="sensitive", redaction="[shred_it]"))
        assert lf.errors
        assert not any("external_models_blocked" in e.problem for e in lf.errors), problems(lf)


class TestPublicProfileGate:
    """I3 — `public_profile` needs `public_candidate` AND `privacy != sensitive`."""

    @staticmethod
    def _public(body: str) -> str:
        return body.replace("public_profile: false", "public_profile: true")

    def test_public_profile_on_a_private_only_entry_is_reported(self, tmp_path):
        lf = load(tmp_path, V2_HEAD + self._public(entry(shareability="private_only")))
        assert lf.errors, "public_profile with private_only must be reported"

    def test_public_profile_on_a_sensitive_entry_is_reported(self, tmp_path):
        lf = load(tmp_path, V2_HEAD + self._public(entry(
            shareability="public_candidate", privacy="sensitive",
            redaction="[external_models_blocked]")))
        assert lf.errors, "public_profile with privacy: sensitive must be reported"

    def test_public_profile_on_a_public_candidate_is_accepted(self, tmp_path):
        lf = load(tmp_path, V2_HEAD + self._public(entry(
            shareability="public_candidate", privacy="private")))
        assert lf.parsed and not lf.errors, problems(lf)

    def test_private_only_without_public_profile_is_accepted(self, tmp_path):
        lf = load(tmp_path, V2_HEAD + entry(shareability="private_only"))
        assert lf.parsed and not lf.errors, problems(lf)

    def test_public_profile_with_no_shareability_at_all_is_reported(self, tmp_path):
        body = self._public(entry()).replace("    shareability: private_only\n", "")
        lf = load(tmp_path, V2_HEAD + body)
        assert lf.errors, "public_profile with no shareability must be reported"


class TestPhilosRelevanceIsRequired:
    """Locked decision — in v2 `philos_relevance` is explicit or it is an error.

    `none` is an answer ("checked, no Philos relevance"); absence is the lack of
    one. Defaulting absence to `none` would invent the decision, which is the
    error §14 names for dates and verification alike.
    """

    def test_an_absent_philos_relevance_is_reported(self, tmp_path):
        body = V2_HEAD + entry().replace("    philos_relevance: none\n", "")
        lf = load(tmp_path, body)
        assert lf.errors, "a v2 entry with no philos_relevance must be reported"

    def test_it_is_never_defaulted_to_none(self, tmp_path):
        body = V2_HEAD + entry().replace("    philos_relevance: none\n", "")
        lf = load(tmp_path, body)
        assert all(e.philos_relevance != "none" for e in lf.entries), (
            "absence must not be silently materialised as 'none'")

    @pytest.mark.parametrize("value", ["none", "related"])
    def test_an_explicit_ungated_value_is_accepted(self, tmp_path, value):
        lf = load(tmp_path, V2_HEAD + entry(philos_relevance=value))
        assert lf.parsed and not lf.errors, problems(lf)

    @pytest.mark.parametrize(
        "value", ["bridge_candidate", "founder_candidate", "accepted_core"])
    def test_a_promoted_value_loads_only_as_written(self, tmp_path, value):
        """I14 — promotion is read from the file, never derived, and never
        gated on a hardcoded entry id."""
        lf = load(tmp_path, V2_HEAD + entry(philos_relevance=value))
        assert lf.parsed and not lf.errors, problems(lf)
        assert lf.entries[0].philos_relevance == value
        assert lf.entries[0].usage.get("philos_core") is not True

    def test_v1_entries_still_expose_none(self):
        """Backward compatibility — v1 never answered this question."""
        st, _ = load_personal_config(Path(__file__).resolve().parent.parent / "profiles")
        for e in st.person + st.music:
            assert e.philos_relevance is None


# ── Unit B — relation integrity (I7) ─────────────────────────────────────────
#
# I7: `supersedes` claims true invalidation, so the target must actually be
# `archived`. The rule is only checkable when the target is in the same file —
# and where it is not, the honest outcome is "cannot check", never "assume
# archived". That split is what these tests hold in place.

SUPERSEDES = "unresolved_supersedes_target"


def warns(lf) -> str:
    return " | ".join(w.problem for w in lf.warnings)


def rel_warnings(lf):
    return [w for w in lf.warnings if w.location.endswith(".relations")]


class TestSupersessionIntegrity:
    """I7 — `supersedes` only where the target really is `archived`."""

    def test_superseding_an_archived_target_is_accepted(self, tmp_path):
        body = (entry(id="e1", relations="[{type: supersedes, target: e2}]")
                + entry(id="e2", status="archived"))
        lf = load(tmp_path, V2_HEAD + body)
        assert lf.parsed and not lf.errors, problems(lf)
        assert not rel_warnings(lf), warns(lf)

    def test_superseding_an_active_target_is_an_error(self, tmp_path):
        body = (entry(id="e1", relations="[{type: supersedes, target: e2}]")
                + entry(id="e2", status="active"))
        lf = load(tmp_path, V2_HEAD + body)
        assert lf.errors, "supersedes must not point at an active target"
        assert any("archived" in e.problem for e in lf.errors), problems(lf)

    def test_superseding_a_historical_target_is_an_error(self, tmp_path):
        """Historical is retained, not invalidated — I5 keeps the two apart."""
        body = (entry(id="e1", relations="[{type: supersedes, target: e2}]")
                + entry(id="e2", status="historical",
                        section="legacy_expression", order="70"))
        lf = load(tmp_path, V2_HEAD + body)
        assert lf.errors, "supersedes must not point at a historical target"

    def test_a_missing_target_warns_specifically_and_still_loads(self, tmp_path):
        lf = load(tmp_path, V2_HEAD + entry(
            id="e1", relations="[{type: supersedes, target: nowhere}]"))
        assert lf.parsed and not lf.errors, problems(lf)
        assert any(SUPERSEDES in w.problem for w in lf.warnings), warns(lf)

    def test_a_forward_target_warns_specifically_and_still_loads(self, tmp_path):
        """Authoring order must stay legal — the target may be written later."""
        body = (entry(id="e1", relations="[{type: supersedes, target: e9}]")
                + entry(id="e2", status="archived"))
        lf = load(tmp_path, V2_HEAD + body)
        assert lf.parsed and not lf.errors, problems(lf)
        assert len(lf.entries) == 2, "a forward reference must not drop the entry"
        assert any(SUPERSEDES in w.problem for w in lf.warnings), warns(lf)

    def test_an_unresolved_supersedes_warns_exactly_once(self, tmp_path):
        """The specific warning REPLACES the generic one — never both."""
        lf = load(tmp_path, V2_HEAD + entry(
            id="e1", relations="[{type: supersedes, target: nowhere}]"))
        assert len(rel_warnings(lf)) == 1, warns(lf)
        assert SUPERSEDES in rel_warnings(lf)[0].problem

    def test_the_rule_is_never_assumed_satisfied(self, tmp_path):
        """An unresolved target must never be read as though it were archived."""
        lf = load(tmp_path, V2_HEAD + entry(
            id="e1", relations="[{type: supersedes, target: nowhere}]"))
        assert not lf.errors
        assert lf.warnings, "silence would read as a satisfied rule"

    def test_a_target_that_failed_validation_reads_as_unresolved(self, tmp_path):
        """Known limitation, pinned deliberately.

        An entry rejected for its own reasons is dropped before this check, so a
        `supersedes` pointing at it cannot be evaluated and degrades to the
        unresolved warning rather than the archived-target error.
        """
        body = (entry(id="e1", relations="[{type: supersedes, target: e2}]")
                + entry(id="e2", status="archived", section="nonsense"))
        lf = load(tmp_path, V2_HEAD + body)
        assert lf.errors, "the invalid target is still reported on its own terms"
        assert any(SUPERSEDES in w.problem for w in lf.warnings), warns(lf)
        assert not any("archived" in e.problem for e in lf.errors), problems(lf)


class TestOtherRelationTypesUnchanged:
    """Only `supersedes` gains a rule; every other type keeps its behaviour."""

    @pytest.mark.parametrize(
        "rtype", ["related_to", "derived_from", "succeeds_as_primary_expression"])
    def test_an_unresolved_non_supersedes_keeps_the_generic_warning(self, tmp_path, rtype):
        lf = load(tmp_path, V2_HEAD + entry(
            id="e1", relations=f"[{{type: {rtype}, target: nowhere}}]"))
        assert lf.parsed and not lf.errors, problems(lf)
        assert len(rel_warnings(lf)) == 1, warns(lf)
        assert "forward reference" in rel_warnings(lf)[0].problem
        assert SUPERSEDES not in rel_warnings(lf)[0].problem

    @pytest.mark.parametrize("status", ["active", "historical"])
    def test_succeeds_as_primary_expression_never_checks_status(self, tmp_path, status):
        """§I7's alternative for a change of expression carries no status rule."""
        kw = {"section": "legacy_expression", "order": "70"} if status == "historical" else {}
        body = (entry(id="e1",
                      relations="[{type: succeeds_as_primary_expression, target: e2}]")
                + entry(id="e2", status=status, **kw))
        lf = load(tmp_path, V2_HEAD + body)
        assert lf.parsed and not lf.errors, problems(lf)
        assert not rel_warnings(lf), warns(lf)

    def test_cross_links_are_untouched_by_the_supersedes_rule(self, tmp_path):
        body = entry(id="e1") + (
            "    cross_links:\n"
            "      - to: person\n        entry: not-written-yet\n        relation: related_to\n"
        )
        lf = load(tmp_path, V2_HEAD + body)
        assert lf.parsed and not lf.errors, problems(lf)
        assert any(w.location.endswith(".cross_links") for w in lf.warnings), warns(lf)

    def test_v1_profiles_gain_no_relation_warnings(self):
        """v1 has no `relations` field at all — the rule must not reach back."""
        st, loaded = load_personal_config(
            Path(__file__).resolve().parent.parent / "profiles")
        assert st.is_valid
        assert st.warnings == ()
        for lf in loaded:
            assert lf.warnings == ()


# ── I1 — ownership is file-level; `owner_scope` was removed ──────────────────
#
# §3 lists `owner_scope` among the fields v2 removed, and I1 says why: ownership
# is the file-level `owner`, claim scope is `universality`. The two are different
# questions, so a leftover `owner_scope` is reported rather than quietly mapped
# onto either — a silent remap would answer a question the author did not ask,
# and silent acceptance would let them believe a dead field still works.


class TestOwnerScopeIsRemoved:
    def test_a_v2_entry_carrying_owner_scope_is_rejected(self, tmp_path):
        lf = load(tmp_path, V2_HEAD + entry(owner_scope="roei"))
        assert lf.errors, "owner_scope must be reported, not ignored"
        assert any(e.location.endswith(".owner_scope") for e in lf.errors), problems(lf)

    def test_the_diagnostic_names_both_replacements(self, tmp_path):
        """The author needs to know WHICH field answers their question."""
        lf = load(tmp_path, V2_HEAD + entry(owner_scope="roei"))
        joined = problems(lf)
        assert "owner" in joined and "universality" in joined, joined

    def test_the_entry_is_not_silently_kept(self, tmp_path):
        lf = load(tmp_path, V2_HEAD + entry(owner_scope="roei"))
        assert lf.entries == (), "a rejected entry must not survive validation"

    def test_it_is_never_remapped_onto_universality(self, tmp_path):
        """A remap would answer `universality` with a value meant for ownership."""
        lf = load(tmp_path, V2_HEAD + entry(owner_scope="shared", universality="personal"))
        assert lf.errors
        assert all(e.universality == "personal" for e in lf.entries)

    def test_an_entry_without_owner_scope_stays_valid(self, tmp_path):
        lf = load(tmp_path, V2_HEAD + entry())
        assert lf.parsed and not lf.errors, problems(lf)
        assert len(lf.entries) == 1

    def test_a_null_owner_scope_is_still_the_removed_field(self, tmp_path):
        """Writing the key at all is the mistake; its value is beside the point."""
        lf = load(tmp_path, V2_HEAD + entry(owner_scope=None))
        assert lf.errors, "a present-but-null owner_scope is still the dead field"

    def test_v1_entries_are_unaffected(self, tmp_path):
        """v1 never rejected unknown keys and its behaviour stays frozen."""
        body = (
            "layer: person\nschema_version: 1\nentries:\n"
            "  - id: a\n    type: fact\n    statement: x\n"
            "    confidence: stated\n    privacy: private\n"
            "    owner_scope: roei\n"
            "    valid_from: null\n    valid_until: null\n"
            "    usage: { merlin: true }\n"
        )
        lf = load(tmp_path, body)
        assert lf.parsed and not lf.errors, problems(lf)
        assert len(lf.entries) == 1

    def test_the_live_v1_profiles_are_unchanged(self):
        st, _ = load_personal_config(Path(__file__).resolve().parent.parent / "profiles")
        assert st.is_valid
        assert len(st.person) == 14 and len(st.music) == 6

    def test_the_canonical_projection_is_untouched(self, tmp_path):
        """I15 routing must not shift: a clean entry still projects as current."""
        st = project([load(tmp_path, V2_HEAD + entry())])
        assert len(st.music) == 1
        assert st.withheld_total == 0

    def test_a_rejected_entry_reaches_no_bucket(self, tmp_path):
        """Rejection is a validation error, not a withheld-verification bucket."""
        st = project([load(tmp_path, V2_HEAD + entry(owner_scope="roei"))])
        assert st.total_entries == 0
        assert st.withheld_total == 0, "a schema error is not a withholding decision"
        assert not st.is_valid
