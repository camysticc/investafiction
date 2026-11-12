import { useEffect, useMemo, useRef, useState } from "react";
import { call, offerDownload, textToBase64 } from "../lib/api";
import { useApp } from "../lib/store";
import { useSetting } from "../lib/settings";
import { fmtDuration, fmtTime } from "../lib/util";
import { openHelp } from "../lib/nav";

type Marker = { seq: number; t: number; case_time: string; time: string; kind: string; label: string; caption: string; good: boolean | null; stage: string; severity?: string };
type ReplayData = {
  case: { id: string; title: string; estimated_minutes: number };
  attempt: { id: string; mode: string; started: string; submitted_at: string; active_seconds: number; score_settings: { hints_available: number; warnings: boolean } };
  total_seconds: number;
  markers: Marker[];
  missed: { id: string; statement: string; required: boolean; evidence: string[]; explain: string }[];
  stages: { id: string; title: string; start: number; end: number; minutes: number; target: number }[];
  stuck: string[];
  gaps: { after_seq: number; t: number; minutes: number }[];
  route: { stage: string; label: string; note: string; stage_start?: number }[];
  findings: { id: string; statement: string; type: string; evidence: string[]; created: string }[];
  custody: { evidence: string; action: string; case_time: string }[];
  result: any;
};

const KEY_KINDS = new Set(["start", "stage", "evidence", "key", "request", "hint", "trap", "integrity", "submit", "legality", "scope"]);
const SPEED: Record<string, number> = { slow: 2600, normal: 1500, fast: 700 };
const KIND_ICON: Record<string, string> = { start: "▶", stage: "◆", evidence: "📄", key: "★", finding: "✎", request: "✉", hint: "💡", trap: "⚠", integrity: "✓", statement: "⇄", legality: "§", submit: "■", scope: "◎" };

