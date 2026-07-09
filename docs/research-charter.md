# Philos Research Charter

**Status: Candidate — design rationale documented; methodology not yet externally reviewed**

*This document records the research philosophy governing the Philos program. It is not a
scientific claim. It is an explicit statement of the rules under which the program operates.*

---

## Purpose

The Philos Research Charter defines:

1. The epistemic standards the program commits to
2. The rules for what counts as evidence
3. The conditions under which work stops
4. The forbidden moves — framings that look like progress but are not

---

## §1 Falsification First

Every claim in this program is written as a falsification target, not a demonstration target.
The goal is to kill the claim before building on it.

A claim is admissible only if it specifies:
- What outcome would falsify it
- How that outcome would be measured
- Who could replicate the measurement

A claim with no falsification path is a placeholder, not a hypothesis.

---

## §2 Evidence Grades

All claims carry an explicit evidence grade. Grades are not interchangeable.

| Grade | Meaning | Examples |
|---|---|---|
| **Frozen** | Methodology only — the framework itself, definitional | Evidence layer protocol (§7), Invariants I1–I5 |
| **Candidate** | Designed, not yet validated — testable hypothesis | DimensionReading interface, Value Fusion, Matching Engine |
| **Placeholder** | Concept identified, not yet formally specified | capacity measurement, impact scoring |
| **Not established** | Named but no evidential path defined | Any claim requiring human-subject data not yet collected |

Evidence grades apply per-claim, not per-document. A single document may contain claims
at all four levels; each must be labeled.

### §2.1 Upgrade rules

A claim upgrades from Placeholder → Candidate when a falsification test is defined.
A claim upgrades from Candidate → (validated) when the test passes or fails.
A test failure is an upgrade, not a setback — it produces information.

A claim may NOT upgrade based on:
- Internal consistency ("it all fits together")
- Aesthetic appeal of the formulation
- Absence of counter-evidence
- Expert opinion without replication

---

## §3 Forbidden Optimization (§6.1)

**Never choose a framework because it feels elegant or complete.**

The following moves are explicitly prohibited:

- Adopting a 9-component model because "9 is complete" or "it covers everything"
- Calling a formulation "minimal" without a minimality proof
- Using "falsification field intentionally left empty" as a substitute for a real falsification test
- Treating architectural elegance as Candidate-level evidence
- Claiming that H9 (can describe with N components) implies G9 (grammar: can predict/forbid)

The H9/G9 distinction is foundational:

| Label | Meaning | Evidential weight |
|---|---|---|
| **H9** | Representational — the system CAN be described with 9 components | Weak — any sufficiently flexible model can describe any dataset |
| **G9** | Grammatical — the system PREDICTS and FORBIDS; violations are detectable | Strong — requires specifying what cannot occur |

Current status of the Model of 9: **H9 only**. The G9 falsification field is intentionally empty
because no test has been specified. The empty field IS the correct scientific state, not an
oversight.

---

## §4 Independence Rule

The three research tracks are independent:

| Track | What it tests | Depends on |
|---|---|---|
| **FEP falsification** | Sacred value hysteresis (D4) | Stage 0a–1 |
| **Marketplace architecture** | Convergence, matching, evidence | Stage 0b–0d-arch |
| **Application (Nexus/Globe)** | User-facing orientation tooling | Neither track above |

A result on one track does not validate or invalidate the others.
The application can be built regardless of FEP outcomes.
The Marketplace architecture can be built regardless of D4 outcomes.

---

## §5 Stop Conditions

The program stops on any track when:

1. A falsification test produces a definitive negative result
2. A simpler published model explains the candidate findings without additional assumptions
3. Required human-subject validation is unavailable and no proxy exists
4. The falsification field cannot be filled — meaning the claim is unfalsifiable as stated

Stop conditions are not failures. They produce information that prevents larger mistakes.

---

## §6 What This Program Does Not Claim

- That Philos is a new theory of human behavior
- That the Model of 9 is the correct decomposition of human experience
- That the Marketplace architecture has been validated
- That the application works as intended for real users
- That any component marked Candidate has been confirmed

These are the boundaries of the program, not weaknesses of it.

---

*Philos Research Charter | Created from session record 2026-07-09*
*Evidence grade: Frozen (methodology) | Not a scientific finding*
