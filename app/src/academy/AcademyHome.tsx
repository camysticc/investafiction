import { useEffect, useState } from "react";
import { useApp } from "../lib/store";
import { BADGES, RANKS, XP, award, rankFor, totalXp, updateProgress, useProgress, getProgress } from "../lib/progress";
import { openHelp, openQuickIntro, useNav, openAcademy } from "../lib/nav";
import { TRACKS, lessonById, trackOf, type Lesson } from "./content";
import { openSandbox, resumePractice, startPractice, useSandbox, setSandbox } from "./sandbox";
import { TryIt, Picture } from "./widgets";
import { playSound } from "../lib/settings";

export default function AcademyHome() {
  const nav = useNav();
  const p = useProgress();
  const { run, setGame } = useApp();
  const xp = totalXp(p);
  const rank = rankFor(xp);
  const nextRank = RANKS.find((r) => r.min > xp);
  const lesson = nav.lesson ? lessonById(nav.lesson) : null;
  const lessonsDone = Object.values(p.lessons).filter((l) => l.done).length;
  const total = TRACKS.reduce((a, t) => a + t.lessons.length, 0);

  if (lesson) return <LessonPlayer lesson={lesson} onExit={() => openAcademy(null)} />;

  const pct = nextRank ? Math.round(((xp - rank.min) / (nextRank.min - rank.min)) * 100) : 100;
  return (
    <main className="academy-home" data-help="area.academy">
      <header className="ah-head">
        <div>
          <h1>Academy</h1>
          <p className="muted">Short lessons with hands-on tasks on a safe training case. Optional, free to fail, and nothing here changes a case score. Ranks and badges are for fun.</p>
        </div>
        <div className="ah-rank">
          <div className="ah-rank-name">{rank.name}</div>
          <div className="ac-xp big"><div style={{ width: `${pct}%` }} /></div>
          <div className="muted small">{xp} XP{nextRank ? ` · ${nextRank.min - xp} to ${nextRank.name}` : " · top rank"} · {lessonsDone} of {total} lessons · {Math.round((lessonsDone / total) * 100)}% overall</div>
        </div>
      </header>

      <section className="ah-cards">
        <article className="ah-card">
          <div className="ah-card-icon">⚡</div>
          <div>
            <h3>Quick intro</h3>
            <p className="muted small">Seven fast missions on a made-up cash shortage. About five minutes. {p.academy === "done" ? "Finished." : p.academy === "started" ? "In progress." : ""}</p>
          </div>
          <button onClick={openQuickIntro}>{p.academy === "done" ? "Replay" : p.academy === "started" ? "Resume" : "Start"}</button>
        </article>
        <article className="ah-card">
          <div className="ah-card-icon">📦</div>
          <div>
            <h3>Practice case: First Day</h3>
            <p className="muted small">A lost parcel, 13 items, two short stages, about 20 minutes. Prompts point at the next useful step and hints are free. {p.practice.done ? "Finished: Graduate badge earned." : `Finish it for ${XP.practice} XP and the Graduate badge.`}</p>
          </div>
          <div className="row">
            <button className="primary" onClick={() => run(async () => { const st = await resumePractice(); if (st && !st.attempt.submitted) { setGame(st); return; } setGame(await startPractice()); })}>{p.practice.done ? "Play again" : "Start"}</button>
          </div>
        </article>
      </section>

      <section className="ah-path" aria-label="Tracks">
        {TRACKS.map((t) => {
          const done = t.lessons.filter((l) => p.lessons[l.id]?.done).length;
          const ring = Math.round((done / t.lessons.length) * 100);
          const next = t.lessons.find((l) => !p.lessons[l.id]?.done);
          return (
            <article key={t.id} className={`ah-track ${done === t.lessons.length ? "complete" : ""}`}>
              <header>
                <div className="ring" style={{ background: `conic-gradient(var(--good) ${ring * 3.6}deg, var(--line-2) 0)` }} aria-label={`${done} of ${t.lessons.length} lessons done`}>
                  <span>{t.icon}</span>
                </div>
                <div>
                  <h2>{t.n}. {t.title}</h2>
                  <div className="muted small">{done} of {t.lessons.length} lessons · practice: {t.practice}{t.badge ? ` · badge: ${t.badge}` : ""}</div>
                </div>
                {next && <button className="primary small" onClick={() => openAcademy(next.id)}>{done ? "Continue" : "Start"}</button>}
              </header>
              <ol className="ah-lessons">
                {t.lessons.map((l) => {
                  const rec = p.lessons[l.id];
                  return (
                    <li key={l.id} className={rec?.done ? "done" : ""}>
                      <button className="ah-lesson" onClick={() => openAcademy(l.id)}>
                        <span className="ah-tick" aria-hidden="true">{rec?.done ? "✓" : "○"}</span>
                        <span>{l.title}</span>
                        <span className="muted small">{l.minutes} min{l.sandbox ? " · sandbox" : ""}{rec?.done ? ` · ${rec.xp} XP` : ""}</span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </article>
          );
        })}
      </section>

      <section className="ah-badges">
        <h2>Badges</h2>
        <div className="ac-badges">
          {Object.entries(BADGES).map(([k, b]) => (
            <div key={k} className={`ac-badge ${p.badges.includes(k) ? "on" : ""}`} title={b.how}>
              <span>{p.badges.includes(k) ? b.icon : "🔒"}</span>
              <small>{b.label}</small>
            </div>
          ))}
        </div>
        <p className="muted small">How XP works: {XP.lesson} for a lesson, {XP.first_try} bonus for passing the check first time, {XP.sandbox} for using a tool in the sandbox, {XP.track} for finishing a track and {XP.practice} for the practice case. <button className="linklike" onClick={() => openHelp("feature.academy")}>More about the Academy</button></p>
      </section>
    </main>
  );
}

/* ------------------------------------------------------------------ lesson player */
type Phase = "intro" | "try" | "sandbox" | "check" | "reward";

export function LessonPlayer({ lesson, onExit }: { lesson: Lesson; onExit: () => void }) {
  const { run, setGame, setTab, select } = useApp();
  const sb = useSandbox();
  const p = useProgress();
  const [resumeAtCheck] = useState(() => sb.finished && sb.lesson?.id === lesson.id);
  const [phase, setPhase] = useState<Phase>(resumeAtCheck ? "check" : "intro");
  const [tryDone, setTryDone] = useState(false);
  const [qi, setQi] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [hint, setHint] = useState(false);
  const [gain, setGain] = useState<{ xp: number; badges: string[]; track: boolean } | null>(null);
  const sandboxUsed = resumeAtCheck || !!p.lessons[lesson.id]?.sandbox;
  const track = trackOf(lesson.id)!;
  const idx = track.lessons.findIndex((l) => l.id === lesson.id);
  const nextLesson = track.lessons[idx + 1] ?? null;
  const phases: Phase[] = ["intro", "try", ...(lesson.sandbox ? (["sandbox"] as Phase[]) : []), "check", "reward"];

  useEffect(() => {
    setPhase(resumeAtCheck ? "check" : "intro");
    setTryDone(false); setQi(0); setWrong(0); setPicked(null); setHint(false); setGain(null);
  }, [lesson.id]);
  useEffect(() => {
    if (resumeAtCheck) setSandbox({ finished: false, lesson: null });
  }, []);

  const launchSandbox = (fresh = false) =>
    run(async () => {
      const st = await openSandbox(lesson, fresh);
      setGame(st);
      setTimeout(() => {
        setTab(lesson.sandbox!.tab);
        if (lesson.sandbox!.select) select(lesson.sandbox!.select);
        if (lesson.sandbox!.tab !== "viewer") setTab(lesson.sandbox!.tab);
      }, 50);
    });

  const answer = (k: number) => {
    const q = lesson.check[qi];
    setPicked(k);
    if (k === q.answer) {
      playSound("good");
      setTimeout(() => {
        setPicked(null);
        setHint(false);
        if (qi + 1 < lesson.check.length) setQi(qi + 1);
        else finish();
      }, 650);
    } else {
      playSound("bad");
      setWrong((w) => w + 1);
      setHint(true);
    }
  };

  const finish = () => {
    const prog = getProgress();
    const before = prog.lessons[lesson.id];
    const firstTry = wrong === 0;
    const sandbox = sandboxUsed || !!before?.sandbox;
    const xp = Math.max(before?.xp ?? 0, XP.lesson + (firstTry ? XP.first_try : 0) + (sandbox && lesson.sandbox ? XP.sandbox : 0));
    const lessons = { ...prog.lessons, [lesson.id]: { done: true, first_try: firstTry || !!before?.first_try, sandbox, xp, at: new Date().toISOString() } };
    const badges: string[] = [];
    const trackDone = track.lessons.every((l) => lessons[l.id]?.done);
    const tracks_done = trackDone && !prog.tracks_done.includes(track.id) ? [...prog.tracks_done, track.id] : prog.tracks_done;
    updateProgress({ lessons, tracks_done });
    if (!Object.values(prog.lessons).some((l) => l.done) && award("First Steps")) badges.push("First Steps");
    if (lesson.id === "analysis.fia" && firstTry && award("Straight Answer")) badges.push("Straight Answer");
    if (["analysis.timeline", "analysis.clocks"].every((id) => lessons[id]?.done) && award("Time Keeper")) badges.push("Time Keeper");
    if (lesson.sandbox?.badge_on_done && sandbox && award(lesson.sandbox.badge_on_done)) badges.push(lesson.sandbox.badge_on_done);
    if (lesson.id === "analysis.links" && award("Link Maker")) badges.push("Link Maker");
    if (trackDone && track.badge && award(track.badge)) badges.push(track.badge);
    setGain({ xp: xp - (before?.xp ?? 0), badges, track: trackDone && !prog.tracks_done.includes(track.id) });
    playSound(badges.length || trackDone ? "level" : "good");
    setPhase("reward");
  };

  return (
    <main className="lesson" data-help="area.academy">
      <header className="lesson-head">
        <button className="ghost" onClick={onExit}>← Academy</button>
        <div>
          <div className="ac-kicker">{track.title} · lesson {idx + 1} of {track.lessons.length} · about {lesson.minutes} minutes</div>
          <h1>{lesson.title}</h1>
        </div>
        <ol className="lesson-steps" aria-label="Lesson steps">
          {phases.map((ph) => <li key={ph} className={ph === phase ? "on" : phases.indexOf(ph) < phases.indexOf(phase) ? "past" : ""}>{{ intro: "Intro", try: "Try it", sandbox: "Sandbox", check: "Quick check", reward: "Reward" }[ph]}</li>)}
        </ol>
      </header>

      <section className="lesson-card">
        {phase === "intro" && (
          <>
            <Picture name={lesson.picture} />
            <p className="lesson-intro">{lesson.intro}</p>
            <button className="primary big" onClick={() => setPhase("try")} autoFocus>Try it</button>
          </>
        )}
        {phase === "try" && (
          <>
            <TryIt cfg={lesson.tryit} onDone={() => setTryDone(true)} />
            <div className="row-end">
              <button className="primary" disabled={!tryDone} onClick={() => setPhase(lesson.sandbox ? "sandbox" : "check")}>{lesson.sandbox ? "On to the sandbox" : "On to the quick check"}</button>
            </div>
          </>
        )}
        {phase === "sandbox" && lesson.sandbox && (
          <>
            <h2>Sandbox task</h2>
            <p>{lesson.sandbox.task}</p>
            <p className="muted small">The real tools open on the First Day training case, with every stage open. A checklist follows you and ticks off each step as you do it. Mistakes here cost nothing.</p>
            <ol>{lesson.sandbox.steps.map((s) => <li key={s.label}>{s.label}</li>)}</ol>
            <div className="row">
              <button className="primary big" onClick={() => launchSandbox(false)}>Open the sandbox</button>
              <button className="ghost" onClick={() => launchSandbox(true)} title="Start the training case again from scratch">Fresh sandbox</button>
              <button className="ghost" onClick={() => setPhase("check")}>Skip the sandbox</button>
            </div>
          </>
        )}
        {phase === "check" && (
          <>
            <div className="ac-kicker">Question {qi + 1} of {lesson.check.length}</div>
            <h2>{lesson.check[qi].q}</h2>
            <div className="ac-choices">
              {lesson.check[qi].options.map((o, k) => (
                <button key={k} className={`ac-quote ${picked === k ? (k === lesson.check[qi].answer ? "right" : "wrong") : ""}`} onClick={() => answer(k)}>{o}</button>
              ))}
            </div>
            {hint && <div className="ac-hint">💡 {lesson.check[qi].hint} Have another go.</div>}
          </>
        )}
        {phase === "reward" && gain && (
          <div className="ac-reward">
            <div className="ac-big pop">{gain.badges.length ? BADGES[gain.badges[0]]?.icon ?? "🏅" : "✅"}</div>
            <h2>Lesson complete</h2>
            <div className="ac-gain">+{gain.xp} XP</div>
            {gain.track && <div className="ac-level">Track complete: {track.title} (+{XP.track} XP)</div>}
            {gain.badges.map((b) => <p key={b}>Badge earned: <b>{BADGES[b]?.label ?? b}</b></p>)}
            <div className="row" style={{ justifyContent: "center" }}>
              <button onClick={() => openHelp(lesson.learn_more)}>Learn more in the help centre</button>
              {nextLesson ? <button className="primary" onClick={() => openAcademy(nextLesson.id)} autoFocus>Next lesson →</button> : <button className="primary" onClick={onExit} autoFocus>Back to the Academy</button>}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
