from typing import Literal

from app.context_builder import ContextBuilder
from pydantic_settings import BaseSettings, SettingsConfigDict


def build_system_prompt(persona: str) -> str:
    return ContextBuilder.for_session(persona).build()


def build_system_prompt_with_task(persona: str, task=None, summary=None, tool_memory=None, recall_result=None, essence_context: str = "", query: str = "") -> str:
    return ContextBuilder.for_session(
        persona, task, summary, tool_memory, recall_result=recall_result,
        essence_context=essence_context, query=query,
    ).build()


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    anthropic_api_key: str | None = None
    openai_api_key: str | None = None

    stt_provider: str = "whisper"
    # Transcription model for the wake-keyword path (service/wake_trigger.py) only.
    # gpt-4o-transcribe supports response_format "json"/"text" only (NOT verbose_json).
    stt_model: str = "gpt-4o-transcribe"
    # Transcription model for the COMMAND path (app/providers/stt/whisper.py —
    # what actually reaches the LLM). Deliberately split from stt_model above
    # 2026-08-07 after a controlled real-hardware comparison (6 Babyface-
    # captured Hebrew samples, gpt-4o-transcribe vs whisper-1): gpt-4o-transcribe
    # produced complete wrong-language hallucinations (German, Slovak) on 2/6
    # samples despite language="he" forced, and exposes no confidence signal at
    # all (rejects response_format="verbose_json" with HTTP 400). whisper-1
    # never switched language on any of the 6 samples and exposes
    # no_speech_prob/avg_logprob/compression_ratio via verbose_json, which
    # app/providers/stt/whisper.py now gates on (service/turn_guard.py). The
    # original stt_model docstring warned against splitting these because a
    # shared response_format assumption once diverged silently — that risk
    # does not recur here: each path (wake_trigger.py vs whisper.py) hardcodes
    # its own response_format against its own model, never sharing the value.
    stt_command_model: str = "whisper-1"
    tts_provider: str = "openai"
    openai_tts_voice: str = "onyx"
    openai_tts_model: str = "tts-1-hd"
    openai_tts_speed: float = 1.15
    adapter: str = "claude"

    # ── ElevenLabs TTS ────────────────────────────────────────────────────────
    elevenlabs_api_key: str = ""
    elevenlabs_voice_id: str = "JBFqnCBsd6RMkjVDRZzb"   # George — deep, British
    elevenlabs_model: str = "eleven_turbo_v2_5"           # fast + multilingual

    # ── Fish Audio TTS ────────────────────────────────────────────────────────
    fish_audio_api_key: str = ""
    fish_audio_voice_id: str = ""   # model_id from the voice URL on fish.audio

    claude_model: str = "claude-opus-4-8"
    persona: Literal["jarvis", "philos", "merlin"] = "jarvis"

    @property
    def claude_system_prompt(self) -> str:
        return build_system_prompt(self.persona)

    max_session_duration_seconds: int = 300
    max_audio_size_bytes: int = 26_214_400  # 25 MB

    host: str = "127.0.0.1"
    port: int = 8765

    # ── Essence integration ────────────────────────────────────────────────────
    # Shared secret for the internal Essence API route.
    # Must match INTERNAL_ESSENCE_TOKEN in the Next.js environment.
    # Leave unset to disable Essence context injection (graceful degradation).
    internal_essence_token: str | None = None
    essence_base_url: str = "http://localhost:3000"

    # ── n8n integration (READ_ONLY_ECHO action only — see app/integrations/n8n) ─
    # Header token for the n8n Authenticated Echo webhook. Must match the
    # X-Action-Token value configured on the n8n Header Auth credential.
    # Leave unset to disable the n8n client (calls fail closed, no silent no-op).
    n8n_webhook_token: str | None = None
    n8n_webhook_url: str = "http://127.0.0.1:5678/webhook/echo"
    # Read-only bookmark file extractor (Chrome + Safari). Same token as
    # above (same trust boundary, same n8n instance) — see
    # app/capabilities/bookmark_audit for the classification/recommendation
    # logic that consumes this action's raw output.
    n8n_bookmark_extract_url: str = "http://127.0.0.1:5678/webhook/bookmark-extract"
    # side_effecting BOOKMARK_APPLY (MOVE/RENAME/MERGE_DUPLICATE/ARCHIVE/DELETE).
    # Requires an explicit approval object bound to inputs_hash — see
    # app.integrations.n8n.client.send_bookmark_apply_action_request and
    # app/capabilities/bookmark_audit/apply.py. As of 2026-08-12 the n8n
    # workflow behind this endpoint targets an isolated mock bookmark file,
    # not the real Chrome/Safari stores — see apply.py module docstring for why.
    n8n_bookmark_apply_url: str = "http://127.0.0.1:5678/webhook/bookmark-apply"


settings = Settings()
