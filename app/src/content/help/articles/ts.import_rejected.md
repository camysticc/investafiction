---
id: "ts.import_rejected"
title: "A case pack was not imported"
category: "Troubleshooting"
answer: "The pack failed a safety or consistency check, so nothing was added. The message lists each problem."
questions: ["pack rejected", "import failed", "case won't import", "invalid case pack", "manifest hash error"]
synonyms: ["import error", "corrupt pack"]
tags: ["import"]
related: ["author.validator", "gs.import"]
errors: ["The pack was rejected. Nothing has been added.", "does not match its manifest hash", "is in the pack but not in the manifest", "The manifest lists", "Missing required file", "is not valid JSON", "more schema errors not shown", " at ", "could not be unpacked", "Blocked an unsafe path", "this file type is not allowed", "larger than the per-file limit", "The pack holds", "The pack is larger than", "which packs may not include", "Entry ", "The pack changed while waiting.", "The case id is not valid.", "uses schema version", "must be released in exactly one", "releases unknown", "unknown request type", "unknown stage", "unknown target", "its file", "share the same id", "has no check in the solution file", "has no unlock condition", "belongs to unknown site", "OSINT image", "Solution finding", "A solution link", "Timeline event", "Statement check", "Statement ST", "Claim ", "Suggested route step"]
version: "1.3"
---

Common causes:
- A file was changed after the pack was made, so its hash no longer matches the manifest.
- A file type that packs may not hold, or a file that is too large.
- A schema error or a broken reference between files.

If you made the pack, rebuild it with the authoring tools and run `python -m invtools check`. If someone sent it, ask them for a fresh copy.
