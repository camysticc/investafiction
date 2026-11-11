import { useState } from "react";
import { useApp } from "../lib/store";
import { Markdown } from "../lib/md";
import { fmtTime } from "../lib/util";

export default function BriefView({ firstTime }: { firstTime?: boolean }) {
  const { game, act } = useApp();
  const [ticked, setTicked] = useState(false);
  if (!game) return null;
  const { intake, brief, manifest } = game.case;
  const a = game.attempt;
  const body = (
    <div className="brief">
      <Markdown text={brief} />
      <section className="intake">
        <h3>Intake form</h3>
        <dl>
          <dt>Tasking</dt>
          <dd>{intake.tasking}</dd>
          <dt>In scope</dt>
          <dd>
            <ul>{intake.scope.map((s) => <li key={s}>{s}</li>)}</ul>
          </dd>
          <dt>Out of scope</dt>
          <dd>
            <ul>{intake.out_of_scope.map((s) => <li key={s}>{s}</li>)}</ul>
          </dd>
          <dt>Authorities in place</dt>
          <dd>
            <ul>
              {intake.authorities.map((x) => <li key={x.id}><b>{x.label}.</b> {x.covers}</li>)}
              {a.authorities.filter((id) => !intake.authorities.some((x) => x.id === id)).map((id) => <li key={id}><b>{id}</b> (granted by request)</li>)}
            </ul>
          </dd>
          <dt>Constraints</dt>
          <dd>
            <ul>{intake.constraints.map((s) => <li key={s}>{s}</li>)}</ul>
          </dd>
          <dt>Open source research</dt>
          <dd>{intake.osint_access === "public_and_authorised" ? "Public pages, plus private material where specific authority is granted" : intake.osint_access === "public_only" ? "Public pages only" : "None"}</dd>
          <dt>Case lead</dt>
          <dd>{intake.case_lead}</dd>
          <dt>Case clock starts</dt>
          <dd>{fmtTime(intake.clock_start)} UTC</dd>
        </dl>
      </section>
      {!firstTime && a.messages.length > 0 && (
        <section>
          <h3>Messages from the case lead</h3>
          {[...a.messages].reverse().map((m) => (
            <div key={m.id} className={`message ${m.read ? "" : "unread"}`} onMouseEnter={() => !m.read && act({ type: "read_message", id: m.id })}>
              <div className="muted small">{m.from} · {fmtTime(m.case_time)} · {game.case.stages.find((s) => s.id === m.stage)?.title}</div>
              <p>{m.text}</p>
            </div>
          ))}
        </section>
      )}
    </div>
  );
  if (!firstTime) return body;
  return (
    <div className="brief-page">
      <div className="brief-card">
        <div className="muted small">{manifest.specialty} · {manifest.difficulty} · about {Math.round(manifest.estimated_minutes / 60 * 10) / 10} hours · {a.mode === "training" ? "Training mode: hints and warnings on" : "Assessment mode: no hints, feedback at the end"}</div>
        {body}
        <div className="ack">
          <label>
            <input type="checkbox" checked={ticked} onChange={(e) => setTicked(e.target.checked)} />
            I have read the tasking, the scope and the authorities. I will work within them.
          </label>
          <button className="primary" disabled={!ticked} onClick={() => act({ type: "ack_scope" })}>
            Acknowledge scope and start
          </button>
        </div>
      </div>
    </div>
  );
}
