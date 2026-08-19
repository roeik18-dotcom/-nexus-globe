"""Day Opening collectors — one function per domain (section 3, A-H).

Reuses existing, already-tested infrastructure wherever it exists:
  - mos/personal_config.py::load_personal_config / load_file for Human
    Config and the live Music Config profile (voice-gateway/profiles/*.yaml)
  - real files on disk for Studio (~/Dropbox/-STUDIO-SYSTEM/ledger/ledger.json)
    and Philos (~/-nexus-globe/.philos-data/philos-events.jsonl)
  - the live RuntimeControlState for Merlin/Infrastructure

Every collector returns a DomainStatus and NEVER raises — a failure is
captured into DomainStatus.error (section 9: one broken collector must not
destroy the whole briefing). Every collector is synchronous, file/subprocess
I/O only — no microphone, no TTS — so this module is fully testable without
hardware (section 7's requirement).
"""

from __future__ import annotations

import datetime
import json
import logging
import subprocess
from pathlib import Path

import yaml

from service.day_opening_models import DomainStatus, Lifecycle, OutcomeCandidate, Provenance
from app.philos_shared_state import fetch_shared_state

logger = logging.getLogger("merlin.day_opening")

_VOICE_GATEWAY_ROOT = Path(__file__).resolve().parent.parent
_NEXUS_GLOBE_ROOT = _VOICE_GATEWAY_ROOT.parent
_STUDIO_LEDGER = Path.home() / "Dropbox" / "-STUDIO-SYSTEM" / "ledger" / "ledger.json"
_PHILOS_EVENTS = _NEXUS_GLOBE_ROOT / ".philos-data" / "philos-events.jsonl"


def _safe(domain: str, label_he: str, fn):
    """Run one collector, converting any exception into an honest error
    DomainStatus instead of taking down the whole briefing (section 9)."""
    try:
        return fn()
    except Exception as exc:  # collectors must never crash collect_all()
        logger.warning("day_opening collector %s failed: %s", domain, exc)
        return DomainStatus(
            domain=domain, label_he=label_he, provenance=Provenance.UNKNOWN,
            summary_he="", error=str(exc),
        )


# ── A. Orientation ───────────────────────────────────────────────────────

def collect_orientation() -> str:
    now = datetime.datetime.now().astimezone()
    hebrew_days = ["שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת", "ראשון"]
    day_name = hebrew_days[now.weekday()]
    return f"היום יום {day_name}, {now.strftime('%d.%m.%Y')}, השעה {now.strftime('%H:%M')}."


# ── section 1. World / External Orientation ─────────────────────────────

def collect_world_external() -> DomainStatus:
    """No external/news/security data source is wired into this runtime
    (confirmed by audit, 2026-08-07 — no live web/feed integration exists
    anywhere in this repo). Reporting UNKNOWN is the honest behavior required
    by the spec's own rule: never turn this into a fabricated news podcast."""
    return DomainStatus(
        domain="world_external", label_he="עולם / חוץ", provenance=Provenance.UNKNOWN,
        summary_he=(
            "UNKNOWN — אין מקור מידע חיצוני (חדשות/ביטחון) מחובר למערכת הזו כרגע. "
            "לא מומצא תוכן כדי למלא את הסעיף הזה."
        ),
    )


# ── B. Human Config ──────────────────────────────────────────────────────

