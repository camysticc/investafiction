"""Validate a case pack folder or a .invcase file.

Checks, in order: structure and file limits, the manifest hash list, every
JSON file against its schema, then cross references between the files.
The desktop app runs the same checks on import, so a pack that passes
here should import cleanly.
"""
from __future__ import annotations

import re
import tempfile
import zipfile
from dataclasses import dataclass, field
from pathlib import Path, PurePosixPath

from jsonschema import Draft202012Validator, FormatChecker

from .common import (ALLOWED_EXTENSIONS, MAX_FILE_BYTES, MAX_FILES, MAX_PACK_BYTES, REQUIRED_FILES,
                     SCHEMA_FOR, SCHEMA_VERSION, load_json, load_schema, sha256_file)


@dataclass
class Report:
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return not self.errors

    def err(self, msg: str) -> None:
        self.errors.append(msg)

    def warn(self, msg: str) -> None:
        self.warnings.append(msg)


def safe_extract(archive: Path, dest: Path, report: Report) -> bool:
    """Unzip with the same safety rules the app uses."""
    if archive.stat().st_size > MAX_PACK_BYTES:
        report.err(f"Pack is larger than {MAX_PACK_BYTES // (1024 * 1024)} MB")
        return False
    try:
        zf = zipfile.ZipFile(archive)
    except zipfile.BadZipFile:
        report.err("File is not a valid .invcase (zip) archive")
        return False
    with zf:
        infos = [i for i in zf.infolist() if not i.is_dir()]
        if len(infos) > MAX_FILES:
            report.err(f"Pack holds {len(infos)} files, the limit is {MAX_FILES}")
            return False
        for info in infos:
            name = info.filename
            p = PurePosixPath(name)
            if name.startswith("/") or "\\" in name or ".." in p.parts or re.match(r"^[A-Za-z]:", name):
                report.err(f"Unsafe path in archive: {name}")
                return False
            if info.file_size > MAX_FILE_BYTES:
                report.err(f"{name} is larger than the per-file limit")
                return False
            if p.suffix.lower() not in ALLOWED_EXTENSIONS:
                report.err(f"{name} has a file type that is not allowed in packs")
                return False
            target = dest / Path(*p.parts)
            target.parent.mkdir(parents=True, exist_ok=True)
            with zf.open(info) as src, open(target, "wb") as out:
                out.write(src.read(MAX_FILE_BYTES + 1))
    return True


def _check_svg(path: Path, rel: str, report: Report) -> None:
    text = path.read_text(encoding="utf-8", errors="replace").lower()
    if "<script" in text or re.search(r"\son[a-z]+\s*=", text) or "javascript:" in text or "<foreignobject" in text:
        report.err(f"{rel} contains scripting, which packs may not include")
    if re.search(r"(href|src)\s*=\s*[\"']\s*(https?:|//)", text):
        report.err(f"{rel} refers to an external resource")


def validate_dir(root: Path) -> Report:
    report = Report()
    files = sorted(p for p in root.rglob("*") if p.is_file())
    rels = {p.relative_to(root).as_posix(): p for p in files}

    for req in REQUIRED_FILES:
        if req not in rels:
            report.err(f"Missing required file: {req}")
    if not report.ok:
        return report
    if len(rels) > MAX_FILES:
        report.err("Too many files in pack")
    for rel, p in rels.items():
        if p.suffix.lower() not in ALLOWED_EXTENSIONS:
            report.err(f"{rel}: file type not allowed")
        if p.stat().st_size > MAX_FILE_BYTES:
            report.err(f"{rel}: file too large")
        if p.suffix.lower() == ".svg":
            _check_svg(p, rel, report)

    # Schemas
    data = {}
    for rel, schema_name in SCHEMA_FOR.items():
        if rel not in rels:
            continue
        try:
            obj = load_json(rels[rel])
        except Exception as exc:  # noqa: BLE001
            report.err(f"{rel}: not valid JSON ({exc})")
            continue
        validator = Draft202012Validator(load_schema(schema_name), format_checker=FormatChecker())
        for e in sorted(validator.iter_errors(obj), key=lambda e: list(e.path)):
            loc = "/".join(str(x) for x in e.path) or "(root)"
            report.err(f"{rel} at {loc}: {e.message}")
        data[rel] = obj
    if not report.ok:
        return report

    manifest = data["manifest.json"]
    major = manifest["schema_version"].split(".")[0]
    if major != SCHEMA_VERSION.split(".")[0]:
        report.err(f"Pack schema version {manifest['schema_version']} is not supported (this tool supports {SCHEMA_VERSION})")

    # Hashes
    listed = manifest["files"]
    for rel in rels:
        if rel == "manifest.json":
            continue
        if rel not in listed:
            report.err(f"{rel} is in the pack but not in the manifest hash list")
        elif sha256_file(rels[rel]) != listed[rel]:
            report.err(f"{rel} does not match its manifest hash")
    for rel in listed:
        if rel not in rels:
            report.err(f"Manifest lists {rel} but the file is missing")

    check_cross_refs(data, rels, report)
    return report


