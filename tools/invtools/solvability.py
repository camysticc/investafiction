"""Solvability and coverage checks for a built case folder.

1. Every required finding can be reached: enough independent sources for
   it are released by stages or requests the player can reach.
2. Each stage unlock only depends on things released before that stage.
3. No evidence item is orphaned. Each one supports a finding, link,
   timeline event or red herring, is used by a trap, request or objective,
   or is listed as deliberate noise.
"""
from __future__ import annotations

from pathlib import Path

from .common import load_json
from .validate import Report


def _release_stage(stages, rules):
    order = {s["id"]: i for i, s in enumerate(stages["stages"])}
    rtypes = {r["id"]: r for r in stages["request_types"]}
    when: dict[str, int] = {}
    for s in stages["stages"]:
        for e in s["evidence"]:
            when[e] = order[s["id"]]
    for rr in rules["request_rules"]:
        st = order[rtypes[rr["request_type"]]["available_from"]]
        for e in rr["releases"].get("evidence", []):
            when[e] = st
    return order, when


def _refs(cond, acc):
    acc.setdefault(cond["kind"], []).append(cond)
    for c in cond.get("of", []):
        _refs(c, acc)
    return acc


def check(folder: Path) -> Report:
    folder = Path(folder)
    rep = Report()
    stages = load_json(folder / "stages.json")
    rules = load_json(folder / "rules.json")
    sol = load_json(folder / "solution.json")
    items = {i["id"]: i for i in load_json(folder / "evidence" / "evidence.json")["items"]}
    order, when = _release_stage(stages, rules)
    osint_path = folder / "osint" / "osint.json"
    pages = {p["id"]: p for p in load_json(osint_path)["pages"]} if osint_path.exists() else {}
    for i, s in enumerate(stages["stages"]):
        for pid in s.get("osint_pages", []):
            when[pid] = i
    rtypes = {r["id"]: r for r in stages["request_types"]}
    for rr in rules["request_rules"]:
        for pid in rr["releases"].get("osint_pages", []):
            when.setdefault(pid, order[rtypes[rr["request_type"]]["available_from"]])

    def group(e):
        if e in items:
            return items[e]["source_group"]
        if e in pages:
            return f"web:{pages[e]['site']}:{e}"
        return None
    findings = {f["id"]: f for f in sol["findings"]}

    reach: dict[str, int] = {}
    for f in sol["findings"]:
        by_stage = sorted((when.get(e, 99), group(e)) for e in f["evidence_any"] if group(e))
        groups = set()
        reached = None
        for st, g in by_stage:
            groups.add(g)
            if len(groups) >= f["min_sources"]:
                reached = st
                break
        if reached is None or reached == 99:
            (rep.err if f["required"] else rep.warn)(f"{f['id']} cannot be reached with {f['min_sources']} independent sources")
        else:
            reach[f["id"]] = reached

    for sid, cond in sol["stage_unlocks"].items():
        idx = order[sid]
        refs = _refs(cond, {})
        for c in refs.get("finding", []):
            r = reach.get(c["key"])
            if r is None or r >= idx:
                rep.err(f"Unlock for {sid} needs {c['key']}, which is only reachable at or after that stage")
        for kind in ("received", "examined", "hashed"):
            for c in refs.get(kind, []):
                for e in c.get("ids", []):
                    if when.get(e, 99) >= idx:
                        rep.err(f"Unlock for {sid} needs {e}, which is released at or after that stage")

    # A required objective must be achievable within its own stage.
    for i, st in enumerate(stages["stages"]):
        for ob in st["objectives"]:
            refs = _refs(sol["objective_checks"].get(ob["id"], {"kind": "start"}), {})
            for c in refs.get("finding", []):
                r = reach.get(c["key"])
                if r is None or r > i:
                    msg = f"{ob['id']} in {st['id']} needs {c['key']}, which is only reachable at stage index {r}"
                    (rep.err if ob["required"] else rep.warn)(msg)

    used: set[str] = set(sol["noise"])
    for f in sol["findings"]:
        used.update(f["evidence_any"])
    for l in sol["links"]:
        used.update(l["evidence_any"])
    for ev in sol["timeline"]:
        used.update(ev["evidence_any"])
    for h in sol["herrings"]:
        used.update(h["evidence"])
    for tr in rules["traps"]:
        used.update(tr["trigger"].get("ids", []))
        used.update(tr["trigger"].get("contradicting", []))
    for cond in list(sol["objective_checks"].values()) + list(sol["stage_unlocks"].values()):
        for kind, cs in _refs(cond, {}).items():
            for c in cs:
                used.update(c.get("ids", []))
    for e in items:
        if e not in used:
            rep.err(f"{e} is orphaned: it supports nothing and is not listed as noise")

    req = [f for f in findings.values() if f["required"]]
    stretch = [f for f in findings.values() if not f["required"]]
    relevant = len(set(items) - set(sol["noise"]))
    rep.warn(f"Summary: {len(items)} items ({len(sol['noise'])} noise, {relevant} relevant), "
             f"{len(stages['stages'])} stages, {len(req)} required and {len(stretch)} stretch findings")
    return rep
