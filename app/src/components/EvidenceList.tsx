import { useEffect, useMemo, useRef, useState } from "react";
import { useSetting } from "../lib/settings";
import { useApp } from "../lib/store";
import { TYPE_LABELS } from "../lib/types";
import { cls } from "../lib/util";
import { TypeIcon } from "./common";

export default function EvidenceList() {
  const { game, selected, select, act } = useApp();
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const items = game!.case.evidence;
  const filterRef = useRef<HTMLInputElement>(null);
  const highlightNew = useSetting<boolean>("gameplay.highlight_new_evidence");
  const curStage = game!.attempt.current_stage;
  useEffect(() => {
    const h = (e: Event) => {
      const id = (e as CustomEvent).detail as string;
      const list = shown.map((i) => i.id);
      const at = selected ? list.indexOf(selected) : -1;
      if (id === "ev.next" && list.length) select(list[Math.min(list.length - 1, at + 1)]);
      else if (id === "ev.prev" && list.length) select(list[Math.max(0, at - 1)]);
      else if (id === "ev.log_receipt" && selected) act({ type: "log_receipt", ids: [selected] });
      else if (id === "ev.hash" && selected) act({ type: "hash_check", ids: [selected] });
      else if (id === "ev.log_all") act({ type: "log_receipt", all: true });
      else if (id === "ev.hash_all") act({ type: "hash_check", all: true });
      else if (id === "ev.filter") filterRef.current?.focus();
    };
    window.addEventListener("inv:cmd", h);
    return () => window.removeEventListener("inv:cmd", h);
  });
  const types = useMemo(() => [...new Set(items.map((i) => i.type))].sort(), [items]);
  const shown = items.filter((i) => {
    if (q && !(i.id + " " + i.title + " " + i.summary + " " + i.tags.join(" ")).toLowerCase().includes(q.toLowerCase())) return false;
    if (type && i.type !== type) return false;
    if (status === "new" && i.received) return false;
    if (status === "received" && (!i.received || i.examined)) return false;
    if (status === "examined" && !i.examined) return false;
    return true;
  });
  const notReceived = items.filter((i) => !i.received).length;
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  return (
    <div className="evlist">
      <div className="evlist-head" data-help="panel.evidence_list">
        <h2>Evidence <span className="muted">({items.length})</span></h2>
        <div className="row wrap">
          <button className="small" disabled={notReceived === 0} onClick={() => act({ type: "log_receipt", all: true })} title="Log receipt of every item not yet received">
            Log all ({notReceived})
          </button>
          <button className="small" onClick={() => act({ type: "hash_check", all: true })} title="Calculate and compare the SHA-256 of every item">
            Hash all
          </button>
          {picked.length > 0 && (
            <button className="small" onClick={() => { act({ type: "log_receipt", ids: picked }); setPicked([]); }}>
              Log {picked.length} selected
            </button>
          )}
        </div>
        <input ref={filterRef} placeholder="Filter the list" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter evidence" />
        <div className="row">
          <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Filter by type">
            <option value="">All types</option>
            {types.map((t) => <option key={t} value={t}>{TYPE_LABELS[t] ?? t}</option>)}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
            <option value="">Any status</option>
            <option value="new">Not looked at</option>
            <option value="received">Logged, not examined</option>
            <option value="examined">Examined</option>
          </select>
        </div>
      </div>
      <ul className="evitems">
        {shown.map((i) => (
          <li key={i.id} className={cls("evitem", selected === i.id && "on", i.marking !== "none" && `mark-${i.marking}`, i.examined && "is-examined", highlightNew && !i.received && i.released_by === curStage && "is-new")}>
            <input type="checkbox" aria-label={`Select ${i.id}`} checked={picked.includes(i.id)} onChange={() => toggle(i.id)} />
            <button className="evbtn" onClick={() => select(i.id)}>
              <TypeIcon type={i.type} />
              <span className="evtext">
                <span className="evtitle"><b>{i.id}</b> {i.title}</span>
                <span className="evmeta">
                  <span className={cls("status", i.examined ? "s-examined" : i.received ? "s-received" : "s-new")}>{i.examined ? "Examined" : i.received ? "Logged" : "Not looked at"}</span>
                  {i.hashed && <span className={cls("status", i.hash_ok ? "s-ok" : "s-bad")}>{i.hash_ok ? "Hash ✓" : "Hash ✗"}</span>}
                  {i.continuity_gap && <span className="status s-bad" title="Examined before receipt was logged">Gap</span>}
                  {i.marking !== "none" && <span className="status s-mark">{i.marking}</span>}
                  {i.grade && <span className="status">{i.grade.source}{i.grade.info}</span>}
                </span>
              </span>
            </button>
          </li>
        ))}
        {shown.length === 0 && <li className="muted pad">Nothing matches.</li>}
      </ul>
    </div>
  );
}
