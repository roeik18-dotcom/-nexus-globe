"""Echo adapter — reflects input, zero latency baseline."""

import asyncio
import pytest
from app.adapters.echo import EchoAdapter


def test_echo_name():
    assert EchoAdapter().name == "echo"


def test_echo_reflects_text():
    adapter = EchoAdapter()

    async def collect():
        chunks = []
        async for chunk in adapter.respond("hello world", "s1"):
            chunks.append(chunk)
        return "".join(chunks)

    result = asyncio.run(collect())
    assert result == "hello world"


def test_echo_reset_is_noop():
    adapter = EchoAdapter()
    asyncio.run(adapter.reset("s1"))  # must not raise


def test_echo_implements_interface():
    from app.adapters.base import VoiceAdapter
    assert isinstance(EchoAdapter(), VoiceAdapter)
