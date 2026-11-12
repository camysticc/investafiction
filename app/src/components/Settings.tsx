import { useState } from "react";
import { call } from "../lib/api";
import { useApp } from "../lib/store";
import { DEFAULT_SETTINGS, playSound, resetSettings, updateSettings, useSettings, type Settings } from "../lib/settings";
import { resetProgress, updateProgress, useProgress, totalXp, rankFor } from "../lib/progress";
import { Modal } from "./common";
import { PRESETS, Avatar } from "./Welcome";

function Choice<K extends keyof Settings>({ k, options, label }: { k: K; options: [Settings[K], string][]; label: string }) {
  const s = useSettings();
  return (
    <div className="set-row">
      <div className="set-label" id={`lbl-${k}`}>{label}</div>
      <div className="seg" role="radiogroup" aria-labelledby={`lbl-${k}`}>
        {options.map(([v, text]) => (
          <button key={String(v)} role="radio" aria-checked={s[k] === v} className={s[k] === v ? "on" : ""} onClick={() => updateSettings({ [k]: v } as Partial<Settings>)}>
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

function Toggle({ k, label, help }: { k: "colourBlind" | "showClock" | "sound"; label: string; help?: string }) {
  const s = useSettings();
  return (
    <div className="set-row">
      <div>
        <div className="set-label">{label}</div>
        {help && <div className="muted small">{help}</div>}
      </div>
      <button role="switch" aria-checked={s[k]} aria-label={label} className={`switch ${s[k] ? "on" : ""}`} onClick={() => { updateSettings({ [k]: !s[k] } as Partial<Settings>); if (k === "sound" && !s[k]) setTimeout(() => playSound("good"), 30); }}>
        <span />
      </button>
    </div>
  );
}

const ACCENTS: [Settings["accent"], string, string][] = [
  ["blue", "Blue", "#1f4e79"],
  ["teal", "Teal", "#0f766e"],
  ["green", "Green", "#2f7a4f"],
  ["purple", "Purple", "#6d3fc4"],
  ["rose", "Rose", "#b8325a"],
  ["amber", "Amber", "#a15c07"],
];

export function SettingsModal({ onClose, onReplayAcademy }: { onClose: () => void; onReplayAcademy?: () => void }) {
  const { profile, setProfile, run, toast, confirm } = useApp();
  const s = useSettings();
  const progress = useProgress();
  const [page, setPage] = useState<"look" | "reading" | "access" | "training" | "you">("look");
  const scale = profile?.text_scale ?? 1;
  const setScale = (v: number) => profile && run(async () => setProfile((await call("profile.set", { name: profile.name, text_scale: v })).profile));
  const pages: [typeof page, string][] = [
    ["look", "Appearance"],
    ["reading", "Reading and layout"],
    ["access", "Accessibility"],
    ["training", "Training and sound"],
    ["you", "You"],
  ];
  return (
    <Modal title="Settings" onClose={onClose} wide>
      <div className="settings">
        <nav className="settings-nav" role="tablist" aria-label="Settings sections">
          {pages.map(([k, t]) => (
            <button key={k} role="tab" aria-selected={page === k} className={page === k ? "on" : ""} onClick={() => setPage(k)}>
              {t}
            </button>
          ))}
        </nav>
        <div className="settings-body">
          {page === "look" && (
            <>
              <h3>Appearance</h3>
              <Choice k="theme" label="Theme" options={[["light", "Light"], ["dark", "Dark"], ["system", "Match my computer"]]} />
              <div className="set-row">
                <div className="set-label" id="lbl-accent">Accent colour</div>
                <div className="swatches" role="radiogroup" aria-labelledby="lbl-accent">
                  {ACCENTS.map(([v, name, c]) => (
                    <button key={v} role="radio" aria-checked={s.accent === v} aria-label={name} title={name} className={`sw ${s.accent === v ? "on" : ""}`} style={{ background: c }} onClick={() => updateSettings({ accent: v })}>
                      {s.accent === v ? "✓" : ""}
                    </button>
                  ))}
                </div>
              </div>
              <Choice k="font" label="Font" options={[["default", "Standard"], ["serif", "Serif"], ["easy", "Easy reading"], ["mono", "Monospace"]]} />
              <div className="preview-card">
                <strong>Preview</strong>
                <p>The last confirmed contact was the message at 20:14. <span className="cite">EV-010</span> <span className="ftype">fact</span></p>
                <button className="primary">Primary button</button> <button>Normal button</button>
              </div>
            </>
          )}
          {page === "reading" && (
            <>
              <h3>Reading and layout</h3>
              <div className="set-row">
                <div className="set-label">Text size</div>
                <div className="row">
                  <button aria-label="Smaller text" disabled={!profile} onClick={() => setScale(Math.max(0.8, +(scale - 0.1).toFixed(1)))}>A−</button>
                  <span className="scale-val">{Math.round(scale * 100)}%</span>
                  <button aria-label="Larger text" disabled={!profile} onClick={() => setScale(Math.min(1.6, +(scale + 0.1).toFixed(1)))}>A+</button>
                  <button className="ghost" disabled={!profile} onClick={() => setScale(1)}>Reset</button>
                </div>
              </div>
              <Choice k="lineSpacing" label="Line spacing" options={[["tight", "Tight"], ["normal", "Normal"], ["relaxed", "Relaxed"]]} />
              <Choice k="density" label="Spacing of buttons and lists" options={[["compact", "Compact"], ["comfortable", "Comfortable"], ["spacious", "Spacious"]]} />
              <Choice k="panels" label="Side panel width" options={[["narrow", "Narrow"], ["normal", "Normal"], ["wide", "Wide"]]} />
              <Toggle k="showClock" label="Show the case clock" help="The in-case time and time worked in the top bar." />
            </>
          )}
          {page === "access" && (
            <>
              <h3>Accessibility</h3>
              <Choice k="contrast" label="Contrast" options={[["normal", "Normal"], ["high", "High"]]} />
              <Choice k="motion" label="Animation" options={[["system", "Match my computer"], ["full", "Full"], ["reduced", "Reduced"]]} />
              <Toggle k="colourBlind" label="Colour-blind friendly colours" help="Uses blue, orange and purple that stay distinct for most kinds of colour blindness. Labels always show as text too." />
              <p className="muted small">Everything can be used with the keyboard. Press Tab to move and Enter or Space to choose. Escape closes windows.</p>
            </>
          )}
          {page === "training" && (
            <>
              <h3>Training and sound</h3>
              <Toggle k="sound" label="Sound effects" help="Short, quiet tones in the Training Academy. They are made by the app and nothing is downloaded." />
              <div className="set-row">
                <div>
                  <div className="set-label">Training Academy</div>
                  <div className="muted small">{rankFor(totalXp(progress)).name} · {totalXp(progress)} XP · {progress.badges.length} badges</div>
                </div>
                <button className="primary" onClick={() => { onClose(); onReplayAcademy?.(); }}>{progress.academy === "done" ? "Replay" : "Open"}</button>
              </div>
              <div className="set-row">
                <div>
                  <div className="set-label">Guided tour of the case desk</div>
                  <div className="muted small">The pointers that appear the first time you open a case.</div>
                </div>
                <button onClick={() => { updateProgress({ tour: "new" }); toast("The tour will show next time you open a case.", "good"); }}>Show again</button>
              </div>
              <div className="set-row">
                <div>
                  <div className="set-label">Clear Academy progress</div>
                  <div className="muted small">Removes your XP and badges on this computer. Your cases and saves are not touched.</div>
                </div>
                <button className="danger" onClick={async () => { if (await confirm("Clear your Academy XP and badges?", "Clear progress", "Clear")) { resetProgress(); toast("Academy progress cleared."); } }}>Clear</button>
              </div>
            </>
          )}
          {page === "you" && (
            <>
              <h3>You</h3>
              {profile ? (
                <>
                  <p className="muted">Your name appears at the top of the window and on report sign-off. It is cosmetic only.</p>
                  <div className="preset-grid">
                    {PRESETS.map((p) => (
                      <button key={p.name} className={`preset ${profile.name === p.name ? "on" : ""}`} onClick={() => run(async () => setProfile((await call("profile.set", { name: p.name })).profile))}>
                        <Avatar name={p.name} size={44} />
                        <strong>{p.name}</strong>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <p className="muted">Choose a name first, then you can change it here.</p>
              )}
              <hr />
              <div className="set-row">
                <div>
                  <div className="set-label">Reset all display settings</div>
                  <div className="muted small">Puts theme, fonts and layout back to how they came.</div>
                </div>
                <button onClick={() => { resetSettings(); toast("Settings reset.", "good"); }} disabled={JSON.stringify(s) === JSON.stringify(DEFAULT_SETTINGS)}>Reset</button>
              </div>
              <p className="muted small">Settings are saved on this computer only.</p>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}

export function SettingsButton({ onOpen, className }: { onOpen: () => void; className?: string }) {
  return (
    <button className={`ghost gear ${className ?? ""}`} aria-label="Settings" title="Settings (press ,)" onClick={onOpen} data-tour="settings">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
      </svg>
    </button>
  );
}
