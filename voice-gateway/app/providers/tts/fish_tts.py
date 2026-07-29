"""Fish Audio TTS provider.

Streaming mode (stream_synthesize):  audio plays as it arrives from Fish Audio —
  the WAV header is parsed from the first HTTP chunk; subsequent chunks go
  directly to AudioPlayer.play_stream() without waiting for the full response.

Fallback:  on any HTTP / timeout error, synthesize() falls back to OpenAI TTS
  automatically (if OPENAI_API_KEY is set).

Config (in .env):
    TTS_PROVIDER=fish_audio
    FISH_AUDIO_API_KEY=<bearer token from fish.audio>
    FISH_AUDIO_VOICE_ID=<model_id from the voice URL on fish.audio>
"""

import io
import logging
import wave as _wave_mod
from math import gcd
from typing import AsyncGenerator

import httpx
import numpy as np
from scipy.io import wavfile
from scipy.signal import resample_poly

from app.config import settings

logger = logging.getLogger(__name__)

_TARGET_SR = 24_000   # must match merlin_service._TTS_SR
_API_URL   = "https://api.fish.audio/v1/tts"


def _decode_pcm_bytes(data: bytes, sample_width: int, n_channels: int) -> np.ndarray:
    """Decode raw PCM bytes from a WAV stream → float32 mono."""
    if sample_width == 2:
        arr = np.frombuffer(data, dtype=np.int16).astype(np.float32) / 32768.0
    elif sample_width == 4:
        arr = np.frombuffer(data, dtype=np.int32).astype(np.float32) / 2_147_483_648.0
    else:
        arr = np.frombuffer(data, dtype=np.uint8).astype(np.float32) / 128.0 - 1.0
    if n_channels > 1:
        # Truncate to a multiple of n_channels before reshape
        trim = (len(arr) // n_channels) * n_channels
        arr = arr[:trim].reshape(-1, n_channels).mean(axis=1)
    return arr


def _wav_to_pcm_int16(wav_bytes: bytes) -> bytes:
    """Decode a full WAV blob → int16 PCM at _TARGET_SR."""
    sr, audio = wavfile.read(io.BytesIO(wav_bytes))

    if audio.dtype == np.int16:
        audio = audio.astype(np.float32) / 32768.0
    elif audio.dtype == np.int32:
        audio = audio.astype(np.float32) / 2_147_483_648.0
    else:
        audio = audio.astype(np.float32)

    if audio.ndim == 2:
        audio = audio.mean(axis=1)

    if sr != _TARGET_SR:
        g     = gcd(sr, _TARGET_SR)
        audio = resample_poly(audio, _TARGET_SR // g, sr // g).astype(np.float32)

    return (np.clip(audio, -1.0, 1.0) * 32767).astype(np.int16).tobytes()


class FishAudioTTS:
    def __init__(self) -> None:
        self._api_key  = settings.fish_audio_api_key
        self._voice_id = settings.fish_audio_voice_id
        self._fallback = None
        if settings.openai_api_key:
            from app.providers.tts.openai_tts import OpenAITTS
            self._fallback = OpenAITTS()
            logger.info("fish_audio: OpenAI TTS fallback configured")

    # ── Non-streaming (used by providers that don't check for stream_synthesize) ─

    async def synthesize(self, text: str) -> bytes:
        if not text.strip():
            return b""
        try:
            return await self._fetch_wav(text)
        except Exception as exc:
            logger.warning("fish_audio failed (%s) — falling back to OpenAI TTS", exc)
            if self._fallback:
                return await self._fallback.synthesize(text)
            raise

    async def _fetch_wav(self, text: str) -> bytes:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                _API_URL,
                headers={"Authorization": f"Bearer {self._api_key}"},
                json={
                    "text": text,
                    "reference_id": self._voice_id,
                    "format": "wav",
                    "normalize": True,
                    "latency": "normal",
                },
            )
            resp.raise_for_status()
            wav_bytes = resp.content

        pcm = _wav_to_pcm_int16(wav_bytes)
        logger.info(
            "fish_audio voice=%s %d chars → %d bytes pcm@%dHz",
            self._voice_id, len(text), len(pcm), _TARGET_SR,
        )
        return pcm

    # ── Streaming: play as data arrives ──────────────────────────────────────────

    async def stream_synthesize(
        self, text: str
    ) -> AsyncGenerator[tuple[np.ndarray, int], None]:
        """
        Async generator yielding (float32_mono_pcm_chunk, sample_rate).

        The WAV header is parsed from the first HTTP chunk; all subsequent
        chunks are decoded and yielded immediately so AudioPlayer.play_stream()
        can start playback before the full response has arrived.

        On error, falls back to non-streaming synthesize() and yields one chunk.
        """
        if not text.strip():
            return

        try:
            async for item in self._stream_fish(text):
                yield item
        except Exception as exc:
            logger.warning(
                "fish_audio stream failed (%s) — falling back to OpenAI TTS", exc
            )
            if self._fallback:
                data = await self._fallback.synthesize(text)
                arr = np.frombuffer(data, dtype=np.int16).astype(np.float32) / 32768.0
                yield arr, _TARGET_SR
            else:
                raise

    async def _stream_fish(
        self, text: str
    ) -> AsyncGenerator[tuple[np.ndarray, int], None]:
        header_buf   = bytearray()
        sample_rate  = None
        n_channels   = None
        sample_width = None
        data_offset  = None   # byte offset where raw PCM starts in the stream

        async with httpx.AsyncClient(timeout=60.0) as client:
            async with client.stream(
                "POST",
                _API_URL,
                headers={"Authorization": f"Bearer {self._api_key}"},
                json={
                    "text": text,
                    "reference_id": self._voice_id,
                    "format": "wav",
                    "normalize": True,
                    "latency": "normal",
                },
            ) as resp:
                resp.raise_for_status()

                async for raw_chunk in resp.aiter_bytes(4096):
                    if data_offset is None:
                        # Still buffering the WAV header
                        header_buf.extend(raw_chunk)
                        idx = bytes(header_buf).find(b"data")
                        if idx != -1 and len(header_buf) >= idx + 8:
                            try:
                                with _wave_mod.open(
                                    io.BytesIO(bytes(header_buf) + b"\x00" * 256), "rb"
                                ) as wf:
                                    sample_rate  = wf.getframerate()
                                    n_channels   = wf.getnchannels()
                                    sample_width = wf.getsampwidth()
                            except Exception:
                                import struct
                                n_channels   = struct.unpack_from("<H", bytes(header_buf), 22)[0]
                                sample_rate  = struct.unpack_from("<I", bytes(header_buf), 24)[0]
                                sample_width = struct.unpack_from("<H", bytes(header_buf), 34)[0] // 8

                            data_offset = idx + 8
                            logger.info(
                                "fish_audio stream: sr=%d ch=%d sw=%d",
                                sample_rate, n_channels, sample_width,
                            )
                            pcm_bytes = bytes(header_buf[data_offset:])
                            if pcm_bytes:
                                yield (
                                    _decode_pcm_bytes(pcm_bytes, sample_width, n_channels),
                                    sample_rate,
                                )
                    else:
                        yield (
                            _decode_pcm_bytes(bytes(raw_chunk), sample_width, n_channels),
                            sample_rate,
                        )
