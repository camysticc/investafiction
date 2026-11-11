import { useMemo, useRef, useState } from "react";
import { useApp } from "../lib/store";
import type { TimelineEvent } from "../lib/types";
import { cls, fmtTime, parseTime, svgToPngBase64 } from "../lib/util";
import { Cite, EvidencePicker, Modal } from "./common";

export function EventForm({ initial, onDone, isNew }: { initial: TimelineEvent; onDone: () => void; isNew?: boolean }) {
  const { act, game } = useApp();
  const [time, setTime] = useState(fmtTime(initial.time));
  const [description, setDescription] = useState(initial.description);
  const [evidence, setEvidence] = useState<string[]>(initial.evidence);
  const [entities, setEntities] = useState<string[]>(initial.entities);
  const [confidence, setConfidence] = useState(initial.confidence || "medium");
  const [clockNote, setClockNote] = useState(initial.clock_note);
  const offsets = evidence.map((e) => game!.case.evidence.find((x) => x.id === e)).filter((x) => x && (x.clock_offset_minutes || x.timezone_note || x.metadata["Time zone"]));
  const applyOffset = (mins: number) => {
    const d = parseTime(time);
    if (!d) return;
    setTime(fmtTime(new Date(d.getTime() - mins * 60000)));
    setClockNote(`Corrected by ${-mins} minutes for the source clock`);
  };
  const save = async () => {
    const r = await act({ type: isNew ? "add_event" : "update_event", id: initial.id, time, description, evidence, entities, confidence, clock_note: clockNote });
    if (r) onDone();
  };
  return (
    <div className="event-form">
      <label className="field">
        Time (UTC, YYYY-MM-DD HH:MM)
        <input value={time} onChange={(e) => setTime(e.target.value)} placeholder="2026-03-02 09:15" />
      </label>
      {offsets.map((x) => (
        <div key={x!.id} className="banner clock small">
          {x!.id}: {x!.clock_offset_minutes ? `clock offset ${x!.clock_offset_minutes} min.` : ""} {x!.timezone_note} {x!.metadata["Time zone"] ? `Time zone: ${x!.metadata["Time zone"]}.` : ""}
          {x!.clock_offset_minutes ? <button className="small" onClick={() => applyOffset(x!.clock_offset_minutes!)}>Correct by {-x!.clock_offset_minutes!} min</button> : null}
          {x!.metadata["Time zone"]?.includes("Los_Angeles") && (
            <>
              <button className="small" onClick={() => applyOffset(-420)}>Convert from PDT (+7 h)</button>
              <button className="small" onClick={() => applyOffset(-480)}>Convert from PST (+8 h)</button>
            </>
          )}
        </div>
      ))}
      <label className="field">
        What happened
        <input value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <EvidencePicker value={evidence} onChange={setEvidence} label="Sources" />
      <label className="field">
        People and things involved
        <select multiple value={entities} onChange={(e) => setEntities([...e.target.selectedOptions].map((o) => o.value))} size={4}>
          {game!.case.entities.map((en) => <option key={en.id} value={en.id}>{en.label}</option>)}
        </select>
      </label>
      <div className="row">
        <label className="field">
          Confidence
          <select value={confidence} onChange={(e) => setConfidence(e.target.value)}>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </label>
        <label className="field grow">
          Clock note
          <input value={clockNote} onChange={(e) => setClockNote(e.target.value)} placeholder="Any correction you applied to the source time" />
        </label>
      </div>
      <div className="row-end">
        <button onClick={onDone}>Cancel</button>
        <button className="primary" disabled={!time || !description} onClick={save}>{isNew ? "Add event" : "Save event"}</button>
      </div>
    </div>
  );
}

