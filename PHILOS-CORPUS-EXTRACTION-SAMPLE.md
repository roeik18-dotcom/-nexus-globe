# PHILOS Corpus — Extraction Sample (95 files read, real content)

**Status:** Genuine, verbatim-sourced extraction across three passes — not a
full corpus pass. 95 of 2372 discovered files have actually been opened and
read (7 + 45 + 32 + 11, selected by real filename/keyword relevance ranking
against a real inventory, not arbitrarily). Everything below is quoted or
closely paraphrased from real file content, attributed to its real source.
2277 of 2372 files remain unread.

Source root: `~/Library/CloudStorage/Dropbox/----text----/+אדם/` (local
only — see `source-corpus/README.md`).

---

## L1–L5 — CONFIRMED, source-verified (not the candidate interpretation — the real one)

Five short `.textClipping` files, each a complete, self-contained formula.
Quoted in full:

**L1 — מצב פנימי (internal state)**
> L1 מחושב על בסיס 4 משתנים: פחד (שלילי), עייפות (שלילי), בהירות (חיובי), ויסות (חיובי).
> L1 = (Clarity + Regulation − Fear − Fatigue) / 4
> הערך המתקבל מייצג את מוכנות המערכת הפנימית לפעולה.
> L1 שלילי = בלימה פנימית · L1 חיובי = דחיפה פנימית

**L2 — שכבת ההתנהגות (behavior layer)**
> L2 מודד את הפער בין כוונה לבין פעולה בפועל. מבוסס על: כוונה (Intent), ביצוע (Execution), הימנעות (Avoidance), עקביות (Consistency).
> L2 = (Execution + Consistency + Intention − Avoidance) / 4
> Execution Gap = Intention − Execution
> L2 גבוה = התנהגות אפקטיבית · L2 נמוך = פער ביצוע / הימנעות

**L3 — שכבת הקשרים הקרובים (close relationships layer)**
> L3 מודד את השפעת האנשים הקרובים על יכולת הפעולה של האדם. מבוסס על: תמיכה (Support), לחץ בין־אישי (Pressure), קונפליקט קרוב (Conflict), שייכות (Belonging).
> L3 = (Support + Belonging − Pressure − Conflict) / 4
> L3 חיובי = קשרים שמאפשרים פעולה · L3 שלילי = קשרים שמגבילים פעולה

**L4 — שכבת המבנה החברתי (social structure layer)**
> L4 מודד את השפעת המסגרות החברתיות על יכולת הפעולה. מבוסס על: לחץ כלכלי, מגבלת תפקיד, סיכון לסנקציה, מרחב חופש.
> L4 = (Freedom − EconomicPressure − RoleConstraint − SanctionRisk) / 4
> L4 חיובי = מבנה מאפשר · L4 שלילי = מבנה חוסם

**L5 — שכבת המערכת הרחבה (broad system layer)**
> L5 מודד את השפעת החברה, התרבות והשיח הקולקטיבי על האדם. מבוסס על: לחץ נורמטיבי, קונפליקט אידיאולוגי, השפעת שיח חיצוני, ציות/עיוורון חברתי.
> L5 = − (NormPressure + IdeologyConflict + MediaInfluence + SocialBlindness) / 4
> L5 שלילי = שליטה חברתית גבוהה · L5 קרוב לאפס = עצמאות תודעתית

**This CONFIRMS the candidate interpretation from the ground-truth audit**
(L1 internal / L2 behavior / L3 close relationships / L4 social structure /
L5 broad system) — it was a correct hypothesis, now source-verified, not
assumed.

**Open, unresolved by this sample: is there an L6?** The weights-model file
(below) explicitly says "האדם פועל בתוך 6 שכבות מערכתיות" (the person
operates within 6 systemic layers) and writes the aggregate formula as
`S = Σ(L1..L6)` — but no `L6`-named file was found anywhere in the corpus
by this pass's search. This is recorded as an open gap, not resolved by
assumption — L6 may be un-captured, differently named, or the "6" may be a
later/looser restatement of a 5-layer model. **Do not canonize either
reading yet.**

