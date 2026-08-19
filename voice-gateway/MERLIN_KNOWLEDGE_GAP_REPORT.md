# MERLIN — Knowledge Ingestion & Gap Report

Audit of the **live runtime** knowledge path (no assumptions — verified from the running
`master_config` reader, `domain_router`, `context_builder`, and 7 production-`route()`
retrieval tests). No code was changed to produce this report.

## Runtime knowledge path (as executed)
- `domain_router.route(query)` → for HUMAN/MUSIC calls `master_config.retrieve_*` which reads the **real Dropbox master `.xlsx`** live (mtime-cached), token-scores rows, returns ≤6 provenance-tagged units. PHILOS → `project_knowledge` → `PHILOS-ORCHESTRATION-LAYER.md`.
- `context_builder.for_session` injects ONLY the selected domain's retrieved units (`OrientationLayer`); `CONTEXT_PROPAGATION=True` proves the master text reaches the final model prompt; `FINAL_PROMPT_AUDIT … MASTER_ABSOLUTE_PATH=` logs the exact file.
- Atomic schema **already exists** in both masters (Source_ID, Document_ID, Atomic_ID, Canonical_ID, Domain, Type, Tags, Keywords, Canonical_Text, relations [Parent/Children/Supports/Contradicts/Expands/Related], Duplicate_Group, Confidence, Status, Version, Semantic_State). Ingestion is done at the master level; the runtime reads it.

## Source inventory
| Source_ID | Path | Type | Domain | Units | Ingested | Runtime reachable | Canonicalized |
|---|---|---|---|---|---|---|---|
| HUMAN-MASTER | `…/Dropbox/----text----/+אדם/…/קונפינג-אדם-MASTER-PRODUCTION-2.1-TAXONOMY-AUDITED-PROGRESS.xlsx` | xlsx (MASTER_UNITS) | HUMAN | 1492 rows / **1329 resolved** | YES | YES (T1) | YES |
| MUSIC-MASTER | `…/Dropbox/----text----/+מוזיקה/MASTER_MUSIC.xlsx` | xlsx (MASTER_MUSIC) | MUSIC | 612 rows / **579 resolved** | YES | YES (T4–T6) | YES |
| PHILOS-ORCH | `/Users/roei/-nexus-globe/PHILOS-ORCHESTRATION-LAYER.md` | markdown | PHILOS | chunked | YES | YES (T3) | N/A |
| person.yaml | `profiles/person.yaml` | yaml | HUMAN | 14 | v1 stub | NOT used by route (superseded by master) | NO |
| music.yaml | `profiles/music.yaml` | yaml | MUSIC | 6 | v1 stub | NOT used by route | NO |
| relationship-mem | `memory/relationship/memories.json` | json | mixed | 711 (personal 246 / relationship 261 / project 204) | YES | GATED (specialist turns suppress it; general low-conf = 0) | N/A |
| persistent-mem | `memory/persistent/{jarvis,philos}.json` | json | persona | — | YES | non-merlin personas only | N/A |

## A. KNOWN + RUNTIME VERIFIED
- **HUMAN identity / psychology / preferences** — 1329 units; T1 ("הדרך שאני מעדיף לעבוד") → `human_config`, 6 units from MASTER-PRODUCTION-2.1. Sections: מנגנוני הסתגלות והגנה (407), רעיונות/תודעה (283), מבנה נפשי (146), קוגניציה (143), תאוריית הדחף (92), התפתחות פסיכוסקסואלית (44).
- **MUSIC taste / workflow / songwriting / production / Ableton** — 579 units; T4–T6 PASS from MASTER_MUSIC. Sections: דגשים ומסקנות (120), מוזה/תצורות הפקה (94), אידיאולוגיה מוזיקלית (92), עקרון השאו (71), הבנת המוזיקה (51), סטיילינג/זמרים/שמות במה.
- **PHILOS orientation** — T3 PASS from PHILOS-ORCHESTRATION-LAYER.md.

