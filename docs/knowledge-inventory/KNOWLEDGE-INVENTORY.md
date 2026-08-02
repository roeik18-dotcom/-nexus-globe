# Roei Knowledge Inventory — read-only analysis (v1)

**Method.** Scanned metadata of ~120,000 files (~425 GB) across Dropbox, ~/Music,
~/Documents, ~/Desktop and the code repos. Sampled a handful of high-value **text**
documents to confirm content. **Sensitive folders (contracts, invoices, brokering)
were classified by path only — never opened.** Nothing was moved, renamed, or
modified. Every row carries a confidence level. Full file list cached at
`scratchpad/dbx_files.txt` for deeper queries.

---

## ★ Headline finding — the architecture already exists, in your own hand
`Dropbox/----text----/…/מבנה_פרויקט_פילוס_ומוזיקה.docx` (written by you, years ago)
already defines the exact system we've been designing:

| Your doc says | = our design |
|---|---|
| **רובד 1 — SOURCE / געש (Geyser)** · "תיקיית מקור. אין למחוק" | the **canonical store / Universal Inbox** (one source, never deleted) |
| **פיצול לשניים: מוזיקה + פילוס אוריאנטציה** | the **two Personal Configs** (artist + person) |
| **רובד 4 — תיקיית גשר (משותפת)**: רעש↔שקט, סדר↔כאוס, זמן, אנרגיה | **multi-tagging** — ideas that belong to both, stored once |
| **שלב 4–5: בניית אפליקציה + אוטומציה** | Merlin / Philos + the daily-brief automation |

The Personal-Config design is therefore **grounded in what you already built**, not
theoretical. "געש" (Geyser) is your canonical idea-source — it appears both as the
SOURCE folder and as your song titles (`געש` series).

---

## Deliverable 1 — Complete inventory (top level)

### Dropbox — 103,674 files, ~400 GB
| Folder | Files | Size | Dominant types | Probable domain | Purpose | Conf. |
|---|--:|--:|---|---|---|---|
| `-DROBOX-ABLETON` | 68,687 | 194 G | asd/wav/aif/als/adv/adg | **Music — Production assets** | Ableton library, samples, presets, Merlin Morgana project | high |
| `Musica-X-קפסולת זמן` | 14,353 | 96 G | mp3/wav | **Music — References** | genre-sorted reference library, liveset refs | high |
| `תמונות רואי` | 7,876 | 94 G | jpg/heic/mp4 | **Personal — Media** | photos/video: tattoos, logo, Thailand, events | high |
| `----text----` | 7,012 | 8.4 G | jpg/mp4/txt/py/pdf/md | **CORE: Person + Music + Config** | the knowledge/config core (see below) | high |
| `—קונפינג אישי—…שוטף` | 3,998 | 4.1 G | pdf/docx/rtf + images | **Personal Config + Life-admin** | config PDFs + contracts/invoices/brokering (sensitive) | high |
| `_-- רימון --_` | 219 | 2.3 G | pdf/img/audio | **Learning — Music school** | Rimon: harmony, production, private teacher | high |
| `---אולפני הקלטות פלוטו---` | 215 | 154 M | img/pdf | **Learning — Music school** | Pluto recording-studio course | high |
| `קשת קורס-שיעורים` | 123 | 331 M | mixed | **Learning — Music course** | Keshet course lessons | med |
| `עמרי כהן-BE YOURSELF` | 27 | 530 M | rtfd/video | **Learning — Method** | Omri Cohen "Be Yourself" reference-work sessions | high |
| `Camera Uploads` | 1,092 | (cloud) | jpg/heic | **Personal — Media** | phone camera roll (online-only) | high |
| `Desktop`, `Screenshots` | 71+8 | 604 M | mixed | **Unsorted / Media** | staging | med |

