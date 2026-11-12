---
id: "author.overview"
title: "Writing your own cases"
category: "Case authoring"
answer: "Cases are written in Python with the invtools kit, built into a .invcase pack and checked by the validator."
questions: ["make my own case", "create a case", "case editor"]
synonyms: ["authoring", "custom case"]
tags: ["authoring"]
related: ["author.pack_format", "author.validator"]
version: "1.3"
---

Start with `python -m invtools new my-case`, write the story, evidence, stages, statements and solution, then `python -m invtools build packs/src/my-case`. See docs/AUTHORING.md in the repository.
