import { useEffect, useState } from "react";
import { useApp } from "../lib/store";
import { fmtTime } from "../lib/util";
import Findings from "./Findings";

export default function SidePanel() {
  const [tab, setTab] = useState<"objectives" | "findings" | "notes" | "log">("objectives");
  const { game } = useApp();
  return (
    <div className="side">
      <nav className="side-tabs" role="tablist">
        {(["objectives", "findings", "notes", "log"] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>
            {t === "objectives" ? "Objectives" : t === "findings" ? `Findings (${game!.attempt.findings.length})` : t === "notes" ? "Notes" : "Action log"}
          </button>
        ))}
      </nav>
      <div className="side-body">
        {tab === "objectives" && <Objectives />}
        {tab === "findings" && <Findings />}
        {tab === "notes" && <Notes />}
        {tab === "log" && <ActionLog />}
      </div>
    </div>
  );
}

function Objectives() {
  const { game, act, toast } = useApp();
  const a = game!.attempt;
  const training = a.mode === "training";
  const shownHints: Record<string, string[]> = {};
  for (const h of a.hints) (shownHints[h.objective] ??= []).push(h.text);
  const traps = a.traps;
  return (
    <div className="objectives">
      {game!.case.stages.map((s, i) => (
        <section key={s.id} className={`stage ${s.open ? "open" : "locked"} ${s.id === a.current_stage ? "current" : ""}`}>
          <h3>
            <span className="stage-n">{i + 1}</span> {s.title}
            <span className="muted small"> · about {s.target_minutes} min</span>
          </h3>
          {!s.open && <p className="muted small">{s.unlock_text || "Locked"}</p>}
          {s.open && (
            <ul>
              {s.objectives!.map((o) => (
                <li key={o.id} className={o.done ? "done" : ""}>
                  <span className="tick" aria-label={o.done ? "Complete" : "Not complete"}>{o.done ? "✓" : "○"}</span>
                  <div>
                    <span>{o.text}</span> <span className={`tag ${o.required ? "req" : "stretch"}`}>{o.required ? "required" : "stretch"}</span>
                    {(shownHints[o.id] ?? []).map((h, k) => (
                      <div key={k} className="hint"><b>Hint {k + 1}.</b> {h}</div>
                    ))}
                    {training && !o.done && (shownHints[o.id]?.length ?? 0) < 3 && (
                      <button
                        className="ghost small"
                        onClick={async () => {
                          const r = await act({ type: "hint", objective: o.id });
                          if (r?.result) toast(`Hint used: minus ${r.result.cost} marks.`);
                        }}
                      >
                        {["Nudge", "Pointer", "Direct pointer"][shownHints[o.id]?.length ?? 0]} hint (−{[0.5, 1, 1.5][shownHints[o.id]?.length ?? 0]})
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
      {training && traps.length > 0 && (
        <section className="trap-list">
          <h3>Procedural slips so far</h3>
          {traps.map((t, i) => (
            <div key={i} className={`trap sev-${t.severity}`}>
              <b>{t.title}</b> <span className="muted small">({t.severity}, −{t.penalty})</span>
              <div className="small">{t.lesson}</div>
            </div>
          ))}
        </section>
      )}
      {training && a.hint_cost > 0 && <p className="muted small">Hints used so far cost {a.hint_cost} marks.</p>}
    </div>
  );
}

function Notes() {
  const { game, act } = useApp();
  const [text, setText] = useState(game!.attempt.notes);
  useEffect(() => {
    const h = setTimeout(() => text !== game!.attempt.notes && act({ type: "notes", text }), 800);
    return () => clearTimeout(h);
  }, [text]);
  return (
    <div className="notes">
      <p className="muted small">Your working notes. They are saved with the attempt but are not marked.</p>
      <textarea aria-label="Notes" value={text} onChange={(e) => setText(e.target.value)} placeholder="Lines of enquiry, questions, things to check…" />
    </div>
  );
}

function ActionLog() {
  const { game, exportFile } = useApp();
  const [f, setF] = useState("");
  const a = game!.attempt;
  const rows = a.actions.filter((x) => !f || (x.action + x.target + x.detail + x.view).toLowerCase().includes(f.toLowerCase()));
  return (
    <div className="actionlog">
      <div className="row">
        <input placeholder="Filter the log" value={f} onChange={(e) => setF(e.target.value)} />
        <button className="small" onClick={() => exportFile("action_log_csv")}>Export CSV</button>
      </div>
      <p className="muted small">Every step is recorded automatically ({a.action_count} entries). Your report must be consistent with this audit trail.</p>
      <ol className="log" reversed>
        {rows.map((x) => (
          <li key={x.seq}>
            <span className="muted small">{fmtTime(x.case_time)}</span> <b>{x.action.replace(/_/g, " ")}</b> {x.target}
            {x.detail && <div className="small muted">{x.detail}</div>}
          </li>
        ))}
      </ol>
    </div>
  );
}