def collect_human_config() -> DomainStatus:
    def _run():
        from mos.personal_config import load_personal_config

        profiles_dir = _VOICE_GATEWAY_ROOT / "profiles"
        state, loaded = load_personal_config(profiles_dir, filenames=("person.yaml",))
        person_file = loaded[0] if loaded else None

        if person_file is None or not person_file.existed:
            return DomainStatus(
                domain="human_config", label_he="הגדרת אדם", provenance=Provenance.UNKNOWN,
                summary_he="לא נמצא קובץ person.yaml — אין תמונה עדכנית של מי שאתה.",
                source=str(profiles_dir / "person.yaml"),
            )
        if not person_file.parsed:
            return DomainStatus(
                domain="human_config", label_he="הגדרת אדם", provenance=Provenance.UNKNOWN,
                summary_he="קובץ person.yaml קיים אך לא נקרא בהצלחה.",
                source=str(profiles_dir / "person.yaml"),
                error=f"{len(person_file.errors)} validation error(s)",
            )

        entries = person_file.entries
        n = len(entries)
        merlin_usable = sum(1 for e in entries if e.merlin_may_use)
        # No aggregate "coverage %" field exists anywhere in this schema
        # (confirmed by audit) — reporting entry counts + validation state
        # only, never a fabricated completion percentage.
        # Section 4's pipeline questions, answered only from what the schema
        # actually tracks — no per-statement MAPPED/UNMAPPED field exists
        # (confirmed by audit), so "what remains unmapped" is stated as an
        # honest schema gap, not fabricated per-item detail.
        summary = (
            f"קובץ person.yaml (schema v{person_file.schema_version}) טעון בהצלחה, "
            f"{n} רשומות, {merlin_usable} מהן זמינות למרלין. "
            f"אין מדד כיסוי כולל מוגדר בסכימה הזו — לא ניתן לדווח אחוז השלמה. "
            f"הסכימה אינה עוקבת אחר MAPPED/UNMAPPED ברמת פריט בודד, ולכן לא ניתן "
            f"לדווח אילו פריטים ספציפיים ממופים מול לא-ממופים."
        )
        return DomainStatus(
            domain="human_config", label_he="הגדרת אדם", provenance=Provenance.FACT,
            summary_he=summary, source=str(profiles_dir / "person.yaml"),
            timestamp=person_file.path.stat().st_mtime if person_file.path.exists() else None,
            lifecycle=Lifecycle.MAPPING if n > 0 else Lifecycle.DRAFT,
            next_action_he="אין פעולה דחופה מזוהה בהגדרת האדם.",
            unfinished_he=(
                "בדיקת כיסוי מקור-מול-פלט, סעיפים ריקים, וחומר שלא הוטמע עדיין לא בוצעה."
            ),
        )

    return _safe("human_config", "הגדרת אדם", _run)


# ── C. Music Config ──────────────────────────────────────────────────────

def collect_music_config() -> DomainStatus:
    def _run():
        from mos.personal_config import load_personal_config

        profiles_dir = _VOICE_GATEWAY_ROOT / "profiles"
        state, loaded = load_personal_config(profiles_dir, filenames=("music.yaml",))
        live_file = loaded[0] if loaded else None
        live_n = len(live_file.entries) if (live_file and live_file.parsed) else 0

        v2_path = profiles_dir / "music.v2-proposal.yaml"
        if not v2_path.exists():
            return DomainStatus(
                domain="music_config", label_he="הגדרת מוזיקה", provenance=Provenance.FACT,
                summary_he=f"קובץ החיים music.yaml טעון, {live_n} רשומות. אין קובץ הצעת v2.",
                source=str(profiles_dir / "music.yaml"), lifecycle=Lifecycle.DRAFT,
            )

        # music.v2-proposal.yaml is an explicit REVIEW ARTIFACT (its own header:
        # "NOT a profile. Nothing here is loaded by anything."), not a live
        # profile file, and holds two YAML documents — read it directly with
        # plain YAML rather than the profile loader (which expects a single
        # loadable profile document).
        with open(v2_path, encoding="utf-8") as f:
            docs = list(yaml.safe_load_all(f))
        proposal_doc = docs[0] if docs else {}
        v2_entries = proposal_doc.get("entries", []) if isinstance(proposal_doc, dict) else []
        status_counts: dict[str, int] = {}
        for e in v2_entries:
            vs = (e or {}).get("verification_status", "unknown")
            status_counts[vs] = status_counts.get(vs, 0) + 1
        total = len(v2_entries)
        self_confirmed = status_counts.get("self_confirmed", 0)
        needs_review = status_counts.get("needs_review", 0)
        source_confirmed = status_counts.get("source_confirmed", 0)
        canonically_admitted = self_confirmed + source_confirmed  # matches ConfigEntry.is_canonically_admitted's allowlist minus human_confirmed (not seen in this file)

        # Section 5's RAW SOURCE / ATOMIC UNIT / CANONICAL UNIT / RUNTIME-READY
        # distinction is not tracked as separate labeled stages anywhere in
        # this data — the only real, verifiable distinction the files support
        # is: music.yaml (live, RUNTIME-READY — actually loaded by the
        # system) vs. music.v2-proposal.yaml (DRAFT, self/needs/source-review
        # tally — NOT runtime-loaded). Stated honestly rather than mapped
        # onto categories the data doesn't carry.
        summary = (
            f"הגדרה חיה: music.yaml עם {live_n} רשומות בלבד (הבלוק studio-operating עדיין ריק) "
            f"— זו ה-RUNTIME-READY היחידה בפועל. "
            f"טיוטת v2 קיימת עם {total} רשומות: {self_confirmed} self_confirmed, "
            f"{needs_review} needs_review, {source_confirmed} source_confirmed — כולה DRAFT, "
            f"לא נטענת בזמן ריצה. "
            f"החלוקה RAW SOURCE / ATOMIC UNIT / CANONICAL UNIT אינה קיימת כשלבים נפרדים "
            f"בנתונים הללו — לא ניתן לדווח עליה בנפרד. "
            f"סטטוס: DRAFT — לא MASTER FINAL."
        )
        return DomainStatus(
            domain="music_config", label_he="הגדרת מוזיקה", provenance=Provenance.FACT,
            summary_he=summary, source=str(v2_path),
            timestamp=v2_path.stat().st_mtime,
            lifecycle=Lifecycle.MAPPING if needs_review > canonically_admitted else Lifecycle.DRAFT,
            next_action_he=(
                f"לעבור על {needs_review} הרשומות במצב needs_review ולאשר/לדחות אותן"
                if needs_review else "אין רשומות הממתינות לאישור."
            ),
            unfinished_he=(
                f"{needs_review} רשומות טיוטה ממתינות לסקירה; הטיוטה כולה עדיין לא "
                f"עברה לריצה בפועל." if needs_review else "אין המתנה כרגע, אך הטיוטה לא runtime-ready."
            ),
            details={"status_counts": status_counts, "total": total},
        )

    return _safe("music_config", "הגדרת מוזיקה", _run)


