"""Command line entry point.

    python -m invtools validate <pack folder or .invcase>
    python -m invtools build <case source folder> [--out packs/dist]
    python -m invtools check <built case folder>
    python -m invtools build-all [--out packs/dist]
    python -m invtools new <case id>
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

from . import build as builder
from . import safety, solvability
from .common import REPO_ROOT
from .validate import Report, validate_path


def _print(report: Report, label: str) -> bool:
    for w in report.warnings:
        print(f"  note: {w}")
    for e in report.errors:
        print(f"  error: {e}")
    print(f"{label}: {'OK' if report.ok else f'{len(report.errors)} error(s)'}")
    return report.ok


def cmd_validate(args) -> int:
    return 0 if _print(validate_path(Path(args.path)), f"validate {args.path}") else 1


def cmd_check(args) -> int:
    folder = Path(args.path)
    ok = _print(validate_path(folder), "schema and references")
    ok &= _print(solvability.check(folder), "solvability")
    ok &= _print(safety.scan(folder), "synthetic data safety")
    return 0 if ok else 1


def _build_one(src: Path, out: Path) -> bool:
    target = builder.build(src, out)
    folder = out / "_build" / src.name
    print(f"built {target}")
    ok = _print(validate_path(target), "  validate pack")
    ok &= _print(solvability.check(folder), "  solvability")
    ok &= _print(safety.scan(folder), "  safety")
    return ok


def cmd_build(args) -> int:
    return 0 if _build_one(Path(args.src), Path(args.out)) else 1


def cmd_build_all(args) -> int:
    ok = True
    for src in sorted((REPO_ROOT / "packs" / "src").iterdir()):
        if (src / "story.py").exists():
            ok &= _build_one(src, Path(args.out))
    return 0 if ok else 1


SCAFFOLD = '''"""Story script for {id}. Run: python -m invtools build packs/src/{id}"""
from invtools.casekit import Case, C_all, C_received, C_examined, C_finding, C_objectives, C_scope, C_legality
from invtools.gen import Gen


def make_case() -> Case:
    g = Gen(seed=1)
    c = Case(id="{id}", title="New case", version="0.1.0", specialty="General", difficulty="Beginner",
             minutes=30, seed=1, summary="A short practice case.")
    c.brief = "# New case\\n\\nWrite the opening situation here."
    c.intake = {{"tasking": "Describe the tasking.", "scope": ["What is in scope"], "out_of_scope": [],
                "authorities": [{{"id": "AUTH-BASE", "label": "Base tasking", "covers": "The supplied material"}}],
                "constraints": [], "clock_start": "2026-01-05T09:00:00Z", "case_lead": "Case lead",
                "osint_access": "none"}}
    p = c.entity("ENT-P01", "person", "Person one", role="Person of interest")
    c.document("EV-001", "First item", "document", "Some text.", source="Example", source_group="a",
               acquired="2026-01-05 09:00", stage="S1", grade=("B", "2"))
    c.document("EV-002", "Second item", "statement", "More text.", source="Witness", source_group="b",
               acquired="2026-01-05 09:30", stage="S1", grade=("C", "3"))
    c.stage("S1", "First look", 20, "Welcome to the case.", [
        ("OB-1-1", "Log receipt of every item", True, C_received(all_released=True),
         ["Check the evidence list.", "Each item has a Log receipt button.", "Log receipt of EV-001 and EV-002."]),
    ])
    c.stage("S2", "Report", 10, "Write it up.", [
        ("OB-2-1", "Complete the legality statement", True, C_legality(),
         ["Open the report tab.", "The statement is at the bottom.", "Fill in all three boxes and sign."]),
    ], unlock=C_objectives("S1"))
    c.finding("KF-01", "Write the key finding.", "fact", ["EV-001", "EV-002"], [["key"]], "Why it matters.")
    return c
'''


def cmd_new(args) -> int:
    folder = REPO_ROOT / "packs" / "src" / args.id
    if folder.exists():
        print(f"{folder} already exists")
        return 1
    folder.mkdir(parents=True)
    (folder / "story.py").write_text(SCAFFOLD.format(id=args.id), encoding="utf-8")
    print(f"created {folder / 'story.py'}")
    return 0


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(prog="invtools", description="Investafiction case authoring tools")
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("validate", help="validate a pack folder or .invcase file")
    p.add_argument("path")
    p.set_defaults(fn=cmd_validate)
    p = sub.add_parser("check", help="validate, solvability and safety checks on a built folder")
    p.add_argument("path")
    p.set_defaults(fn=cmd_check)
    p = sub.add_parser("build", help="build one case source folder into a .invcase")
    p.add_argument("src")
    p.add_argument("--out", default=str(REPO_ROOT / "packs" / "dist"))
    p.set_defaults(fn=cmd_build)
    p = sub.add_parser("build-all", help="build every case in packs/src")
    p.add_argument("--out", default=str(REPO_ROOT / "packs" / "dist"))
    p.set_defaults(fn=cmd_build_all)
    p = sub.add_parser("new", help="scaffold a new case source folder")
    p.add_argument("id")
    p.set_defaults(fn=cmd_new)
    args = ap.parse_args(argv)
    return args.fn(args)


if __name__ == "__main__":
    sys.exit(main())