## B. KNOWN BUT NOT RUNTIME-CONNECTED
- **Personal goals / aspirations** — T2 ("מה המטרות והשאיפות שלי") → **GENERAL, 0 units**. The master almost certainly holds goal/values content, but the phrasing matches no cue and the token-probe finds no overlap → not retrieved. **Root cause:** token-exact retrieval + Hebrew morphology (prefixes) + no goal/values cue. **Fix:** add HUMAN cues for goals/values (מטרות/שאיפות/יעדים/ערכים/עקרונות) OR a lightweight semantic/embedding recall over the master.
- **Cross-domain HUMAN+MUSIC** — T7 ("איך האופי הפסיכולוגי משפיע על המוזיקה") → `music_config` only; the runtime routes **one** domain/turn, so it cannot co-retrieve both masters in a single answer. **Fix (if desired):** a cross-domain retrieval mode for explicitly cross-domain queries.
- **Control-panel observability** — `/api/knowledge_sources` reports `profiles/person.yaml` (14) + `music.yaml` (6) as the sources, **not** the live masters actually used. Misleading; the routing itself is correct.
- **97 open human units** — 27 `EXPLICITLY_UNMAPPED` + 70 `RETAINED_OPEN` exist in the master but are not resolved/canonical.

## C. PARTIAL / CONFLICTING
- **Music theory inside the HUMAN master** — 135 units under "תאוריה מוזיקלית" live in the *human* master. Domain overlap; a music-theory question could be split across both masters (routing picks one).
- **Retrieval recall is token-exact** — Hebrew prefixes (ל/ה/ב…) and transliteration (e.g. דיסונאנס↔צרימה↔לצרימה) mean some valid queries won't surface the right units even though they exist. Partial recall, not a content gap.
- **Stale v1 profiles** — person.yaml/music.yaml remain on disk and are still surfaced by the control panel although superseded by the masters.

## D. MISSING (thin/absent in sources)
- **HUMAN logistics / social-professional context / habits / projects** — the 1329 units are psychology-heavy (defense mechanisms, cognition, drive theory); day-to-day logistics, calendar, concrete projects, and social/professional context are thin. *Recommended source:* a structured "operating profile" (routines, current projects, constraints, contacts).
- **MUSIC release / artist strategy, explicit dislikes, unresolved choices** — production/ideology is rich; explicit release strategy, "known dislikes", and open decisions are thin. *Recommended:* a short "artist strategy + dislikes + open decisions" sheet.
- **Merlin persistent store** — `memory/persistent/merlin.json` does not exist (only jarvis/philos). Not required (masters are the source of truth), but noted.

## Coverage (computed from sources, not estimated)
| Metric | Value |
|---|---|
| Human source rows / resolved units | 1492 / **1329** |
| Human mapped (Semantic_State RESOLVED) | 1395 |
| Human runtime reachable | YES (preferences/identity T1); goals **NOT** reachable (T2) |
| Music source rows / resolved units | 612 / **579** |
| Music mapped | 579 resolved |
| Music runtime reachable | YES (T4–T6) |
| Unmapped human units | 97 (27 EXPLICITLY_UNMAPPED + 70 RETAINED_OPEN) |
| Conflicts / overlaps | music-theory (135) placed in HUMAN master |
| Duplicates | linked via `Duplicate_Group` (not deleted) |
| Missing categories | HUMAN logistics/social/projects; MUSIC release-strategy/dislikes/open-choices |

## Self-audit
- Every source scanned: YES (both masters loaded + schema read; profiles; memories; philos). 
- Units lost: NO (masters read verbatim, provenance preserved; nothing deleted). 
- Invented canonical text: NO (report only cites what the masters contain). 
- HUMAN/MUSIC mixed: no injection mixing at runtime (isolation verified); the *only* overlap is the music-theory section physically inside the human master (flagged, not merged). 
- Philos personal material routed correctly: YES (T3). 
- Created files loaded at runtime: this report is documentation only; no runtime file created. 
- Retrieval test proves reachability: YES for 6/7; T2 is the documented disconnect.