# ── D. Studio / Ableton capability ───────────────────────────────────────

def collect_studio() -> DomainStatus:
    def _run():
        if not _STUDIO_LEDGER.exists():
            return DomainStatus(
                domain="studio", label_he="אולפן / אייבלטון", provenance=Provenance.UNKNOWN,
                summary_he="לא נמצא קובץ ledger של מערכת האולפן.",
                source=str(_STUDIO_LEDGER),
            )
        with open(_STUDIO_LEDGER, encoding="utf-8") as f:
            data = json.load(f)
        projects = data.get("projects", [])
        total = data.get("project_count", len(projects))
        stages: dict[str, int] = {}
        for p in projects:
            s = p.get("inferred_stage") or "UNKNOWN"
            stages[s] = stages.get(s, 0) + 1
        bounced = sum(1 for p in projects if (p.get("bounce_count") or 0) > 0)
        most_recent = max(
            (p for p in projects if p.get("last_modified")),
            key=lambda p: p["last_modified"], default=None,
        )
        # Section 6 treats Studio as an operational department (composition /
        # arrangement / sound design / recording / vocals / editing / mixing
        # / mastering / reference / learning). The real ledger only tracks
        # inferred_stage + bounce_count per project — none of those
        # sub-categories are separately measured, stated honestly rather
        # than invented per-category numbers.
        summary = (
            f"{total} פרויקטים אמיתיים נסרקו ({data.get('scanned_at', 'לא ידוע')}). "
            f"פילוח שלבים: " + ", ".join(f"{k}={v}" for k, v in sorted(stages.items())) + ". "
            f"{bounced} פרויקטים עם bounce אחד לפחות. "
            f"הלדג'ר עוקב אחרי שלב ומספר bounce-ים בלבד — קומפוזיציה, עיבוד, סאונד-דיזיין, "
            f"הקלטה, ווקאלים, עריכה, מיקס, מאסטרינג ולמידה/תרגול אינם נמדדים בנפרד במקור הזה."
        )
        next_action = (
            f"להמשיך את הפרויקט האחרון שנגע בו: {most_recent.get('name')}"
            if most_recent else "לא נמצא פרויקט פעיל אחרון."
        )
        stuck = stages.get("SKETCH", 0)
        unfinished = (
            f"{stuck} פרויקטים עדיין בשלב SKETCH (לא התקדמו לעיבוד/מיקס)." if stuck else ""
        )
        return DomainStatus(
            domain="studio", label_he="אולפן / אייבלטון", provenance=Provenance.FACT,
            summary_he=summary, source=str(_STUDIO_LEDGER),
            next_action_he=next_action, unfinished_he=unfinished,
            details={"stages": stages, "total": total},
        )

    return _safe("studio", "אולפן / אייבלטון", _run)


# ── E. Master Course ──────────────────────────────────────────────────────

