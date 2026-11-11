import { useState } from "react";
import { call } from "../lib/api";
import { useApp } from "../lib/store";

export const PRESETS = [
  { name: "Officer Smith", initials: "OS", colour: "#3a6ea5", line: "Steady and thorough." },
  { name: "Detective Jones", initials: "DJ", colour: "#8a5a2b", line: "Follows every thread." },
  { name: "Sergeant Nolan", initials: "SN", colour: "#3f7d5a", line: "Keeps the team on track." },
];

export function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  const p = PRESETS.find((x) => x.name === name) ?? PRESETS[0];
  return (
    <span className="avatar" style={{ width: size, height: size, background: p.colour, fontSize: size * 0.4 }} aria-hidden="true">
      {p.initials}
    </span>
  );
}

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
          Confirm and go to the case library
        </button>
        <p className="disclaimer">
          Investafiction is a personal project inspired by investigative methods. It is not official training, is not endorsed by any organisation, and does not give legal advice. Every case is fictional and the app never connects to the internet.
        </p>
      </div>
    </div>
  );
}
