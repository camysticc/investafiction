import { useEffect, useState } from "react";
import { useApp } from "../lib/store";
import { get as setting } from "../lib/settings";
import { getProgress, updateProgress } from "../lib/progress";
import { openAcademy } from "../lib/nav";
import { TOOL_LESSON, lessonById } from "./content";
import { sandboxActive, isPracticeAttempt } from "./sandbox";

/** The first time a tool is opened, offer its lesson (plan section 12.6). */
export default function ToolPrompt() {
  const { tab, game } = useApp();
  const [offer, setOffer] = useState<string | null>(null);
  useEffect(() => {
    const lessonId = TOOL_LESSON[tab];
    if (!lessonId || !game || sandboxActive() || isPracticeAttempt(game.attempt.id) || !setting("academy.academy_reminders")) return;
    const p = getProgress();
    if (p.seen_tools.includes(tab) || p.lessons[lessonId]?.done) return;
    updateProgress({ seen_tools: [...p.seen_tools, tab] });
    setOffer(lessonId);
  }, [tab]);
  if (!offer) return null;
  const l = lessonById(offer);
  if (!l) return null;
  return (
    <div className="tool-prompt" role="status">
      <span>🎓 New to this tool? <b>{l.title}</b> is a {l.minutes} minute Academy lesson.</span>
      <button className="small primary" onClick={() => { setOffer(null); openAcademy(offer); }}>Open the lesson</button>
      <button className="small ghost" onClick={() => setOffer(null)}>Not now</button>
    </div>
  );
}
