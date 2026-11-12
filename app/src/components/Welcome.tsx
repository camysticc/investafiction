import { useState } from "react";
import { call } from "../lib/api";
import { useApp } from "../lib/store";
import { get as setting, useSetting } from "../lib/settings";
import { useProgress, unlockedFrames } from "../lib/progress";

export const PRESETS = [
  { name: "Officer Smith", initials: "OS", colour: "#3a6ea5", line: "Steady and thorough." },
  { name: "Detective Jones", initials: "DJ", colour: "#8a5a2b", line: "Follows every thread." },
  { name: "Sergeant Nolan", initials: "SN", colour: "#3f7d5a", line: "Keeps the team on track." },
];

const AVATAR_PATHS: Record<string, string> = {
  icon2: "M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z",
  icon3: "M12 2l3 7h7l-5.5 4.5 2 7.5-6.5-4.5L5.5 21l2-7.5L2 9h7z",
  icon4: "M10 4a6 6 0 1 0 0 12 6 6 0 0 0 0-12zM14.5 14.5L21 21",
  icon5: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM15 9l-2 5-5 2 2-5z",
  icon6: "M8 14a4 4 0 1 1 3.9-5H22v3h-2v3h-3v-3h-5.1A4 4 0 0 1 8 14z",
  icon7: "M12 3c-4 0-7 3-7 7 0 3 1 5 1 9M12 7c-2 0-3 1.5-3 3.5 0 3 1 5 1 9M12 7c2 0 3 1.5 3 3.5 0 3-.5 6-1.5 9M19 10c0 3-.5 6-1.5 9M12 11v9",
  icon8: "M12 2l2.5 5 5.5.8-4 3.9.9 5.5L12 14.6 7.1 17.2 8 11.7 4 7.8 9.5 7z",
  icon9: "M4 4h7a3 3 0 0 1 3 3v14a2 2 0 0 0-2-2H4zM20 4h-5a3 3 0 0 0-3 3",
  icon10: "M12 22s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  icon11: "M13 2L4 14h7l-1 8 9-12h-7z",
  icon12: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
};

/** The profile avatar: the chosen icon, an optional frame unlocked in the Academy, and the name's colour. */
export function Avatar({ name, size = 32, icon, frame }: { name: string; size?: number; icon?: string; frame?: string }) {
  const p = PRESETS.find((x) => x.name === name) ?? PRESETS[0];
  const chosen = icon ?? (setting("profile.avatar") as string) ?? "icon1";
  const fr = frame ?? (setting("academy.show_academy_rewards_on_profile") ? localFrame() : "none");
  return (
    <span className={`avatar frame-${fr}`} style={{ width: size, height: size, background: p.colour, fontSize: size * 0.4 }} aria-hidden="true">
      {chosen === "icon1" || !AVATAR_PATHS[chosen] ? (
        p.initials
      ) : (
        <svg width={size * 0.58} height={size * 0.58} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={AVATAR_PATHS[chosen]} /></svg>
      )}
    </span>
  );
}
let frameCache = "none";
function localFrame() {
  return frameCache;
}
/** Keeps the best unlocked frame in step with Academy progress. */
export function useFrameSync() {
  const p = useProgress();
  useSetting("academy.show_academy_rewards_on_profile");
  const f = unlockedFrames(p);
  frameCache = f[f.length - 1];
}
export const AVATAR_IDS = ["icon1", ...Object.keys(AVATAR_PATHS)];

export default function Welcome() {
  const { setProfile, run } = useApp();
  const [pick, setPick] = useState<string | null>(null);
  return (
    <div className="welcome">
      <div className="welcome-inner">
        <div className="brand-big">
          <img src="/icon.svg" alt="" width={56} height={56} />
          <div>
            <h1>Investafiction</h1>
            <p className="muted">A desk for working fictional cases, from first brief to final report.</p>
          </div>
        </div>
        <h2>Choose your name</h2>
        <p>This appears at the top of the window and on your report sign-off. It is for show only and does not change the cases or the marking. You can change it later.</p>
        <div className="preset-grid" role="radiogroup" aria-label="Preset names">
          {PRESETS.map((p) => (
            <button key={p.name} role="radio" aria-checked={pick === p.name} className={`preset ${pick === p.name ? "on" : ""}`} onClick={() => setPick(p.name)}>
              <Avatar name={p.name} size={64} />
              <strong>{p.name}</strong>
              <span className="muted">{p.line}</span>
            </button>
          ))}
        </div>
        <button
          className="primary big"
          disabled={!pick}
          onClick={() => run(async () => {
            const r = await call("profile.set", { name: pick });
            setProfile(r.profile);
          })}
        >
          Confirm
        </button>
        <p className="disclaimer">
          Investafiction is a personal project inspired by investigative methods. It is not official training, is not endorsed by any organisation, and does not give legal advice. Every case is fictional and the app never connects to the internet.
        </p>
      </div>
    </div>
  );
}