def collect_course() -> DomainStatus:
    """No course-progress source exists anywhere in the repo or known paths
    (confirmed by audit, 2026-08-07). Explicit UNKNOWN — never fabricated."""
    return DomainStatus(
        domain="course", label_he="קורס", provenance=Provenance.UNKNOWN,
        summary_he="UNKNOWN — לא קיים מקור נתונים למעקב התקדמות קורס.",
    )


# ── F. Professional readiness ────────────────────────────────────────────

def collect_professional_readiness(studio_status: DomainStatus) -> DomainStatus:
    """DERIVED from the studio ledger only — never an invented percentage.
    If the studio collector itself is UNKNOWN, readiness is UNKNOWN too."""
    if studio_status.provenance != Provenance.FACT:
        return DomainStatus(
            domain="professional_readiness", label_he="מוכנות מקצועית",
            provenance=Provenance.UNKNOWN, summary_he="NOT YET MEASURED — תלוי בנתוני האולפן שאינם זמינים.",
        )
    stages = studio_status.details.get("stages", {})
    released = stages.get("RELEASED", 0)
    mix_or_later = sum(v for k, v in stages.items() if k in ("MIX", "MIXDOWN", "MASTER", "RELEASED"))
    total = studio_status.details.get("total", 0)
    summary = (
        f"NOT YET MEASURED כאחוז — אין מודל מדידה רשמי. עובדה: {released} טראקים ב-RELEASED "
        f"מתוך {total}; {mix_or_later} הגיעו לשלב מיקס ומעלה. הרוב עדיין SKETCH."
    )
    return DomainStatus(
        domain="professional_readiness", label_he="מוכנות מקצועית", provenance=Provenance.DERIVED,
        summary_he=summary,
        next_action_he="לקדם פרויקט אחד משלב SKETCH לשלב ARRANGEMENT/MIX." if total else "",
    )


# ── G. Philos ─────────────────────────────────────────────────────────────

def collect_philos() -> DomainStatus:
    def _run():
        if not _PHILOS_EVENTS.exists():
            return DomainStatus(
                domain="philos", label_he="Philos", provenance=Provenance.UNKNOWN,
                summary_he="לא נמצא קובץ אירועי Philos.", source=str(_PHILOS_EVENTS),
            )
        lines = [l for l in _PHILOS_EVENTS.read_text(encoding="utf-8").splitlines() if l.strip()]
        n = len(lines)
        last_event = json.loads(lines[-1]) if lines else None
        last_ts = last_event.get("timestamp") if last_event else None
        summary = (
            f"{n} אירועים ביומן Philos. " +
            (f"אירוע אחרון: {last_event.get('event_type')} בתאריך {last_ts}." if last_event else "אין אירועים.")
        )
        return DomainStatus(
            domain="philos", label_he="Philos", provenance=Provenance.FACT,
            summary_he=summary, source=str(_PHILOS_EVENTS),
            next_action_he="",
        )

    return _safe("philos", "Philos", _run)


# ── Phase 7: Canonical Person/Value shared state ────────────────────────
# Reads the SAME PersonInstance/ValueDomainInstance/BrainDerivation state
# every one of the 7 PHILOS web terminals already renders
# (`app/api/canon/shared-state/route.ts` — one HTTP GET, `app/
# philos_shared_state.py::fetch_shared_state`). No canon logic — loader,
# projection, or derivation — is re-implemented here; a failed connection
# degrades honestly to Provenance.UNKNOWN via `_safe()`, same as every other
# collector in this file, never a fabricated Human/Music reading.
#
# Human and Music stay two SEPARATE collectors/domains on purpose (Phase 7
# rule: "Music queries must remain isolated to Music domain... Human
# queries must remain isolated to Human domain unless explicitly
# requested") — no cross-domain synthesis happens in either function below.
# Action/Effect/Learning counts are real but SUBJECT-scoped, not
# domain-scoped (canon's own `Action.owner` has no `domain_id` field — see
# `canonicalRef.ts`/`domainStateQuery.ts` for why this codebase never
# invents that mapping); they are reported once, on the Person collector,
# labeled as subject-wide activity rather than attributed to either domain.

