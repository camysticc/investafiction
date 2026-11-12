import { useEffect, useMemo, useState } from "react";
import { call, offerDownload, textToBase64 } from "../lib/api";
import { useApp } from "../lib/store";
import { useSetting } from "../lib/settings";
import { openAcademy, openHelp, openReplay, openSettings } from "../lib/nav";
import { fmtTime } from "../lib/util";

type Rec = {
  attempt_id: string; case_id: string; case_title: string; difficulty: string; date: string; mode: string; total: number; band: string;
  categories: { key: string; label: string; points: number; weight: number }[]; skills: Record<string, number | null>;
  minutes: number; estimated_minutes: number; traps: { trap: string; title: string; category: string; severity: string }[];
  hints_used: number; score_settings: { hints_available: number; warnings: boolean };
};

export const AREAS: [string, string][] = [["osint", "OSINT"], ["evidence", "Evidence handling"], ["analysis", "Data analysis"], ["reporting", "Reporting"], ["procedure", "Procedure and ethics"]];
const LESSON_FOR: Record<string, [string, string]> = {
  osint: ["osint.capture", "feature.browser"],
  evidence: ["evidence.hashes", "concept.chain_of_custody"],
  analysis: ["analysis.timeline", "feature.timeline"],
  reporting: ["reporting.report", "feature.report"],
  procedure: ["procedure.necessity", "concept.necessity_proportionality"],
};

function Radar({ values, size = 340 }: { values: (number | null)[]; size?: number }) {
  const c = size / 2, r = size / 2 - 78;
  const pt = (k: number, v: number) => {
    const a = -Math.PI / 2 + (k * 2 * Math.PI) / AREAS.length;
    return [c + Math.cos(a) * r * v, c + Math.sin(a) * r * v];
  };
  const poly = values.map((v, k) => pt(k, (v ?? 0) / 100).join(",")).join(" ");
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label={`Skill radar: ${AREAS.map(([, l], k) => `${l} ${values[k] ?? "not assessed"}`).join(", ")}`}>
      {[0.25, 0.5, 0.75, 1].map((f) => <polygon key={f} points={AREAS.map((_, k) => pt(k, f).join(",")).join(" ")} fill="none" stroke="var(--line)" />)}
      {AREAS.map(([, l], k) => {
        const [x, y] = pt(k, 1.18);
        return <text key={l} x={x} y={y} fontSize="11" textAnchor="middle" fill="var(--ink-2)">{l}</text>;
      })}
      <polygon points={poly} fill="color-mix(in srgb, var(--primary) 30%, transparent)" stroke="var(--primary)" strokeWidth="2" />
    </svg>
  );
}

