# Philos Potential Map — Visual Specification

**Status: Candidate — visual concept specified; not a validated architecture diagram**

*This document records the specification for the Philos World Map visual artifact.
The map is an ecosystem overview, not a technical architecture diagram. It shows
intended use-cases, not demonstrated ones. See `artifacts/visuals/philos-world.html`
for the current rendered version.*

---

## §1 Purpose

The Philos Potential Map is a single-page visual that communicates:

1. What Philos is at its core (Human Orientation Operating System)
2. How OPM and the Marketplace relate as twin engines
3. The types of users the system is designed for (15 entry points)
4. The flow from Mission → Execution → Evidence → Learning
5. The evidence status of every layer

It is NOT a technical spec. It IS a communication tool for orienting new contributors
and stakeholders.

---

## §2 Visual Structure

The map uses a concentric orbital / astrolabe layout with five rings:

```
Ring 0 (center)   PHILOS core
Ring 1            OPM + Marketplace (twin engines, left + right)
Ring 2            Reality / Human / Human Drives (three nodes, 120° spacing)
Ring 3            15 User Entry Points (outer ring, 24° spacing each)
External layer    Evidence Framework (below core, grounding layer)
```

### Ring positions (reference implementation)

| Element | Position | Color |
|---|---|---|
| PHILOS core | Center | Blue (#1565c0) |
| OPM engine | Left of center (r=198) | Orange (#e65100) |
| Marketplace engine | Right of center (r=198) | Green (#2e7d32) |
| Reality | Top (r=318, 270°) | Indigo (#4527a0) |
| Human | Lower-right (r=318, 30°) | Teal (#00695c) |
| Human Drives | Lower-left (r=318, 150°) | Red (#b71c1c) |
| 15 Users | Outer ring (r=428, 270° + i×24°) | Gray (#546e7a) |
| Evidence Framework | Below core | Green (#43a047) |

### Connecting elements

- Twin arc loop between OPM ↔ Marketplace (upper + lower arcs)
- Spokes from Reality/Human/Drives to each user node in their sector
- Learning loop annotation (dashed) connecting Evidence back to Core

---

## §3 Fifteen User Entry Points

| # | User | Critical Gap | Marketplace Output |
|---|---|---|---|
| 1 | Fashion Entrepreneur | Capital · Community · Market Access | Funding + Brand Network + Customer Base |
| 2 | Startup Founder | Product-Market Fit · Team · Capital | Validation + Co-founders + Investors |
| 3 | Student | Direction · Mentorship · Community | Clarity + Guides + Peer Network |
| 4 | Couple | Communication · Shared Values | Mediation + Growth Framework |
| 5 | Family | Roles · Resources · Crisis Support | Structure + Services + Community |
| 6 | Doctor | Time · Evidence · System Support | Clinical Tools + Research + Admin Relief |
| 7 | Therapist | Supervision · Evidence Base · Community | Peer Network + Research + Client Tools |
| 8 | Company | Alignment · Talent · Market Position | Culture + Recruiting + Strategy |
| 9 | Municipality | Community Trust · Resources · Coordination | Civic Tools + Funding + Collaboration |
| 10 | NGO | Funding · Impact Measurement · Partners | Grants + Evaluation + Coalition |
| 11 | Teacher | Resources · Curriculum · Community | Materials + Frameworks + Peer Support |
| 12 | Researcher | Data · Collaboration · Funding | Datasets + Co-investigators + Grants |
| 13 | Lawyer | Case Law · Client Trust · Evidence | Research Tools + Reputation + Evidence Chain |
| 14 | Investor | Deal Flow · Due Diligence · Network | Opportunities + Analysis + Co-investors |
| 15 | AI Agent | Tool Access · Context · Coordination | APIs + Context Protocol + Orchestration |

**Honest label on user ring**: "intended use-cases · not demonstrated"

---

## §4 Evidence Layer Visualization

Colors encode evidence grade per component:

| Color | Grade | Example |
|---|---|---|
| Green (#43a047) | Frozen | Evidence Framework itself |
| Purple (#9c27b0) | Candidate | OPM engine, Matching logic |
| Orange (#f57c00) | Placeholder | 15 user entry points |
| Red (#d32f2f) | Not established | Learning loop dynamics |

---

## §5 Full Value Flow

The map shows this flow as a caption / annotation panel:

```
Mission
  ↓
OPM Decomposition → Required Values
  ↓
Marketplace Match → Value Providers
  ↓
Execution
  ↓
Evidence Collection
  ↓
Trust + Reputation + Impact
  ↓
Learning
  ↓
Next Mission
```

---

## §6 Value Providers (Ring annotation)

Eight provider types shown as Marketplace outputs:

- People
- AI
- Organizations
- Communities
- Knowledge
- Capital
- Resources
- Mentors

---

## §7 Status

| Claim | Grade |
|---|---|
| The 15 user types represent the full scope of Philos users | Placeholder — no coverage proof |
| The orbital layout correctly represents system architecture | Candidate — illustrative, not formal |
| Evidence grade colors accurately reflect current state | Candidate — aligned with evidence-roadmap.md |
| The learning loop is correctly specified | Not established — no formal definition |

---

## §8 Artifact Location

| Format | Path |
|---|---|
| HTML (interactive) | `artifacts/visuals/philos-world.html` |
| Published (Artifact URL) | `https://claude.ai/code/artifact/90347283-7cf5-424d-8492-423b619cbe45` |
| PDF (user upload) | `/root/.claude/uploads/.../57fd5915-philosworld.pdf` (session-only, not in git) |

---

*Philos Potential Map Spec | Created from session record 2026-07-09*
*Evidence grade: Candidate — visual concept only*