def collect_canonical_person() -> DomainStatus:
    def _run():
        result = fetch_shared_state()
        if not result.connected:
            return DomainStatus(
                domain="canonical_person", label_he="Person קנוני (PHILOS)",
                provenance=Provenance.UNKNOWN,
                summary_he=f"לא ניתן היה להתחבר ל-PHILOS shared-state ({result.error}).",
                source="app/api/canon/shared-state",
            )
        data = result.data or {}
        human = data.get("human") or {}
        current = human.get("current_state") or []
        open_loops = data.get("open_loops") or {}
        no_effect = open_loops.get("no_effect_recorded", 0)
        claimed_only = open_loops.get("effect_claimed_only", 0)
        verified = open_loops.get("effect_verified", 0)

        if not current:
            summary = "אין עדיין תצפית Human אמיתית (current_state ריק) — PersonInstance קיים אך ללא State מתועד."
            provenance = Provenance.UNKNOWN
        else:
            parts = [f"{s.get('parameter_id')}={s.get('level')} (confidence={s.get('confidence')})" for s in current]
            summary = "מצב Human נוכחי: " + "; ".join(parts) + "."
            provenance = Provenance.FACT
        summary += f" פעילות Action/Effect (כלל הנושא): {verified} מאומת, {claimed_only} claimed בלבד, {no_effect} ללא Effect."

        blocker = f"{no_effect} Action ללא Effect רשום — לולאה פתוחה." if no_effect > 0 else ""
        brain_next = (data.get("brain") or {}).get("next_action") or {}

        return DomainStatus(
            domain="canonical_person", label_he="Person קנוני (PHILOS)", provenance=provenance,
            summary_he=summary, source=f"subject={data.get('subject_id')} @ {data.get('asOf')}",
            next_action_he=brain_next.get("label", ""), blocker_he=blocker,
            what_changed_he="השתנה מאז הקריאה הקודמת." if human.get("changed") else "",
            details={
                "subject_id": data.get("subject_id"), "domain_id": human.get("domain_id"),
                "source_refs": human.get("source_refs"), "current_state": current,
                "history_count": len(human.get("history") or []), "evidence": human.get("evidence"),
                "changed": human.get("changed"), "confidence": human.get("confidence"),
                "actions": data.get("actions"), "effects": data.get("effects"), "learning": data.get("learning"),
            },
        )

    return _safe("canonical_person", "Person קנוני (PHILOS)", _run)


def collect_canonical_music() -> DomainStatus:
    def _run():
        result = fetch_shared_state()
        if not result.connected:
            return DomainStatus(
                domain="canonical_music", label_he="Music קנוני (PHILOS)",
                provenance=Provenance.UNKNOWN,
                summary_he=f"לא ניתן היה להתחבר ל-PHILOS shared-state ({result.error}).",
                source="app/api/canon/shared-state",
            )
        data = result.data or {}
        music = data.get("music") or {}
        current = music.get("current_state") or []
        cm = data.get("community_marketplace") or {}
        world = data.get("world_relevance") or {}
        open_needs = len(cm.get("open_needs") or [])
        open_offers = len(cm.get("open_offers") or [])
        bridge_links = world.get("bridge_link_count", 0)

        if not current:
            summary = "אין עדיין תצפית Music אמיתית (current_state ריק) — ValueDomainInstance קיים אך ללא State מתועד."
            provenance = Provenance.UNKNOWN
        else:
            parts = [f"{s.get('parameter_id')}={s.get('level')} (confidence={s.get('confidence')})" for s in current]
            summary = "מצב Music נוכחי: " + "; ".join(parts) + "."
            provenance = Provenance.FACT
        summary += f" הזדמנויות קהילה/שוק: {open_needs} Need פתוח, {open_offers} Offer פתוח. קישורי עולם: {bridge_links}."

        return DomainStatus(
            domain="canonical_music", label_he="Music קנוני (PHILOS)", provenance=provenance,
            summary_he=summary, source=f"subject={data.get('subject_id')} @ {data.get('asOf')}",
            what_changed_he="השתנה מאז הקריאה הקודמת." if music.get("changed") else "",
            details={
                "subject_id": data.get("subject_id"), "domain_id": music.get("domain_id"),
                "source_refs": music.get("source_refs"), "current_state": current,
                "history_count": len(music.get("history") or []), "evidence": music.get("evidence"),
                "changed": music.get("changed"), "confidence": music.get("confidence"),
                "open_needs": open_needs, "open_offers": open_offers, "bridge_link_count": bridge_links,
            },
        )

    return _safe("canonical_music", "Music קנוני (PHILOS)", _run)