export default function Progress() {
  const { run, toast, profile, confirm } = useApp();
  const [recs, setRecs] = useState<Rec[] | null>(null);
  const [caseF, setCaseF] = useState("all");
  const [modeF, setModeF] = useState("all");
  const range = useSetting<string>("replay.dashboard_range");
  const chart = useSetting<string>("replay.dashboard_chart_style");
  const bestAssessOnly = useSetting<boolean>("replay.best_scores_count_assessment_mode_only");
  const showNext = useSetting<boolean>("replay.show_suggested_next_steps");
  const load = () => run(async () => setRecs((await call<{ attempts: Rec[] }>("history.get")).attempts));
  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => (recs ?? []).filter((r) => (caseF === "all" || r.case_id === caseF) && (modeF === "all" || r.mode === modeF)).sort((a, b) => a.date.localeCompare(b.date)), [recs, caseF, modeF]);
  const n = range === "last_5_attempts" ? 5 : range === "last_10" ? 10 : 9999;
  const recent = filtered.slice(-n);
  const avg = AREAS.map(([k]) => {
    const vs = recent.map((r) => r.skills?.[k]).filter((v): v is number => typeof v === "number");
    return vs.length ? Math.round(vs.reduce((a, b) => a + b, 0) / vs.length) : null;
  });
  const cases = [...new Map((recs ?? []).map((r) => [r.case_id, r.case_title])).entries()];
  const best = cases.map(([id, title]) => {
    const pool = (recs ?? []).filter((r) => r.case_id === id && (!bestAssessOnly || r.mode === "assessment"));
    return { id, title, best: pool.length ? Math.max(...pool.map((r) => r.total)) : null };
  });
  const trapCounts = new Map<string, number>();
  for (const r of recent) for (const t of r.traps) trapCounts.set(t.title, (trapCounts.get(t.title) ?? 0) + 1);
  const traps = [...trapCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);

  // Plain language suggestions: the lowest area across recent attempts, and repeated traps
  const next: { text: string; lesson: string; article: string }[] = [];
  const scored = AREAS.map(([k, l], i) => ({ k, l, v: avg[i] })).filter((x) => x.v !== null) as { k: string; l: string; v: number }[];
  if (scored.length) {
    const low = scored.sort((a, b) => a.v - b.v)[0];
    const lowCount = recent.filter((r) => {
      const vals = AREAS.map(([k]) => ({ k, v: r.skills?.[k] })).filter((x) => typeof x.v === "number") as { k: string; v: number }[];
      return vals.length && vals.sort((a, b) => a.v - b.v)[0].k === low.k;
    }).length;
    next.push({ text: `${low.l} has been your lowest area${lowCount > 1 ? ` in ${lowCount} attempts` : ""} (average ${low.v}).`, lesson: LESSON_FOR[low.k][0], article: LESSON_FOR[low.k][1] });
  }
  if (traps[0] && traps[0][1] > 1) next.push({ text: `"${traps[0][0]}" has come up ${traps[0][1]} times. It is worth practising the habit behind it.`, lesson: "procedure.traps", article: "concept.procedural_traps" });
  const slow = recent.filter((r) => r.minutes > r.estimated_minutes * 1.3).length;
  if (slow >= 2) next.push({ text: `${slow} recent attempts ran well over the time estimate. The replay shows where the time went.`, lesson: "procedure.traps", article: "feature.replay" });

  const exportSummary = async () => {
    const lines = [
      `# Progress summary`, ``, `Analyst: ${profile?.name ?? "Analyst"} · ${recent.length} attempt(s) in view · ${fmtTime(new Date())}`, ``,
      `## Skill areas (average)`, ...AREAS.map(([, l], i) => `- ${l}: ${avg[i] ?? "not assessed"}`), ``,
      `## Best scores${bestAssessOnly ? " (assessment mode only)" : ""}`, ...best.map((b) => `- ${b.title}: ${b.best ?? "none yet"}`), ``,
      `## Most common mistakes`, ...(traps.length ? traps.map(([t, c]) => `- ${t}: ${c}`) : ["- None"]), ``,
      `*A personal practice record from Investafiction. It is not an assessment or a qualification.*`,
    ];
    const r: any = await run(() => call("data.write_file", { filename: "investafiction-progress.md", data_b64: textToBase64(lines.join("\n")) }));
    if (r) { offerDownload(r.filename, r.data_b64); toast(`Progress summary saved to ${r.path}`, "good"); }
  };

  if (recs === null) return <main className="progress-page"><p>Loading…</p></main>;
  return (
    <main className="progress-page" data-help="area.progress">
      <header className="pg-head">
        <div>
          <h1>Your progress</h1>
          <p className="muted">A private record of how you are doing across the skills the program teaches. It is stored only on this computer. There are no leaderboards.</p>
        </div>
        <div className="row">
          <select value={caseF} onChange={(e) => setCaseF(e.target.value)} aria-label="Filter by case"><option value="all">All cases</option>{cases.map(([id, t]) => <option key={id} value={id}>{t}</option>)}</select>
          <select value={modeF} onChange={(e) => setModeF(e.target.value)} aria-label="Filter by mode"><option value="all">Both modes</option><option value="training">Training</option><option value="assessment">Assessment</option></select>
          <button onClick={exportSummary} disabled={!recent.length}>Export summary</button>
          <button className="ghost" onClick={() => openSettings("replay")}>Dashboard settings</button>
          <button className="ghost" onClick={() => openHelp("feature.dashboard")}>?</button>
        </div>
      </header>
      {!recs.length ? (
        <div className="empty big-empty">
          <h3>No submitted attempts yet</h3>
          <p>Finish a case and submit your report. Your scores, skill areas and common mistakes will appear here. Not sure where to start? Try the <button className="linklike" onClick={() => openAcademy(null)}>Academy</button>.</p>
        </div>
      ) : (
        <div className="pg-grid">
          <section className="pg-card">
            <h2>Skill areas</h2>
            <p className="muted small">Average over {recent.length} attempt{recent.length === 1 ? "" : "s"}{range !== "all" ? " (change the range in settings)" : ""}. Training and assessment are {modeF === "all" ? "both included; filter to compare fairly" : `filtered to ${modeF}`}.</p>
            {chart === "radar" ? <Radar values={avg} /> : (
              <div className="bars" role="img" aria-label={AREAS.map(([, l], i) => `${l} ${avg[i] ?? "not assessed"}`).join(", ")}>
                {AREAS.map(([k, l], i) => <div key={k} className="bar-row"><span>{l}</span><div className="bar"><div style={{ width: `${avg[i] ?? 0}%` }} /></div><b>{avg[i] ?? "n/a"}</b></div>)}
              </div>
            )}
          </section>
          <section className="pg-card">
            <h2>Overall score</h2>
            <Trend recs={filtered} />
            <h3>Best scores{bestAssessOnly ? " (assessment only)" : ""}</h3>
            <ul className="plain">{best.map((b) => <li key={b.id}>{b.title}: <b>{b.best ?? "none yet"}</b></li>)}</ul>
          </section>
          {showNext && (
            <section className="pg-card">
              <h2>Suggested next steps</h2>
              {next.length ? (
                <ul className="next-steps">
                  {next.map((s, k) => (
                    <li key={k}>{s.text} <button className="linklike" onClick={() => openAcademy(s.lesson)}>Academy lesson</button> · <button className="linklike" onClick={() => openHelp(s.article)}>Help article</button></li>
                  ))}
                </ul>
              ) : <p className="muted">Nothing stands out yet. Keep going.</p>}
            </section>
          )}
          <section className="pg-card">
            <h2>Common mistakes</h2>
            {traps.length ? <table className="grid"><tbody>{traps.map(([t, c]) => <tr key={t}><td>{t}</td><td><b>{c}</b></td></tr>)}</tbody></table> : <p className="muted">No procedural traps in the attempts shown.</p>}
          </section>
          <section className="pg-card wide">
            <h2>Attempts</h2>
            <table className="grid">
              <thead><tr><th>Case</th><th>Date</th><th>Mode</th><th>Score</th><th>Time</th><th>Settings that affect the score</th><th /></tr></thead>
              <tbody>
                {[...filtered].reverse().map((r) => (
                  <tr key={r.attempt_id}>
                    <td>{r.case_title}</td><td>{fmtTime(r.date)}</td><td>{r.mode}</td><td><b>{r.total}</b> {r.band}</td>
                    <td className={r.minutes > r.estimated_minutes ? "warn-text" : ""}>{r.minutes} min <span className="muted">/ {r.estimated_minutes}</span></td>
                    <td className="small">{r.mode === "assessment" ? "No hints or warnings" : `Hints: ${["none", "level 1", "levels 1 and 2", "all three"][r.score_settings?.hints_available ?? 3]} · warnings ${r.score_settings?.warnings ? "on" : "off"} · ${r.hints_used} used`}</td>
                    <td><button className="small" onClick={() => openReplay(r.case_id, r.attempt_id)}>Replay</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="row-end">
              <button className="ghost danger" onClick={async () => {
                if (await confirm("Clear the history behind this dashboard? Your case saves are not touched.", "Reset progress history", "Reset")) {
                  await run(() => call("history.reset"));
                  load();
                }
              }}>Reset history</button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

function Trend({ recs }: { recs: Rec[] }) {
  if (recs.length < 2) return <p className="muted small">The trend line appears after two attempts.</p>;
  const W = 420, H = 140, pad = 24;
  const xs = (i: number) => pad + (i * (W - 2 * pad)) / (recs.length - 1);
  const ys = (v: number) => H - pad - (v / 100) * (H - 2 * pad);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="trend" role="img" aria-label={`Scores over time: ${recs.map((r) => r.total).join(", ")}`}>
      {[55, 70, 85].map((b) => <line key={b} x1={pad} x2={W - pad} y1={ys(b)} y2={ys(b)} stroke="var(--line)" strokeDasharray="3 3" />)}
      <polyline fill="none" stroke="var(--primary)" strokeWidth="2.5" points={recs.map((r, i) => `${xs(i)},${ys(r.total)}`).join(" ")} />
      {recs.map((r, i) => <circle key={i} cx={xs(i)} cy={ys(r.total)} r={4} fill={r.mode === "assessment" ? "var(--primary)" : "var(--panel)"} stroke="var(--primary)" strokeWidth="2"><title>{`${r.case_title}: ${r.total} (${r.mode})`}</title></circle>)}
    </svg>
  );
}
