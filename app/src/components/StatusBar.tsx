import { useApp } from "../lib/store";
import { useSetting } from "../lib/settings";
import { useNav } from "../lib/nav";

export default function StatusBar() {
  const show = useSetting<boolean>("appearance.show_status_bar");
  const notice = useSetting<string>("notifications.autosave_notice");
  const { game, saving, lastSaved } = useApp();
  const nav = useNav();
  if (!show) return null;
  const a = game?.attempt;
  const stage = game?.case.stages.find((s) => s.id === a?.current_stage);
  return (
    <footer className="statusbar" aria-label="Status">
      <span>{nav.area === "workspace" && game ? game.case.manifest.title : nav.area[0].toUpperCase() + nav.area.slice(1)}</span>
      {game && stage && <span>Stage: {stage.title}</span>}
      {game && <span>{game.case.evidence.length} items released</span>}
      {game && <span>{a!.findings.length} findings</span>}
      <span className="sb-end" aria-live="polite">{notice === "off" ? "" : saving ? "Saving…" : lastSaved ? `Saved ${lastSaved.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}` : "Autosave on"}</span>
      <span className="muted">Offline · nothing leaves this computer</span>
    </footer>
  );
}
