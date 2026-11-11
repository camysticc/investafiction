import { useEffect, useState } from "react";
import { call } from "../lib/api";
import { useApp } from "../lib/store";
import { Markdown } from "../lib/md";
import { Cite, Modal } from "./common";
import { Avatar } from "./Welcome";

const SECTIONS = [
  ["summary", "1. Summary", "What happened, in a few sentences, and your overall assessment."],
  ["scope_method", "2. Scope and method", "What you examined, what you requested and how you worked."],
  ["gaps", "7. Gaps and limitations", "What the evidence cannot tell you, conflicts you could not resolve, and anything you chose not to pursue."],
  ["recommendations", "8. Recommendations", "What should happen next, in priority order."],
] as const;

export default function ReportView() {
  const { game, act, guarded, setGame, exportFile, profile, setTab } = useApp();
  const r = game!.attempt.report;
  const [draft, setDraft] = useState({ summary: r.summary, scope_method: r.scope_method, gaps: r.gaps, recommendations: r.recommendations });
  const [legal, setLegal] = useState({ legality: r.legality.legality, necessity: r.legality.necessity, proportionality: r.legality.proportionality });
  const [preview, setPreview] = useState<string | null>(null);
  const submitted = game!.attempt.submitted;
  useEffect(() => {
    const h = setTimeout(() => {
      const changed = (Object.keys(draft) as (keyof typeof draft)[]).some((k) => draft[k] !== r[k]) || (Object.keys(legal) as (keyof typeof legal)[]).some((k) => legal[k] !== r.legality[k]);
      if (changed && !submitted) act({ type: "report", ...draft, ...legal });
    }, 900);
    return () => clearTimeout(h);
  }, [draft, legal]);
  const findings = game!.attempt.findings;
  const issues = game!.attempt.report_issues;
  const submit = async () => {
    await act({ type: "report", ...draft, ...legal });
    const res = await guarded("submit", {});
    if (res?.state) {
      setGame(res.state);
      setTab("debrief");
    }
  };
  return (
    <div className="report">
      <div className="row">
        <h2 className="grow">Report builder</h2>
        <button onClick={async () => setPreview((await call("report.preview")).markdown)}>Preview</button>
        <button onClick={() => exportFile("report_md")}>Export Markdown</button>
        <button onClick={() => exportFile("report_pdf")}>Export PDF</button>
      </div>
      <div className={`check ${issues.length ? "warn" : "ok"}`}>
        <b>Citation and completeness check:</b> {issues.length ? issues.join(" ") : "every finding in the report cites evidence, and every section has content."}
      </div>
      {SECTIONS.slice(0, 2).map(([k, label, help]) => (
        <label key={k} className="field section">
          <span className="section-title">{label}</span>
          <span className="muted small">{help}</span>
          <textarea disabled={submitted} rows={5} value={draft[k]} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} />
        </label>
      ))}
      <section className="section">
        <span className="section-title">3. Key findings</span>
        <span className="muted small">Tick the findings to include. Manage them in the findings board on the right.</span>
        {findings.length === 0 && <p className="muted">No findings recorded yet.</p>}
        {findings.map((f) => (
          <label key={f.id} className={`report-finding f-${f.type}`}>
            <input type="checkbox" disabled={submitted} checked={f.in_report} onChange={(e) => act({ type: "report_finding", id: f.id, on: e.target.checked })} />
            <span className={`ftype ftype-${f.type}`}>{f.type}</span>
            <span className="grow">{f.statement}</span>
            <span className="row">{f.evidence.length ? f.evidence.map((e) => <Cite key={e} id={e} />) : <span className="warn-text small">uncited</span>}</span>
          </label>
        ))}
      </section>
      <section className="section">
        <span className="section-title">4 to 6. Timeline, link chart and evidence list</span>
        <label className="small"><input type="checkbox" disabled={submitted} checked={r.include_timeline} onChange={(e) => act({ type: "report", include_timeline: e.target.checked })} /> Include the timeline ({game!.attempt.timeline.length} events)</label>
        <label className="small"><input type="checkbox" disabled={submitted} checked={r.include_links} onChange={(e) => act({ type: "report", include_links: e.target.checked })} /> Include the link chart summary ({game!.attempt.links.length} links)</label>
        <p className="muted small">The evidence list is built automatically from everything you cite.</p>
      </section>
      {SECTIONS.slice(2).map(([k, label, help]) => (
        <label key={k} className="field section">
          <span className="section-title">{label}</span>
          <span className="muted small">{help}</span>
          <textarea disabled={submitted} rows={5} value={draft[k]} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} />
        </label>
      ))}
      <section className="section legality">
        <span className="section-title">9. Legality, necessity and proportionality</span>
        <span className="muted small">Principle 4: the person in charge is responsible for making sure the law and the principles are followed. Complete this and sign off as case lead before you submit. A simplified teaching statement, not legal advice.</span>
        {(["legality", "necessity", "proportionality"] as const).map((k) => (
          <label key={k} className="field">
            {k[0].toUpperCase() + k.slice(1)}
            <textarea disabled={submitted} rows={2} value={legal[k]} onChange={(e) => setLegal({ ...legal, [k]: e.target.value })} placeholder={k === "legality" ? "What authority did you work under?" : k === "necessity" ? "Why was each step needed for the tasking?" : "Why was what you collected no more intrusive than needed?"} />
          </label>
        ))}
        <div className="signoff">
          <Avatar name={profile!.name} size={36} />
          {r.legality.signed ? (
            <span>Signed as case lead by <b>{r.legality.signed_by}</b>. Editing the statement removes the signature.</span>
          ) : (
            <>
              <span className="grow">Sign as case lead: <b>{profile!.name}</b></span>
              <button className="primary" disabled={submitted} onClick={async () => { await act({ type: "report", ...legal }); await act({ type: "sign" }); }}>Sign statement</button>
            </>
          )}
        </div>
      </section>
      {!submitted && (
        <div className="submit-bar">
          <p className="muted small">When you submit, the attempt is marked and the answers are shown. You can start a new attempt afterwards.</p>
          <button className="primary big" disabled={!r.legality.signed} onClick={submit}>Submit report for marking</button>
        </div>
      )}
      {preview !== null && (
        <Modal title="Report preview" onClose={() => setPreview(null)} wide>
          <div className="paper"><Markdown text={preview} /></div>
        </Modal>
      )}
    </div>
  );
}
