"""Merlin Control Center — canonical config schema, validation, and safe I/O.

This module is the single source of truth for reading/writing
`config/merlin_control.json`. No other module should parse that file directly.

Design constraints (see docs/MERLIN_CONTROL_SPEC.md for the runtime this feeds):
  - No secrets live here. API keys stay in `.env` / `app/config.py::Settings`.
  - Every write is atomic (temp file + os.replace) so a crash mid-write can never
    corrupt the live config.
  - An invalid write is rejected before touching disk; the last valid config on
    disk is never destroyed by a bad PUT.
  - `load_with_fallback()` is what the runtime actually calls — if the primary
    file is missing/corrupt, it falls back to the last-known-good snapshot, and
    only if that is *also* unusable does it fall back to hardcoded defaults.
"""

from __future__ import annotations

import json
import os
import shutil
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

SCHEMA_VERSION = 1

_CONFIG_DIR = Path(__file__).parent
DEFAULT_CONFIG_PATH = _CONFIG_DIR / "merlin_control.json"
LAST_KNOWN_GOOD_PATH = _CONFIG_DIR / "merlin_control.last_known_good.json"
_MERLIN_SERVICE_PATH = _CONFIG_DIR.parent / "service" / "merlin_service.py"


def live_barge_in_supported() -> bool:
    """Real, current capability check — reads BARGE_IN_ENABLED directly out of
    service/merlin_service.py's source via `ast` (never imports that module:
    it reconfigures the importing process's root logger as a side effect of
    import, which a config/console module must not trigger). Fails closed
    (False) on any read/parse error — this must never claim a capability it
    could not actually verify."""
    import ast

    try:
        tree = ast.parse(_MERLIN_SERVICE_PATH.read_text(encoding="utf-8"), filename=str(_MERLIN_SERVICE_PATH))
        for node in tree.body:
            if (
                isinstance(node, ast.Assign)
                and len(node.targets) == 1
                and isinstance(node.targets[0], ast.Name)
                and node.targets[0].id == "BARGE_IN_ENABLED"
            ):
                return bool(ast.literal_eval(node.value))
    except Exception:
        pass
    return False

_ALLOWED_LANGUAGES = {"he", "en"}
_ALLOWED_RESPONSE_LENGTHS = {"short", "normal", "deep"}
_ALLOWED_RESPONSE_STYLES = {"direct_natural"}


# ── schema (mirrors the JSON shape exactly — no extra fields invented) ────────

@dataclass
class LanguagePolicy:
    default: str = "he"
    allowed_output_languages: list[str] = field(default_factory=lambda: ["he"])
    switch_only_on_explicit_request: bool = True
    technical_terms_may_remain_english: bool = True


@dataclass
class ConversationPolicy:
    response_style: str = "direct_natural"
    default_length: str = "short"
    answer_first: bool = True
    avoid_repetition: bool = True
    avoid_stock_phrases: bool = True
    ask_followup_only_when_blocked: bool = True
    offer_unrequested_followups: bool = False


@dataclass
class TurnControlPolicy:
    listen_timeout_seconds: int = 8
    interruptions_enabled: bool = False
    stop_command_enabled: bool = True


@dataclass
class TriggerDef:
    enabled: bool = True
    phrases: list[str] = field(default_factory=list)
    action: str = ""


@dataclass
class ToolDef:
    enabled: bool = False
    requires_confirmation: bool = True


@dataclass
class PersonaPolicy:
    profile: str = "merlin"
    natural_hebrew: bool = True
    direct_corrections: bool = True
    automatic_agreement: bool = False


@dataclass
class MerlinControlConfig:
    version: int = SCHEMA_VERSION
    language: LanguagePolicy = field(default_factory=LanguagePolicy)
    conversation: ConversationPolicy = field(default_factory=ConversationPolicy)
    turn_control: TurnControlPolicy = field(default_factory=TurnControlPolicy)
    triggers: dict[str, TriggerDef] = field(default_factory=dict)
    tools: dict[str, ToolDef] = field(default_factory=dict)
    persona: PersonaPolicy = field(default_factory=PersonaPolicy)

    def to_dict(self) -> dict:
        return asdict(self)


def default_config() -> MerlinControlConfig:
    """The shipped default — matches the shape specified for the MVP."""
    return MerlinControlConfig(
        version=SCHEMA_VERSION,
        language=LanguagePolicy(
            default="he",
            allowed_output_languages=["he"],
            switch_only_on_explicit_request=True,
            technical_terms_may_remain_english=True,
        ),
        conversation=ConversationPolicy(),
        turn_control=TurnControlPolicy(),
        triggers={
            "morning_greeting": TriggerDef(
                enabled=True, phrases=["בוקר טוב"], action="morning_brief",
            ),
            "web_search": TriggerDef(
                enabled=True, phrases=["חפש ברשת", "בדוק ברשת"], action="web_search",
            ),
        },
        tools={
            "web_search": ToolDef(enabled=True, requires_confirmation=False),
            "terminal": ToolDef(enabled=False, requires_confirmation=True),
        },
        persona=PersonaPolicy(),
    )


