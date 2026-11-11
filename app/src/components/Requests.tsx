import { useState } from "react";
import { useApp } from "../lib/store";
import { fmtTime } from "../lib/util";
import { Empty } from "./common";

export default function Requests() {
  const { game, act } = useApp();
  const types = game!.case.request_types;
  const [rt, setRt] = useState(types[0]?.id ?? "");
  const [target, setTarget] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [why, setWhy] = useState("");
  const t = types.find((x) => x.id === rt);
  const targets = game!.case.entities.filter((e) => t?.target_kinds.includes(e.kind));
  const reqs = [...game!.attempt.requests].reverse();
  const submit = async () => {
    const r = await act({ type: "request", request_type: rt, target, date_from: from, date_to: to, justification: why });
    if (r?.result?.granted) {
      setTarget("");
      setWhy("");
    }
  };
  return (
    <div className="requests">
      <h2>Requests for authority and data</h2>
      <p className="muted">Some material only arrives if you ask for it, and some actions need authority first. A request should name one target, cover only the period that matters, and explain why it is necessary and proportionate. Broad or unjustified requests are refused and count against procedure.</p>
      {types.length === 0 ? (
        <Empty>No requests can be made yet in this case.</Empty>
      ) : (
        <div className="request-form">
          <label className="field">
            Type of request
            <select value={rt} onChange={(e) => { setRt(e.target.value); setTarget(""); }}>
              {types.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
            </select>
          </label>
          {t?.description && <p className="muted small">{t.description}</p>}
          <label className="field">
            Target
            <select value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="">Choose…</option>
              {targets.map((e) => <option key={e.id} value={e.id}>{e.label}{e.role ? ` (${e.role})` : ""}</option>)}
              {t?.allow_all && <option value="ALL">Every {t.target_kinds.join(" or ")} in the case</option>}
            </select>
          </label>
          {t?.needs_dates && (
            <div className="row">
              <label className="field">From<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
              <label className="field">To<input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
            </div>
          )}
          <label className="field">
            Justification
            <textarea rows={4} value={why} onChange={(e) => setWhy(e.target.value)} placeholder="Why is this necessary for the tasking? What have you already found that points to this target and period? Why is it proportionate?" />
          </label>
          <div className="row-end">
            <button className="primary" disabled={!target || why.trim().length < 20 || (t?.needs_dates && (!from || !to))} onClick={submit}>Submit request</button>
          </div>
        </div>
      )}
      <h3>Request history</h3>
      {reqs.length === 0 && <p className="muted">No requests yet.</p>}
      {reqs.map((r) => (
        <div key={r.id} className={`request ${r.granted ? "granted" : "refused"}`}>
          <div className="row">
            <b className="grow">{r.id} · {types.find((x) => x.id === r.request_type)?.label ?? r.request_type}</b>
            <span className={`pill ${r.granted ? "ok" : "bad"}`}>{r.granted ? "Granted" : "Refused"}</span>
          </div>
          <div className="small muted">Target: {r.target === "ALL" ? "every target" : game!.case.entities.find((e) => e.id === r.target)?.label ?? r.target}{r.date_from && ` · ${r.date_from} to ${r.date_to}`} · {fmtTime(r.time)}</div>
          <p className="small">{r.justification}</p>
          <p className="response">{r.response}</p>
        </div>
      ))}
    </div>
  );
}
