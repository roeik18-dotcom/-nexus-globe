"""Verify that VoiceAdapter cannot be instantiated directly."""

import pytest
from app.adapters.base import VoiceAdapter


def test_adapter_is_abstract():
    with pytest.raises(TypeError):
        VoiceAdapter()


def test_concrete_must_implement_all():
    class Incomplete(VoiceAdapter):
        @property
        def name(self):
            return "incomplete"

    with pytest.raises(TypeError):
        Incomplete()
