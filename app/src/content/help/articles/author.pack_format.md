---
id: "author.pack_format"
title: "The case pack format"
category: "Case authoring"
answer: "A .invcase file is a zip with a manifest of SHA-256 hashes, the brief, intake, stages, entities, evidence, optional OSINT, map and statements, rules and the solution."
questions: ["what is an invcase file", "pack contents", "what is in a case pack", "what is inside a pack"]
synonyms: ["invcase", "zip"]
tags: ["authoring"]
related: ["author.schemas"]
version: "1.3"
---

Limits: 50 MB per pack, 10 MB per file, 600 files. Allowed types: json, md, csv, txt, eml, svg, png, jpg. SVGs may not contain scripts or external links.
