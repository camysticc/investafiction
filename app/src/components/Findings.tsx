import { useState } from "react";
import { get as setting } from "../lib/settings";
import { useApp } from "../lib/store";
import type { Finding } from "../lib/types";
import { Cite, EvidencePicker, GradeControl } from "./common";

const TYPES = [
  ["fact", "Fact", "Established by the evidence. Needs at least one citation, and two independent sources for anything important."],
  ["inference", "Inference", "A conclusion you draw from facts. Say why."],
  ["assumption", "Assumption", "Something you are taking as true without evidence. Say so plainly."],
] as const;

export function FindingForm({ initial, onDone, prefillEvidence }: { initial?: Finding; onDone: () => void; prefillEvidence?: string[] }) {
  const { act, selected } = useApp();
  const [statement, setStatement] = useState(initial?.statement ?? "");
  const [kind, setKind] = useState<string>(initial?.type ?? setting("notes.default_finding_type"));
  const [evidence, setEvidence] = useState<string[]>(initial?.evidence ?? prefillEvidence ?? (setting("notes.link_selected_evidence_to_new_findings") && selected ? [selected] : []));
  const save = async () => {
    const r = await act({ type: initial ? "update_finding" : "add_finding", id: initial?.id, statement, kind, evidence });
    if (r) onDone();
  };
  return (
    <div className="finding-form">
      <label className="field">
        Finding
        <textarea value={statement} onChange={(e) => setStatement(e.target.value)} placeholder="Write one clear statement, for example: Every payment to X was just under the approval limit." rows={3} />
      </label>
      <div className="seg" role="radiogroup" aria-label="Type of finding">
        {TYPES.map(([k, label, help]) => (
          <button key={k} role="radio" aria-checked={kind === k} className={kind === k ? "on" : ""} title={help} onClick={() => setKind(k)}>
            {label}
          </button>
        ))}
      </div>
      <p className="muted small">{TYPES.find((t) => t[0] === kind)![2]}</p>
      <EvidencePicker value={evidence} onChange={setEvidence} />
      {kind === "fact" && evidence.length === 0 && <p className="warn-text small">A fact needs at least one evidence link.</p>}
      <div className="row-end">
        <button onClick={onDone}>Cancel</button>
        <button className="primary" disabled={statement.trim().length < 8 || (kind === "fact" && evidence.length === 0)} onClick={save}>
          {initial ? "Save finding" : "Add finding"}
        </button>
      </div>
    </div>
  );
}

export default function Findings() {
  const { game, act, confirm } = useApp();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const fs = game!.attempt.findings;
  return (
    <div className="findings">
      <div className="row">
        <h3 className="grow">Findings board</h3>
        {!adding && <button className="primary small" onClick={() => setAdding(true)}>+ Finding</button>}
      </div>
      {adding && <FindingForm onDone={() => setAdding(false)} />}
      {fs.length === 0 && !adding && <p className="muted">No findings yet. Record each thing you establish as a fact, an inference or an assumption, linked to the evidence.</p>}
      {fs.map((f) =>
        editing === f.id ? (
          <FindingForm key={f.id} initial={f} onDone={() => setEditing(null)} />
        ) : (
          <div key={f.id} className={`finding f-${f.type}`}>
            <div className="row">
              <span className={`ftype ftype-${f.type}`}>{f.type}</span>
              <span className="muted small grow">{f.id}</span>
              <label className="small" title="Include in report">
                <input type="checkbox" checked={f.in_report} onChange={(e) => act({ type: "report_finding", id: f.id, on: e.target.checked })} /> in report
              </label>
            </div>
            <p>{f.statement}</p>
            <div className="row wrap">
              {f.evidence.length ? f.evidence.map((e) => <Cite key={e} id={e} />) : <span className="warn-text small">No evidence cited</span>}
            </div>
            <div className="row wrap">
              <GradeControl target={f.id} grade={f.grade} />
              <span className="grow" />
              <button className="ghost small" onClick={() => setEditing(f.id)}>Edit</button>
              <button className="ghost small" onClick={async () => (await confirm("Delete this finding?", "Delete finding", "Delete")) && act({ type: "delete_finding", id: f.id })}>Delete</button>
            </div>
          </div>
        ),
      )}
    </div>
  );
}