# ── System Status: Nexus / Nexus Globe (repo-wide, distinct from Merlin's
#    own runtime — section 2 lists them as separate systems) ────────────

def collect_nexus_globe() -> DomainStatus:
    def _run():
        rev = subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"], cwd=_NEXUS_GLOBE_ROOT,
            capture_output=True, text=True, timeout=5,
        ).stdout.strip()
        branch = subprocess.run(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"], cwd=_NEXUS_GLOBE_ROOT,
            capture_output=True, text=True, timeout=5,
        ).stdout.strip()
        dirty = subprocess.run(
            ["git", "status", "--porcelain"], cwd=_NEXUS_GLOBE_ROOT,
            capture_output=True, text=True, timeout=5,
        ).stdout
        n_changed = len([l for l in dirty.splitlines() if l.strip()])
        if not rev:
            return DomainStatus(
                domain="nexus_globe", label_he="נקסוס גלוב", provenance=Provenance.UNKNOWN,
                summary_he="לא ניתן לקרוא מצב git עבור המאגר.",
            )
        summary = (
            f"ענף {branch}, commit {rev}. {n_changed} קבצים לא-מחויבים (uncommitted) כרגע."
        )
        return DomainStatus(
            domain="nexus_globe", label_he="נקסוס גלוב", provenance=Provenance.FACT,
            summary_he=summary, source=str(_NEXUS_GLOBE_ROOT / ".git"),
            next_action_he="לבחון ולמזג קבצים לא-מחויבים." if n_changed else "",
            details={"branch": branch, "revision": rev, "uncommitted": n_changed},
        )

    return _safe("nexus_globe", "נקסוס גלוב", _run)


# ── sections 7-8: Philos Personal Orientation, Behavior/Physical Reality ──
# No data source exists for either (confirmed by audit, 2026-08-07 — see the
# Day Opening rewrite's inspection: app/lib/essence/orientation.ts tracks
# CONVERSATIONAL STYLE, not life-balance; mos/orientation.py is an explicit
# stub with zero real signal). Reporting honest UNKNOWN / insufficient-data
# is the behavior the spec itself requires (sections 7-8's own rules).

def collect_philos_personal_orientation() -> DomainStatus:
    return DomainStatus(
        domain="personal_orientation", label_he="Philos — אוריינטציה אישית",
        provenance=Provenance.UNKNOWN,
        summary_he=(
            "אין לי מספיק נתונים כדי לקבוע את מצבך בממדים גוף / רגש / שכל, "
            "פנימי / חיצוני, או אישי / חברתי."
        ),
    )


def collect_behavior_physical() -> DomainStatus:
    return DomainStatus(
        domain="behavior_physical", label_he="התנהגות / מציאות פיזית",
        provenance=Provenance.UNKNOWN,
        summary_he="אין לי מספיק נתונים כדי לקבוע את מצבך הפיזי או החיצוני.",
    )


# ── H. Merlin / Infrastructure (includes Control Interface health, per the
#    spec's placement: SYSTEM STATUS → Merlin → Control Interface — kept
#    inside this one domain, never a separate section) ──────────────────

def _control_interface_health(control_state) -> str:
    """One sentence if healthy, a named-failure sentence if not. Reads only
    real, live fields off the SAME control_state object service/control_panel.py
    (Surface B, port 8802) is built on — this code runs inside that same
    process, so 'control interface reachable' / 'Merlin service connected'
    are structural facts (the object is shared), not assumptions. Never
    claims health without runtime evidence."""
    problems: list[str] = []
    if control_state.last_error:
        problems.append(f"שגיאה אחרונה: {control_state.last_error}")
    if control_state.invariant_violations:
        problems.append(f"{len(control_state.invariant_violations)} הפרות invariant")
    if not control_state.day_opening_double_clap_enabled:
        problems.append("clap trigger אינו מחובר כרגע ל-Day Opening")

    try:
        import service.merlin_service as svc  # local import — avoids circular import at module load
        barge_in_ok = bool(getattr(svc, "BARGE_IN_ENABLED", False))
    except Exception:
        barge_in_ok = False
        problems.append("לא ניתן לאמת זמינות barge-in")
    else:
        if not barge_in_ok:
            problems.append("barge-in אינו זמין")

    if problems:
        return "ממשק השליטה פעיל (127.0.0.1:8802), אבל " + "; ".join(problems) + "."

    wake_note = "ממתין למילת הפעלה" if control_state.runtime_state == "IDLE" else control_state.runtime_state
    return (
        f"ממשק השליטה תקין (127.0.0.1:8802), Merlin מחובר, מצב: {wake_note}, "
        "האזנה, barge-in ומחיאת-כף פעילים."
    )