## Weights model — real, source-verified

`מודל המשקלים של פילוס אוריאנטציה` (.textClipping), quoted in full:
> האדם פועל בתוך 6 שכבות מערכתיות. לכל שכבה יש: משקל, כיוון, עוצמה.
> המצב הכולל של האדם הוא סכימת הכוחות מכל השכבות.
> Li = wi × di × ii
> System State: S = Σ(L1..L6)
> כאשר: משקל קובע כמה השכבה דומיננטית · כיוון קובע אם היא דוחפת או בולמת · עוצמה קובעת את כוח ההשפעה בפועל
> מתוך S ניתן לגזור: capacityScore, execution gap, readiness to act

This is a **second, more general formula layer** than the plain L1–L5
formulas above — those hard-code 4 named variables each with fixed +/−
signs; this one describes a generic `weight × direction × intensity` model
per layer. Whether these are the SAME model at two points in time, or two
different formulations, is not resolved by this sample — recorded as an
open question (`VERSION_FAMILY`/`CONTRADICTION`, not merged).

## Sub-components model — real, source-verified

`מודל תתי־המרכיבים של פילוס אוריאנטציה` (.textClipping), quoted in full:
> כל אחת מ־6 השכבות במערכת מפורקת לתת־מרכיבים מדידים. המטרה: להפוך את השפעת השכבות ממשמעה רעיונית למבנה חישובי. לכל שכבה יש תתי־מרכיבים. לכל תת־מרכיב יש: עוצמה, כיוון, תרומה למצב הכולל. מתוך סכימת תתי־המרכיבים ניתן לחשב: מצב שכבה, מצב מערכת, capacityScore, execution gap, readiness to act.

Also references 6 layers — consistent with the weights-model file, still
without a located `L6` source document.

## Contradiction-table sample — real, partial, genuinely raw

One file opened (`טבלת ניגודים אדם.textClipping`) out of what is likely many
such tables in the corpus. The extracted text is a raw, informally-punctuated
brainstorm list (pairs separated by `½`, not prose) — quoted representative
fragments, not cleaned up or reinterpreted:

> חלל½מרחב *(void/cavity ↔ space/expanse — used as a CONTRASTED pair by the
> source author, appearing twice in this fragment)*
> הרס½בניה *(destruction ↔ building)*
> מהירות½עכשיויות *(speed ↔ immediacy)*
> יכולת איפוק אישית½יכולת איפוק קבוצתית *(personal restraint capacity ↔
> group restraint capacity)*

