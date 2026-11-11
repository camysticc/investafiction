"""A small library for writing case packs in Python.

A story script builds a Case object and calls case.write(folder). The
builder then adds the manifest and zips the result into a .invcase file.
See docs/AUTHORING.md for a walk through.
"""
from __future__ import annotations

from datetime import timedelta
from pathlib import Path

from .common import SCHEMA_VERSION, dump_json, sha256_bytes
from .gen import csv_text, iso, t

# Shorthand condition builders, used in objective checks and stage unlocks.
def C_all(*conds): return {"kind": "all", "of": list(conds)}
def C_any(*conds): return {"kind": "any", "of": list(conds)}
def C_received(*ids, all_released=False): return {"kind": "received", "ids": list(ids), "all_released": all_released}
def C_examined(*ids, min=None):
    c = {"kind": "examined", "ids": list(ids)}
    if min is not None:
        c["min"] = min
    return c
def C_hashed(*ids, all_released=False): return {"kind": "hashed", "ids": list(ids), "all_released": all_released}
def C_finding(key): return {"kind": "finding", "key": key}
def C_findings(n): return {"kind": "findings_count", "min": n}
def C_request(rr): return {"kind": "request_granted", "request": rr}
def C_authority(a): return {"kind": "authority", "id": a}
def C_timeline(n): return {"kind": "timeline_count", "min": n}
def C_event(key): return {"kind": "timeline_event", "key": key}
def C_link(a, b): return {"kind": "link", "a": a, "b": b}
def C_links(n): return {"kind": "links_count", "min": n}
def C_captured(*pages): return {"kind": "captured", "pages": list(pages)}
def C_graded(n): return {"kind": "graded", "min": n}
def C_objectives(stage): return {"kind": "objectives", "stage": stage}
def C_legality(): return {"kind": "legality_done"}
def C_scope(): return {"kind": "scope_acknowledged"}
def C_mismatch(*ids): return {"kind": "hash_mismatch_reported", "ids": list(ids)}


