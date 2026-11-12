import { call } from "../lib/api";
import { useApp } from "../lib/store";
import { BADGES, RANKS, rankFor, totalXp, unlockedFrames, useProgress } from "../lib/progress";
import { openAcademy, openSettings } from "../lib/nav";
import { set, useSetting } from "../lib/settings";
import { Avatar, PRESETS } from "./Welcome";
import { fmtTime } from "../lib/util";

export default function ProfilePage() {
  const { profile, setProfile, run } = useApp();
  const p = useProgress();
  useSetting("profile.avatar");
  const xp = totalXp(p);
  const rank = rankFor(xp);
  const next = RANKS.find((r) => r.min > xp);
  const frames = unlockedFrames(p);
  const lessonsDone = Object.values(p.lessons).filter((l) => l.done).length;
  return (
    <main className="profile-page" data-help="area.profile">
      <header className="pf-head">
        <Avatar name={profile!.name} size={88} />
        <div>
          <h1>{profile!.name}</h1>
          <div className="pf-rank">{rank.name} · {xp} XP{next ? ` · ${next.min - xp} XP to ${next.name}` : " · top rank"}</div>
          <p className="muted small">Ranks are for fun. They are not real ranks or qualifications.</p>
        </div>
      </header>
      <section className="pf-section">
        <h2>Name</h2>
        <p className="muted small">Shown on your badge and report sign-off. It never changes the marking.</p>
        <div className="preset-grid">
          {PRESETS.map((n) => (
            <button key={n.name} className={`preset ${profile!.name === n.name ? "on" : ""}`} onClick={() => run(async () => setProfile((await call("profile.set", { name: n.name })).profile))}>
              <Avatar name={n.name} size={44} frame="none" /><strong>{n.name}</strong>
            </button>
          ))}
        </div>
      </section>
      <section className="pf-section">
        <h2>Avatar frames</h2>
        <p className="muted small">Unlocked by Academy ranks and badges. They change how the profile looks and nothing else.</p>
        <div className="row">
          {["none", "bronze", "silver", "gold", "graduate"].map((f) => (
            <div key={f} className={`frame-chip ${frames.includes(f) ? "" : "locked"}`}>
              <Avatar name={profile!.name} size={40} frame={f} />
              <span className="small">{frames.includes(f) ? f : `${f} (locked)`}</span>
            </div>
          ))}
        </div>
        <button className="ghost small" onClick={() => openSettings("profile")}>Change avatar and badge style</button>
      </section>
      <section className="pf-section">
        <h2>Badges ({p.badges.length})</h2>
        <div className="ac-badges">
          {Object.entries(BADGES).map(([k, b]) => (
            <div key={k} className={`ac-badge ${p.badges.includes(k) ? "on" : ""}`} title={b.how}>
              <span>{p.badges.includes(k) ? b.icon : "🔒"}</span>
              <small>{b.label}</small>
            </div>
          ))}
        </div>
        <p className="muted small">{lessonsDone} lessons done · {p.tracks_done.length} of 6 tracks · practice case {p.practice.done ? "finished" : "not finished"}. <button className="linklike" onClick={() => openAcademy(null)}>Open the Academy</button></p>
      </section>
      <section className="pf-section">
        <h2>Practice streak</h2>
        <p className="muted small">Optional, and off by default so nobody feels pressured.</p>
        <label className="row"><input type="checkbox" checked={p.streak.enabled} onChange={(e) => {
          import("../lib/progress").then((m) => m.updateProgress({ streak: { ...p.streak, enabled: e.target.checked } }));
        }} /> Track a practice streak</label>
        {p.streak.enabled && <p>Current streak: <b>{p.streak.count} day{p.streak.count === 1 ? "" : "s"}</b></p>}
      </section>
      {p.practice.done && (
        <section className="pf-section completion-card" aria-label="Completion card">
          <div className="cc-inner">
            <div className="cc-title">Investafiction Academy</div>
            <div className="cc-name">{profile!.name}</div>
            <div>completed the core Academy path and the First Day practice case</div>
            <div className="muted small">{p.practice.at ? fmtTime(p.practice.at) : ""}</div>
            <div className="cc-note">A program milestone. This is not a certificate or a qualification.</div>
          </div>
        </section>
      )}
      <p className="muted small">Want Academy rewards hidden? <button className="linklike" onClick={() => set("academy.show_academy_rewards_on_profile", false)}>Hide them</button>.</p>
    </main>
  );
}
