import { useEffect, useRef } from "react";
import { useApp } from "../lib/store";
import { XP, award, getProgress, updateProgress } from "../lib/progress";
import { isPracticeAttempt } from "./sandbox";

/** Highlights and prompts for the First Day practice case, and its reward. */
export default function PracticeGuide() {
  const { game, act, toast } = useApp();
  const rewarded = useRef<string | null>(null);
  const a = game?.attempt;
  const practice = !!game && isPracticeAttempt(a?.id);
  useEffect(() => {
    if (!practice || !a?.submitted || rewarded.current === a.id) return;
    rewarded.current = a.id;
    const p = getProgress();
    if (!p.practice.done) {
      updateProgress({ practice: { done: true, at: new Date().toISOString(), xp: XP.practice } });
      award("Graduate");
      toast(`Practice case finished: +${XP.practice} XP and the Graduate badge.`, "good");
    }
  }, [practice, a?.submitted]);
  if (!practice || !a || a.submitted || !a.scope_acknowledged) return null;
  const stage = game!.case.stages.find((s) => s.id === a.current_stage);
  const next = stage?.objectives?.find((o) => !o.done && o.required) ?? stage?.objectives?.find((o) => !o.done);
  const hints = a.hints.filter((h) => h.objective === next?.id);
  return (
    <aside className="practice-guide" role="region" aria-label="Practice guide">
      <div className="ac-kicker">First Day · practice guide</div>
      {next ? (
        <>
          <p><b>Next useful step:</b> {next.text}</p>
          {hints.map((h, k) => <div key={k} className="hint small">{h.text}</div>)}
          {hints.length < 3 && <button className="small" onClick={() => act({ type: "hint", objective: next.id })}>{hints.length ? "More help" : "Show me how"} (free)</button>}
        </>
      ) : (
        <p>{a.current_stage === game!.case.stages[game!.case.stages.length - 1].id ? "Everything required is done. Finish your report and submit it from the Report tab." : "Stage complete. The next stage opens automatically."}</p>
      )}
    </aside>
  );
}