# ── validation ─────────────────────────────────────────────────────────────

def validate(data: dict) -> tuple[bool, list[str]]:
    """Structural + value validation. Returns (ok, error_messages)."""
    errors: list[str] = []

    if not isinstance(data, dict):
        return False, ["root must be a JSON object"]

    version = data.get("version")
    if not isinstance(version, int) or version < 1:
        errors.append("version must be a positive integer")

    lang = data.get("language", {})
    if not isinstance(lang, dict):
        errors.append("language must be an object")
    else:
        default_lang = lang.get("default")
        if default_lang not in _ALLOWED_LANGUAGES:
            errors.append(f"language.default must be one of {_ALLOWED_LANGUAGES}")
        allowed = lang.get("allowed_output_languages")
        if not isinstance(allowed, list) or not allowed:
            errors.append("language.allowed_output_languages must be a non-empty list")
        elif not all(l in _ALLOWED_LANGUAGES for l in allowed):
            errors.append(f"language.allowed_output_languages entries must be in {_ALLOWED_LANGUAGES}")
        elif default_lang and default_lang not in allowed:
            errors.append("language.default must be a member of language.allowed_output_languages")
        for bkey in ("switch_only_on_explicit_request", "technical_terms_may_remain_english"):
            if not isinstance(lang.get(bkey), bool):
                errors.append(f"language.{bkey} must be a boolean")

    conv = data.get("conversation", {})
    if not isinstance(conv, dict):
        errors.append("conversation must be an object")
    else:
        if conv.get("response_style") not in _ALLOWED_RESPONSE_STYLES:
            errors.append(f"conversation.response_style must be one of {_ALLOWED_RESPONSE_STYLES}")
        if conv.get("default_length") not in _ALLOWED_RESPONSE_LENGTHS:
            errors.append(f"conversation.default_length must be one of {_ALLOWED_RESPONSE_LENGTHS}")
        for bkey in ("answer_first", "avoid_repetition", "avoid_stock_phrases",
                     "ask_followup_only_when_blocked", "offer_unrequested_followups"):
            if not isinstance(conv.get(bkey), bool):
                errors.append(f"conversation.{bkey} must be a boolean")

    turn = data.get("turn_control", {})
    if not isinstance(turn, dict):
        errors.append("turn_control must be an object")
    else:
        timeout = turn.get("listen_timeout_seconds")
        if not isinstance(timeout, (int, float)) or not (1 <= timeout <= 120):
            errors.append("turn_control.listen_timeout_seconds must be a number in [1,120]")
        for bkey in ("interruptions_enabled", "stop_command_enabled"):
            if not isinstance(turn.get(bkey), bool):
                errors.append(f"turn_control.{bkey} must be a boolean")
        if turn.get("interruptions_enabled") is True and not live_barge_in_supported():
            # Real-time check (see live_barge_in_supported() above), not a
            # hardcoded assumption — rejected only while the live runtime
            # actually lacks barge-in, so the config can never silently claim
            # a capability the runtime does not have. Re-evaluated on every
            # validate() call, so this tracks BARGE_IN_ENABLED automatically
            # if it ever changes again.
            errors.append(
                "turn_control.interruptions_enabled=true is rejected — barge-in is "
                "not implemented on the live runtime (see docs/MERLIN_CONTROL_SPEC.md §12)"
            )

    triggers = data.get("triggers", {})
    if not isinstance(triggers, dict):
        errors.append("triggers must be an object")
    else:
        seen_phrases: dict[str, str] = {}
        for name, t in triggers.items():
            if not isinstance(t, dict):
                errors.append(f"triggers.{name} must be an object")
                continue
            if not isinstance(t.get("enabled"), bool):
                errors.append(f"triggers.{name}.enabled must be a boolean")
            phrases = t.get("phrases")
            if not isinstance(phrases, list) or not all(isinstance(p, str) for p in phrases):
                errors.append(f"triggers.{name}.phrases must be a list of strings")
            elif t.get("enabled"):
                # No two ENABLED triggers may claim the same phrase — ambiguous routing.
                for p in phrases:
                    key = p.strip().lower()
                    if key in seen_phrases and seen_phrases[key] != name:
                        errors.append(
                            f"triggers.{name} and triggers.{seen_phrases[key]} both "
                            f"claim phrase {p!r} while enabled — ambiguous"
                        )
                    seen_phrases[key] = name
            if not isinstance(t.get("action"), str) or not t.get("action"):
                errors.append(f"triggers.{name}.action must be a non-empty string")

    tools = data.get("tools", {})
    if not isinstance(tools, dict):
        errors.append("tools must be an object")
    else:
        for name, t in tools.items():
            if not isinstance(t, dict):
                errors.append(f"tools.{name} must be an object")
                continue
            for bkey in ("enabled", "requires_confirmation"):
                if not isinstance(t.get(bkey), bool):
                    errors.append(f"tools.{name}.{bkey} must be a boolean")

    persona = data.get("persona", {})
    if not isinstance(persona, dict):
        errors.append("persona must be an object")
    else:
        if not isinstance(persona.get("profile"), str) or not persona.get("profile"):
            errors.append("persona.profile must be a non-empty string")
        for bkey in ("natural_hebrew", "direct_corrections", "automatic_agreement"):
            if not isinstance(persona.get(bkey), bool):
                errors.append(f"persona.{bkey} must be a boolean")

    return (len(errors) == 0), errors


