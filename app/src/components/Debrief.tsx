import { call } from "../lib/api";
import { useApp } from "../lib/store";
import { fmtTime } from "../lib/util";
import { Cite } from "./common";

export default function Debrief() {
  const { game, exportFile, run, setGame } = useApp();
  const r = game!.attempt.result;
  if (!r) return <p>Not submitted yet.</p>;
  const ent = (id: string) => game!.case.entities.find((e) => e.id === id)?.label ?? id;
  return (
    <div className="debrief">
      <div className="score-head">
        <div className={`score band-${String(r.band).toLowerCase().replace(" ", "-")}`}>
          <b>{r.total}</b>
          <span>{r.band}</span>
        </div>
        <div className="grow">
          <h2>Debrief</h2>
          <p className="muted">Bands: Distinction 85+, Merit 70+, Pass 55+. {r.capped && "A serious breach capped this result at Pass."} {r.hint_cost > 0 && `Hints cost ${r.hint_cost} marks.`}</p>
          <div className="row">
            <button onClick={() => exportFile("debrief_md")}>Export debrief</button>
            <button onClick={() => exportFile("report_pdf")}>Export your report</button>
            <button className="primary" onClick={() => run(async () => { const n = await call("attempt.reset"); setGame(await call("attempt.open", { case_id: game!.case.manifest.id, attempt_id: n.attempt_id })); })}>Try the case again</button>
          </div>
        </div>
      </div>
      <div className="cats">
        {r.categories.map((c: any) => (
          <div key={c.key} className="cat">
            <div className="row"><span className="grow">{c.label}</span><b>{c.points}</b><span className="muted">/ {c.weight}</span></div>
            <div className="bar"><div style={{ width: `${(c.points / c.weight) * 100}%` }} /></div>
          </div>
        ))}
      </div>
      {r.notes.length > 0 && <div className="banner">{r.notes.join(" ")}</div>}

      <h3>Key findings</h3>
      <table className="grid">
        <thead><tr><th /><th>Finding</th><th>Supported by</th><th>Why it matters</th></tr></thead>
        <tbody>
          {r.findings.map((f: any) => (
            <tr key={f.id} className={f.found ? "found" : "missed"}>
              <td>{f.found ? (f.label_ok ? "✓" : "½") : "✗"}</td>
              <td>
                {f.statement} <span className={`tag ${f.required ? "req" : "stretch"}`}>{f.required ? "required" : "stretch"}</span> <span className={`ftype ftype-${f.type}`}>{f.type}</span>
                {f.your_finding && <div className="small muted">You wrote: {f.your_finding.statement} ({f.your_finding.type}){!f.label_ok && " · label differs from the expected one"}</div>}
              </td>
              <td className="small">{f.evidence.map((e: string) => (e.startsWith("EV") ? <Cite key={e} id={e} /> : <span key={e} className="cite">{e}</span>))} <div className="muted">needs {f.min_sources} independent source(s)</div></td>
              <td className="small">{f.explain}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Red herrings</h3>
      <ul className="plain">
        {r.herrings.map((h: any) => <li key={h.id} className={h.followed ? "bad-text" : ""}><b>{h.label}</b> {h.followed ? "(you followed this)" : "(avoided)"}: {h.explain}</li>)}
      </ul>

      <h3>Your timeline against the true one</h3>
      <table className="grid">
        <thead><tr><th>True time (UTC)</th><th>What happened</th><th>Your entry</th></tr></thead>
        <tbody>
          {r.timeline.map((t: any) => (
            <tr key={t.id} className={t.matched ? "found" : t.key ? "missed" : ""}>
              <td>{fmtTime(t.time)}</td>
              <td>{t.label}{!t.key && <span className="muted small"> (context)</span>}</td>
              <td>{t.your_event ? `${fmtTime(t.your_event.time)} ${t.your_event.description}` : "Not on your timeline"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Links</h3>
      <ul className="plain">
        {r.links.map((l: any, i: number) => <li key={i}>{l.backed ? "✓" : l.found ? "½" : "✗"} {ent(l.a)} ↔ {ent(l.b)}: {l.note}</li>)}
      </ul>

      <h3>Gaps a careful analyst would admit</h3>
      <ul className="plain">{r.gaps.map((g: any) => <li key={g.id}>{g.admitted ? "✓" : "✗"} {g.label}</li>)}</ul>

      <h3>Procedural events</h3>
      {r.procedural_events.length === 0 ? <p>None. Well handled.</p> : (
        <table className="grid">
          <thead><tr><th>When</th><th>Event</th><th>Penalty</th><th>Lesson</th></tr></thead>
          <tbody>
            {r.procedural_events.map((t: any, i: number) => (
              <tr key={i} className={`sev-${t.severity}`}><td>{fmtTime(t.time)}</td><td><b>{t.title}</b> <span className="muted small">{t.severity}</span><div className="small">{t.detail}</div></td><td>−{t.penalty}</td><td className="small">{t.lesson}</td></tr>
            ))}
          </tbody>
        </table>
      )}
      {r.refused_requests.length > 0 && (
        <>
          <h3>Refused requests</h3>
          <ul className="plain">{r.refused_requests.map((q: any) => <li key={q.id}><b>{q.id}</b> {q.response}</li>)}</ul>
        </>
      )}
      <h3>Time per stage</h3>
      <table className="grid">
        <thead><tr><th>Stage</th><th>Your time</th><th>Target</th></tr></thead>
        <tbody>{r.stage_times.map((s: any) => <tr key={s.stage}><td>{s.title}</td><td>{s.minutes} min</td><td>{s.target} min</td></tr>)}</tbody>
      </table>
      <h3>What a careful analyst would do next</h3>
      <p>{r.next_steps}</p>
      {r.story && (
        <details>
          <summary>What really happened (spoiler)</summary>
          <p className="story">{r.story}</p>
        </details>
      )}
    </div>
  );
}
