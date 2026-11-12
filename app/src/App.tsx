import { useEffect, useRef, useState } from "react";
import { call } from "./lib/api";
import { useApp } from "./lib/store";
import Welcome from "./components/Welcome";
import Library from "./components/Library";
import Workspace from "./components/Workspace";
import TopBar from "./components/TopBar";
import BriefView from "./components/BriefView";
import Academy from "./components/Academy";
import Tour from "./components/Tour";
import { SettingsModal } from "./components/Settings";
import { useProgress } from "./lib/progress";

export default function App() {
  const { profile, setProfile, game, setGame, run } = useApp();
  const [loaded, setLoaded] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [academyOpen, setAcademyOpen] = useState(false);
  const progress = useProgress();

  useEffect(() => {
    run(async () => {
      const r = await call("profile.get");
      setProfile(r.profile);
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    const scale = profile?.text_scale ?? 1;
    document.documentElement.style.fontSize = `${15 * scale}px`;
  }, [profile?.text_scale]);

  // first run: offer the Academy as soon as there is a name
  const offered = useRef(false);
  useEffect(() => {
    if (loaded && profile && progress.academy === "new" && !offered.current) {
      offered.current = true;
      setAcademyOpen(true);
    }
  }, [loaded, profile, progress.academy]);

  useEffect(() => {
    const s = () => setSettingsOpen(true);
    const a = () => setAcademyOpen(true);
    const k = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
      if (e.key === "," && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) setSettingsOpen(true);
    };
    window.addEventListener("inv:settings", s);
    window.addEventListener("inv:academy", a);
    window.addEventListener("keydown", k);
    return () => {
      window.removeEventListener("inv:settings", s);
      window.removeEventListener("inv:academy", a);
      window.removeEventListener("keydown", k);
    };
  }, []);

  if (!loaded) return <div className="splash">Opening your desk…</div>;

  const inWorkspace = !!game && game.attempt.scope_acknowledged;
  return (
    <>
      {!profile ? (
        <Welcome />
      ) : (
        <div className="app">
          <TopBar onLeave={async () => { await run(() => call("attempt.close")); setGame(null); }} />
          {!game ? <Library /> : !game.attempt.scope_acknowledged ? <BriefView firstTime /> : <Workspace />}
        </div>
      )}
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} onReplayAcademy={() => profile && setAcademyOpen(true)} />}
      {academyOpen && profile && <Academy onClose={() => setAcademyOpen(false)} />}
      {profile && inWorkspace && !academyOpen && !settingsOpen && !game!.attempt.submitted && progress.tour === "new" && <Tour />}
    </>
  );
}