def _from_dict(data: dict) -> MerlinControlConfig:
    lang = data.get("language", {})
    conv = data.get("conversation", {})
    turn = data.get("turn_control", {})
    triggers = {
        name: TriggerDef(
            enabled=bool(t.get("enabled", True)),
            phrases=list(t.get("phrases", [])),
            action=str(t.get("action", "")),
        )
        for name, t in data.get("triggers", {}).items()
    }
    tools = {
        name: ToolDef(
            enabled=bool(t.get("enabled", False)),
            requires_confirmation=bool(t.get("requires_confirmation", True)),
        )
        for name, t in data.get("tools", {}).items()
    }
    persona = data.get("persona", {})
    return MerlinControlConfig(
        version=int(data.get("version", SCHEMA_VERSION)),
        language=LanguagePolicy(
            default=lang.get("default", "he"),
            allowed_output_languages=list(lang.get("allowed_output_languages", ["he"])),
            switch_only_on_explicit_request=bool(lang.get("switch_only_on_explicit_request", True)),
            technical_terms_may_remain_english=bool(lang.get("technical_terms_may_remain_english", True)),
        ),
        conversation=ConversationPolicy(
            response_style=conv.get("response_style", "direct_natural"),
            default_length=conv.get("default_length", "short"),
            answer_first=bool(conv.get("answer_first", True)),
            avoid_repetition=bool(conv.get("avoid_repetition", True)),
            avoid_stock_phrases=bool(conv.get("avoid_stock_phrases", True)),
            ask_followup_only_when_blocked=bool(conv.get("ask_followup_only_when_blocked", True)),
            offer_unrequested_followups=bool(conv.get("offer_unrequested_followups", False)),
        ),
        turn_control=TurnControlPolicy(
            listen_timeout_seconds=int(turn.get("listen_timeout_seconds", 8)),
            interruptions_enabled=bool(turn.get("interruptions_enabled", False)),
            stop_command_enabled=bool(turn.get("stop_command_enabled", True)),
        ),
        triggers=triggers,
        tools=tools,
        persona=PersonaPolicy(
            profile=persona.get("profile", "merlin"),
            natural_hebrew=bool(persona.get("natural_hebrew", True)),
            direct_corrections=bool(persona.get("direct_corrections", True)),
            automatic_agreement=bool(persona.get("automatic_agreement", False)),
        ),
    )


# ── atomic I/O ─────────────────────────────────────────────────────────────

def atomic_write(path: Path, data: dict) -> None:
    """tempfile in the same dir → write → flush → fsync → os.replace.
    On any failure the tempfile is removed; the target is never left partial."""
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    try:
        with open(tmp, "w", encoding="utf-8") as f:
            f.write(json.dumps(data, ensure_ascii=False, indent=2))
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, path)
    except Exception:
        tmp.unlink(missing_ok=True)
        raise


def _next_version(path: Path) -> int:
    """The version to write next: current on-disk version + 1, or SCHEMA_VERSION
    if no valid file exists yet. The caller's submitted version is intentionally
    ignored for the on-disk value — version is server-assigned and monotonic,
    never client-trusted."""
    if path.exists():
        try:
            raw = json.loads(path.read_text(encoding="utf-8"))
            current = raw.get("version")
            if isinstance(current, int):
                return current + 1
        except Exception:
            pass
    return SCHEMA_VERSION


def save(data: dict, *, path: Path = DEFAULT_CONFIG_PATH) -> tuple[bool, list[str]]:
    """Validate, then atomically write with a server-assigned monotonic version.
    Backs up the previous good file first.

    Returns (ok, errors). On ok=False, disk is untouched.
    """
    data = dict(data)
    data["version"] = _next_version(path)
    ok, errors = validate(data)
    if not ok:
        return False, errors
    if path.exists():
        shutil.copyfile(path, LAST_KNOWN_GOOD_PATH)
    atomic_write(path, data)
    return True, []


def load_with_fallback(*, path: Path = DEFAULT_CONFIG_PATH) -> tuple[MerlinControlConfig, str]:
    """Load the live config. Returns (config, source) where source is one of:
    "primary", "last_known_good", "defaults" — so callers/telemetry can tell
    which one is actually in effect.
    """
    for candidate_path, label in ((path, "primary"), (LAST_KNOWN_GOOD_PATH, "last_known_good")):
        if not candidate_path.exists():
            continue
        try:
            raw = json.loads(candidate_path.read_text(encoding="utf-8"))
        except Exception:
            continue
        ok, _errors = validate(raw)
        if ok:
            return _from_dict(raw), label
    return default_config(), "defaults"
