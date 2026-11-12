"""Build step for the help centre (plan section 13).

Reads the Markdown articles in app/src/content/help/articles, generates one
short article per setting from settings.schema.json, adds the glossary, and
writes app/src/content/help/build/articles.json for the search index.

The build FAILS if: a setting, feature id or core error message has no
article; an article links to one that does not exist; a lesson's 'learn more'
points nowhere; or a data-help id in the interface has no article.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / "app" / "src"
HELP = APP / "content" / "help"
OUT = HELP / "build" / "articles.json"


def parse_md(p: Path) -> dict:
    text = p.read_text(encoding="utf-8")
    if not text.startswith("---\n"):
        raise SystemExit(f"{p.name}: missing front matter")
    head, body = text[4:].split("\n---\n", 1)
    a = {"body": body.strip()}
    for line in head.splitlines():
        if not line.strip():
            continue
        k, v = line.split(": ", 1)
        a[k] = json.loads(v)
    for k in ("questions", "synonyms", "tags", "related", "features", "errors"):
        a.setdefault(k, [])
    a.setdefault("lesson", None)
    return a


def slug(s):
    return re.sub(r"[^a-z0-9]+", "_", s.lower()).strip("_")


def settings_articles():
    sch = json.loads((APP / "content" / "settings.schema.json").read_text(encoding="utf-8"))
    cats = {c["id"]: c["label"] for c in sch["categories"]}
    syn = json.loads((Path(__file__).parent / "setting_synonyms.json").read_text(encoding="utf-8"))
    wiring = (APP / "lib" / "wiring.ts").read_text(encoding="utf-8")
    not_active = set(re.findall(r'"([a-z_]+\.[a-z_]+)"', wiring))
    out = []
    for s in sch["settings"]:
        lines = [s["description"], "", f"**Where:** Settings > {cats[s['category']]} > {s['label']}"]
        if s["type"] == "choice":
            lines.append("**Options:** " + ", ".join(o["label"] for o in s["options"]) + ".")
            d = next((o["label"] for o in s["options"] if o["value"] == s.get("default")), None)
            if d:
                lines.append(f"**Default:** {d}.")
        elif s["type"] == "toggle":
            lines.append(f"**Default:** {'On' if s.get('default') else 'Off'}.")
        elif s["type"] == "range":
            lines.append(f"**Range:** {s['min']} to {s['max']}{s.get('unit', '')}. **Default:** {s['default']}{s.get('unit', '')}.")
        if s.get("affects_score"):
            lines.append("**Affects score.** This setting changes how attempts are marked, and the debrief records it.")
        if s.get("locked"):
            lines.append(f"**Locked.** {s.get('locked_reason', '')}")
        if s.get("note"):
            lines.append(s["note"])
        if s["id"] in not_active:
            lines.append("**Not active yet.** This setting is saved and kept between sessions, but it does not change anything in this version.")
        if not s.get("essential"):
            lines.append("This is an extra setting. Turn on **Show more settings** to see it.")
        label = s["label"]
        out.append({
            "id": f"setting.{s['id']}", "title": f"Setting: {label}", "category": "Settings reference", "answer": s["description"],
            "body": "\n\n".join(lines), "questions": [f"what does {label.lower()} do", f"how do i change {label.lower()}"],
            "synonyms": syn.get(s["id"], []), "tags": ["settings", cats[s["category"]].lower()], "related": ["feature.settings"], "features": [f"setting:{s['id']}"],
            "lesson": None, "errors": [], "version": "1.3",
        })
    return out, {s["id"] for s in sch["settings"]}


def glossary_articles():
    g = json.loads((HELP / "glossary.json").read_text(encoding="utf-8"))
    return [{"id": f"glossary.{slug(e['term'])}", "title": e["term"], "category": "Glossary", "answer": e["definition"], "body": "",
             "questions": [f"what is {e['term'].lower()}", f"what does {e['term'].lower()} mean"], "synonyms": [], "tags": ["glossary"],
             "related": [], "features": [], "lesson": None, "errors": [], "version": "1.3"} for e in g]


def core_errors():
    msgs = set()
    for f in (ROOT / "core" / "src").glob("*.rs"):
        t = f.read_text(encoding="utf-8")
        for m in re.finditer(r'(?:bad|ApiError::new|ApiError::with)\((?:format!\()?"([^"]+)"', t):
            msgs.add(m.group(1))
        if f.name == "pack.rs":
            for m in re.finditer(r'errors?\.push\((?:format!\()?"([^"]+)"', t):
                msgs.add(m.group(1))
    return msgs


def main():
    problems = []
    written = [parse_md(p) for p in sorted((HELP / "articles").glob("*.md"))]
    ids = [a["id"] for a in written]
    if len(ids) != len(set(ids)):
        problems.append("Duplicate article ids")
    sets, setting_ids = settings_articles()
    gloss = glossary_articles()
    allart = written + sets + gloss
    by_id = {a["id"]: a for a in allart}

    for a in written:
        for k in ("id", "title", "category", "answer"):
            if not a.get(k):
                problems.append(f"{a.get('id')}: missing {k}")
        for r in a["related"]:
            if r not in by_id:
                problems.append(f"{a['id']}: links to missing article {r}")
        if len(a["answer"].split(".")) > 4:
            problems.append(f"{a['id']}: the short answer should be one or two sentences")

    # every lesson links to a real article, and articles name real lessons
    lessons = {}
    for f in (APP / "content" / "academy").glob("*-*.json"):
        for l in json.loads(f.read_text(encoding="utf-8"))["lessons"]:
            lessons[l["id"]] = l
            if l["learn_more"] not in by_id:
                problems.append(f"Lesson {l['id']} points to missing article {l['learn_more']}")
    for a in written:
        if a["lesson"] and a["lesson"] not in lessons:
            problems.append(f"{a['id']}: names unknown lesson {a['lesson']}")

    # every feature id (data-help in the interface) has an article
    features = {f for a in allart for f in a["features"]} | set(by_id)
    used = set()
    for f in APP.rglob("*.tsx"):
        used |= set(re.findall(r'data-help="([^"]+)"', f.read_text(encoding="utf-8")))
    for h in sorted(used):
        if h not in features:
            problems.append(f"Interface help id '{h}' has no article")
    # every help link in the code points to a real article
    for f in APP.rglob("*.tsx"):
        for m in re.findall(r'openHelp\("([^"]+)"', f.read_text(encoding="utf-8")):
            if m not in by_id:
                problems.append(f"{f.name}: openHelp('{m}') has no article")
    for f in [APP / "components" / "Progress.tsx"]:
        for m in re.findall(r'"((?:feature|concept|howto)\.[a-z_]+)"', f.read_text(encoding="utf-8")):
            if m not in by_id:
                problems.append(f"{f.name}: article {m} does not exist")
    # every setting has an article
    for s in setting_ids:
        if f"setting.{s}" not in by_id:
            problems.append(f"Setting {s} has no article")
    # every core error message is covered by a troubleshooting or how-to article
    patterns = [(p.lower(), a["id"]) for a in written for p in a["errors"]]
    def norm(m):
        return re.sub(r"\{[^}]*\}", "", m).lower()
    uncovered = [m for m in core_errors() if not any(p.strip() and (p.strip() in norm(m) or norm(m).strip() in p) for p, _ in patterns)]
    for m in sorted(uncovered):
        problems.append(f"Core error has no help article: {m}")

    if problems:
        print("\n".join(problems))
        print(f"\nHelp build FAILED: {len(problems)} problem(s).")
        sys.exit(1)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"version": "1.3", "articles": allart}, ensure_ascii=False) + "\n", encoding="utf-8")
    cats = {}
    for a in allart:
        cats[a["category"]] = cats.get(a["category"], 0) + 1
    print(f"Help built: {len(written)} written, {len(sets)} settings articles, {len(gloss)} glossary terms ({len(allart)} entries)")
    print("  " + ", ".join(f"{k}: {v}" for k, v in cats.items()))


if __name__ == "__main__":
    main()
