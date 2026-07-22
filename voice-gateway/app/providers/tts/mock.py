"""Mock TTS provider — returns a tiny silent WAV instantly. No API calls."""

import asyncio
import io
import struct


def _silent_wav(duration_ms: int = 100, sample_rate: int = 16_000) -> bytes:
    n = int(sample_rate * duration_ms / 1000)
    data_size = n * 2
    buf = io.BytesIO()
    buf.write(b"RIFF")
    buf.write(struct.pack("<I", 36 + data_size))
    buf.write(b"WAVE")
    buf.write(b"fmt ")
    buf.write(struct.pack("<I", 16))
    buf.write(struct.pack("<H", 1))
    buf.write(struct.pack("<H", 1))
    buf.write(struct.pack("<I", sample_rate))
    buf.write(struct.pack("<I", sample_rate * 2))
    buf.write(struct.pack("<H", 2))
    buf.write(struct.pack("<H", 16))
    buf.write(b"data")
    buf.write(struct.pack("<I", data_size))
    buf.write(b"\x00" * data_size)
    return buf.getvalue()


_WAV = _silent_wav()


class MockTTS:
    async def synthesize(self, text: str) -> bytes:
        await asyncio.sleep(0)
        return _WAV
