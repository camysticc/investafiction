import { useEffect, useRef, useState } from "react";
import { call } from "../lib/api";
import { useApp } from "../lib/store";
import { fmtDuration, fmtTime } from "../lib/util";
import { Avatar, PRESETS } from "./Welcome";
import BriefView from "./BriefView";
import { Modal } from "./common";
import { openHelp, openSettings, goTo } from "../lib/nav";
import { useSetting } from "../lib/settings";
import { useProgress, totalXp, rankFor } from "../lib/progress";
import { Icon } from "./LeftMenu";
import { useFrameSync } from "./Welcome";

export default function TopBar({ onLeave }: { onLeave: () => void }) {
  const { profile, setProfile, game, saving, lastSaved, act, run } = useApp();
  useFrameSync();
  const clockMode = useSetting<string>("gameplay.case_clock");
  const badgeStyle = useSetting<string>("profile.badge_style");
  const showRank = useSetting<boolean>("profile.show_academy_rank_on_badge");
  const notice = useSetting<string>("notifications.autosave_notice");
  useSetting("profile.avatar");
  const prog = useProgress();
  const rank = rankFor(totalXp(prog)).name;
  const [menu, setMenu] = useState(false);
  const [brief, setBrief] = useState(false);
  const [changing, setChanging] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setMenu(false);
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const a = game?.attempt;
  const unread = a?.messages.filter((m) => !m.read).length ?? 0;
  useEffect(() => {
    const h = (e: Event) => (e as CustomEvent).detail === "case.brief" && setBrief(true);
    window.addEventListener("inv:cmd", h);
    return () => window.removeEventListener("inv:cmd", h);
  }, []);
  const left = Math.max(0, (game?.case.manifest.estimated_minutes ?? 0) * 60 - (a?.active_seconds ?? 0));

  return (
    <header className="topbar">
      <div className="brand">
        <img src="/icon.svg" alt="" width={24} height={24} />
        <span>Investafiction</span>
      </div>
      {game && (
        <div className="case-info">
          <button className="ghost" onClick={onLeave} title="Save and return to the case library">
            ← Library
          </button>
          <div className="case-title">
            <strong>{game.case.manifest.title}</strong>
            <span className={`mode-pill ${a!.mode}`}>{a!.mode === "training" ? "Training" : "Assessment"}</span>
          </div>
          {clockMode !== "hidden" && (
            <div className="clock" title="Case clock: the in-case time, which advances while you work" data-help="topbar.case_clock">
              <span className="muted">Case clock</span> {fmtTime(a!.case_time)} UTC
              <span className="muted"> · {clockMode === "time_left_against_the_estimate" ? `${fmtDuration(left)} left of the estimate` : `${fmtDuration(a!.active_seconds)} worked`}</span>
            </div>
          )}
          {notice !== "off" && (
            <div className="save-status" aria-live="polite">
              {saving ? "Saving…" : lastSaved ? `Saved ${lastSaved.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}` : "Autosave on"}
            </div>
          )}
          <button onClick={() => act({ type: "save" })}>Save</button>
          <button data-tour="brief" onClick={() => setBrief(true)}>
            Brief{unread ? <span className="badge">{unread}</span> : null}
          </button>
        </div>
      )}
      <div className="topbar-end">
      <button className="ghost gear" aria-label="Settings" title="Settings" data-tour="settings" data-help="topbar.settings" onClick={() => openSettings()}>
        <Icon name="settings" size={18} />
      </button>
      <button className="ghost gear help-btn" aria-label="Help" title="Help centre" data-help="topbar.help" onClick={() => openHelp()}>
        <span aria-hidden="true">?</span>
      </button>
      <div className="profile" ref={ref}>
        <button className="profile-badge" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu(!menu)} data-help="topbar.profile">
          {badgeStyle !== "name_only" && <Avatar name={profile!.name} size={28} />}
          {badgeStyle !== "avatar_only" && (
            <span className="pb-text">
              <span>{profile!.name}</span>
              {showRank && <span className="pb-rank">{rank}</span>}
            </span>
          )}
        </button>
        {menu && (
          <div className="menu" role="menu">
            <div className="menu-head">
              <Avatar name={profile!.name} size={40} />
              <div>
                <strong>{profile!.name}</strong>
                <div className="muted small">{rank} · shown on your report sign-off</div>
              </div>
            </div>
            <button role="menuitem" onClick={() => { setChanging(true); setMenu(false); }}>
              Change name
            </button>
            <button role="menuitem" onClick={() => { goTo("profile"); setMenu(false); }}>
              Profile and badges
            </button>
            <button role="menuitem" onClick={() => { goTo("progress"); setMenu(false); }}>
              Progress
            </button>
            <button role="menuitem" onClick={() => { openSettings("profile"); setMenu(false); }}>
              Profile settings…
            </button>
          </div>
        )}
      </div>
      </div>
      {changing && (
        <Modal title="Change your name" onClose={() => setChanging(false)}>
          <p className="muted">Cosmetic only. Marking and cases are the same whichever name you use.</p>
          <div className="preset-grid">
            {PRESETS.map((p) => (
              <button
                key={p.name}
                className={`preset ${profile!.name === p.name ? "on" : ""}`}
                onClick={() => run(async () => {
                  setProfile((await call("profile.set", { name: p.name })).profile);
                  setChanging(false);
                })}
              >
                <Avatar name={p.name} size={48} />
                <strong>{p.name}</strong>
              </button>
            ))}
          </div>
        </Modal>
      )}
      {brief && game && (
        <Modal title="Case brief and messages" onClose={() => setBrief(false)} wide>
          <BriefView />
        </Modal>
      )}
    </header>
  );
}
