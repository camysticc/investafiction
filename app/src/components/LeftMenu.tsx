import { useApp } from "../lib/store";
import { goTo, openHelp, openSettings, useNav, type Area } from "../lib/nav";
import { useProgress, totalXp, rankFor } from "../lib/progress";

const ICONS: Record<string, string> = {
  library: "M4 5h4v14H4zM10 5h4v14h-4zM16 6l3.5-1 3 13.5-3.5 1z",
  workspace: "M3 5h18v12H3zM8 21h8M12 17v4",
  academy: "M2 9l10-5 10 5-10 5zM6 11v5c3 2 9 2 12 0v-5",
  progress: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
  help: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01",
  profile: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
};

export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return (
    <svg className="ico" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  );
}

export default function LeftMenu() {
  const { game } = useApp();
  const nav = useNav();
  const p = useProgress();
  const items: [Area, string, string][] = [
    ["library", "Case library", "Your cases and attempts"],
    ["workspace", "Workspace", game ? game.case.manifest.title : "Open a case first"],
    ["academy", "Academy", rankFor(totalXp(p)).name],
    ["progress", "Progress", "Skills and attempts"],
    ["settings", "Settings", "About 210 options"],
    ["help", "Help centre", "Search for anything"],
    ["profile", "Profile", "Name, rank and badges"],
  ];
  return (
    <nav className="leftmenu" aria-label="Main areas" data-help="nav.left_menu">
      {items.map(([k, label, sub]) => {
        const disabled = k === "workspace" && !game;
        const on = k === "help" ? nav.helpOpen || nav.area === "help" : nav.area === k;
        return (
          <button
            key={k}
            className={`lm-item ${on ? "on" : ""}`}
            disabled={disabled}
            aria-current={on ? "page" : undefined}
            title={`${label}: ${sub}`}
            data-tour={k === "academy" ? "academy" : undefined}
            onClick={() => (k === "help" ? openHelp() : k === "settings" ? openSettings() : goTo(k))}
          >
            <Icon name={k} />
            <span className="lm-label">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