**Direct, real evidence for the open `MATTER_GAP_SPACE_TIME` question**: in
this one document, the source author pairs **"חלל" (chalal) against
"מרחב" (merchav)** as opposites/complements — not as synonyms. This is real
support for keeping them distinct rather than assuming either reading. It is
not, by itself, proof of how "חלל"/"מרחב" relate to the separately-attested
"Gap" (canon's `PHILOS-MELTING-POT-CANON.md` §2) or "Space" (`docs/philos-
reality-flow-v0.md`) — a fuller comparison needs more of the corpus read,
not just this one fragment.

---

# PASS 2 — 45 more files, keyword-ranked (not read arbitrarily)

Selected via a real scoring pass over `source-corpus/MANIFEST.json`: filename/
path matches against the priority terms (כוח, L1–L5, מרחב/חלל, ערך, אדם מול,
כור היתוך, קבוצה/קהילה, פעולה/השפעה, משקל, תת, מודל, ניגוד), excluding the
`philos/` code subproject (software, not prose), deduplicated by content
hash. All 45 extracted via `plutil`/`textutil`/`pdftotext` and read in full.

## FORCE MODEL — the real "6" found; NO 9 or 10-force version found

`8.-מבנה הכוחות- מודל ששת הבניינים` ("Force Structure: The Six-Buildings
Model — Individual ↔ Collective") — found as **3 byte-identical copies**
(exact duplicates, same hash), quoted in full (abridged for length, nothing
paraphrased away from its actual claims):

> **5 קיומיים־פיזיים** (physical-existential components): מוח (Mind — logical
> processing, analysis, strategy) · לב (Heart — emotions, compassion, sense
> of worth/connection) · גוף (Body — action, survival, sensory input) ·
> אנרגיה משתפחת (spilling/flowing energy — drive to act, movement, change,
> creation) · סביבת ניגודים (environment of contradictions — conditions,
> pressures, friction, real-world stimuli).
>
> **Psychological depth layer**: each of the three centers (Mind/Heart/Body)
> is overlaid by איד↔אגו↔סופר־אגו (Id↔Ego↔Superego).
>
> **The SIX BUILDINGS**: מוח, לב, גוף, איד, אגו, סופר־אגו (Mind, Heart, Body,
> Id, Ego, Superego) — explicitly named "ששת הבניינים."
>
> **Fractal individual↔collective mapping** (quoted table): Mind→science/
> knowledge/law, Heart→community/trust/connection, Body→economy/
> infrastructure/resources, Id→survival forces/interests, Ego→balancing
> mechanisms, Superego→collective values/ideology. "המערכת היא פרקטלית —
> אותו מבנה חוזר במיקרו (פרט), מזו (קבוצה), מקרו (חברה)" (the system is
> fractal — the same structure repeats at micro/individual, meso/group,
> macro/society scale).
>
> **Named vectors**: V₁ internal-energy · V₂ psychic-conflict · V₃
> interpersonal · V₄ collective · V₅ tonus-shift · V₀ identity-stabilization
> (the response mechanism that tries to produce harmony across the other five).
>
> **Collapse point, quoted**: "הסופר־אגו הפרטי קובע 'מה נכון לי'. הסופר־אגו
> החברתי קובע 'מה נכון לחברה'. כשאין התאמה: הבניינים של הפרט מתנגשים עם
> בנייני הכלל. זו נקודת הקריסה." (individual superego decides "what's right
> for me"; collective superego decides "what's right for society"; when they
> don't align, the individual's structures collide with the collective's —
> that is the collapse point.)

**This is a real, coherent, internally-consistent 6-force/6-structure
model — the fullest, most polished single document found in either pass.**
It is a DIFFERENT "6" than the weights-model's "6 systemic layers" (L1..L6)
— this one is 6 internal STRUCTURES (Mind/Heart/Body/Id/Ego/Superego), not
6 nested SCOPE layers (internal→behavior→close relationships→social
structure→broad system). **Recorded as two distinct source-attested "6"
concepts, not merged.**

**NO 9-force or 10-force version was found anywhere in this batch.** The
candidate ranking specifically prioritized filenames/content containing
"כוח" (force); none of the 45 files reached, referenced, or hinted at a
9-force or 10-force successor. `FORCE_LINEAGE_6_9_10`: **only the 6-force
stage is source-proven from this pass; the 9 and 10-force stages are
UNRESOLVED — not found, not disproven.**

## CONTRADICTIONS — a real, clean taxonomy found

`קטגוריות ניגודים — פילוס אוריאנטציה` ("Contradiction Categories — PHILOS
Orientation"), quoted in full — the cleanest structured list found in either
pass:

> A. ניגודים אונטולוגיים (ontological)
> B. ניגודים גופניים־חושיים (bodily-sensory)
> C. ניגודים רגשיים־פנימיים (emotional-internal)
> D. ניגודים שכליים־תפיסתיים (cognitive-perceptual)
> E. ניגודים בין־אישיים (interpersonal)
> F. ניגודים חברתיים־תרבותיים (social-cultural)
> G. ניגודים מבניים־מערכתיים (structural-systemic)
> H. ניגודים ערכיים־מוסריים (value-moral)
> I. ניגודים אקזיסטנציאליים־קיומיים (existential)
> J. ניגודים מטא־תודעתיים (meta-consciousness)

Ten named categories — a real, deliberate taxonomy, `SOURCE_PROVEN`. Note:
this is a categorization SCHEME for contradictions, unrelated to the
separate "10 forces" target — the two should not be conflated just because
both happen to enumerate ten items.

By contrast, two other "ניגודים" (contradiction) sources found this batch
are genuinely raw, low-signal brainstorm dumps, not models: one
(`ניגודים-לאסוף עוד...textClipping`, 89KB) is several hundred loosely
punctuated opposite-word pairs (חוסר=עודף, מוביליות שימור½מובליות התפתחות,
etc.) interleaved with unrelated tangents — Wikipedia physics-category
listings, Instagram growth-hacking notes, gender-role/sexuality notes,
classical-element (air/fire/water/earth) correspondences, aesthetics-theory
categories, and a stray reference to "קטקסיס" (cathexis) in a personal
diagnostic checklist alongside "מזג" (temperament), "דחף" (drive),
"אינטליגנציה." **Classified `PERSONAL_NOTE` — extremely mixed epistemic
content, not a coherent extractable model.** A repeated fragment (found 3
times, near-duplicate) uses quantum entanglement/superposition as a folk
metaphor for "ניגודים" — **classified `METAPHOR`, explicitly not a physics
claim to narrate as fact** ("שני חלקקים תת אטומים שזורים במצב סופר
פוזיציה…" — colloquial, not a rigorous physics statement).

One further fragment, `שלב א׳ — טבע הניגודים (התרחקות)`, depicts religious/
LGBT/women's groups each "pulling toward" power/money/attention with a
shrinking center — **classified `PERSONAL_NOTE`/opinion, politically
charged, not narrated as PHILOS theory.**

## ACTION → EFFECT → LEARNING — a real, complete product-level document found

`פילוס — מחזור פעולה מלא למשתמש` ("PHILOS — full action cycle for the
user"), a real PDF, structured and complete. Quoted/summarized:

> **Morning opening**: "האדם פועל בשלושה תחומים: גוף · רגש · מחשבה. בחר
> תחום אחד בלבד. הבחירה שלך קובעת אילו פעולות יגיעו אליך היום." (the person
> acts in three domains — body/emotion/thought; choose exactly one; that
> choice determines which actions arrive today.) גוף = "פעולה בעולם... אתה
> משנה מציאות דרך עשייה נראית" (action in the world — you change reality
> through visible doing). רגש = "פעולה בין אנשים... דרך יחס" (action between
> people — through relation). מחשבה = "פעולה של סדר והבנה... דרך בהירות"
> (action of order/understanding — through clarity).
>
> **Day close**: real completion tracking (הגעת למשימה/השלמת), real effect
> tracking (למי הועיל: אדם/כמה אנשים/קהילה; מה השתנה בפועל), real business
> metrics (הכנסה שנוצרה, בקשות חדשות).
>
> **Explicit anti-scoring statement, quoted verbatim**: "אין ציונים. המערכת
> מזהה דפוס פעולה." (No scores. The system identifies a pattern of action.)
> — direct source support for `NO_GLOBAL_HUMAN_SCORE`.
>
> **Monthly summary**: real aggregated stats + dominant domain + "לאחר
> מספר חודשים המערכת תציע כיווני התפתחות ועיסוק בהתאם לדפוס הפעולה האמיתי
> שלך" (after months the system suggests development directions based on
> your real action pattern — not a declared aspiration).
>
> **Closing line, quoted verbatim**: "פילוס אינו שואל מה אתה רוצה להיות,
> אלא מה המציאות משתמשת בך להיות." (PHILOS doesn't ask what you want to be
> — it asks what reality uses you to be.)

This maps directly onto the ALREADY-implemented canon Domain (G/E/C) — the
same three domains, described here at product-usage level rather than
measurement level. `SOURCE_PROVEN`, high confidence, single clean document.

## Minor real fragments (single-sentence sources, real but low-signal)

~18 files in this batch were single-sentence `.textClipping` fragments
(titles or one-line aphorisms, e.g. "כוח האדם זה ההון האנושי" / "human
force is human capital", "ובליבה שוכן כור היתוך גרעיני ענקי" / "and at the
core sits a giant nuclear melting pot" [METAPHOR, not literal], "מצב הלב זה
מצב העולם" / "the state of the heart is the state of the world"). Real,
read, but each is a single unexplained sentence — not a definition, not
extractable as a claim beyond "this phrase exists in the corpus." Listed
for completeness, not treated as `SOURCE_PROVEN` models.

`מודל אפר"ת` (`.doc`) — a real, standard 4-stage Event→Interpretation→
Emotion→Response communication model. **Classified `EXTERNAL_THEORY`** — this
is a known CBT/NLP-style technique (structurally identical to Albert
Ellis's ABC model), not a PHILOS original, and must not be promoted as one.

---

---

# PASS 3 — 4 more files, targeted at Values / Forces / Self-World-Situation

Selected the same way as pass 2, re-ranked to exclude already-read files,
weighted toward ערך/אחדות/אדם מול/כוח/L6-L9 keywords. 32 candidates
extracted; the 4 most information-dense were read in full this pass (the
rest are short single-line fragments or a large ~70KB cluster of
near-duplicate "explanation" documents not yet read).

## FORCE COUNT — critical correction: no source evidence for "10" found anywhere

A real, internally-declared **"complete, official, locked" chapter** —
`5. הכוחות המשפיעים בפועל` ("The Forces Actually Influencing"), full text
recovered — lists **SIX** force categories, explicitly stated as complete
("תואם 100% לגרסת הליבה הרשמית שלך" — matches 100% your official core
version):

> 5.1 הכוחות הרגשיים (emotional — fear, anger, love, attraction, anxiety, joy)
> 5.2 הכוחות השכליים (cognitive — thinking, analysis, planning, interpretation)
> 5.3 הכוחות הגופניים (physical — fatigue, hunger, pain, tension, energy, hormones)
> 5.4 הכוחות האישיים (personal — tendency, character, memory, habits, traumas)
> 5.5 הכוחות החברתיים (social — norms, groups, friction, belonging, groupthink)
> 5.6 איד / אגו / סופר־אגו (as ONE combined category, not three separate ones)

Plus 5.7 (structural conflict when layers misalign) and 5.8/5.X ("the choice
position" — described as "the supreme command of consciousness," not itself
a force). A SEPARATE section, `5.X — מצפן קולקטיבי + וקטורי ערך` (collective
compass + value vectors), covers value-to-money mechanics (reward,
value economy, "social currency," a Reaction→Engagement→Value→Money chain)
— this is a **value/economy layer, not additional forces**.

**This is a DIFFERENT six-category grouping than the "Six Buildings" model**
found in pass 2 (Mind/Heart/Body/Id/Ego/Superego as six PEERS) — this
chapter groups Id/Ego/Superego as ONE category alongside five others
(Emotional/Cognitive/Physical/Personal/Social). Two real, different "6"s.
Neither is silently merged into the other.

A separate real document (`שלד-לאומי-אנושי-פילוס-אוריאנטציה.pdf`, real
folder-structure listing) names the corpus's own top-level organization:
`פילוס אוריאנטציה / שלד האדם / שלד הכוחות (רגשי·שכלי·גופני·חברתי) /
שלד הניגודים / שלד לאומי־אנושי` — a **FOUR-category** grouping in the
folder name itself (no Personal, no Id/Ego/Superego). *(This document's own
body content is heavily national/religious/political personal material —
classified `PERSONAL_NOTE`, not reproduced here beyond this one structural
fact.)*

A real table-of-contents fragment references **"5.X.11.7 שכבות
הרב־ממדיות המלאות (11 ממדים)"** ("the full multi-dimensional layers, 11
DIMENSIONS") — in a "multi-dimensionality and optimal choice" subsection,
a different context from force-counting. **Not evidence for "10 forces"** —
a different number (11), a different word (dimensions, not forces), in a
different section. Not conflated with the force question.

**Across 84 real files read in this whole pass (both batches), zero
instances of a stated "10-force" model were found.** What exists,
repeatedly, are various **6**-category groupings (at least two different
ones) and one **4**-category folder structure. This is reported exactly as
found — the product's target of "10 forces" is the user's own stated
instruction for this session, not something located in the source material
itself. Recorded as `UNRESOLVED`, not silently reconciled toward either
number.

## VALUES — real hierarchy fragment found

`ערכי פרט- ↓ -ערכי קבו...textClipping`, quoted in full:
> ערכי פרט ↓ ערכי קבוצה ↓ ערכי כלל ← מצפן ערכי — כולם מציגים ערכים
> · הערכים מתכנסים · המרכז נבנה מחדש · לא מתוך הסכמה — מתוך זיהוי הערך המשותף בין הניגודים

(Personal values → Group values → Collective values ← a value compass —
everyone presents values; the values converge; the center is rebuilt; not
through agreement — through identifying the shared value AMONG the
contradictions.) A real, small, but genuinely relevant data point for the
Individual↔Collective value question — convergence is framed as emerging
FROM contradiction, not from consensus.

---

# PASS 4 — 11 more files, deep dive on "מצפן ערכי" (value compass) per direct request

## The value compass, fully recovered — real, coherent, multi-file mechanism

`⸻--🌗 דיון ניגודי–ערכי- איך .textClipping` (a real, complete, structured
5-part text) gives the fullest account found in this pass. Quoted:

> **"קצבה ניגודית" (a "contradiction stipend")** — every person or group
> transparently states, simply: what they support, what value drives them,
> what contradiction/opposition they represent. Not feelings, not claims,
> not "who started it" — only the value position.
>
> **The real convergence chain, with mechanism, not just the 3 words found
> in pass 2**: "הקצבאות הפרטיות מתכנסות ל־ערכים האישיים של כל אדם, ואז
> מתאגדות למערכת רחבה יותר: **ערכי הפרט → ערכי קבוצה → ערכי הכלל**. ככה
> נוצר המרכז." (Private stipends converge into each person's personal
> values, then unite into a broader system: individual values → group
> values → collective values. This is how the CENTER is created.)
>
> **Explicit, direct confirmation that agreement is NOT required** —
> "המרכז לא נבנה מהסכמה — אלא מהבנה של הניגודיות. המערכת לא מחפשת שכולם
> יחשבו אותו דבר. היא מחפשת את **הערך המשותף שמתעורר דווקא מתוך הניגוד**"
> (The center is not built from agreement — but from UNDERSTANDING the
> opposition. The system does not seek everyone to think the same thing.
> It seeks the shared value that arises precisely FROM the contradiction),
> with real examples: כבוד↔חופש (honor↔freedom), חברה↔פרט (society↔
> individual), מסורת↔קדמה (tradition↔progress), זהות↔אוניברסליות (identity↔
> universality). Named explicitly: **"ה־DNA הערכי של המצפן החברתי"** (the
> value DNA of the social compass).
>
> **The mechanism connecting this to coordination/self-governance**:
> "שקיפות ערכית = שליטה עצמית של ההמון" (value transparency = self-
> governance of the masses) — when values are shown transparently and
> measurably, "ההמון רוכש מצפן ערכי" (the masses acquire a value compass),
> know who acts for the collective good vs who exploits power/money/
> attention, and power returns to the public **without state coercion**.
>
> Closing line, quoted verbatim: "כשניגודים מציגים את ערכיהם — המרכז נולד.
> וכשהמרכז נולד — ההמון שולט בעצמו, בלי אלימות, בלי כפייה ובלי מנגנוני
> כוח." (When contradictions present their values — the center is born.
> And when the center is born — the masses govern themselves, without
> violence, without coercion, without power mechanisms.)

