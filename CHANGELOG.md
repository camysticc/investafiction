# Changelog

## 1.3.0 (12 November 2026)

- Start-up: every launch now opens on a mock desktop. Open the program icon, see a short welcome with your name, then a loading screen while saved work, case packs and the help centre are checked.
- New left menu with seven areas: Cases, Case desk, Academy, Progress, Settings, Help and Profile.
- Settings rebuilt: about 210 settings in 24 categories, with search, presets (recommended, minimal, accessibility, assessment), per-setting reset and help, export and import. Theme is Dark by default, with Light, High contrast and Match my computer. Settings that are saved but not built yet are clearly labelled "not active yet".
- Academy tab: 23 lessons in six tracks with hands-on widgets, a training sandbox on the new First Day practice case, XP, ranks and badges. The quick intro track is kept and is still offered on first start. Everything is optional.
- Help centre: about 120 written articles, a glossary of about 150 terms and offline search that finds the right answer for at least 95% of a bank of 333 real questions. "What is this?" mode explains anything you click.
- Statements tab: compare witness statements claim by claim, link claims to each other and to evidence, and send claims to the timeline or map. A new trap catches calling a witness a liar without the evidence.
- Investigation replay after submission: a step-by-step track of what you did, what you missed, where you got stuck, and one suggested route.
- Progress dashboard: skills by area, score trend, best scores, common mistakes, attempt history and export.
- Saves keep backup copies. New data tools: usage, export and import saves, clear caches, delete everything.
- All four cases updated with statements, statement checks, skill tags and routes.

## Earlier changes (between 1.0.0 and 1.3.0)

- Fixed: the case brief and other pop-up windows opened from the top bar showed pale, hard to read text. Pop-ups are now drawn at the page root and set their own text colour.
- Added a Settings window (gear in the top bar, or press the comma key): light, dark or match-my-computer theme, six accent colours, four fonts, line spacing, spacing density, side panel width, text size, high contrast, reduced animation, colour-blind friendly colours, case clock toggle, sound, and reset.
- Added the Training Academy: seven hands-on missions on a made-up mini case with XP, ranks and badges. Offered on first launch, skippable at any point, and replayable from Settings or the library.
- Added a short guided tour of the real case desk the first time a case is opened. It waits for real clicks, gives a little XP and can be skipped.
- Dark theme: paper documents, maps, link charts and simulated web pages stay light so they look like the real thing.

## 1.0.0

First full build.

- Desktop app: first launch name selection and profile badge, case library and import with full checks, brief and intake, staged cases with objectives and case lead messages, evidence viewers for every type in the starter pack, search and filter, timeline builder, link chart with suggestions, offline map with time slider, simulated web browser with capture, requests and authorities, integrity checker, chain of custody and action log, intelligence grading, findings board, report builder with PDF and Markdown export, scoring, procedural traps, training and assessment modes, debrief, save and resume.
- Rust core with pack verification, saves with versioned migration, scoring and a browser development server.
- Python authoring tools: validator, builder, seeded generators, solvability and synthetic data checks.
- Starter pack: The Ledger, The Last Signal and Quiet Exit.