class Case:
    def __init__(self, *, id, title, version, specialty, difficulty, minutes, seed, summary,
                 author="Investafiction starter pack", licence="CC BY-NC-SA 4.0",
                 assets_licence="All images drawn for this pack as SVG and released under CC BY-NC-SA 4.0"):
        self.manifest = dict(schema_version=SCHEMA_VERSION, id=id, title=title, version=version,
                             author=author, licence=licence, assets_licence=assets_licence,
                             specialty=specialty, difficulty=difficulty, estimated_minutes=minutes,
                             seed=seed, summary=summary)
        self.brief = ""
        self.intake: dict = {}
        self.entities: list[dict] = []
        self.items: list[dict] = []
        self.files: dict[str, bytes] = {}
        self.stages: list[dict] = []
        self.request_types: list[dict] = []
        self.rules = {"traps": [], "request_rules": [], "broad_request_penalty": 2, "unfounded_request_penalty": 1}
        self.solution = {"findings": [], "links": [], "timeline": [], "herrings": [], "grades": {},
                         "objective_checks": {}, "stage_unlocks": {}, "hints": {}, "noise": [], "gaps": [],
                         "next_steps": "", "story": ""}
        self.osint = {"sites": [], "pages": [], "images": []}
        self.map: dict | None = None
        self._stage_of: dict[str, str] = {}
        self._trap_n = 0

    # ---- entities ---------------------------------------------------------------
    def entity(self, id, kind, label, role="", identifiers=None, attributes=None, hidden_until=None):
        e = {"id": id, "kind": kind, "label": label}
        if role:
            e["role"] = role
        if identifiers:
            e["identifiers"] = identifiers
        if attributes:
            e["attributes"] = attributes
        if hidden_until:
            e["hidden_until"] = hidden_until
        self.entities.append(e)
        return id

    # ---- evidence ---------------------------------------------------------------
    def evidence(self, id, title, type, content, ext, *, source, source_group, acquired, stage=None,
                 summary="", acquired_by="Case officer", custody=None, clock_offset_minutes=None,
                 clock_note="", timezone_note="", handling="", marking="none", tags=None, metadata=None,
                 table=None, original_hash=None, grade=None, noise=False):
        data = content.encode("utf-8") if isinstance(content, str) else content
        path = f"evidence/{id}.{ext}"
        self.files[path] = data
        acq = t(acquired) if isinstance(acquired, str) else acquired
        item = {"id": id, "title": title, "type": type, "file": path, "source": source,
                "source_group": source_group, "acquired": iso(acq), "acquired_by": acquired_by,
                "summary": summary, "original_hash": original_hash or sha256_bytes(data)}
        item["custody"] = custody or [
            {"time": iso(acq), "action": "Acquired from source", "by": acquired_by, "note": source},
            {"time": iso(acq + timedelta(hours=2)), "action": "Sealed and booked into evidence store", "by": "Evidence officer"},
        ]
        if clock_offset_minutes is not None:
            item["clock_offset_minutes"] = clock_offset_minutes
        for k, v in (("clock_note", clock_note), ("timezone_note", timezone_note), ("handling", handling)):
            if v:
                item[k] = v
        item["marking"] = marking
        item["tags"] = tags or []
        if metadata:
            item["metadata"] = metadata
        if table:
            item["table"] = table
        self.items.append(item)
        if stage:
            self._stage_of[id] = stage
        if grade:
            self.solution["grades"][id] = {"source": grade[0], "info": grade[1]}
        if noise:
            self.solution["noise"].append(id)
        return id

    def table(self, id, title, type, columns, rows, *, table=None, **kw):
        return self.evidence(id, title, type, csv_text(columns, rows), "csv", table=table or {}, **kw)

    def document(self, id, title, type, markdown, **kw):
        return self.evidence(id, title, type, markdown.strip() + "\n", "md", **kw)

    def email(self, id, title, *, headers: list[tuple[str, str]], body: str, **kw):
        raw = "".join(f"{k}: {v}\r\n" for k, v in headers) + "\r\n" + body.strip().replace("\n", "\r\n") + "\r\n"
        return self.evidence(id, title, "email", raw, "eml", **kw)

    def json_item(self, id, title, type, obj, **kw):
        import json
        return self.evidence(id, title, type, json.dumps(obj, indent=2, ensure_ascii=False) + "\n", "json", **kw)

    def image(self, id, title, svg: str, **kw):
        return self.evidence(id, title, "image", svg, "svg", **kw)

    def asset(self, path, content):
        self.files[path] = content.encode("utf-8") if isinstance(content, str) else content
        return path

    # ---- stages and requests ----------------------------------------------------
    def stage(self, id, title, minutes, message, objectives, unlock=None, unlock_text="", osint_pages=None):
        st = {"id": id, "title": title, "target_minutes": minutes, "message": message, "evidence": [],
              "objectives": []}
        if unlock_text:
            st["unlock_text"] = unlock_text
        if osint_pages:
            st["osint_pages"] = osint_pages
        for ob in objectives:
            oid, text, required, check, hints = ob
            st["objectives"].append({"id": oid, "text": text, "required": required})
            self.solution["objective_checks"][oid] = check
            self.solution["hints"][oid] = hints
        if unlock is not None:
            self.solution["stage_unlocks"][id] = unlock
        self.stages.append(st)

    def request_type(self, id, kind, label, target_kinds, available_from, needs_dates, description="", allow_all=True):
        self.request_types.append({"id": id, "kind": kind, "label": label, "description": description,
                                   "target_kinds": target_kinds, "available_from": available_from,
                                   "needs_dates": needs_dates, "allow_all": allow_all})

    def request_rule(self, id, request_type, targets, grant_message, *, evidence=None, authority=None,
                     osint_pages=None, must_cover=None, max_days=None, justification=None, min_groups=None,
                     refuse_broad="", refuse_dates="", refuse_justification=""):
        rel = {}
        if evidence:
            rel["evidence"] = evidence
        if authority:
            rel["authority"] = authority
        if osint_pages:
            rel["osint_pages"] = osint_pages
        rr = {"id": id, "request_type": request_type, "targets": targets, "grant_message": grant_message,
              "releases": rel}
        for k, v in (("must_cover", must_cover), ("max_days", max_days), ("justification", justification),
                     ("min_groups", min_groups), ("refuse_broad", refuse_broad), ("refuse_dates", refuse_dates),
                     ("refuse_justification", refuse_justification)):
            if v:
                rr[k] = v
        self.rules["request_rules"].append(rr)

    def trap(self, title, category, trigger, penalty, severity, lesson, warning=""):
        self._trap_n += 1
        tr = {"id": f"TR-{self._trap_n}", "title": title, "category": category, "trigger": trigger,
              "penalty": penalty, "severity": severity, "lesson": lesson}
        if warning:
            tr["warning"] = warning
        self.rules["traps"].append(tr)

    # ---- solution ---------------------------------------------------------------
    def finding(self, id, statement, type, evidence_any, keywords, explain, required=True, min_sources=2, stage=None):
        f = {"id": id, "required": required, "statement": statement, "type": type,
             "evidence_any": evidence_any, "min_sources": min_sources, "keywords": keywords, "explain": explain}
        if stage:
            f["stage"] = stage
        self.solution["findings"].append(f)

    def link(self, a, b, evidence_any, note):
        self.solution["links"].append({"a": a, "b": b, "evidence_any": evidence_any, "note": note})

    def event(self, id, when, label, evidence_any, tolerance_minutes=60, key=True):
        self.solution["timeline"].append({"id": id, "time": iso(t(when)), "label": label,
                                          "evidence_any": evidence_any, "tolerance_minutes": tolerance_minutes,
                                          "key": key})

    def herring(self, id, label, evidence, keywords, explain):
        self.solution["herrings"].append({"id": id, "label": label, "evidence": evidence,
                                          "keywords": keywords, "explain": explain})

    def gap(self, id, label, keywords):
        self.solution["gaps"].append({"id": id, "label": label, "keywords": keywords})

    # ---- osint --------------------------------------------------------------------
    def site(self, id, name, domain, kind, colour="#3b6ea5", tagline=""):
        self.osint["sites"].append({"id": id, "name": name, "domain": domain, "kind": kind,
                                    "colour": colour, "tagline": tagline})

    def page(self, **page):
        self.osint["pages"].append(page)
        return page["id"]

    def osint_image(self, path, svg, metadata=None):
        self.asset(path, svg)
        entry = {"file": path, "licence": "Drawn for this pack, CC BY-NC-SA 4.0"}
        if metadata:
            entry["metadata"] = metadata
        self.osint["images"].append(entry)
        return path

    # ---- output -------------------------------------------------------------------
    def write(self, out: Path) -> None:
        out = Path(out)
        by_id = {s["id"]: s for s in self.stages}
        for eid, sid in self._stage_of.items():
            by_id[sid]["evidence"].append(eid)
        (out / "brief.md").parent.mkdir(parents=True, exist_ok=True)
        (out / "brief.md").write_text(self.brief.strip() + "\n", encoding="utf-8", newline="\n")
        dump_json(self.intake, out / "intake.json")
        dump_json({"stages": self.stages, "request_types": self.request_types}, out / "stages.json")
        dump_json({"entities": self.entities}, out / "entities.json")
        dump_json({"items": self.items}, out / "evidence" / "evidence.json")
        dump_json(self.rules, out / "rules.json")
        dump_json(self.solution, out / "solution.json")
        if self.osint["sites"] or self.osint["pages"]:
            dump_json(self.osint, out / "osint" / "osint.json")
        if self.map:
            dump_json(self.map, out / "map" / "map.json")
        for rel, data in self.files.items():
            p = out / rel
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_bytes(data)
