"""Build a .invcase file from a case source folder.

A case source folder holds story.py, which must define build(case_dir: Path).
The builder runs it into a clean folder, writes the manifest with the
SHA-256 of every file, and zips the result with fixed timestamps so the
same seed always gives a byte-identical pack.
"""
from __future__ import annotations

import importlib.util
import json
import shutil
import zipfile
from pathlib import Path

from .common import sha256_file

FIXED_TIME = (2026, 1, 1, 0, 0, 0)


def run_story(src: Path, out: Path):
    spec = importlib.util.spec_from_file_location(f"story_{src.name.replace('-', '_')}", src / "story.py")
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader
    spec.loader.exec_module(mod)
    case = mod.make_case()
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)
    case.write(out)
    return case


def write_manifest(folder: Path, manifest: dict) -> None:
    files = {}
    for p in sorted(folder.rglob("*")):
        if p.is_file() and p.name != "manifest.json":
            files[p.relative_to(folder).as_posix()] = sha256_file(p)
    manifest = dict(manifest)
    manifest["files"] = files
    with open(folder / "manifest.json", "w", encoding="utf-8", newline="\n") as fh:
        json.dump(manifest, fh, indent=2, ensure_ascii=False)
        fh.write("\n")


def zip_folder(folder: Path, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(target, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for p in sorted(folder.rglob("*")):
            if p.is_file():
                info = zipfile.ZipInfo(p.relative_to(folder).as_posix(), date_time=FIXED_TIME)
                info.compress_type = zipfile.ZIP_DEFLATED
                info.external_attr = 0o644 << 16
                zf.writestr(info, p.read_bytes())


def build(src: Path, dist: Path) -> Path:
    src, dist = Path(src), Path(dist)
    stage_dir = dist / "_build" / src.name
    case = run_story(src, stage_dir)
    write_manifest(stage_dir, case.manifest)
    target = dist / f"{case.manifest['id']}.invcase"
    zip_folder(stage_dir, target)
    return target
