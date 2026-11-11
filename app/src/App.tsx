import { useEffect, useState } from "react";
import { call } from "./lib/api";
import { useApp } from "./lib/store";
import Welcome from "./components/Welcome";
import Library from "./components/Library";
import Workspace from "./components/Workspace";
import TopBar from "./components/TopBar";
import BriefView from "./components/BriefView";

export default function App() {
  const { profile, setProfile, game, setGame, run } = useApp();
  const [loaded, setLoaded] = useState(false);

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

  if (!loaded) return <div className="splash">Opening your desk…</div>;
  if (!profile) return <Welcome />;

  return (
    <div className="app">
      <TopBar onLeave={async () => { await run(() => call("attempt.close")); setGame(null); }} />
      {!game ? <Library /> : !game.attempt.scope_acknowledged ? <BriefView firstTime /> : <Workspace />}
    </div>
  );
}