def check_cross_refs(data: dict, rels: dict, report: Report) -> None:
    stages = data["stages.json"]
    entities = {e["id"]: e for e in data["entities.json"]["entities"]}
    items = {e["id"]: e for e in data["evidence/evidence.json"]["items"]}
    rules = data["rules.json"]
    sol = data["solution.json"]
    osint = data.get("osint/osint.json", {"sites": [], "pages": []})
    pages = {p["id"]: p for p in osint["pages"]}
    sites = {s["id"] for s in osint["sites"]}
    stage_ids = [s["id"] for s in stages["stages"]]
    authorities = {a["id"] for a in data["intake.json"]["authorities"]}
    ev_or_page = set(items) | set(pages)

    if len(items) != len(data["evidence/evidence.json"]["items"]):
        report.err("Duplicate evidence ids")
    for ev in items.values():
        if ev["file"] not in rels:
            report.err(f"{ev['id']}: file {ev['file']} is missing")
        elif sha256_file(rels[ev["file"]]) != ev["original_hash"] and "integrity_test" not in ev.get("tags", []):
            report.warn(f"{ev['id']}: original hash differs from the file but the item is not tagged integrity_test")
        for col_key in ("map_entity",):
            v = ev.get("table", {}).get(col_key)
            if v and v not in entities:
                report.err(f"{ev['id']}: table.{col_key} names unknown entity {v}")

    # Every evidence item is released exactly once, by a stage or a request.
    released: dict[str, list[str]] = {}
    for st in stages["stages"]:
        for eid in st["evidence"]:
            released.setdefault(eid, []).append(st["id"])
        for pid in st.get("osint_pages", []):
            if pid not in pages:
                report.err(f"{st['id']} releases unknown page {pid}")
    rtypes = {r["id"]: r for r in stages["request_types"]}
    for rr in rules["request_rules"]:
        if rr["request_type"] not in rtypes:
            report.err(f"{rr['id']}: unknown request type {rr['request_type']}")
        for t in rr["targets"]:
            if t not in entities:
                report.err(f"{rr['id']}: unknown target {t}")
        for eid in rr["releases"].get("evidence", []):
            released.setdefault(eid, []).append(rr["id"])
        auth = rr["releases"].get("authority")
        if auth and auth not in authorities:
            report.warn(f"{rr['id']}: grants authority {auth} not listed in the intake (fine if it is new)")
        for pid in rr["releases"].get("osint_pages", []):
            if pid not in pages:
                report.err(f"{rr['id']}: unknown page {pid}")
    for eid in items:
        where = released.get(eid, [])
        if len(where) != 1:
            report.err(f"{eid} must be released exactly once, found {len(where)} ({', '.join(where) or 'none'})")
    for eid in released:
        if eid not in items:
            report.err(f"Release list names unknown evidence {eid}")
    for rt in stages["request_types"]:
        if rt["available_from"] not in stage_ids:
            report.err(f"{rt['id']}: unknown stage {rt['available_from']}")

    for p in pages.values():
        if p["site"] not in sites:
            report.err(f"{p['id']}: unknown site {p['site']}")
        for link in p.get("links", []):
            if link not in pages:
                report.err(f"{p['id']}: links to unknown page {link}")
        img_ref = p.get("avatar")
        if img_ref and img_ref not in rels:
            report.err(f"{p['id']}: avatar {img_ref} missing")
        for post in p.get("posts", []):
            if post.get("image") and post["image"] not in rels:
                report.err(f"{p['id']}/{post['id']}: image {post['image']} missing")
    for img in osint.get("images", []):
        if img["file"] not in rels:
            report.err(f"osint image {img['file']} missing")

    def group(eid):
        if eid in items:
            return items[eid]["source_group"]
        if eid in pages:
            return f"web:{pages[eid]['site']}:{eid}"
        return None

    for f in sol["findings"]:
        for eid in f["evidence_any"]:
            if eid not in ev_or_page:
                report.err(f"{f['id']}: unknown evidence {eid}")
        groups = {group(e) for e in f["evidence_any"] if group(e)}
        if len(groups) < f["min_sources"]:
            report.err(f"{f['id']}: needs {f['min_sources']} independent sources but only {len(groups)} source groups are listed")
    for link in sol["links"]:
        for end in (link["a"], link["b"]):
            if end not in entities:
                report.err(f"Solution link uses unknown entity {end}")
        for eid in link["evidence_any"]:
            if eid not in ev_or_page:
                report.err(f"Solution link cites unknown evidence {eid}")
    for ev in sol["timeline"]:
        for eid in ev["evidence_any"]:
            if eid not in ev_or_page:
                report.err(f"{ev['id']}: unknown evidence {eid}")
    for h in sol["herrings"]:
        for eid in h["evidence"]:
            if eid not in ev_or_page:
                report.err(f"{h['id']}: unknown evidence {eid}")
    for eid in sol["grades"]:
        if eid not in items:
            report.err(f"Grade given for unknown evidence {eid}")
    for eid in sol["noise"]:
        if eid not in items:
            report.err(f"Noise list names unknown evidence {eid}")

    objective_ids = {o["id"] for s in stages["stages"] for o in s["objectives"]}
    for oid in objective_ids:
        if oid not in sol["objective_checks"]:
            report.err(f"Objective {oid} has no check in solution.json")
        if oid not in sol["hints"]:
            report.warn(f"Objective {oid} has no hints")
    for oid in sol["objective_checks"]:
        if oid not in objective_ids:
            report.err(f"Check for unknown objective {oid}")
    for sid in stage_ids[1:]:
        if sid not in sol["stage_unlocks"]:
            report.err(f"Stage {sid} has no unlock condition")

    finding_ids = {f["id"] for f in sol["findings"]}
    timeline_ids = {t["id"] for t in sol["timeline"]}
    rr_ids = {r["id"] for r in rules["request_rules"]}

    def walk(cond, where):
        k = cond["kind"]
        if k in ("all", "any"):
            for c in cond.get("of", []):
                walk(c, where)
        if k in ("received", "examined", "hashed", "graded") and not cond.get("all_released"):
            for eid in cond.get("ids", []):
                if eid not in items:
                    report.err(f"{where}: unknown evidence {eid}")
        if k == "finding" and cond.get("key") not in finding_ids:
            report.err(f"{where}: unknown finding {cond.get('key')}")
        if k == "timeline_event" and cond.get("key") not in timeline_ids:
            report.err(f"{where}: unknown timeline event {cond.get('key')}")
        if k == "request_granted" and cond.get("request") not in rr_ids:
            report.err(f"{where}: unknown request rule {cond.get('request')}")
        if k == "objectives" and cond.get("stage") not in stage_ids:
            report.err(f"{where}: unknown stage {cond.get('stage')}")
        if k == "link":
            for end in (cond.get("a"), cond.get("b")):
                if end not in entities:
                    report.err(f"{where}: unknown entity {end}")
        if k == "captured":
            for pid in cond.get("pages", []):
                if pid not in pages:
                    report.err(f"{where}: unknown page {pid}")

    for oid, cond in sol["objective_checks"].items():
        walk(cond, oid)
    for sid, cond in sol["stage_unlocks"].items():
        walk(cond, f"unlock {sid}")
    for trap in rules["traps"]:
        trig = trap["trigger"]
        for eid in trig.get("ids", []) + trig.get("contradicting", []):
            if eid not in ev_or_page:
                report.err(f"{trap['id']}: unknown item {eid}")
        for pid in trig.get("pages", []):
            if pid not in pages:
                report.err(f"{trap['id']}: unknown page {pid}")


def validate_path(path: Path) -> Report:
    path = Path(path)
    if path.is_dir():
        return validate_dir(path)
    report = Report()
    with tempfile.TemporaryDirectory() as tmp:
        if not safe_extract(path, Path(tmp), report):
            return report
        return validate_dir(Path(tmp))
