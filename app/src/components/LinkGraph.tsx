import { useEffect, useMemo, useRef, useState } from "react";
import { call } from "../lib/api";
import { useApp } from "../lib/store";
import type { Entity } from "../lib/types";
import { svgToBase64, svgToPngBase64 } from "../lib/util";
import { Cite, EntitySelect, EvidencePicker, Modal } from "./common";

const KIND_COLOUR: Record<string, string> = {
  person: "#1f4e79", organisation: "#7c3aed", phone: "#0f766e", account: "#b45309", vehicle: "#be123c", address: "#4d7c0f", device: "#475569", online_account: "#0369a1",
};
const KIND_SHAPE: Record<string, string> = { person: "circle", organisation: "rect", account: "diamond", phone: "rect", device: "rect", vehicle: "diamond", address: "circle", online_account: "circle" };

type Pos = Record<string, { x: number; y: number }>;

function layout(nodes: Entity[], edges: { from: string; to: string }[], W: number, H: number, prev: Pos): Pos {
  const pos: Pos = {};
  nodes.forEach((n, i) => {
    const a = (i / Math.max(nodes.length, 1)) * Math.PI * 2;
    pos[n.id] = prev[n.id] ?? { x: W / 2 + Math.cos(a) * W * 0.35, y: H / 2 + Math.sin(a) * H * 0.35 };
  });
  for (let it = 0; it < 220; it++) {
    const f: Record<string, { x: number; y: number }> = {};
    for (const n of nodes) f[n.id] = { x: 0, y: 0 };
    for (let i = 0; i < nodes.length; i++)
      for (let j = i + 1; j < nodes.length; j++) {
        const a = pos[nodes[i].id], b = pos[nodes[j].id];
        let dx = a.x - b.x, dy = a.y - b.y;
        const d2 = Math.max(dx * dx + dy * dy, 100);
        const k = 16000 / d2;
        dx /= Math.sqrt(d2);
        dy /= Math.sqrt(d2);
        f[nodes[i].id].x += dx * k; f[nodes[i].id].y += dy * k;
        f[nodes[j].id].x -= dx * k; f[nodes[j].id].y -= dy * k;
      }
    for (const e of edges) {
      const a = pos[e.from], b = pos[e.to];
      if (!a || !b) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const k = (d - 230) * 0.02;
      f[e.from].x += (dx / d) * k * d * 0.05; f[e.from].y += (dy / d) * k * d * 0.05;
      f[e.to].x -= (dx / d) * k * d * 0.05; f[e.to].y -= (dy / d) * k * d * 0.05;
    }
    for (const n of nodes) {
      if (prev[n.id]) continue;
      const p = pos[n.id];
      p.x = Math.min(W - 60, Math.max(60, p.x + Math.max(-12, Math.min(12, f[n.id].x + (W / 2 - p.x) * 0.002))));
      p.y = Math.min(H - 40, Math.max(40, p.y + Math.max(-12, Math.min(12, f[n.id].y + (H / 2 - p.y) * 0.002))));
    }
  }
  return pos;
}

