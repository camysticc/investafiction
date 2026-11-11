# Writing a case

This guide is enough to write a new case without reading the app's code. A case is a folder with a Python story script. The builder turns it into a single `.invcase` file that anyone can import.

## 1. Set up

```bash
pip install -r tools/requirements.txt
PYTHONPATH=tools python -m invtools new my-case
```

This creates `packs/src/my-case/story.py` with a tiny working example. Build it straight away to check your set-up:

```bash
PYTHONPATH=tools python -m invtools build packs/src/my-case
```

The builder writes `packs/dist/my-case.invcase` and runs three checks: the validator (schemas, hashes and cross references), the solvability check and the synthetic data safety scan.

## 2. Write the story bible first

Put a private account of what really happened at the top of `story.py`, minute by minute: who did what, when, where and why, and which clues it leaves. Nothing the player sees should be invented separately from this. The starter cases show the style.

Then plan:

- **Stages** (five or six), each with a short message from the case lead and a list of objectives, some required and some stretch.
- **Findings** the player should reach, each needing support from at least two independent sources.
- **Red herrings, conflicts and gaps**, added on purpose.
- **Requests**: material that only arrives if the player asks for it with a narrow, justified request.
- **Traps**: procedural mistakes the case can catch.

## 3. The pack format

A pack is a zip file with these parts. The JSON Schemas in `schemas/` are the full specification.

| File | Seen by the player? | Purpose |
|---|---|---|
| `manifest.json` | Summary only | Id, title, version, schema version, specialty, difficulty, time, and the SHA-256 of every other file |
| `brief.md` | Yes | The opening situation |
| `intake.json` | Yes | Tasking, scope, what is out of scope, authorities, constraints, case clock start |
| `stages.json` | Yes, as stages open | Stages, objectives (text only), evidence released per stage, request types |
| `entities.json` | Yes | People, organisations, phones, accounts, vehicles, addresses, devices, online accounts |
| `evidence/` | Yes, once released | Evidence files and `evidence.json`, the register |
| `osint/` | Yes, once released | The simulated web: sites, pages, images |
| `map/map.json` | Yes | The fictional map and its camera, cell site and address locations |
| `rules.json` | No | Traps and request rules |
| `solution.json` | No, until submission | Key findings, links, true timeline, herrings, expected grades, objective checks, stage unlocks, hints, noise list, gaps |

Allowed file types: `.json .md .csv .txt .eml .svg .png .jpg .jpeg`. Packs may never contain scripts or executables. SVG files with scripts, event handlers or external links are rejected.

## 4. Writing with `casekit`

```python
from invtools.casekit import Case, C_received, C_finding, C_objectives, C_legality
from invtools.gen import Gen

def make_case():
    g = Gen(seed=42)                      # the same seed always gives the same case
    c = Case(id="my-case", title="My Case", version="1.0.0", specialty="Fraud",
             difficulty="Beginner", minutes=60, seed=42, summary="One line.")
    c.brief = "# My Case\n\nWhat the player sees first."
    c.intake = {...}
    c.entity("ENT-P1", "person", g.name(), role="Person of interest")
    c.table("EV-001", "Bank statement", "bank_statement", columns, rows,
            table={"time_column": "date", "entity_columns": ["account", "counterparty"]},
            source="Bank", source_group="bank", acquired="2026-01-05 09:00", stage="S1",
            grade=("A", "1"))
    ...
    return c
```

Useful helpers:

| Helper | Use |
|---|---|
| `c.table(...)` | CSV evidence. `table` metadata tells the app which column is the time, which columns hold identifiers (for link suggestions), and which hold map locations or x and y coordinates |
| `c.document(...)` | Markdown documents, statements and invoices. Put document metadata in `metadata={...}` |
| `c.email(...)` | `.eml` files with full headers |
| `c.json_item(...)` | Phone extractions (`type="phone_extraction"`) with `device`, `contacts`, `messages`, `calls`, `locations`, `media`, `apps` |
| `c.image(...)` / `c.osint_image(...)` | SVG images. `invtools.art` has the town map and some scenes |
| `c.stage(id, title, minutes, message, objectives, unlock=...)` | Each objective is `(id, text, required, check, [three hints])` |
| `c.request_type(...)`, `c.request_rule(...)` | What the player can ask for, and when a request is granted |
| `c.trap(...)` | A procedural trap |
| `c.finding(...)`, `c.link(...)`, `c.event(...)`, `c.herring(...)`, `c.gap(...)` | The marking rubric |

### Independence

Every evidence item has a `source_group`. Items in the same group, for example several files from one forensic image, count as one source. A finding with `min_sources=2` needs citations from two different groups. Web pages count by page.

### How findings are matched

A player's finding matches a key finding when:

1. every keyword group appears in the statement (each group is a list of alternatives, matched case-insensitively), and
2. its citations cover at least `min_sources` independent groups from the key finding's `evidence_any` list.

Write keyword groups generously, with synonyms and spellings a player might use. Keep the second group about the claim, not the wording. Then test it: write the statement a careful player would write and check it matches.

### Conditions

Objective checks and stage unlocks use small conditions, built with helpers such as `C_received(all_released=True)`, `C_hashed(...)`, `C_finding("KF-01")`, `C_request("RR-1")`, `C_timeline(5)`, `C_link(a, b)`, `C_captured(page)`, `C_graded(6)`, `C_objectives("S1")`, `C_legality()`, `C_mismatch(id)`, and `C_all(...)` or `C_any(...)`.

### Requests

A request rule names a request type and the targets that make sense. The player chooses a target, dates and a justification. A request is granted when the target is right, the dates cover `must_cover` without going past `max_days`, and the justification hits at least `min_groups` of the keyword groups. Asking for every target, or for far too long a period, is refused and penalised.

### Traps

| Trigger | When it fires |
|---|---|
| `evidence_opened` | An item in `ids` is opened without the `unless_authority` authority |
| `persona_access` | The player uses a fake persona on a private page |
| `excess_views` | A page is viewed more than `max_views` times without authority |
| `finding_claim` | A finding of the listed types matches the keywords (overclaiming) |
| `clock_uncorrected` | A timeline entry uses a device time known to be off by `offset_minutes` |
| `sensitive_cited` | A report finding cites a privileged or restricted item |
| `confirmation_bias` | A report finding backs a theory while the contradicting items were never looked at |
| `capture_page` | The player captures a page about someone outside scope |
| `poor_capture` | The player uses a quick screenshot instead of a proper capture |

Altering an original, broken continuity, over-broad requests and unjustified requests are built in.

## 5. Check and calibrate

```bash
PYTHONPATH=tools python -m invtools check packs/dist/_build/my-case
```

The solvability check confirms every required finding can be reached with enough independent sources, every required objective can be met within its own stage, and no evidence item is orphaned. Anything that is deliberate background goes in the noise list with `noise=True`.

Then play it yourself with a timer, and ask a friend to play it without help. Compare stage times with your targets and add or remove noise and steps until the time is right. As a guide, aim for about one irrelevant item per relevant one in a beginner case, two in an intermediate case and three in a hard case.

## 6. Review checklist

Before sharing a case, go through the checklist in [SYNTHETIC_DATA.md](SYNTHETIC_DATA.md). The safety scan catches most data problems but cannot judge whether a story resembles a real incident.

## 7. Versioning

`manifest.json` carries a schema version. The app refuses a pack built for a newer major version and explains why. Bump your case's own `version` whenever you change it, so players know to re-import.
