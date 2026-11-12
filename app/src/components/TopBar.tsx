import { useEffect, useRef, useState } from "react";
import { call } from "../lib/api";
import { useApp } from "../lib/store";
import { fmtDuration, fmtTime } from "../lib/util";
import { Avatar, PRESETS } from "./Welcome";
import BriefView from "./BriefView";
import { Modal } from "./common";
import { SettingsButton } from "./Settings";
import { openSettings } from "../lib/ui";

export default function TopBar({ onLeave }: { onLeave: () => void }) {
  const { profile, setProfile, game, saving, lastSaved, act, run } = useApp();
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
  const scale = profile?.text_scale ?? 1;
  const setScale = (s: number) => run(async () => setProfile((await call("profile.set", { name: profile!.name, text_scale: s })).profile));

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
          <div className="clock" title="Case clock: the in-case time, which advances while you work">
            <span className="muted">Case clock</span> {fmtTime(a!.case_time)} UTC
            <span className="muted"> · {fmtDuration(a!.active_seconds)} worked</span>
          </div>
          <div className="save-status" aria-live="polite">
            {saving ? "Saving…" : lastSaved ? `Saved ${lastSaved.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}` : "Autosave on"}
          </div>
          <button onClick={() => act({ type: "save" })}>Save</button>
          <button data-tour="brief" onClick={() => setBrief(true)}>
            Brief{unread ? <span className="badge">{unread}</span> : null}
          </button>
        </div>
      )}
      <div className="topbar-end">
      <SettingsButton onOpen={openSettings} />
      <div className="profile" ref={ref}>
        <button className="profile-badge" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu(!menu)}>
          <Avatar name={profile!.name} size={28} />
          <span>{profile!.name}</span>
        </button>
        {menu && (
          <div className="menu" role="menu">
            <div className="menu-head">
              <Avatar name={profile!.name} size={40} />
              <div>
                <strong>{profile!.name}</strong>
                <div className="muted small">Shown on your report sign-off</div>
              </div>
            </div>
            <button role="menuitem" onClick={() => { setChanging(true); setMenu(false); }}>
              Change name
            </button>
            <button role="menuitem" onClick={() => { openSettings(); setMenu(false); }}>
              Settings…
            </button>
            <div className="menu-row">
              <span>Text size</span>
              <button aria-label="Smaller text" onClick={() => setScale(Math.max(0.8, +(scale - 0.1).toFixed(1)))}>A−</button>
              <span>{Math.round(scale * 100)}%</span>
              <button aria-label="Larger text" onClick={() => setScale(Math.min(1.6, +(scale + 0.1).toFixed(1)))}>A+</button>
            </div>
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
