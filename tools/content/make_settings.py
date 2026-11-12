"""Build app/src/content/settings.schema.json from the settings catalogue table.

The catalogue (catalogue.tsv) is the plan's section 11.3, one row per setting:
category, label, options, default. This script turns it into the schema the
app uses for the settings screen, defaults, validation, search and help.
Run it whenever the catalogue changes. It is deterministic.
"""
import json
import re
from pathlib import Path

HERE = Path(__file__).parent
OUT = HERE.parent.parent / "app" / "src" / "content" / "settings.schema.json"

CATS = [
    ("general", "General", "Language, dates, times and what opens first."),
    ("profile", "Profile", "Your chosen name, avatar and badge."),
    ("appearance", "Appearance", "Theme, colours, text and layout."),
    ("accessibility", "Accessibility", "Motion, contrast, colour and focus."),
    ("sound", "Sound", "Volume and which sounds play."),
    ("gameplay", "Gameplay and mode", "Mode, hints, warnings, objectives and the case clock."),
    ("viewers", "Evidence viewers", "Tables, emails, messages, images and files."),
    ("timeline", "Timeline", "Zoom, grouping and how events are shown."),
    ("graph", "Link analysis graph", "Layout, labels and suggested links."),
    ("map", "Map", "Base map, units and the time slider."),
    ("statements", "Statement comparison", "Comparing witness statements side by side."),
    ("search", "Search and filter", "How searching across evidence works."),
    ("osint", "OSINT module", "The mock web browser and page captures."),
    ("integrity", "Evidence log and integrity", "Logging, hashes and chain of custody."),
    ("report", "Report builder", "Templates, citations and exports."),
    ("replay", "Replay and dashboard", "The investigation replay and the skills dashboard."),
    ("notes", "Notes and findings", "Findings board and working notes."),
    ("saves", "Saves and data", "Autosave, backups and your data."),
    ("library", "Case library", "How cases are listed and checked."),
    ("academy", "Academy and help", "The Academy, tips and the help centre."),
    ("shortcuts", "Keyboard shortcuts", "Shortcut presets and rebinding."),
    ("notifications", "Notifications", "Banners, notices and how long they stay."),
    ("privacy", "Privacy and safety", "Content notices and data collection."),
    ("advanced", "Advanced", "Case author tools, diagnostics and resets."),
]

LOCKED_EXPLAIN = {
    "osint.hash_captures_automatically": "Captures are always hashed so they can be shown to be unchanged. Marking and the evidence trail depend on it.",
    "integrity.action_logging": "Every action is always logged. The debrief, the replay and the marking are built from this log.",
    "privacy.usage_data_collection": "Investafiction never sends anything off your computer. There is nothing to switch on.",
}


def slug(s):
    s = re.sub(r"\(.*?\)", "", s).lower().replace("'", "")
    return re.sub(r"[^a-z0-9]+", "_", s).strip("_")