def collect_merlin_infrastructure(control_state, turn_ctrl) -> DomainStatus:
    def _run():
        snap = control_state.snapshot()
        parts = [
            f"השירות פעיל {int(snap['uptime_seconds'])} שניות.",
            f"מודל STT: {control_state.stt_model or 'לא ידוע'}.",
        ]
        blocker = ""
        if snap.get("last_error"):
            blocker = snap["last_error"]
        if control_state.last_rejection_reason:
            parts.append(f"תמלול אחרון שנדחה: {control_state.last_rejection_reason}.")
        cancelled = turn_ctrl.cancelled_turn_ids
        parts.append(f"{len(cancelled)} תורות בוטלו מאז ההפעלה.")
        parts.append(_control_interface_health(control_state))
        return DomainStatus(
            domain="merlin", label_he="Merlin / תשתית", provenance=Provenance.FACT,
            summary_he=" ".join(parts), source="service/control_state.py (live)",
            blocker_he=blocker,
            next_action_he="" if not blocker else "לטפל בשגיאה האחרונה שדווחה.",
        )

    return _safe("merlin", "Merlin / תשתית", _run)


# ── orchestration ─────────────────────────────────────────────────────────

def _isolated(domain: str, label_he: str, fn):
    """Belt-and-suspenders on top of each collector's own _safe() wrapper
    (section 9): even if a collector function raises OUTSIDE its own
    internal try/except — e.g. a bug in a future edit that removes it, or a
    monkeypatched replacement in a test — collect_all() itself must still
    return a complete domain list rather than crashing the whole briefing."""
    try:
        return fn()
    except Exception as exc:
        logger.warning("day_opening collect_all: %s raised outside its own guard: %s", domain, exc)
        return DomainStatus(
            domain=domain, label_he=label_he, provenance=Provenance.UNKNOWN,
            summary_he="", error=str(exc),
        )


def collect_all(control_state, turn_ctrl) -> tuple[str, list[DomainStatus], list[OutcomeCandidate]]:
    """Runs every collector, each isolated (section 9). Returns
    (orientation_text, domain_statuses, outcome_candidates)."""
    orientation = collect_orientation()

    world = _isolated("world_external", "עולם / חוץ", collect_world_external)
    human = _isolated("human_config", "הגדרת אדם", collect_human_config)
    music = _isolated("music_config", "הגדרת מוזיקה", collect_music_config)
    studio = _isolated("studio", "אולפן / אייבלטון", collect_studio)
    nexus = _isolated("nexus_globe", "נקסוס גלוב", collect_nexus_globe)
    course = _isolated("course", "קורס", collect_course)
    readiness = _isolated(
        "professional_readiness", "מוכנות מקצועית",
        lambda: collect_professional_readiness(studio),
    )
    philos = _isolated("philos", "Philos", collect_philos)
    canonical_person = _isolated("canonical_person", "Person קנוני (PHILOS)", collect_canonical_person)
    canonical_music = _isolated("canonical_music", "Music קנוני (PHILOS)", collect_canonical_music)
    merlin = _isolated(
        "merlin", "Merlin / תשתית",
        lambda: collect_merlin_infrastructure(control_state, turn_ctrl),
    )
    personal = _isolated(
        "personal_orientation", "Philos — אוריינטציה אישית", collect_philos_personal_orientation,
    )
    behavior = _isolated("behavior_physical", "התנהגות / מציאות פיזית", collect_behavior_physical)

    domains = [
        world, human, music, studio, nexus, course, readiness,
        philos, canonical_person, canonical_music, merlin, personal, behavior,
    ]

    candidates: list[OutcomeCandidate] = []
    for d in domains:
        if d.blocker_he:
            candidates.append(OutcomeCandidate(
                domain=d.domain, text_he=d.next_action_he or f"לטפל בחסם ב{d.label_he}",
                blocker_removal=True, strategic_value=2,
            ))
        elif d.next_action_he:
            candidates.append(OutcomeCandidate(
                domain=d.domain, text_he=d.next_action_he,
                strategic_value=2 if d.provenance == Provenance.FACT else 0,
                executable_today=d.provenance != Provenance.UNKNOWN,
            ))

    return orientation, domains, candidates