export default function Timeline() {
  const { game, act, exportFile, confirm } = useApp();
  const [editing, setEditing] = useState<TimelineEvent | null>(null);
  const [adding, setAdding] = useState(false);
  const [entity, setEntity] = useState("");
  const svgRef = useRef<SVGSVGElement>(null);
  const events = game!.attempt.timeline.filter((e) => !entity || e.entities.includes(entity));
  const items = game!.case.evidence;
  const conflicts = useMemo(() => {
    const c = new Set<string>();
    const ev = game!.attempt.timeline;
    for (let i = 0; i < ev.length; i++)
      for (let j = i + 1; j < ev.length; j++) {
        const a = ev[i], b = ev[j];
        const dt = Math.abs((parseTime(a.time)?.getTime() ?? 0) - (parseTime(b.time)?.getTime() ?? 0)) / 60000;
        const shared = a.entities.some((x) => b.entities.includes(x));
        const sameSrc = a.evidence.some((x) => b.evidence.includes(x));
        if (dt <= 15 && shared && !sameSrc) {
          c.add(a.id);
          c.add(b.id);
        }
      }
    return c;
  }, [game]);
  const times = events.map((e) => parseTime(e.time)!.getTime());
  const t0 = Math.min(...times), t1 = Math.max(...times);
  const W = 900, H = 120;
  const x = (t: number) => (t1 === t0 ? W / 2 : 40 + ((t - t0) / (t1 - t0)) * (W - 80));
  const ent = (id: string) => game!.case.entities.find((e) => e.id === id)?.label ?? id;

  return (
    <div className="timeline">
      <div className="row">
        <h2 className="grow">Timeline <span className="muted small">({events.length} events, UTC)</span></h2>
        <select value={entity} onChange={(e) => setEntity(e.target.value)} aria-label="Filter by entity">
          <option value="">All people and things</option>
          {game!.case.entities.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
        </select>
        <button className="primary" onClick={() => setAdding(true)}>+ Event</button>
        <button onClick={() => exportFile("timeline_csv")}>Export CSV</button>
        <button onClick={() => exportFile("timeline_md")}>Export table</button>
        <button disabled={!events.length} onClick={async () => svgRef.current && exportFile("file", { filename: "timeline.png", data_b64: await svgToPngBase64(svgRef.current) })}>Export image</button>
      </div>
      {events.length > 0 && (
        <svg ref={svgRef} className="tl-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Timeline chart">
          <rect width={W} height={H} fill="#fbfaf6" />
          <line x1={30} x2={W - 30} y1={70} y2={70} stroke="#9aa3ad" />
          {events.length > 0 && <text x={30} y={100} fontSize={10} fill="#6b7480">{fmtTime(events[0].time)}</text>}
          {events.length > 1 && <text x={W - 30} y={100} fontSize={10} fill="#6b7480" textAnchor="end">{fmtTime(events[events.length - 1].time)}</text>}
          {events.map((e, i) => {
            const xx = x(parseTime(e.time)!.getTime());
            return (
              <g key={e.id}>
                <line x1={xx} x2={xx} y1={70} y2={i % 3 === 0 ? 40 : i % 3 === 1 ? 26 : 12} stroke="#c9ced6" />
                <circle cx={xx} cy={70} r={7} fill={conflicts.has(e.id) ? "#c2410c" : e.evidence.length ? "#1f4e79" : "#9aa3ad"} />
                <text x={xx} y={i % 3 === 0 ? 36 : i % 3 === 1 ? 22 : 8} fontSize={10} fontWeight={700} textAnchor="middle" fill="#25303b">{i + 1}</text>
              </g>
            );
          })}
        </svg>
      )}
      <table className="grid">
        <thead><tr><th>#</th><th>Time (UTC)</th><th>Event</th><th>Sources</th><th>Involved</th><th>Confidence</th><th /></tr></thead>
        <tbody>
          {events.map((e, idx) => {
            const offs = e.evidence.map((id) => items.find((i) => i.id === id)).filter((i) => i?.clock_offset_minutes);
            return (
              <tr key={e.id} className={cls(conflicts.has(e.id) && "conflict", !e.evidence.length && "uncited")}>
                <td className="muted">{idx + 1}</td>
                <td>{fmtTime(e.time)}{e.clock_note && <div className="small muted">{e.clock_note}</div>}{offs.length > 0 && !e.clock_note && <div className="small warn-text">Source has a clock offset</div>}</td>
                <td>{e.description}{conflicts.has(e.id) && <div className="small warn-text">Close in time to another event about the same person from a different source. Check whether they agree.</div>}</td>
                <td>{e.evidence.length ? e.evidence.map((id) => <Cite key={id} id={id} />) : <span className="warn-text small">uncited</span>}</td>
                <td className="small">{e.entities.map(ent).join(", ")}</td>
                <td>{e.confidence}</td>
                <td className="actions-cell">
                  <button className="ghost small" onClick={() => setEditing(e)}>Edit</button>
                  <button className="ghost small" onClick={async () => (await confirm("Delete this event?", "Delete", "Delete")) && act({ type: "delete_event", id: e.id })}>✕</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {events.length === 0 && <p className="muted">No events yet. Use ⏱ on any table row or message, or add an event by hand. Every entry should cite the evidence it came from.</p>}
      {(adding || editing) && (
        <Modal title={adding ? "Add event" : "Edit event"} onClose={() => { setAdding(false); setEditing(null); }}>
          <EventForm isNew={adding} initial={editing ?? { id: "", time: "", description: "", evidence: [], entities: [], confidence: "medium", clock_note: "" }} onDone={() => { setAdding(false); setEditing(null); }} />
        </Modal>
      )}
    </div>
  );
}