def parse_options(label, opts, default):
    o = opts.strip()
    if o.lower().startswith("button"):
        return {"type": "button", "action": slug(label), "confirm": "confirmation" in o.lower(), "note": o}
    if "(locked)" in o or o.startswith("None. The program"):
        return {"type": "locked", "value": default, "note": o}
    if o in ("On, Off", "Off, On"):
        return {"type": "toggle", "default": default.strip().lower().startswith("on")}
    if o in ("Show, Hide",):
        return {"type": "toggle", "default": default.strip() == "Show", "labels": ["Show", "Hide"]}
    m = re.match(r"^(\d+)%? to (\d+)%?$", o)
    if m:
        lo, hi = int(m.group(1)), int(m.group(2))
        d = int(re.sub(r"\D", "", default) or lo)
        return {"type": "range", "min": lo, "max": hi, "step": 5 if "%" in o else (5 if hi >= 100 else 1), "unit": "%" if "%" in o else "", "default": d}
    if o.startswith("About 40 actions"):
        return {"type": "shortcuts", "default": "default"}
    if o.startswith("12 built-in icons"):
        return {"type": "choice", "options": [{"value": f"icon{i}", "label": f"Icon {i}"} for i in range(1, 13)], "default": "icon1"}
    if o == "8 colours":
        cols = ["Blue", "Teal", "Green", "Purple", "Rose", "Amber", "Slate", "Crimson"]
        return {"type": "choice", "options": [{"value": c.lower(), "label": c} for c in cols], "default": "blue"}
    if " or " in o and "," in o and o.count(",") <= 2:
        parts = [p.strip() for p in o.split(" or ")]
    else:
        parts = [p.strip() for p in o.split(", ")]
    if o == "Officer Smith, Detective Jones, Sergeant Nolan":
        return {"type": "profile_name", "options": [{"value": p, "label": p} for p in parts], "default": None}
    opts_l = [{"value": slug(p) or p, "label": p} for p in parts]
    if label == "Number format":
        opts_l = [{"value": "comma_point", "label": "1,234.56"}, {"value": "space_comma", "label": "1 234,56"}]
    vals = [x["value"] for x in opts_l]
    if len(set(vals)) != len(vals):
        raise SystemExit(f"Option values clash for {label}: {vals}")
    d = default.strip()
    tok = d.split()[0].lower() if d else ""
    exact = next((x["value"] for x in opts_l if x["label"].split()[0].lower() == tok and tok.isdigit()), None)
    if exact:
        return {"type": "choice", "options": opts_l, "default": exact}
    dv = next((x["value"] for x in opts_l if x["label"].lower() == d.lower() or x["label"].lower().startswith(d.lower())), None)
    if dv is None:
        dv = next((x["value"] for x in opts_l if d.lower() in x["label"].lower()), opts_l[0]["value"])
    return {"type": "choice", "options": opts_l, "default": dv}


DESCRIBE = json.loads((HERE / "descriptions.json").read_text(encoding="utf-8"))


def main():
    rows = [l.split("\t") for l in (HERE / "catalogue.tsv").read_text(encoding="utf-8").splitlines() if l.strip() and not l.startswith("#")]
    settings = []
    counts = {}
    for cat, label, opts, default in rows:
        counts[cat] = counts.get(cat, 0) + 1
    seen = {}
    for cat, label, opts, default in rows:
        affects = "(affects score)" in label
        clean = label.replace(" (affects score)", "").strip()
        sid = f"{cat}.{slug(clean)}"
        spec = parse_options(clean, opts, default)
        n = seen.get(cat, 0)
        seen[cat] = n + 1
        essential = n < max(3, round(counts[cat] * 0.6))
        entry = {"id": sid, "category": cat, "label": clean,
                 "description": DESCRIBE.get(sid, ""), "affects_score": affects,
                 "locked": spec["type"] == "locked", "essential": essential, **spec}
        if entry["locked"]:
            entry["locked_reason"] = LOCKED_EXPLAIN.get(sid, "This cannot be turned off.")
        if default.strip() == "On in training mode":
            entry["default"] = True
            entry["note"] = "On in training mode. Assessment mode never shows warnings."
        settings.append(entry)
    missing = [s["id"] for s in settings if not s["description"]]
    if missing:
        raise SystemExit("Settings with no description: " + ", ".join(missing))
    presets = json.loads((HERE / "presets.json").read_text(encoding="utf-8"))
    ids = {s["id"] for s in settings}
    by_id = {s["id"]: s for s in settings}
    for p in presets:
        for k, v in p["values"].items():
            if k not in ids:
                raise SystemExit(f"Preset {p['id']} sets unknown setting {k}")
            st = by_id[k]
            if st["type"] == "toggle" and not isinstance(v, bool):
                raise SystemExit(f"Preset {p['id']}: {k} needs true or false")
            if st["type"] == "choice" and v not in [o["value"] for o in st["options"]]:
                raise SystemExit(f"Preset {p['id']}: {k} has no option {v!r}")
    out = {"version": 1, "categories": [{"id": c, "label": l, "description": d} for c, l, d in CATS], "settings": settings, "presets": presets}
    OUT.write_text(json.dumps(out, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"{len(settings)} settings in {len(CATS)} categories -> {OUT}")


if __name__ == "__main__":
    main()
