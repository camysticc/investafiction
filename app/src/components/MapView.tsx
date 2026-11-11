import { useEffect, useMemo, useState } from "react";
import { call } from "../lib/api";
import { useApp } from "../lib/store";
import { fmtTime, parseTime } from "../lib/util";
import { Empty } from "./common";

type Pt = { evidence: string; time: string; x: number; y: number; label: string; entity?: string; description: string; offset: number };

const AREA_FILL: Record<string, string> = { park: "#d9ead3", water: "#cfe2f3", industrial: "#e3dcd2", residential: "#efe9df", commercial: "#eadfd0", woodland: "#c9dfc0", retail: "#f1e2d0" };
const PT_COLOURS = ["#1f4e79", "#c2410c", "#0f766e", "#7c3aed", "#b45309", "#be123c", "#4d7c0f", "#0369a1"];

export default function MapView() {
  const { game, run } = useApp();
  const map = game!.case.map;
  const [pts, setPts] = useState<Pt[]>([]);
  const [hidden, setHidden] = useState<string[]>([]);
  const [corrected, setCorrected] = useState(true);
  const [coverage, setCoverage] = useState(true);
  const [windowMins, setWindowMins] = useState(60);
  const [t, setT] = useState<number | null>(null);
  const [allTime, setAllTime] = useState(true);
  const [measure, setMeasure] = useState<{ x: number; y: number }[]>([]);
  const [hover, setHover] = useState<Pt | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragFrom, setDragFrom] = useState<{ x: number; y: number; px: number; py: number } | null>(null);
  useEffect(() => {
    run(async () => setPts(await call("map.points")));
  }, [game!.case.evidence.length]);
  const sources = useMemo(() => [...new Set(pts.map((p) => p.evidence))], [pts]);
  const timeOf = (p: Pt) => (parseTime(p.time)?.getTime() ?? 0) - (corrected ? p.offset * 60000 : 0);
  const times = pts.map(timeOf).filter((x) => x > 0);
  const tMin = Math.min(...times), tMax = Math.max(...times);
  useEffect(() => {
    if (t === null && times.length) setT(tMin);
  }, [times.length]);
  if (!map) return <Empty><h3>No map for this case</h3><p>This case has no location data. The map is used in cases with phone locations, cameras or cell sites.</p></Empty>;
  const W = map.width, H = map.height;
  const vbW = W / zoom, vbH = H / zoom;
  const vbX = Math.max(0, Math.min(W - vbW, (W - vbW) / 2 + pan.x));
  const vbY = Math.max(0, Math.min(H - vbH, (H - vbH) / 2 + pan.y));
  const visible = pts.filter((p) => !hidden.includes(p.evidence) && (allTime || t === null || Math.abs(timeOf(p) - t) <= windowMins * 60000));
  const colourOf = (ev: string) => PT_COLOURS[sources.indexOf(ev) % PT_COLOURS.length];
  const dist = measure.length === 2 ? Math.hypot(measure[0].x - measure[1].x, measure[0].y - measure[1].y) : null;
  const toMap = (e: React.MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: vbX + ((e.clientX - r.left) / r.width) * vbW, y: vbY + ((e.clientY - r.top) / r.height) * vbH };
  };
  const evTitle = (id: string) => game!.case.evidence.find((e) => e.id === id)?.title ?? id;
  return (
    <div className="mapview">
      <div className="row wrap">
        <h2 className="grow">{map.name} <span className="muted small">fictional map, metres</span></h2>
        <label className="small"><input type="checkbox" checked={coverage} onChange={(e) => setCoverage(e.target.checked)} /> cell coverage</label>
        <label className="small"><input type="checkbox" checked={corrected} onChange={(e) => setCorrected(e.target.checked)} /> apply recorded clock offsets</label>
        <button className="small" onClick={() => setZoom(Math.min(6, zoom * 1.5))}>Zoom in</button>
        <button className="small" onClick={() => { setZoom(Math.max(1, zoom / 1.5)); if (zoom / 1.5 <= 1) setPan({ x: 0, y: 0 }); }}>Zoom out</button>
        <button className="small" onClick={() => setMeasure([])}>{measure.length ? "Clear distance" : "Distance: click two points"}</button>
      </div>
      <div className="map-layout">
        <div className="map-wrap">
          <svg
            viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
            className="map"
            onClick={(e) => { if (dragFrom && Math.abs(e.clientX - dragFrom.x) > 4) return; const p = toMap(e); setMeasure((m) => (m.length >= 2 ? [p] : [...m, p])); }}
            onMouseDown={(e) => setDragFrom({ x: e.clientX, y: e.clientY, px: pan.x, py: pan.y })}
            onMouseMove={(e) => { if (dragFrom && e.buttons === 1 && zoom > 1) { const r = e.currentTarget.getBoundingClientRect(); setPan({ x: dragFrom.px - ((e.clientX - dragFrom.x) / r.width) * vbW, y: dragFrom.py - ((e.clientY - dragFrom.y) / r.height) * vbH }); } }}
            onMouseUp={() => setTimeout(() => setDragFrom(null), 0)}
            role="img"
            aria-label="Map"
          >
            <rect width={W} height={H} fill="#f6f3ec" />
            {map.features.filter((f) => f.kind === "area").map((f, i) => <polygon key={i} points={f.points.map((p: number[]) => p.join(",")).join(" ")} fill={AREA_FILL[f.style] ?? "#eee"} stroke="#d6cfc2" />)}
            {map.features.filter((f) => f.kind === "river").map((f, i) => <polyline key={i} points={f.points.map((p: number[]) => p.join(",")).join(" ")} fill="none" stroke="#9cc3e6" strokeWidth={40} strokeLinecap="round" />)}
            {map.features.filter((f) => f.kind === "building").map((f, i) => <polygon key={i} points={f.points.map((p: number[]) => p.join(",")).join(" ")} fill="#d8d2c6" stroke="#b7ae9f" />)}
            {map.features.filter((f) => f.kind === "rail").map((f, i) => <polyline key={i} points={f.points.map((p: number[]) => p.join(",")).join(" ")} fill="none" stroke="#6b7280" strokeWidth={8} strokeDasharray="30 20" />)}
            {map.features.filter((f) => f.kind === "major_road" || f.kind === "road").map((f, i) => (
              <g key={i}>
                <polyline points={f.points.map((p: number[]) => p.join(",")).join(" ")} fill="none" stroke="#c9bfae" strokeWidth={f.kind === "major_road" ? 34 : 20} strokeLinecap="round" strokeLinejoin="round" />
                <polyline points={f.points.map((p: number[]) => p.join(",")).join(" ")} fill="none" stroke={f.kind === "major_road" ? "#f2d79b" : "#ffffff"} strokeWidth={f.kind === "major_road" ? 26 : 14} strokeLinecap="round" strokeLinejoin="round" />
              </g>
            ))}
            {map.features.filter((f) => f.kind !== "area" && f.points?.length).map((f, i) => {
              const p = f.points[Math.floor(f.points.length / 2)];
              return <text key={"l" + i} x={p[0]} y={p[1] - 18} fontSize={f.kind === "label" ? 60 : 38} fill="#6b6152" textAnchor="middle" fontStyle={f.kind === "area" ? "italic" : "normal"}>{f.name}</text>;
            })}
            {map.features.filter((f) => f.kind === "area").map((f, i) => {
              const xs = f.points.map((p: number[]) => p[0]), ys = f.points.map((p: number[]) => p[1]);
              return <text key={"a" + i} x={(Math.min(...xs) + Math.max(...xs)) / 2} y={(Math.min(...ys) + Math.max(...ys)) / 2} fontSize={44} fill="#8a8172" textAnchor="middle" fontStyle="italic">{f.name}</text>;
            })}
            {map.locations.map((l) => (
              <g key={l.id}>
                {l.kind === "cell_site" && coverage && l.radius && <circle cx={l.x} cy={l.y} r={l.radius} fill="#0f766e" fillOpacity={0.06} stroke="#0f766e" strokeOpacity={0.4} strokeDasharray="20 14" strokeWidth={6} />}
                {l.kind === "camera" && <rect x={l.x - 34} y={l.y - 34} width={68} height={68} fill="#111827" rx={10} />}
                {l.kind === "cell_site" && <polygon points={`${l.x},${l.y - 52} ${l.x + 40},${l.y + 34} ${l.x - 40},${l.y + 34}`} fill="#0f766e" />}
                {l.kind === "address" && <circle cx={l.x} cy={l.y} r={34} fill="#4d7c0f" />}
                {l.kind === "point" && <circle cx={l.x} cy={l.y} r={26} fill="#6b7280" />}
                <text x={l.x + 48} y={l.y + 18} fontSize={58 / Math.sqrt(zoom)} fill="#111827" fontWeight={600} stroke="#f6f3ec" strokeWidth={10 / Math.sqrt(zoom)} paintOrder="stroke">{l.label}</text>
              </g>
            ))}
            {visible.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={44 / Math.sqrt(zoom)} fill={colourOf(p.evidence)} fillOpacity={0.85} stroke="#fff" strokeWidth={8} onMouseEnter={() => setHover(p)} onMouseLeave={() => setHover(null)} />
            ))}
            {measure.map((m, i) => <circle key={"m" + i} cx={m.x} cy={m.y} r={18} fill="#c2410c" />)}
            {measure.length === 2 && <line x1={measure[0].x} y1={measure[0].y} x2={measure[1].x} y2={measure[1].y} stroke="#c2410c" strokeWidth={8} strokeDasharray="24 14" />}
            <g transform={`translate(${vbX + vbW - 560 / zoom},${vbY + vbH - 80 / zoom}) scale(${1 / zoom})`}>
              <rect width={520} height={50} fill="#fff" fillOpacity={0.8} />
              <line x1={20} x2={520} y1={30} y2={30} stroke="#111" strokeWidth={6} />
              <text x={20} y={22} fontSize={22}>0</text>
              <text x={470} y={22} fontSize={22}>{Math.round(500 / zoom)} m</text>
            </g>
          </svg>
          {hover && (
            <div className="map-tip">
              <b>{hover.evidence}</b> {fmtTime(new Date(timeOf(hover)))} UTC{corrected && hover.offset ? " (corrected)" : ""}
              <div>{hover.label} {hover.description}</div>
            </div>
          )}
          {dist !== null && <div className="map-dist">Distance: <b>{Math.round(dist)} m</b> · about {Math.round(dist / 80)} min on foot, {Math.max(1, Math.round(dist / 500))} min by car in town</div>}
        </div>
        <aside className="map-side">
          <h4>Layers</h4>
          {sources.length === 0 && <p className="muted small">No location data released yet.</p>}
          {sources.map((s) => (
            <label key={s} className="layer">
              <input type="checkbox" checked={!hidden.includes(s)} onChange={(e) => setHidden(e.target.checked ? hidden.filter((h) => h !== s) : [...hidden, s])} />
              <span className="swatch" style={{ background: colourOf(s) }} /> <b>{s}</b> {evTitle(s)}
            </label>
          ))}
          <h4>Key</h4>
          <div className="small"><span className="key cam" /> Camera <span className="key cell" /> Cell site <span className="key addr" /> Address</div>
        </aside>
      </div>
      {times.length > 0 && (
        <div className="slider">
          <label className="small"><input type="checkbox" checked={allTime} onChange={(e) => setAllTime(e.target.checked)} /> show all times</label>
          <input type="range" min={tMin} max={tMax} step={60000} value={t ?? tMin} disabled={allTime} onChange={(e) => setT(Number(e.target.value))} aria-label="Time slider" className="grow" />
          <span className="small"><b>{fmtTime(new Date(t ?? tMin))}</b> UTC ± </span>
          <select value={windowMins} disabled={allTime} onChange={(e) => setWindowMins(Number(e.target.value))} aria-label="Time window">
            {[10, 30, 60, 180, 720].map((m) => <option key={m} value={m}>{m >= 60 ? `${m / 60} h` : `${m} min`}</option>)}
          </select>
          <span className="muted small">{visible.length} points</span>
        </div>
      )}
    </div>
  );
}
