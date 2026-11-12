"""Shared constants and helpers for the Investafiction authoring tools.

The limits here must match the ones in core/src/pack.rs, because the
desktop app applies the same checks when a pack is imported.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
SCHEMA_DIR = REPO_ROOT / "schemas"

SCHEMA_VERSION = "1.0"
MAX_PACK_BYTES = 50 * 1024 * 1024
MAX_FILE_BYTES = 10 * 1024 * 1024
MAX_FILES = 600
ALLOWED_EXTENSIONS = {".json", ".md", ".csv", ".txt", ".eml", ".svg", ".png", ".jpg", ".jpeg"}

# Which schema validates which JSON file inside a pack.
SCHEMA_FOR = {
    "manifest.json": "manifest.schema.json",
    "intake.json": "intake.schema.json",
    "stages.json": "stages.schema.json",
    "entities.json": "entities.schema.json",
    "evidence/evidence.json": "evidence.schema.json",
    "osint/osint.json": "osint.schema.json",
    "map/map.json": "map.schema.json",
    "rules.json": "rules.schema.json",
    "solution.json": "solution.schema.json",
    "statements.json": "statements.schema.json",
}
REQUIRED_FILES = ["manifest.json", "brief.md", "intake.json", "stages.json", "entities.json",
                  "evidence/evidence.json", "rules.json", "solution.json"]


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def load_json(path: Path):
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def dump_json(obj, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(obj, fh, indent=2, ensure_ascii=False)
        fh.write("\n")


def load_schema(name: str):
    return load_json(SCHEMA_DIR / name)


def keywords_match(text: str, groups) -> bool:
    """True when every keyword group has at least one alternative in the text."""
    low = text.lower()
    return all(any(alt.lower() in low for alt in group) for group in groups)
