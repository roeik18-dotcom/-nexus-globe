"""Merlin OS · Voice → Event bridge (the seam to the real world).

Connects an STT transcript to the Kernel:

    microphone → audio → STT → on_transcript(text) → user.spoke → intent.classified
              → … the whole already-built Alpha chain runs unchanged …

Everything downstream already awaits `intent.classified`; this bridge is the only new
wire. It is transport-only: it does NOT do STT (that is the Voice Track) — it takes
whatever text STT produced and drives the platform. Bad STT text → low-confidence /
unknown intent, honestly (I-4), never a fabricated command.
"""
from __future__ import annotations

import itertools
from typing import Optional

from .alpha import AlphaRuntime
from .events import Event, new_event

_utt = itertools.count(1)


class VoiceBridge:
    def __init__(self, runtime: Optional[AlphaRuntime] = None,
                 store_path: Optional[str] = None, calibrate: bool = False) -> None:
        self.rt = runtime or AlphaRuntime(store_path=store_path, calibrate=calibrate)

    def on_transcript(self, text: str, correlation_id: Optional[str] = None) -> Event:
        """A finished STT transcript enters the platform and drives the full chain."""
        corr = correlation_id or f"utt-{next(_utt):04d}"
        self.rt.bus.publish(new_event(              # the world event: user spoke
            "user.spoke", "voice.stt", "user",
            {"transcript": text}, correlation_id=corr))
        self.rt.speak(text, correlation_id=corr)    # → intent.classified → chain
        return corr

    def response_for(self, correlation_id: str) -> Optional[str]:
        return self.rt.response_for(correlation_id)

    def pending_token(self) -> Optional[str]:
        return self.rt.pending_token()

    def approve(self, token: str) -> None:
        self.rt.approve(token)


def _demo() -> None:
    from .latency import stage_latencies
    from .trace import render

    vb = VoiceBridge()
    for text in ["מרלין מה השעה", "בוקר טוב", "פתח Pro Tools"]:
        corr = vb.on_transcript(text)
        print(f"\n🎙️ {text!r}  (corr {corr})")
        print("   chain:", render(vb.rt.bus.log, corr))
        print("   response:", vb.response_for(corr))
        print("   latency:", stage_latencies(vb.rt.bus.log, corr))


if __name__ == "__main__":
    _demo()