export default function LinkGraph() {
  const { game, act, run, exportFile, confirm } = useApp();
  const [adding, setAdding] = useState<{ from: string; to: string; evidence: string[]; kind: string; note: string; suggested?: boolean } | null>(null);
  const [suggestions, setSuggestions] = useState<any[] | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [kindFilter, setKindFilter] = useState("");
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);
  const [pinned, setPinned] = useState<Pos>(() => game!.attempt.view?.graph ?? {});
  const [drag, setDrag] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const W = 960, H = 620;
  const links = game!.attempt.links;
  const linked = new Set(links.flatMap((l) => [l.from, l.to]));
  const nodes = game!.case.entities.filter((e) => (showAll || linked.has(e.id)) && (!kindFilter || e.kind === kindFilter || linked.has(e.id)));
  const pos = useMemo(() => layout(nodes, links, W, H, pinned), [nodes.map((n) => n.id).join(), links.length, pinned]);
  useEffect(() => {
    const t = setTimeout(() => call("act", { type: "view", view: { tab: "links", graph: pinned } }).catch(() => {}), 600);
    return () => clearTimeout(t);
  }, [pinned]);
  const onMove = (e: React.MouseEvent) => {
    if (!drag || !svgRef.current) return;
    const r = svgRef.current.getBoundingClientRect();
    setPinned((p) => ({ ...p, [drag]: { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H } }));
  };
  const label = (id: string) => game!.case.entities.find((e) => e.id === id)?.label ?? id;
  const sel = links.find((l) => l.id === selectedEdge);
  return (
    <div className="linkgraph">
      <div className="row wrap">
        <h2 className="grow">Link chart</h2>
        <label className="small"><input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> show unlinked entities</label>
        <select value={kindFilter} onChange={(e) => setKindFilter(e.target.value)} aria-label="Filter by kind">
          <option value="">All kinds</option>
          {Object.keys(KIND_COLOUR).map((k) => <option key={k} value={k}>{k.replace("_", " ")}</option>)}
        </select>
        <button className="primary" onClick={() => setAdding({ from: "", to: "", evidence: [], kind: "", note: "" })}>+ Link</button>
        <button onClick={() => run(async () => setSuggestions(await call("links.suggest")))}>Suggest from data</button>
        <button onClick={() => svgRef.current && exportFile("file", { filename: "link-chart.svg", data_b64: svgToBase64(svgRef.current) })}>Export SVG</button>
        <button onClick={async () => svgRef.current && exportFile("file", { filename: "link-chart.png", data_b64: await svgToPngBase64(svgRef.current) })}>Export PNG</button>
      </div>
      <p className="muted small">Solid lines cite evidence. Dashed lines have none and are shown as assumptions. Drag nodes to arrange them.</p>
      <div className="graph-wrap">
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="graph" onMouseMove={onMove} onMouseUp={() => setDrag(null)} onMouseLeave={() => setDrag(null)} role="img" aria-label="Link chart">
          <rect width={W} height={H} fill="#fbfaf6" />
          {links.map((l) => {
            const a = pos[l.from], b = pos[l.to];
            if (!a || !b) return null;
            return (
              <g key={l.id} onClick={() => setSelectedEdge(l.id)} style={{ cursor: "pointer" }}>
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={selectedEdge === l.id ? "#c2410c" : "#4b5563"} strokeWidth={selectedEdge === l.id ? 3 : 2} strokeDasharray={l.evidence.length ? "" : "6 5"} />
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={12} />
                {l.type && <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 6} fontSize={10} textAnchor="middle" fill="#6b7280" stroke="#fbfaf6" strokeWidth={4} paintOrder="stroke">{l.type}</text>}
              </g>
            );
          })}
          {nodes.map((n) => {
            const p = pos[n.id];
            const c = KIND_COLOUR[n.kind] ?? "#334155";
            const shape = KIND_SHAPE[n.kind];
            return (
              <g key={n.id} transform={`translate(${p.x},${p.y})`} onMouseDown={() => setDrag(n.id)} style={{ cursor: "grab" }}>
                {shape === "circle" && <circle r={16} fill={c} />}
                {shape === "rect" && <rect x={-16} y={-13} width={32} height={26} rx={4} fill={c} />}
                {shape === "diamond" && <polygon points="0,-18 18,0 0,18 -18,0" fill={c} />}
                <text y={32} fontSize={12} textAnchor="middle" fill="#111827" fontWeight={600} stroke="#fbfaf6" strokeWidth={4} paintOrder="stroke">{n.label.length > 30 ? n.label.slice(0, 29) + "…" : n.label}</text>
                {n.role && <text y={42} fontSize={9} textAnchor="middle" fill="#6b7280">{n.role}</text>}
              </g>
            );
          })}
          <g transform={`translate(12,${H - 18})`}>
            {Object.entries(KIND_COLOUR).map(([k, c], i) => (
              <g key={k} transform={`translate(${i * 112},0)`}><rect width={10} height={10} fill={c} /><text x={14} y={9} fontSize={10} fill="#374151">{k.replace("_", " ")}</text></g>
            ))}
          </g>
        </svg>
        {nodes.length === 0 && <div className="graph-empty muted">No links yet. Add one, or tick "show unlinked entities".</div>}
      </div>
      {sel && (
        <div className="edge-detail">
          <b>{label(sel.from)}</b> ↔ <b>{label(sel.to)}</b> {sel.type && `(${sel.type})`} {sel.note && <span className="muted">· {sel.note}</span>}
          <div className="row wrap">{sel.evidence.length ? sel.evidence.map((e) => <Cite key={e} id={e} />) : <span className="warn-text small">No evidence: this link is an assumption.</span>}</div>
          <div className="row-end">
            <button className="small" onClick={() => setAdding({ from: sel.from, to: sel.to, evidence: sel.evidence, kind: sel.type, note: sel.note, ...{ id: sel.id } } as any)}>Edit</button>
            <button className="small danger" onClick={async () => { if (await confirm("Delete this link?", "Delete", "Delete")) { act({ type: "delete_link", id: sel.id }); setSelectedEdge(null); } }}>Delete</button>
          </div>
        </div>
      )}
      {suggestions && (
        <div className="suggestions">
          <h3>Suggestions from the data <span className="muted small">based on examined tables only</span></h3>
          <p className="muted small">These come from counting how often two identifiers appear in the same record. A suggestion is a lead, not a finding. Check it before you rely on it.</p>
          {suggestions.length === 0 && <p className="muted">No new suggestions. Examine more tables, or the strong links are already drawn.</p>}
          {suggestions.map((s, i) => (
            <div key={i} className="suggestion">
              <span className="grow"><b>{label(s.from)}</b> ↔ <b>{label(s.to)}</b> <span className="muted small">{s.reason} in {s.evidence.join(", ")}</span></span>
              <button className="small" onClick={() => setAdding({ from: s.from, to: s.to, evidence: s.evidence, kind: "", note: s.reason, suggested: true })}>Review and add</button>
            </div>
          ))}
        </div>
      )}
      {adding && (
        <Modal title={(adding as any).id ? "Edit link" : "Add link"} onClose={() => setAdding(null)}>
          <EntitySelect label="From" value={adding.from} onChange={(v) => setAdding({ ...adding, from: v })} />
          <EntitySelect label="To" value={adding.to} onChange={(v) => setAdding({ ...adding, to: v })} />
          <label className="field">Type of link<input value={adding.kind} onChange={(e) => setAdding({ ...adding, kind: e.target.value })} placeholder="for example: account holder, called, assigned to" /></label>
          <EvidencePicker value={adding.evidence} onChange={(v) => setAdding({ ...adding, evidence: v })} />
          <label className="field">Note<input value={adding.note} onChange={(e) => setAdding({ ...adding, note: e.target.value })} /></label>
          {adding.evidence.length === 0 && <p className="warn-text small">Without evidence this link will be drawn dashed, as an assumption.</p>}
          <div className="row-end">
            <button onClick={() => setAdding(null)}>Cancel</button>
            <button className="primary" disabled={!adding.from || !adding.to} onClick={async () => {
              const id = (adding as any).id;
              const r = await act({ type: id ? "update_link" : "add_link", id, from: adding.from, to: adding.to, kind: adding.kind, evidence: adding.evidence, note: adding.note, suggested: !!adding.suggested });
              if (r) { setAdding(null); if (suggestions) setSuggestions(suggestions.filter((s) => !(s.from === adding.from && s.to === adding.to))); }
            }}>Save link</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
