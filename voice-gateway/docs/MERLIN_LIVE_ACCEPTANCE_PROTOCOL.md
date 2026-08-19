# Merlin Live Voice-Loop Acceptance Protocol (PREPARED — not executed)

This protocol is written to be run **by the operator on the real RME Babyface /
mic / speakers**. Nothing here has been executed by Claude — Claude has no audio
hardware. Every result stays **UNKNOWN** until physically run.

Verdict vocabulary: `PROVEN_BY_LIVE_TEST` · `PROVEN_BY_AUTOMATED_TEST` ·
`IMPLEMENTED_NOT_LIVE_PROVEN` · `FAILED` · `UNKNOWN`.

---

## Step 1 — Capture the truth (answers "is it CAPTURE or STT?")

Enable the exact-WAV capture probe, restart the service, then speak:

```bash
launchctl setenv MERLIN_CAPTURE_WAV 1 && launchctl kickstart -k gui/$(id -u)/com.merlin.voice
```

Speak **10 controlled Hebrew utterances** (say each also into a notes app so you
have the ground truth). Then disable capture:

```bash
launchctl unsetenv MERLIN_CAPTURE_WAV
```

Captured pairs land in `~/Library/Logs/Merlin/capture/` as `wake_*.wav`/`cmd_*.wav`
+ `.json` (holds the runtime transcript, rms, peak, sample_rate, no_speech, language).

**Classify each turn (do not mix classes):**
- **A. CAPTURE failure** — the WAV itself is quiet/clipped/echoed/wrong-channel → RME/routing/gain problem. Fix capture first.
- **B. STT failure** — WAV is clear Hebrew but transcript is wrong/foreign → STT problem.
- **C. ACCEPTANCE-GATE failure** — transcript is bad but the runtime still answered → gate problem.
- **D. LLM/turn-association** — transcript correct but the answer is unrelated → context/turn problem.

## Step 2 — A/B the SAME WAVs (evidence for the model decision)

```bash
cd ~/-nexus-globe/voice-gateway
.venv/bin/python tools/stt_ab_harness.py --corpus ~/Library/Logs/Merlin/capture \
    --language he --out ~/stt_ab_report
open ~/stt_ab_report.md
```

Optional ground truth: put a `manifest.json` (`{"wake_001.wav":"מה השעה"}`) or a
`<name>.expected.txt` next to the WAVs. The report gives, per model:
transcript · language · no_speech_prob/avg_logprob/compression_ratio (or
`UNAVAILABLE` for gpt-4o-transcribe) · latency · hallucination flag · non-Hebrew flag.
**Do not switch the production model** until the report shows the alternative is
actually better on YOUR recordings.

---

## Live acceptance tests (run after Step 1–2)

**TEST A — Hebrew accuracy.** Say a clear Hebrew request. PASS ⇔ saved WAV matches
speech → transcript matches → answer addresses it. Run ×10; report each transcript.

**TEST B — interruption.** While Merlin speaks, start speaking normally. PASS ⇔ Merlin
stops promptly, your full utterance is captured, no old speech resumes. Run ×10.

**TEST C — consecutive interruptions.** Interrupt across turns: N cancelled → N+1
accepted → N+1 cancelled → N+2 accepted. PASS ⇔ no cross-turn contamination.

**TEST D — silence.** Stay silent while Merlin speaks. PASS ⇔ Merlin does NOT
interrupt himself (no self-echo barge-in).

**TEST E — new unrelated request mid-speech.** Speak a different request while Merlin
speaks. PASS ⇔ old answer terminates, new request is the sole current turn, new
answer addresses the new request.

**TEST STOP — control panel.** Start a long answer → press STOP SPEAKING → immediate
silence → wait several seconds → PASS ⇔ no stale continuation.

**TEST CLAP — Day Opening.** Two real claps. PASS ⇔ Day Opening starts with no speech
(independent of STT). Then speak during it → PASS ⇔ it stops, your turn proceeds, the
briefing never resumes.

---

## Runtime trace to look for (PHASE 1 — same turn_id on every line)

`MIC_RAW · CAPTURE_START · CAPTURE_END · CAPTURE_RMS · CAPTURE_PEAK · STT_REQUEST ·
STT_RESULT · STT_ACCEPT/REJECT · LLM_REQUEST · LLM_RESPONSE · TTS_START ·
PLAYBACK_START · USER_SPEECH_DETECTED_DURING_PLAYBACK · TURN_OWNERSHIP_REVOKED ·
TTS_CANCEL · PLAYBACK_CANCEL · BUFFER_FLUSH · LISTENING_RESUMED`

For the echo question (PHASE 4), the trace must log `PLAYBACK_RMS` and `MIC_RMS`
simultaneously plus `barge_candidate/accepted/rejected_reason`, so you can tell
whether user speech is missed, Merlin's own voice is mistaken for the user, or the
echo guard suppresses genuine speech. (These trace lines are a runtime change owned
by the other window — this doc only specifies what to look for.)