### Other roots
| Root | Files | Size | Domain | Note | Conf. |
|---|--:|--:|---|---|---|
| `~/Music` | 12,895 | 24 G | **Music — DAW libraries** | Ableton, Pro Tools, MPC, EZ-series, Superior Drummer, Sample Library | high |
| `~/Documents` | 2,905 | 315 M | Mixed | to be sub-scanned | low |
| `~/-nexus-globe` | 39,228 | — | **Merlin + Philos (active code)** | the live monorepo (voice-gateway, app) | high |
| `~/nexus-globe` | 1,112 | — | **Philos surfaces (duplicate)** | see [[nexus-repos]] | med |
| `~/philos-orchestrator` | 32 | — | Philos (early) | small/early scaffold | med |
| `~/cluod code` | 104 | — | **Engine of record** | current working repo | high |

---

## Deliverable 2 — Domain map

**Top-level domains detected:** Philos · Music · Merlin · Personal · Learning ·
Finance · Legal · Media · Archive · Unknown. Mapping:

- **Philos** → `----text----/+אדם/` (orientation model, the 3-planes/6-forces prism,
  world-domain schemas), `+אדם/philos/` (an older Philos **code repo** — archive),
  the active `-nexus-globe/app/lib/philos`.
- **Music** → `-DROBOX-ABLETON`, `~/Music`, `Musica-X` (references),
  `----text----/+מוזיקה` (writing principles + lyrics/"היתוך מילולי").
- **Merlin** → `-nexus-globe/voice-gateway` (active), Merlin Morgana = the *artist/brand*
  (distinct from Merlin the agent).
- **Personal** → `תמונות רואי`, `Camera Uploads`, life events under `—קונפינג אישי—`.
- **Learning** → `רימון`, `פלוטו`, `קשת`, `עמרי כהן`, course PDFs.
- **Finance / Legal** → `—קונפינג אישי—/{חוזים הסכמים, חשבוניות, תיווך}` — **path-classified, not read**.
- **Media / Archive** → photos, videos, `Camera Uploads`, conflicted-copy files.

### Music sub-classification (real folders → template)
`Artist Identity` (Merlin Morgana logo/brand) · `Production` (`-DROBOX-ABLETON`, `~/Music/Ableton`) ·
`Songwriting/Lyrics` (`+מוזיקה/היתוך מילולי,טקסט,סקיצות` — the `געש` song drafts) ·
`Writing principles` (`+מוזיקה/עקרונות הכתיבה` — **phonetics-driven**: vowels/consonants/tones,
sort-by-vowel-height) · `Studio/Plugins/Presets` (Serum, Waves, `~/Music/*`) ·
`Samples` (`~/Music/Sample Library`, MPC) · `References` (`Musica-X`) ·
`Learning` (Rimon/Pluto/Keshet/Omri) · `Templates` (`~/Music/Ableton/Templates`).

### Philos sub-classification (real folders → template)
`Orientation` (`philos_orientation_complete.md`, `פילוס_אוריאנטציה_מודל_מלא.docx`, PDF
expanded) · `Core Principles / Human Model` (the **3 planes** physical/mental/emotional +
**6 forces** prism; the "three-dimensions prism" folder) · `World domains` (`תמונות סרטונים
סכמות תחומי עולם`) · `Product/Architecture/History` (`+אדם/philos` old repo, docs, session
summaries) · `Morning trigger` (`🌅 פתיח יום — טריגר 1.pdf`).

---

## Deliverable 3 — Knowledge graph (the real flow you built)
```
              עישת געש  (GEYSER / SOURCE — canonical, "do not delete")
                     │  daily thoughts · empowering lines · raw ideas · life insight
        ┌────────────┼─────────────────────┐
        ▼            ▼                       ▼
   +מוזיקה       BRIDGE (shared)          +אדם  (Philos)
   emotional     noise↔silence · order↔    explanatory
   /expressive   chaos · time · energy ·   models · definitions ·
   lyrics·melody frequency · matter↔spirit human/society principles
        │            │(multi-tag)                │
        ▼            ▼                            ▼
   Music Config   one canonical item,        Philos Personal Config
        │         many links                      │
        └──────────► App (Merlin/Philos) ◄────────┘  → automation → daily brief
```
Cross-links found: the *same* Philos-orientation PDFs appear in `+אדם` **and** in
`—קונפינג אישי—/תזכוות…2026` (iPhone-reminder dumps) — evidence the SOURCE→split flow
was done by hand and partially duplicated.

---

