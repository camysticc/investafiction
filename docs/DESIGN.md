# Design notes

These notes explain the main design decisions. They are also the starting point for the written case study.

## The problem

Real investigative work is mostly careful sorting, checking and reasoning. Certificates show that someone has read about it. Investafiction lets someone practise it, on fictional data, and shows the method as well as the answer.

## Three languages, one job each

| Layer | Why this language |
|---|---|
| React and TypeScript | Rich viewers, a timeline, a link chart and a map are much easier in a web interface. TypeScript catches mistakes when the data shapes change. |
| Rust core | Pack verification, hashing, saves, the audit trail and scoring need to be correct and fast, and the answer key should live somewhere the interface cannot reach. |
| Python tools | Case authoring is data generation and checking, which Python does well. The tools are not shipped with the app. |
| Tauri shell | Small installers, a native window and a direct bridge to Rust. |

The layers only meet through JSON. The schemas in `schemas/` are the contract, so a job can move between layers without a redesign. The interface talks to the core through a single command, `call(cmd, args)`, which made it easy to add a browser development server using the same dispatcher.

## The core owns the state

Every player action goes to the core, which:

1. checks whether the action would trigger a trap, and in training mode returns a warning first;
2. applies the action and writes the action log and, where relevant, the chain of custody;
3. re-checks objectives and opens the next stage if its condition is met;
4. saves the attempt to disk; and
5. returns a cleaned-up state with no answers in it.

Because the core holds the state and the answer key, the interface can be simple, and spoilers cannot leak by accident. This is not meant to stop a determined cheater. For a practice tool that is fine.

## Packs are untrusted

Anyone can write a case pack, so every pack is treated as hostile until checked:

- size, file count and file type limits before unpacking;
- path traversal blocked during unzipping;
- no scripts or executables, and SVGs with scripts or external links rejected;
- every file checked against the manifest's SHA-256 list;
- every JSON file validated against its schema;
- cross references checked, for example that every cited evidence id exists and every item is released exactly once.

Installed cases are checked again each time they open, so a pack changed on disk after import is refused. Web pages in the simulated browser are rendered from structured data by React components, never as raw HTML, and the app's content security policy blocks any network connection.

## Marking the method, not just the answer

| Category | Weight | What is marked |
|---|---|---|
| Key findings | 35 | Core findings reached, with the right label |
| Analysis quality | 20 | Labelling, evidenced links, timeline accuracy, red herrings avoided |
| Report quality | 15 | Complete sections, every finding cited, gaps admitted |
| Evidence handling | 15 | Receipt before examination, hashing, reasons for originals, integrity problems reported |
| Procedure, legality and ethics | 10 | Starts at 10 and loses points for each trap and each over-broad or unjustified request |
| Grading accuracy | 5 | Grades within one step of the expected ones |

Bands: Distinction 85, Merit 70, Pass 55. A serious breach caps the result at Pass.

### Matching free text fairly

Findings are free text, so the core matches them with two tests: every keyword group must appear (each group has alternatives), and the citations must cover enough independent sources from the right list. Requiring citations as well as words makes guessing hard, and it rewards the habit the app is trying to teach: back every claim with evidence.

## Cases built from a story bible

Each case starts as a private account of what really happened. Python scripts turn it into bank statements, call records, logs, file listings and web pages, with seeded random noise around the real events. The same seed always gives a byte-identical pack. The solvability check then confirms every required finding can be reached within its stage with enough independent sources, and that no item is orphaned.

## Testing

- Rust integration tests play each starter case from import to debrief through the same API the interface uses, including traps, requests and scoring.
- Import tests break the real pack in each way listed above and check it is refused with nothing left behind.
- Python tests check validation, determinism, the safety scan and solvability.
- The interface is type-checked and built on every change.

## What went wrong and what I would do next

To be completed after playtesting. Starting points:

- Keyword matching is fair for careful players but can miss unusual wording. Playtest notes should feed back into the keyword lists.
- Timings in the plan are estimates. Each case needs timed playtests per stage, then noise and steps adjusted.
- A later version could add fully generated case variants from the same story bible.