export default function Replay({ caseId, attemptId, onClose }: { caseId: string; attemptId: string; onClose: () => void }) {
  const { run, toast, profile } = useApp();
  const [data, setData] = useState<ReplayData | null>(null);
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  const speed = useSetting<string>("replay.replay_speed");
  const detail = useSetting<string>("replay.replay_detail");
  const showMistakes = useSetting<boolean>("replay.show_mistakes_on_the_replay");
  const showRoute = useSetting<boolean>("replay.show_suggested_route");
  const autostart = useSetting<boolean>("replay.start_replay_automatically");
  const [routeOpen, setRouteOpen] = useState(false);
  const trackRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    run(async () => {
      const d = await call<ReplayData>("replay", { case_id: caseId, attempt_id: attemptId });
      setData(d);
      if (autostart) setPlaying(true);
    });
  }, [caseId, attemptId]);

  const markers = useMemo(() => {
    if (!data) return [];
    return data.markers.filter((m) => (detail === "every_action" || KEY_KINDS.has(m.kind)) && (showMistakes || m.kind !== "trap"));
  }, [data, detail, showMistakes]);

  useEffect(() => {
    if (!playing) return;
    if (i >= markers.length - 1) {
      setPlaying(false);
      return;
    }
    const h = setTimeout(() => setI((x) => x + 1), SPEED[speed] ?? 1500);
    return () => clearTimeout(h);
  }, [playing, i, markers.length, speed]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setI((x) => Math.min(markers.length - 1, x + 1));
      if (e.key === "ArrowLeft") setI((x) => Math.max(0, x - 1));
      if (e.key === " " && (e.target as HTMLElement).tagName !== "BUTTON") { e.preventDefault(); setPlaying((p) => !p); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [markers.length]);

  if (!data) return <div className="replay-back"><div className="replay"><p>Building the replay from your action log…</p></div></div>;
  const m = markers[i];
  const T = Math.max(60, data.total_seconds);
  const W = 1000;
  // With very little recorded time, space moments evenly so they stay readable.
  const byOrder = data.total_seconds < 120;
  const orderPos = new Map(markers.map((mk, k) => [mk.t, k]));
  const x = (t: number) => (byOrder ? 20 + (((orderPos.get(t) ?? 0) + 0.5) / Math.max(1, markers.length)) * (W - 40) : 20 + (Math.min(t, T) / T) * (W - 40));
  const knownAt = m ? m.case_time : "";
  const findingsThen = data.findings.filter((f) => f.created <= knownAt);
  const loggedThen = new Set(data.custody.filter((c) => c.action === "received" && c.case_time <= knownAt).map((c) => c.evidence));
  const examinedThen = new Set(data.custody.filter((c) => c.action.startsWith("examined") && c.case_time <= knownAt).map((c) => c.evidence));
  const routeVisible = showRoute && routeOpen && data.route.length > 0;

  const exportMd = async () => {
    const lines = [
      `# Investigation replay: ${data.case.title}`,
      ``,
      `Analyst: ${profile?.name ?? "Analyst"} · ${data.attempt.mode} mode · ${fmtDuration(data.attempt.active_seconds)} worked (estimate ${data.case.estimated_minutes} min)`,
      data.result ? `Result: ${data.result.total} (${data.result.band})` : "",
      ``,
      `## Time in each stage`,
      ...data.stages.map((s) => `- ${s.title}: ${s.minutes} min (target ${s.target})${data.stuck.includes(s.id) ? " · longest over target" : ""}`),
      ``,
      `## Key moments`,
      ...markers.map((k) => `- ${fmtDuration(k.t)} · ${k.label}${k.good === false ? " (cost marks or time)" : ""}: ${k.caption}`),
      ``,
      `## Key findings missed`,
      ...(data.missed.length ? data.missed.map((k) => `- ${k.statement} (${k.evidence.slice(0, 3).join(", ")})`) : ["- None"]),
      ``,
      `*A personal practice record from Investafiction. Not an assessment or qualification.*`,
    ];
    const r: any = await run(() => call("data.write_file", { filename: `replay-${data.case.id}-${data.attempt.id}.md`, data_b64: textToBase64(lines.filter((l) => l !== undefined).join("\n")) }));
    if (r) { offerDownload(r.filename, r.data_b64); toast(`Replay summary saved to ${r.path}`, "good"); }
  };
  const exportPng = async () => {
    const svg = trackRef.current;
    if (!svg) return;
    const { svgToPngBase64 } = await import("../lib/util");
    const b64 = await svgToPngBase64(svg, 2);
    const r: any = await run(() => call("data.write_file", { filename: `replay-${data.case.id}-${data.attempt.id}.png`, data_b64: b64 }));
    if (r) { offerDownload(r.filename, r.data_b64); toast(`Replay image saved to ${r.path}`, "good"); }
  };

  return (
    <div className="replay-back" role="dialog" aria-modal="true" aria-label="Investigation replay">
      <div className="replay">
        <header className="rp-head">
          <div>
            <h2>Investigation replay: {data.case.title}</h2>
            <div className="muted small">{data.attempt.mode} mode · {fmtDuration(data.attempt.active_seconds)} worked · estimate {data.case.estimated_minutes} min{data.result ? ` · ${data.result.total} (${data.result.band})` : ""}</div>
          </div>
          <div className="row">
            <button onClick={() => openHelp("feature.replay")} className="ghost">?</button>
            <button onClick={exportMd}>Export Markdown</button>
            <button onClick={exportPng}>Export image</button>
            <button className="primary" onClick={onClose}>Close</button>
          </div>
        </header>

        <svg ref={trackRef} className="rp-track" viewBox={`0 0 ${W} ${routeVisible ? 150 : 100}`} style={{ aspectRatio: `${W} / ${routeVisible ? 150 : 100}`, width: "100%", flex: "none" }} role="img" aria-label={`Track of ${markers.length} key moments across ${data.stages.length} stages`}>
          <rect x="0" y="0" width={W} height={routeVisible ? 150 : 100} fill="#fbfaf6" />
          {!byOrder && data.stages.map((s, k) => (
            <g key={s.id}>
              <rect x={x(s.start)} y={22} width={Math.max(2, x(s.end) - x(s.start))} height={30} fill={k % 2 ? "#e6edf5" : "#dbe5f0"} stroke={data.stuck.includes(s.id) ? "#a15c07" : "none"} strokeWidth={2} />
              <text x={x(s.start) + 4} y={16} fontSize="11" fill="#44505e">{s.title}</text>
            </g>
          ))}
          {byOrder && <text x={20} y={16} fontSize="11" fill="#44505e">Moments in order (too little time was recorded to show them to scale)</text>}
          {data.gaps.map((g, k) => <rect key={k} x={x(g.t)} y={56} width={6} height={6} fill="#9aa4b1"><title>{`${g.minutes} minute gap`}</title></rect>)}
          {markers.map((mk, k) => (
            <g key={k} onClick={() => setI(k)} style={{ cursor: "pointer" }}>
              <line x1={byOrder ? 20 + ((k + 0.5) / markers.length) * (W - 40) : x(mk.t)} x2={byOrder ? 20 + ((k + 0.5) / markers.length) * (W - 40) : x(mk.t)} y1={22} y2={52} stroke={mk.good === false ? "#b3261e" : mk.good ? "#2f7a4f" : "#6b7480"} strokeWidth={k === i ? 3 : 1.4} />
              <circle cx={byOrder ? 20 + ((k + 0.5) / markers.length) * (W - 40) : x(mk.t)} cy={72} r={k === i ? 7 : 4.5} fill={mk.kind === "key" ? "#e8b04a" : mk.good === false ? "#b3261e" : mk.good ? "#2f7a4f" : "#6b7480"} />
            </g>
          ))}
          {routeVisible && (
            <g>
              <text x={6} y={108} fontSize="11" fill="#44505e">Suggested route</text>
              {data.route.map((r, k) => {
                const st = data.stages.find((s) => s.id === r.stage);
                const sameStage = data.route.filter((q) => q.stage === r.stage);
                const n = sameStage.indexOf(r);
                const rx = byOrder ? 20 + ((k + 0.5) / data.route.length) * (W - 40) : st ? x(st.start + ((st.end - st.start) * (n + 1)) / (sameStage.length + 1)) : 20 + (k * (W - 40)) / data.route.length;
                return <g key={k}><circle cx={rx} cy={128} r={5} fill="#7c3aed" /><title>{r.label}</title></g>;
              })}
            </g>
          )}
        </svg>

        <div className="rp-controls">
          <button onClick={() => setI(0)} aria-label="First moment">⏮</button>
          <button onClick={() => setI(Math.max(0, i - 1))} aria-label="Previous moment">◀</button>
          <button className="primary" onClick={() => setPlaying(!playing)}>{playing ? "Pause" : "Play"}</button>
          <button onClick={() => setI(Math.min(markers.length - 1, i + 1))} aria-label="Next moment">▶</button>
          <span className="muted small">Moment {markers.length ? i + 1 : 0} of {markers.length}</span>
          {showRoute && data.route.length > 0 && (
            <label className="small"><input type="checkbox" checked={routeOpen} onChange={(e) => setRouteOpen(e.target.checked)} /> Show the suggested route</label>
          )}
        </div>

        <div className="rp-body">
          <section className="rp-caption" aria-live="polite">
            {m ? (
              <>
                <div className="rp-when">{KIND_ICON[m.kind] ?? "•"} {fmtDuration(m.t)} into the case · case time {fmtTime(m.case_time)}</div>
                <h3 className={m.good === false ? "bad" : m.good ? "good" : ""}>{m.label}</h3>
                <p>{m.caption}</p>
              </>
            ) : <p>No moments to show.</p>}
            {routeVisible && (
              <div className="rp-route">
                <h4>One good route (not the only one)</h4>
                <ol>{data.route.map((r, k) => <li key={k}><b>{r.label}.</b> {r.note}</li>)}</ol>
              </div>
            )}
            {data.missed.length > 0 && (
              <div className="rp-missed">
                <h4>Key findings you did not reach</h4>
                <ul>{data.missed.map((k) => <li key={k.id}>{k.statement} <span className="muted small">({k.evidence.slice(0, 3).join(", ")})</span></li>)}</ul>
              </div>
            )}
          </section>
          <aside className="rp-state">
            <h4>What you knew at this point</h4>
            <div className="muted small">{loggedThen.size} items logged · {examinedThen.size} examined · {findingsThen.length} findings</div>
            <ul className="rp-findings">{findingsThen.map((f) => <li key={f.id}><span className={`ftype ${f.type}`}>{f.type}</span> {f.statement}</li>)}</ul>
            <h4>Time in each stage</h4>
            <table className="grid"><tbody>{data.stages.map((s) => <tr key={s.id} className={data.stuck.includes(s.id) ? "warn-row" : ""}><td>{s.title}</td><td>{s.minutes} min</td><td className="muted">target {s.target}</td></tr>)}</tbody></table>
            {data.gaps.length > 0 && <p className="muted small">{data.gaps.length} long gap{data.gaps.length === 1 ? "" : "s"} with no activity (10 minutes or more).</p>}
          </aside>
        </div>
      </div>
    </div>
  );
}