## Deliverable 4 — Knowledge detection (issues to resolve)
- **Duplicate Philos repos (4):** `+אדם/philos` (Dropbox archive) · `~/-nexus-globe` (active) ·
  `~/nexus-globe` · `~/philos-orchestrator`. Risk of divergent "sources of truth" — see [[nexus-repos]].
- **Conflicted copies:** e.g. `…'s conflicted copy 2026-01-13`, `…2026-06-03` in `עמרי כהן`
  and elsewhere — Dropbox sync forks. Need a canonical pick.
- **Config-as-images (major):** the "full personal config" (31 "pages") is **blank in text** —
  it's scans/screenshots/handwriting. Most of `—קונפינג אישי—` and `+אדם` knowledge is in
  **jpg/heic/pdf**, not machine-readable. → an **OCR/extraction pass** is the real unlock.
- **Orphans / staging:** `Desktop`, `Screenshots`, `Camera Uploads`, `1.rtfd` — captured but unsorted (your "Unclassified" inbox, already real).
- **Naming entropy:** many `געש1..8`, `myfile.docx`, "conflicted copy", version suffixes — no stable ids.
- **Missing structure:** no explicit `Knowledge Base`, `Projects`, `Events` layers yet —
  everything is mixed inside folders. (These are exactly the L4/L5/L6 levels of the design.)

---

## Deliverable 5 — Suggested final architecture (5-way split + WHY)

| # | Bucket | What goes here (real folders) | Why here |
|---|---|---|---|
| 1 | **Philos Personal Config** (person) | `+אדם` orientation/principles/human-model; the 3-planes/6-forces prism; morning trigger | identity & mechanisms — "who you are"; changes slowest |
| 2 | **Music Personal Config** (artist) | `+מוזיקה` identity + writing principles (phonetics) + production philosophy; Merlin Morgana brand | "how you work" as an artist; reuses the person core |
| 3 | **Knowledge Base** | Rimon/Pluto/Keshet/Omri courses; phonetics/harmony/theory; references catalog | *what you know* — grows forever; not identity (L4) |
| 4 | **Project Data** | `-DROBOX-ABLETON`, `~/Music`, active `.als` sets, mixes, stems, `-nexus-globe` code | *what you're working on* — heavy binaries (L5) |
| 5 | **Historical Archive** | old `philos` repo, conflicted copies, `Camera Uploads`, past events/photos, invoices/contracts (sensitive, sealed) | *what already happened* — read-mostly, some sealed (L6) |

**Canonical source stays the Geyser (עישת געש)** — everything else references it; nothing
is copied. Sensitive Finance/Legal is a **sealed** sub-archive: never rendered to Merlin,
never a founder principle.

---

## Deliverable 6 — Migration plan (phased — nothing moves until you approve each step)
0. **Freeze & backup** — snapshot the folder tree (paths only) before any change; pick the
   canonical Philos repo among the four (recommend `~/cluod code` engine + `-nexus-globe`) — see [[nexus-repos]].
1. **Extraction pass (read-only):** OCR the image/PDF config (`+אדם`, `—קונפינג אישי—`) into
   text so the knowledge becomes machine-readable. This is the single highest-value step.
2. **Designate the SOURCE** (Geyser) as the canonical inbox; index (don't move) every item with an id.
3. **Classify → multi-tag** each extracted item to Config/Knowledge/Project/Archive (confidence-scored). No copies.
4. **Populate the two Configs** from the tagged, high-confidence Person/Music entries (into the versioned schema).
5. **Seal** Finance/Legal/medical under privacy; exclude from Merlin render.
6. **Wire Merlin** last (ContextSelector + daily brief) once Configs are populated.

Each phase is reversible and read-only until the specific "go".

---

## How this feeds the operating loop
`Geyser (source) → Universal Inbox → Classifier → {Philos Config · Music Config ·
Knowledge · Projects} → Morning Snapshot → Daily Brief → Schedule → Execution → Events →
Knowledge/Behaviour → Philos Evolution`. The scan shows every stage already has **real
material** to draw on — the system isn't starting from zero, it's organising a decade of work.

*Boundaries kept: no files moved/renamed/modified; sensitive folders classified by path
only; no code changed. Analysis only.*
