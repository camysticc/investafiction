import { useState } from "react";
import { call } from "../lib/api";
import { useApp } from "../lib/store";
import { TYPE_LABELS } from "../lib/types";
import { TypeIcon } from "./common";

export default function SearchPanel() {
  const { game, run, select } = useApp();
  const [q, setQ] = useState("");
  const [types, setTypes] = useState<string[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [entity, setEntity] = useState("");
  const [tag, setTag] = useState("");
  const [grade, setGrade] = useState("");
  const [res, setRes] = useState<{ results: any[]; ms: number } | null>(null);
  const allTypes = [...new Set(game!.case.evidence.map((e) => e.type))];
  const tags = [...new Set(game!.case.evidence.flatMap((e) => e.tags))];
  const go = () => run(async () => setRes(await call("search", { query: q, types, from, to, entity, tag, grade })));
  return (
    <div className="search-panel">
      <h2>Search and filter</h2>
      <div className="row">
        <input className="grow" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && go()} placeholder="Search all released evidence: content and metadata. All words must match." aria-label="Search" />
        <button className="primary" onClick={go}>Search</button>
      </div>
      <div className="filters row wrap">
        <label className="field">From<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="field">To<input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        <label className="field">Entity
          <select value={entity} onChange={(e) => setEntity(e.target.value)}><option value="">Any</option>{game!.case.entities.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}</select>
        </label>
        {tags.length > 0 && <label className="field">Tag<select value={tag} onChange={(e) => setTag(e.target.value)}><option value="">Any</option>{tags.map((t) => <option key={t}>{t}</option>)}</select></label>}
        <label className="field">Your grade
          <select value={grade} onChange={(e) => setGrade(e.target.value)}><option value="">Any</option>{["A", "B", "C", "D", "E"].map((g) => <option key={g}>{g}</option>)}</select>
        </label>
      </div>
      <div className="chips">
        {allTypes.map((t) => (
          <button key={t} className={`chip-btn ${types.includes(t) ? "on" : ""}`} onClick={() => setTypes(types.includes(t) ? types.filter((x) => x !== t) : [...types, t])}>{TYPE_LABELS[t] ?? t}</button>
        ))}
      </div>
      {res && (
        <div className="results">
          <p className="muted small">{res.results.length} item(s) in {res.ms} ms</p>
          {res.results.map((r) => (
            <div key={r.id} className="result">
              <button className="link" onClick={() => select(r.id)}><TypeIcon type={r.type} /> <b>{r.id}</b> {r.title}</button>
              {r.hits > 0 && <span className="muted small"> · {r.hits} hit(s)</span>}
              {r.snippets.map((s: string, i: number) => <div key={i} className="snippet small">{s}</div>)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