A separate one-line fragment states the compass definition most tersely:
`המצפן הוא המצפון.textClipping` → **"המצפן הוא המצפון"** (the compass IS
the conscience) — a direct equation, real, unelaborated beyond this.

**Answering the specific questions asked:**
- **Definitions**: recovered above, in the source author's own words.
- **פרט/קבוצה/כלל relationship**: a real 3-stage convergence (individual→
  group→collective), driven by transparent value declaration, not vote or
  authority.
- **מצפן ערכי meaning**: literally "conscience"; operationally, a real
  social self-governance mechanism built from transparent value positions.
- **ניגודים meaning (in this specific context)**: not conflicts to be
  resolved by one side winning — the SOURCE of the shared value itself.
- **Is agreement explicitly unnecessary?** Yes — stated directly, twice,
  in the same document.
- **Connection to action/coordination/community**: direct and explicit —
  this IS a coordination/governance mechanism, not a side note.
- **Contradictions / later versions found in this batch**: real and
  significant — see below.

## CONTRADICTIONS taxonomy — a FOURTH distinct 6-category grouping found

`מבנה־העל – 6 מחלקות הניגודים.textClipping` ("Top Structure — 6 Categories
of Contradictions"), a real, titled document, gives **yet another** 6-way
split, different from all three found previously (Six Buildings; Chapter 5's
Emotional/Cognitive/Physical/Personal/Social/Id-Ego-Superego; the 4-category
folder name): **Emotional / Cognitive("שכליים") / Physical-sensory /
Personal(פסיכו-אישיותיים) / Social-communal / Global-systemic**, each with
4-5 real named opposite-pairs (e.g. Emotional: פחד↔ביטחון, אהבה↔דחייה;
Global-systemic: חופש↔שליטה, שלום↔כוח). A follow-up file (`מצוין — נמשיך עם
עוד ניגודים`) shows the author actively iterating a **DIFFERENT** six-layer
label set mid-conversation — "רגשי / גופני / שכלי / חברתי / אישי / קוסמי"
(emotional/physical/cognitive/social/personal/**cosmic**) — a fifth naming.
**This corpus contains at least four-to-five different "6" framings across
different documents/sessions, none identical.** Recorded as real,
unreconciled version churn — not one settled taxonomy silently picked.

Two real, closed, numbered **base-contradiction lists** were also found:
a 10-item core (`ברור. הנה כל ניגודי־הבסיס`: חומר↔מרווח, אנרגיה↔מרווח,
התהוות↔דעיכה, איד↔סופר־אגו, דחף↔ריסון, חוק↔חופש, סף↔קריסה, פוטנציאל↔תנועה,
ריק↔עומס, כיוון↔זווית) and its stated 30-item extension
(`להלן 30 ניגודי־בסיס`, organized into 5 groups of 6: physical/existential,
mental/psychic, energetic/functional, personal/social, vector/structural).
Both explicitly self-described as "ליבה + הרחבה טבעית" (core + natural
extension) of the SAME list — a real, coherent version-family, unlike the
6-category naming churn above.

---

## What this sample does NOT establish

The full Reality/Matter/Gap/Space/Time comparison table (still only one
`חלל½מרחב` data point plus one `חומר↔מרווח`/`אנרגיה↔מרווח` pairing from the
base-contradiction list — real, but still not a definition), Self/World/
Situation as a named concept (still not found anywhere read across four
passes — 95/2372 files), the 9 and 10-force stages of the force lineage
(actively searched for, not found — see the Master Ledger's recorded
decision), and Color architecture remain **NOT_YET_EXTRACTED**. 2277 of
2372 discovered files are unread.
