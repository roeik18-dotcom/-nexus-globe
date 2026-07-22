# Voice Gateway MVP

Push-to-talk voice loop: **hold SPACE → speak → hear the answer.**

Stack: OpenAI Whisper (STT) → Claude Opus 4.8 (backend) → OpenAI TTS (voice).

---

## Architecture

```
client/push_to_talk.py
        │  WebSocket (ws://localhost:8765/ws/voice)
        ▼
app/main.py                FastAPI WebSocket server
  ├── app/providers/stt/whisper.py   OpenAI Whisper
  ├── app/adapters/claude.py         Claude Opus 4.8  ← swappable in Phase 2/3
  └── app/providers/tts/openai_tts.py  OpenAI TTS
                                    (fallback: app/providers/tts/system_tts.py → macOS say)
```

**Adapter interface** (`app/adapters/base.py`) — JARVIS and Philos plug in here in later phases. The gateway never calls the adapter directly; it goes through the interface, so swapping backends is a one-line config change.

---

## Install

```bash
# From the voice-gateway directory
python -m venv .venv
source .venv/bin/activate

pip install -r requirements.txt
```

macOS note: `sounddevice` requires PortAudio. If `pip install sounddevice` fails:
```bash
brew install portaudio
pip install sounddevice
```

---

## Configure

```bash
cp .env.example .env
# Edit .env — fill in ANTHROPIC_API_KEY and OPENAI_API_KEY
```

Required env vars:
| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Anthropic API key (for Claude backend) |
| `OPENAI_API_KEY` | OpenAI API key (for Whisper STT + TTS) |

Optional (see `.env.example` for full list):
- `TTS_PROVIDER=system` — use macOS `say` instead of OpenAI TTS (no API cost)
- `CLAUDE_MODEL` — defaults to `claude-opus-4-8`
- `MAX_SESSION_DURATION_SECONDS` — defaults to 300

---

## Run

**Terminal 1 — start the server:**
```bash
cd voice-gateway
source .venv/bin/activate
uvicorn app.main:app --host 127.0.0.1 --port 8765
```

**Terminal 2 — start the client:**
```bash
cd voice-gateway
source .venv/bin/activate
python client/push_to_talk.py
```

Hold SPACE to speak. Release to send. Press Q to quit.

> **macOS microphone permission**: on first run, macOS will prompt for microphone access. Allow it in System Settings → Privacy & Security → Microphone.

---

## Tests

```bash
cd voice-gateway
source .venv/bin/activate
# Set dummy keys so config loads
ANTHROPIC_API_KEY=sk-test OPENAI_API_KEY=sk-test pytest tests/ -v
```

All tests are unit tests — no API calls, no network.

---

## Security constraints applied

- API keys live only in `.env` (server-side). Never sent to the client.
- `.env` is gitignored — only `.env.example` is committed.
- Audio size is validated before STT (max 25 MB, configurable).
- Session duration is enforced server-side (max 5 min, configurable).
- macOS `say` is invoked via `subprocess.exec` (no shell=True) to prevent injection.
- WebSocket server binds to `127.0.0.1` only — not exposed to LAN by default.

---

## What's NOT here (by design)

| Feature | Phase |
|---|---|
| JARVIS integration | Phase 2 |
| Philos integration | Phase 3 |
| Inter-agent bus / Observable Timeline | Phase 3+ |
| Voice Activity Detection (VAD) | Optional future |
| Interruption / barge-in | Optional future |
| Authentication | Optional future |

The adapter interface (`app/adapters/base.py`) is the seam for Phase 2/3 integration. JARVIS and Philos adapters implement `respond()` and `reset()` — everything else stays the same.

---

## WebSocket protocol reference

```
Client → Server
  <binary>               raw WAV audio chunk
  {"type":"end_of_speech"}  flush + process
  {"type":"reset"}          clear session history
  {"type":"ping"}           keepalive

Server → Client
  {"type":"transcript","text":"..."}    STT result
  {"type":"response_text","text":"..."}  full adapter response
  <binary>                               TTS audio (mp3)
  {"type":"done"}                        turn complete
  {"type":"error","message":"..."}       recoverable error
  {"type":"expired"}                     session time limit
  {"type":"pong"}                        keepalive reply
```
