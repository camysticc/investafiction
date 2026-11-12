import { useEffect, useRef, useState } from "react";
import { ApiError, call, fileToBase64 } from "../lib/api";
import { useApp } from "../lib/store";
import type { LibraryCase } from "../lib/types";
import { fmtDuration, fmtTime } from "../lib/util";
import { Modal } from "./common";
import { openAcademy, openQuickIntro, openReplay } from "../lib/nav";
import { useProgress, totalXp, rankFor } from "../lib/progress";
import { get as setting, set as setSetting, useSetting } from "../lib/settings";

export default function Library() {
  const { setGame, run, toast, confirm } = useApp();
  const [cases, setCases] = useState<LibraryCase[] | null>(null);
  const [inspect, setInspect] = useState<any>(null);
  const [errors, setErrors] = useState<{ message: string; details: string[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const mode = useSetting<"training" | "assessment">("gameplay.mode");
  const setMode = (m: "training" | "assessment") => setSetting("gameplay.mode", m);
  const sortBy = useSetting<string>("library.sort_by");
  const view = useSetting<string>("library.view");
  const showDiff = useSetting<boolean>("library.show_difficulty_badges");
  const showTime = useSetting<boolean>("library.show_time_estimates");
  const showDone = useSetting<boolean>("library.show_completed_cases");
  const confirmRemove = useSetting<boolean>("library.confirm_before_removing_a_case");
  const allowRetry = useSetting<boolean>("gameplay.allow_retry_after_submission");
  const fileRef = useRef<HTMLInputElement>(null);
  const progress = useProgress();

  const load = () => run(async () => setCases((await call("library.list")).cases));
  useEffect(() => {
    load();
  }, []);

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".invcase")) {
      setErrors({ message: "That is not a case pack.", details: ["Case packs are single files ending in .invcase."] });
      return;
    }
    setBusy(true);
    try {
      const b64 = await fileToBase64(f);
      setInspect(await call("pack.inspect", { data_b64: b64 }));
    } catch (e) {
      if (e instanceof ApiError) setErrors({ message: e.message, details: e.details });
      else setErrors({ message: String(e), details: [] });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const open = (caseId: string, attemptId: string) => run(async () => setGame(await call("attempt.open", { case_id: caseId, attempt_id: attemptId })));
  const start = (caseId: string) =>
    run(async () => {
      const hints = { none: 0, level_1_only: 1, levels_1_and_2: 2, all_three: 3 }[setting<string>("gameplay.hints_available")] ?? 3;
      const r = await call("attempt.new", { case_id: caseId, mode, hints_available: hints, warnings: setting<boolean>("gameplay.procedural_warnings") });
      setGame(await call("attempt.open", { case_id: caseId, attempt_id: r.attempt_id }));
    });

  return (
    <main className="library">
      <div className="library-head">
        <div>
          <h1>Case library</h1>
          <p className="muted">Import a case pack, then start or resume an attempt. Each case can be attempted as many times as you like.</p>
        </div>
        <div className="row">
          <div className="seg" role="radiogroup" aria-label="Mode for new attempts">
            <button role="radio" aria-checked={mode === "training"} className={mode === "training" ? "on" : ""} onClick={() => setMode("training")}>
              Training
            </button>
            <button role="radio" aria-checked={mode === "assessment"} className={mode === "assessment" ? "on" : ""} onClick={() => setMode("assessment")}>
              Assessment
            </button>
          </div>
          <button onClick={() => openAcademy(null)} title="Lessons, a practice case, XP and badges">
            🎓 Academy · {rankFor(totalXp(progress)).name}
          </button>
          <button className="primary" disabled={busy} onClick={() => fileRef.current?.click()}>
            {busy ? "Checking pack…" : "Import case pack"}
          </button>
          <input ref={fileRef} type="file" accept=".invcase" hidden onChange={(e) => onFile(e.target.files?.[0])} />
        </div>
      </div>
      {!progress.practice.done && (
        <div className="banner academy-banner" data-help="area.academy">
          <span>🎓 <b>New here?</b> The Academy teaches the desk in short, hands-on lessons with a safe practice case. It is optional and never affects case scores.</span>
          <div className="row">
            {progress.academy !== "done" && <button onClick={openQuickIntro}>{progress.academy === "started" ? "Resume the quick intro" : "Five minute quick intro"}</button>}
            <button className="primary" onClick={() => openAcademy(null)}>Begin the Academy</button>
          </div>
        </div>
      )}
      <p className="mode-note muted">
        {mode === "training" ? "Training mode: three levels of hint (each costs a few marks) and a warning before any procedural mistake." : "Assessment mode: no hints or warnings. You see your feedback only after you submit."}
      </p>
      {cases === null ? (
        <p>Loading…</p>
      ) : cases.filter((c) => c.difficulty !== "Training").length === 0 ? (
        <div className="empty big-empty">
          <h3>No cases yet</h3>
          <p>Choose Import case pack and pick a .invcase file. The starter pack has three cases: The Ledger, The Last Signal and Quiet Exit.</p>
        </div>
      ) : (
        <div className={`case-grid ${view === "list" ? "as-list" : ""}`} data-help="area.library">
          {[...cases]
            .filter((c) => c.difficulty !== "Training")
            .filter((c) => showDone || !c.attempts.some((a) => a.submitted))
            .sort((a, b) => {
              const ord: Record<string, number> = { Beginner: 1, Intermediate: 2, Hard: 3 };
              if (sortBy === "title") return a.title.localeCompare(b.title);
              if (sortBy === "difficulty") return (ord[a.difficulty] ?? 0) - (ord[b.difficulty] ?? 0);
              if (sortBy === "time") return a.estimated_minutes - b.estimated_minutes;
              const la = a.attempts[0]?.updated ?? "", lb = b.attempts[0]?.updated ?? "";
              return lb.localeCompare(la);
            })
            .map((c) => (
            <article key={c.id} className="case-card">
              {showDiff && <div className={`diff diff-${c.difficulty.toLowerCase()}`}>{c.difficulty}</div>}
              <h2>{c.title}</h2>
              <div className="muted small">{c.specialty}{showTime ? ` · about ${Math.round((c.estimated_minutes / 60) * 10) / 10} hours` : ""} · v{c.version}</div>
              <p>{c.summary}</p>
              <div className="row">
                <button className="primary" disabled={!allowRetry && c.attempts.some((a) => a.submitted)} title={!allowRetry && c.attempts.some((a) => a.submitted) ? "Retries are switched off in settings" : ""} onClick={() => start(c.id)}>
                  New {mode} attempt
                </button>
                <button
                  className="ghost small"
                  onClick={async () => {
                    if (!confirmRemove || await confirm(`Remove ${c.title} from the library? Your saved attempts are kept and will work again if you re-import the pack.`, "Remove case", "Remove")) {
                      await run(() => call("pack.remove", { case_id: c.id }));
                      load();
                    }
                  }}
                >
                  Remove
                </button>
              </div>
              {c.attempts.length > 0 && (
                <table className="attempts">
                  <thead>
                    <tr>
                      <th>Attempt</th>
                      <th>Mode</th>
                      <th>Progress</th>
                      <th>Time</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {c.attempts.map((a) => (
                      <tr key={a.id}>
                        <td>{fmtTime(a.updated)}</td>
                        <td>{a.mode}</td>
                        <td>{a.submitted ? <b>{a.score} · {a.band}</b> : a.stage ? `Stage ${a.stage.slice(1)}` : "Not started"}</td>
                        <td>{fmtDuration(a.active_seconds)}</td>
                        <td className="actions-cell">
                          <button className="small" onClick={() => open(c.id, a.id)}>
                            {a.submitted ? "Debrief" : "Resume"}
                          </button>
                          {a.submitted && <button className="small" onClick={() => openReplay(c.id, a.id)}>Replay</button>}
                          <button
                            className="ghost small"
                            aria-label="Delete attempt"
                            onClick={async () => {
                              if (await confirm("Delete this attempt? This cannot be undone.", "Delete attempt", "Delete")) {
                                await run(() => call("attempt.delete", { case_id: c.id, attempt_id: a.id }));
                                load();
                              }
                            }}
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </article>
          ))}
        </div>
      )}
      {inspect && (
        <Modal title="Check this case pack" onClose={() => { call("pack.cancel", { token: inspect.token }); setInspect(null); }}>
          <div className="pack-ok">✓ The pack passed every check: safe paths, file types and sizes, the manifest hash of every file, the schemas and the cross references.</div>
          <dl className="kv">
            <dt>Title</dt><dd>{inspect.summary.title}</dd>
            <dt>Specialty</dt><dd>{inspect.summary.specialty}</dd>
            <dt>Difficulty</dt><dd>{inspect.summary.difficulty}</dd>
            <dt>Estimated time</dt><dd>about {Math.round(inspect.summary.estimated_minutes / 6) / 10} hours</dd>
            <dt>Evidence items</dt><dd>{inspect.summary.items}</dd>
            <dt>Stages</dt><dd>{inspect.summary.stages}</dd>
            <dt>Web pages</dt><dd>{inspect.summary.osint_pages}</dd>
            <dt>Author</dt><dd>{inspect.summary.author}</dd>
            <dt>Licence</dt><dd>{inspect.summary.licence}</dd>
          </dl>
          {setting("privacy.warn_before_opening_packs_from_other_authors") && inspect.summary.author !== "Investafiction starter pack" && <p className="warn-box">This pack was made by <b>{inspect.summary.author || "an unknown author"}</b>, not the starter pack authors. It passed every safety check, but its content has not been reviewed.</p>}
          {inspect.already_installed && <p className="warn-box">This case is already in your library (version {inspect.installed_version}). Importing replaces the case files. Your saved attempts are kept.</p>}
          {inspect.summary.warnings.length > 0 && <details><summary>{inspect.summary.warnings.length} note(s)</summary><ul>{inspect.summary.warnings.map((w: string) => <li key={w}>{w}</li>)}</ul></details>}
          <div className="row-end">
            <button onClick={() => { call("pack.cancel", { token: inspect.token }); setInspect(null); }}>Cancel</button>
            <button
              className="primary"
              onClick={() => run(async () => {
                await call("pack.install", { token: inspect.token });
                toast(`${inspect.summary.title} added to the library.`, "good");
                setInspect(null);
                load();
              })}
            >
              Add to library
            </button>
          </div>
        </Modal>
      )}
      {errors && (
        <Modal title="The pack was not imported" onClose={() => setErrors(null)}>
          <p><b>{errors.message}</b></p>
          <ul className="error-list">{errors.details.map((d, i) => <li key={i}>{d}</li>)}</ul>
          <p className="muted">Packs are checked before anything is unpacked into the library. Nothing has been added.</p>
        </Modal>
      )}
    </main>
  );
}
