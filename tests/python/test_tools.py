"""Tests for the Python authoring tools. Run from the repository root:

    PYTHONPATH=tools python -m pytest tests/python
"""
import json
import shutil
import zipfile
from pathlib import Path

import pytest

from invtools import build, safety, solvability
from invtools.common import REPO_ROOT, sha256_file
from invtools.gen import Gen
from invtools.validate import validate_path

CASES = ["ledger", "last-signal", "quiet-exit"]


@pytest.fixture(scope="session")
def built(tmp_path_factory):
    out = tmp_path_factory.mktemp("dist")
    return {name: build.build(REPO_ROOT / "packs" / "src" / name, out) for name in CASES}, out


@pytest.mark.parametrize("name", CASES)
def test_starter_cases_are_valid_solvable_and_safe(built, name):
    packs, out = built
    assert validate_path(packs[name]).ok
    folder = out / "_build" / name
    assert solvability.check(folder).ok
    assert safety.scan(folder).ok


def test_builds_are_deterministic(built, tmp_path):
    packs, _ = built
    again = build.build(REPO_ROOT / "packs" / "src" / "ledger", tmp_path)
    assert sha256_file(again) == sha256_file(packs["ledger"])


def test_generators_stay_in_reserved_ranges():
    g = Gen(42)
    for _ in range(200):
        assert g.mobile().startswith("07700 900")
        assert g.ip().rsplit(".", 1)[0] in {"192.0.2", "198.51.100", "203.0.113"}
        assert "-" in g.plate()
        assert g.account()[0].startswith("99-")


def _unpack(pack: Path, dest: Path) -> Path:
    with zipfile.ZipFile(pack) as z:
        z.extractall(dest)
    return dest


def test_validator_rejects_tampered_file(built, tmp_path):
    packs, _ = built
    folder = _unpack(packs["ledger"], tmp_path / "p")
    (folder / "evidence" / "EV-002.md").write_text("changed", encoding="utf-8")
    rep = validate_path(folder)
    assert not rep.ok and any("manifest hash" in e for e in rep.errors)


def test_validator_rejects_scripted_svg(built, tmp_path):
    packs, _ = built
    folder = _unpack(packs["last-signal"], tmp_path / "p")
    svg = folder / "osint" / "marina.svg"
    svg.write_text('<svg onload="alert(1)"></svg>', encoding="utf-8")
    rep = validate_path(folder)
    assert any("scripting" in e for e in rep.errors)


def test_validator_rejects_path_traversal(built, tmp_path):
    packs, _ = built
    bad = tmp_path / "bad.invcase"
    shutil.copy(packs["ledger"], bad)
    with zipfile.ZipFile(bad, "a") as z:
        z.writestr("../escape.json", "{}")
    rep = validate_path(bad)
    assert not rep.ok and any("Unsafe path" in e for e in rep.errors)


def test_safety_scan_catches_real_looking_data(tmp_path):
    (tmp_path / "x.md").write_text("Call 07123 456789 or email someone@gmail.com from 81.2.69.160", encoding="utf-8")
    rep = safety.scan(tmp_path)
    joined = " ".join(rep.errors)
    assert "07123" in joined and "gmail.com" in joined and "81.2.69.160" in joined


def test_solvability_flags_orphans(built, tmp_path):
    packs, _ = built
    folder = _unpack(packs["ledger"], tmp_path / "p")
    sol = json.loads((folder / "solution.json").read_text(encoding="utf-8"))
    sol["noise"].remove("EV-009")
    (folder / "solution.json").write_text(json.dumps(sol), encoding="utf-8")
    rep = solvability.check(folder)
    assert any("EV-009 is orphaned" in e for e in rep.errors)
