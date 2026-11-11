import React, { useMemo, useState } from "react";
import { useApp } from "../lib/store";
import { TYPE_ICONS, type EvidenceItem, type Grade } from "../lib/types";
import { cls } from "../lib/util";

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="modal-back" role="dialog" aria-modal="true" aria-label={title} onKeyDown={(e) => e.key === "Escape" && onClose()}>
      <div className={cls("modal", wide && "modal-wide")}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="ghost" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export const SOURCE_GRADES: [string, string][] = [
  ["A", "Always reliable: no doubt about the source's authenticity or competence"],
  ["B", "Mostly reliable: has proved reliable in most instances"],
  ["C", "Sometimes reliable: has been reliable on some occasions"],
  ["D", "Unreliable: has proved unreliable in the past"],
  ["E", "Untested: reliability cannot be judged"],
];
export const INFO_GRADES: [string, string][] = [
  ["1", "Known to be true without reservation, or confirmed by other sources"],
  ["2", "Known personally to the source but not confirmed"],
  ["3", "Not personally known to the source but corroborated"],
  ["4", "Cannot be judged"],
  ["5", "Suspected to be false"],
];

export function GradeControl({ target, grade }: { target: string; grade?: Grade | null }) {
  const { act } = useApp();
  const [help, setHelp] = useState(false);
  const set = (source: string, info: string) => act({ type: "grade", target, source, info });
  return (
    <span className="grade-control">
      <label>
        Source
        <select aria-label="Source reliability" value={grade?.source ?? ""} onChange={(e) => set(e.target.value, grade?.info || "4")}>
          <option value="">-</option>
          {SOURCE_GRADES.map(([g]) => (
            <option key={g}>{g}</option>
          ))}
        </select>
      </label>
      <label>
        Info
        <select aria-label="Information confidence" value={grade?.info ?? ""} onChange={(e) => set(grade?.source || "E", e.target.value)}>
          <option value="">-</option>
          {INFO_GRADES.map(([g]) => (
            <option key={g}>{g}</option>
          ))}
        </select>
      </label>
      <button className="ghost small" onClick={() => setHelp(true)} aria-label="Grading guidance">
        ?
      </button>
      {help && (
        <Modal title="Intelligence grading guidance" onClose={() => setHelp(false)}>
          <p className="muted">A simplified teaching version of the grading used in policing. It is not the official scheme.</p>
          <h4>Source reliability</h4>
          <dl className="grade-list">
            {SOURCE_GRADES.map(([g, t]) => (
              <React.Fragment key={g}>
                <dt>{g}</dt>
                <dd>{t}</dd>
              </React.Fragment>
            ))}
          </dl>
          <h4>Information confidence</h4>
          <dl className="grade-list">
            {INFO_GRADES.map(([g, t]) => (
              <React.Fragment key={g}>
                <dt>{g}</dt>
                <dd>{t}</dd>
              </React.Fragment>
            ))}
          </dl>
        </Modal>
      )}
    </span>
  );
}

export function TypeIcon({ type }: { type: string }) {
  return (
    <span className={`type-icon t-${type}`} aria-hidden="true">
      {TYPE_ICONS[type] ?? "▭"}
    </span>
  );
}

export function Cite({ id }: { id: string }) {
  const { select, game, openPage } = useApp();
  const cap = game?.attempt.captures.find((c) => c.id === id);
  return (
    <button className="cite" onClick={() => (cap ? openPage(cap.page) : select(id))} title={cap ? cap.url : game?.case.evidence.find((e) => e.id === id)?.title}>
      {id}
    </button>
  );
}

/** Pick evidence items and captures to cite. */
export function EvidencePicker({ value, onChange, label = "Evidence" }: { value: string[]; onChange: (v: string[]) => void; label?: string }) {
  const { game } = useApp();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const options = useMemo(() => {
    const ev = (game?.case.evidence ?? []).map((e: EvidenceItem) => ({ id: e.id, title: e.title }));
    const caps = (game?.attempt.captures ?? []).filter((c) => c.method === "full").map((c) => ({ id: c.id, title: `Capture: ${c.title}` }));
    return [...ev, ...caps];
  }, [game]);
  const shown = options.filter((o) => !q || (o.id + " " + o.title).toLowerCase().includes(q.toLowerCase()));
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  return (
    <div className="picker">
      <div className="picker-label">{label}</div>
      <div className="chips">
        {value.map((v) => (
          <span key={v} className="chip">
            {v}
            <button aria-label={`Remove ${v}`} onClick={() => toggle(v)}>
              ✕
            </button>
          </span>
        ))}
        <button className="small" onClick={() => setOpen(!open)}>
          {open ? "Done" : "+ Cite"}
        </button>
      </div>
      {open && (
        <div className="picker-drop">
          <input autoFocus placeholder="Filter items" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="picker-list">
            {shown.map((o) => (
              <label key={o.id} className="picker-row">
                <input type="checkbox" checked={value.includes(o.id)} onChange={() => toggle(o.id)} />
                <b>{o.id}</b> {o.title}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function EntitySelect({ value, onChange, label, kinds }: { value: string; onChange: (v: string) => void; label: string; kinds?: string[] }) {
  const { game } = useApp();
  const ents = (game?.case.entities ?? []).filter((e) => !kinds || kinds.includes(e.kind));
  return (
    <label className="field">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Choose…</option>
        {ents.map((e) => (
          <option key={e.id} value={e.id}>
            {e.label} {e.role ? `(${e.role})` : ""}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="empty">{children}</div>;
}
