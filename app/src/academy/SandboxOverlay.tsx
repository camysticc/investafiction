import { useEffect, useRef } from "react";
import { call } from "../lib/api";
import { useApp } from "../lib/store";
import { openAcademy } from "../lib/nav";
import { setSandbox, stepDone, useSandbox } from "./sandbox";
import { playSound } from "../lib/settings";

/** The task checklist that follows the player around the real tools. */
export default function SandboxOverlay() {
  const sb = useSandbox();
  const { game, tab, setGame, run } = useApp();
  const announced = useRef(false);
  const lesson = sb.lesson;
  const steps = lesson?.sandbox?.steps ?? [];
  const done = game ? steps.map((s) => stepDone(s, game, tab)) : steps.map(() => false);
  const all = done.length > 0 && done.every(Boolean);
  useEffect(() => {
    if (all && !announced.current) {
      announced.current = true;
      playSound("good");
    }
    if (!all) announced.current = false;
  }, [all]);
  if (!lesson || !game) return null;
  const back = (completed: boolean) =>
    run(async () => {
      await call("attempt.close");
      setGame(null);
      setSandbox({ finished: completed, lesson: completed ? lesson : null });
      openAcademy(lesson.id);
    });
  return (
    <aside className="sandbox-box" role="region" aria-label="Sandbox task">
      <div className="ac-kicker">Academy sandbox · {lesson.title}</div>
      <p><b>{lesson.sandbox!.task}</b></p>
      <ol className="sb-steps">
        {steps.map((s, k) => <li key={k} className={done[k] ? "done" : ""}><span aria-hidden="true">{done[k] ? "✓" : "○"}</span> {s.label}</li>)}
      </ol>
      {all ? (
        <div className="ac-fb good">✓ Task complete. +10 XP when you finish the lesson.</div>
      ) : (
        <p className="muted small">Mistakes here cost nothing. Hints in the Objectives panel are free on this training case.</p>
      )}
      <div className="row">
        <button className={all ? "primary" : ""} onClick={() => back(all)}>{all ? "Back to the lesson" : "Leave the sandbox"}</button>
      </div>
    </aside>
  );
}
