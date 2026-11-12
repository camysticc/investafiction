import { useEffect, useMemo, useRef, useState } from "react";
import { call, fileToBase64, offerDownload, textToBase64 } from "../lib/api";
import { useApp } from "../lib/store";
import {
  SCHEMA, DEFAULTS, DEFS, applyPreset, changedFromDefault, exportSettings, importSettings, resetAll, resetCategory, resetOne, set,
  useSettings, type SettingDef,
} from "../lib/settings";
import { countSettingChange, resetProgress } from "../lib/progress";
import { ACTIONS, bindings, comboOf, rebind, resetShortcuts } from "../lib/shortcuts";
import { openHelp, useNav } from "../lib/nav";
import { Avatar, AVATAR_IDS, PRESETS as NAMES } from "./Welcome";
import { NOT_ACTIVE } from "../lib/wiring";

function fmtBytes(n: number) {
  if (n < 1024) return `${n} bytes`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function score(def: SettingDef, q: string): number {
  const t = q.toLowerCase().trim();
  if (!t) return 0;
  const words = t.split(/\s+/);
  const hay = `${def.label} ${def.description} ${(def.options ?? []).map((o) => o.label).join(" ")} ${SCHEMA.categories.find((c) => c.id === def.category)?.label}`.toLowerCase();
  let s = 0;
  for (const w of words) {
    if (def.label.toLowerCase().includes(w)) s += 3;
    else if (hay.includes(w)) s += 1;
    else if (w.length > 4 && hay.includes(w.slice(0, -1))) s += 0.5;
    else return 0;
  }
  return s;
}

export default function SettingsPage() {
  const values = useSettings();
  const nav = useNav();
  const { toast, confirm } = useApp();
  const [cat, setCat] = useState(SCHEMA.categories[0].id);
  const [q, setQ] = useState("");
  const [more, setMore] = useState(() => localStorage.getItem("inv.settings.more") !== "off");
  const [flash, setFlash] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = nav.settingsTarget;
    if (!t) return;
    if (DEFS[t]) {
      setCat(DEFS[t].category);
      setQ("");
      setMore(true);
      setFlash(t);
      setTimeout(() => document.getElementById(`set-${t}`)?.scrollIntoView({ block: "center" }), 60);
      setTimeout(() => setFlash(null), 2200);
    } else if (SCHEMA.categories.some((c) => c.id === t)) setCat(t);
  }, [nav.settingsTarget]);

  useEffect(() => localStorage.setItem("inv.settings.more", more ? "on" : "off"), [more]);

  const changed = changedFromDefault();
  const list = useMemo(() => {
    if (q.trim()) return SCHEMA.settings.map((d) => [d, score(d, q)] as const).filter(([, s]) => s > 0).sort((a, b) => b[1] - a[1]).map(([d]) => d);
    const inCat = SCHEMA.settings.filter((d) => d.category === cat);
    return [...inCat.filter((d) => d.essential), ...inCat.filter((d) => !d.essential && more)];
  }, [q, cat, more]);
  const hiddenExtra = !q.trim() ? SCHEMA.settings.filter((d) => d.category === cat && !d.essential).length : 0;
  const category = SCHEMA.categories.find((c) => c.id === cat)!;

  return (
    <main className="settings-page" data-help="area.settings">
      <header className="sp-head">
        <div>
          <h1>Settings</h1>
          <p className="muted">{SCHEMA.settings.length} settings in {SCHEMA.categories.length} categories. Changes apply straight away; there is no Save button. Settings are stored on this computer only.</p>
        </div>
        <div className="row">
          <input className="sp-search" type="search" placeholder="Search settings, for example 'dark' or 'bigger text'" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search settings" />
        </div>
      </header>
      <div className="sp-presets" role="group" aria-label="Presets">
        <span className="muted small">Presets:</span>
        {SCHEMA.presets.map((p) => (
          <button key={p.id} title={p.description} onClick={async () => {
            if (await confirm(`${p.description} This changes many settings at once. You can still change any of them afterwards.`, `Apply the ${p.label} preset?`, "Apply")) {
              applyPreset(p.id);
              toast(`${p.label} preset applied.`, "good");
            }
          }}>{p.label}</button>
        ))}
        <span className="sp-spacer" />
        <label className="sp-more">
          <input type="checkbox" checked={more} onChange={(e) => setMore(e.target.checked)} /> Show more settings
        </label>
        <button onClick={() => {
          const text = exportSettings();
          call("data.write_file", { filename: "investafiction-settings.json", data_b64: textToBase64(text) })
            .then((r: any) => { offerDownload(r.filename, r.data_b64); toast(`Settings exported to ${r.path}`, "good"); })
            .catch(() => toast("The settings could not be exported.", "error"));
        }}>Export</button>
        <button onClick={() => fileRef.current?.click()}>Import</button>
        <input ref={fileRef} type="file" accept=".json" hidden onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          const r = importSettings(await f.text());
          toast(r.ok ? `Settings imported.${r.dropped ? ` ${r.dropped} unknown or invalid value(s) were ignored.` : ""}` : r.message!, r.ok ? "good" : "error");
          e.target.value = "";
        }} />
        <button className="danger" disabled={!changed.length} onClick={async () => {
          if (await confirm("Put every setting back to its default? Saves and Academy progress are not touched.", "Reset everything", "Reset")) {
            resetAll();
            toast("All settings reset.", "good");
          }
        }}>Reset everything</button>
      </div>
      <div className="sp-body">
        <nav className="sp-cats" aria-label="Setting categories">
          {SCHEMA.categories.map((c) => {
            const n = SCHEMA.settings.filter((d) => d.category === c.id).length;
            const ch = changed.filter((id) => DEFS[id].category === c.id).length;
            return (
              <button key={c.id} className={!q && cat === c.id ? "on" : ""} aria-current={!q && cat === c.id ? "true" : undefined} onClick={() => { setCat(c.id); setQ(""); }}>
                <span>{c.label}</span>
                <span className="muted small">{ch ? `${ch} changed · ` : ""}{n}</span>
              </button>
            );
          })}
        </nav>
        <section className="sp-list" aria-live="polite">
          {q.trim() ? (
            <h2>{list.length ? `${list.length} setting${list.length === 1 ? "" : "s"} match "${q}"` : `No settings match "${q}"`}</h2>
          ) : (
            <div className="sp-cat-head">
              <div>
                <h2>{category.label}</h2>
                <p className="muted">{category.description}</p>
              </div>
              <button className="ghost small" onClick={() => { resetCategory(cat); toast(`${category.label} reset to defaults.`); }}>Reset this category</button>
            </div>
          )}
          {cat === "appearance" && !q.trim() && <Preview />}
          {list.map((d) => (
            <Row key={d.id} def={d} value={values[d.id]} flash={flash === d.id} showCat={!!q.trim()} />
          ))}
          {!q.trim() && !more && hiddenExtra > 0 && (
            <button className="ghost sp-show-more" onClick={() => setMore(true)}>Show {hiddenExtra} more setting{hiddenExtra === 1 ? "" : "s"} in {category.label}</button>
          )}
          {q.trim() && list.length === 0 && <p className="muted">Try other words, or search the <button className="linklike" onClick={() => openHelp(null, q)}>help centre</button>.</p>}
        </section>
      </div>
    </main>
  );
}

function Preview() {
  return (
    <div className="preview-card" aria-label="Live preview">
      <strong>Live preview</strong>
      <p>The last confirmed contact was the message at 20:14. <span className="cite">EV-010</span> <span className="ftype">fact</span></p>
      <div className="row"><button className="primary">Primary button</button><button>Normal button</button><a href="#" onClick={(e) => e.preventDefault()}>A link</a></div>
    </div>
  );
}

function Row({ def: d, value, flash, showCat }: { def: SettingDef; value: any; flash: boolean; showCat: boolean }) {
  const isDefault = JSON.stringify(value) === JSON.stringify(DEFAULTS[d.id]);
  const change = (v: any) => {
    set(d.id, v);
    countSettingChange();
  };
  return (
    <div id={`set-${d.id}`} className={`set-row ${flash ? "flash" : ""}`}>
      <div className="set-text">
        <div className="set-label">
          {d.label}
          {d.affects_score && <span className="tag score" title="This setting changes how attempts are marked. The debrief records it.">affects score</span>}
          {d.locked && <span className="tag locked">locked</span>}
          {!d.essential && <span className="tag extra">extra</span>}
          {NOT_ACTIVE.has(d.id) && <span className="tag later" title="This setting is saved but does not change anything yet. It is planned for a later version.">not active yet</span>}
          {showCat && <span className="muted small"> · {SCHEMA.categories.find((c) => c.id === d.category)?.label}</span>}
        </div>
        <div className="muted small">{d.locked ? d.locked_reason : d.description}{d.note ? ` ${d.note}` : ""}</div>
      </div>
      <div className="set-control">
        <Control def={d} value={value} onChange={change} />
        {(d.type === "choice" || d.type === "toggle" || d.type === "range") && (
          <button className="ghost icon-btn" aria-label={`Reset ${d.label}`} title="Reset to default" disabled={isDefault} onClick={() => resetOne(d.id)}>↺</button>
        )}
        <button className="ghost icon-btn" aria-label={`Help on ${d.label}`} title="What does this do?" onClick={() => openHelp(`setting.${d.id}`)}>?</button>
      </div>
    </div>
  );
}

function Control({ def: d, value, onChange }: { def: SettingDef; value: any; onChange: (v: any) => void }) {
  const { profile, setProfile, run } = useApp();
  if (d.type === "locked") return <span className="locked-val">🔒 {d.note?.replace(" (locked)", "")}</span>;
  if (d.type === "toggle") {
    const [on, off] = d.labels ?? ["On", "Off"];
    return (
      <button role="switch" aria-checked={!!value} aria-label={d.label} className={`switch ${value ? "on" : ""}`} onClick={() => onChange(!value)} title={value ? on : off}>
        <span />
      </button>
    );
  }
  if (d.type === "range") {
    return (
      <span className="range-wrap">
        <input type="range" min={d.min} max={d.max} step={d.step} value={value} aria-label={d.label} onChange={(e) => onChange(Number(e.target.value))} />
        <span className="range-val">{value}{d.unit}</span>
      </span>
    );
  }
  if (d.type === "choice") {
    if (d.id === "appearance.accent_colour") {
      const COL: Record<string, string> = { blue: "#1f4e79", teal: "#0f766e", green: "#2f7a4f", purple: "#6d3fc4", rose: "#b8325a", amber: "#a15c07", slate: "#475569", crimson: "#9f1239" };
      return (
        <div className="swatches" role="radiogroup" aria-label={d.label}>
          {d.options!.map((o) => (
            <button key={o.value} role="radio" aria-checked={value === o.value} aria-label={o.label} title={o.label} className={`sw ${value === o.value ? "on" : ""}`} style={{ background: COL[o.value] }} onClick={() => onChange(o.value)}>
              {value === o.value ? "✓" : ""}
            </button>
          ))}
        </div>
      );
    }
    if (d.id === "profile.avatar") {
      return (
        <div className="avatar-pick" role="radiogroup" aria-label={d.label}>
          {AVATAR_IDS.map((id) => (
            <button key={id} role="radio" aria-checked={value === id} className={`av-opt ${value === id ? "on" : ""}`} onClick={() => onChange(id)} aria-label={`Icon ${id.slice(4)}`}>
              <Avatar name={profile?.name ?? NAMES[0].name} size={30} icon={id} frame="none" />
            </button>
          ))}
        </div>
      );
    }
    if (d.options!.length <= 4 && d.options!.every((o) => o.label.length < 26))
      return (
        <div className="seg" role="radiogroup" aria-label={d.label}>
          {d.options!.map((o) => (
            <button key={o.value} role="radio" aria-checked={value === o.value} className={value === o.value ? "on" : ""} onClick={() => onChange(o.value)}>{o.label}</button>
          ))}
        </div>
      );
    return (
      <select value={value} aria-label={d.label} onChange={(e) => onChange(e.target.value)}>
        {d.options!.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  }
  if (d.type === "profile_name") {
    return (
      <div className="seg" role="radiogroup" aria-label={d.label}>
        {d.options!.map((o) => (
          <button key={o.value} role="radio" aria-checked={profile?.name === o.value} className={profile?.name === o.value ? "on" : ""}
            onClick={() => run(async () => setProfile((await call("profile.set", { name: o.value })).profile))}>{o.label}</button>
        ))}
      </div>
    );
  }
  if (d.type === "shortcuts") return <ShortcutEditor />;
  return <ActionButton def={d} />;
}

function ShortcutEditor() {
  const [open, setOpen] = useState(false);
  const [capturing, setCapturing] = useState<string | null>(null);
  useSettings();
  const b = bindings();
  useEffect(() => {
    if (!capturing) return;
    const h = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") return setCapturing(null);
      const c = comboOf(e);
      if (!c || ["Ctrl", "Alt", "Shift", "Ctrl+Alt", "Ctrl+Shift", "Alt+Shift"].includes(c)) return;
      rebind(capturing, c);
      setCapturing(null);
    };
    window.addEventListener("keydown", h, true);
    return () => window.removeEventListener("keydown", h, true);
  }, [capturing]);
  if (!open) return <button onClick={() => setOpen(true)}>Change shortcuts ({ACTIONS.length} actions)</button>;
  return (
    <div className="shortcut-editor">
      <div className="row-end"><button className="ghost small" onClick={() => setOpen(false)}>Close</button></div>
      <table className="grid">
        <tbody>
          {ACTIONS.map((a) => (
            <tr key={a.id}>
              <td>{a.label}<div className="muted small">{a.group}</div></td>
              <td>
                <button className={`kbd-btn ${capturing === a.id ? "capturing" : ""}`} onClick={() => setCapturing(a.id)}>
                  {capturing === a.id ? "Press keys… (Esc to cancel)" : <kbd>{b[a.id] || "none"}</kbd>}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ActionButton({ def: d }: { def: SettingDef }) {
  const { confirm, toast, setProfile, run, setGame } = useApp();
  const [info, setInfo] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const labels: Record<string, string> = {
    "profile.reset_profile": "Reset profile", "replay.reset_progress_history": "Reset history", "saves.export_all_saves": "Export saves",
    "saves.import_saves": "Import saves", "saves.show_storage_used": "Show", "saves.clear_caches": "Clear", "saves.delete_all_data": "Delete all data",
    "academy.reset_academy_progress": "Reset Academy", "shortcuts.show_shortcut_sheet": "Show sheet", "shortcuts.reset_all_shortcuts": "Reset shortcuts",
    "advanced.open_data_folder": "Show folder", "advanced.export_diagnostics": "Export diagnostics", "advanced.reset_all_settings": "Reset all settings",
  };
  const danger = d.confirm || d.id === "saves.delete_all_data";
  const go = async () => {
    switch (d.id) {
      case "profile.reset_profile":
        if (await confirm("Clear your chosen name? The name choice appears again. Saves, settings and Academy progress are kept.", "Reset profile", "Reset")) {
          const r = await run(() => call("profile.reset"));
          if (r) {
            setGame(null);
            setProfile(null);
          }
        }
        return;
      case "replay.reset_progress_history":
        if (await confirm("Clear the history behind the skills dashboard? Case saves are not touched.", "Reset progress history", "Reset")) {
          await run(() => call("history.reset"));
          toast("Progress history cleared.", "good");
        }
        return;
      case "academy.reset_academy_progress":
        if (await confirm("Clear your Academy XP, ranks and badges? Case saves are not touched.", "Reset Academy progress", "Reset")) {
          resetProgress();
          toast("Academy progress cleared.", "good");
        }
        return;
      case "saves.export_all_saves": {
        const r: any = await run(() => call("data.export_saves"));
        if (r) { offerDownload(r.filename, r.data_b64); toast(`Saves exported to ${r.path}`, "good"); }
        return;
      }
      case "saves.import_saves":
        importRef.current?.click();
        return;
      case "saves.show_storage_used": {
        const u: any = await run(() => call("data.usage"));
        if (u) setInfo(`Cases ${fmtBytes(u.cases)} · saves ${fmtBytes(u.saves)} · settings and progress ${fmtBytes(u.settings_and_progress)} · caches ${fmtBytes(u.caches)}`);
        return;
      }
      case "saves.clear_caches": {
        const r: any = await run(() => call("data.clear_caches"));
        if (r) toast(`Cleared ${fmtBytes(r.freed)} of temporary files.`, "good");
        return;
      }
      case "saves.delete_all_data":
        if (await confirm("This removes every case, save, setting and Academy record from this computer. It cannot be undone.", "Delete all data?", "Continue")) {
          if (await confirm("Are you completely sure? Everything will be deleted and the program will start fresh.", "Last check", "Delete everything")) {
            const r = await run(() => call("data.delete_all", { confirm: "DELETE EVERYTHING" }));
            if (r) { setGame(null); setProfile(null); location.reload(); }
          }
        }
        return;
      case "shortcuts.show_shortcut_sheet":
        window.dispatchEvent(new CustomEvent("inv:shortcut-sheet"));
        return;
      case "shortcuts.reset_all_shortcuts":
        if (await confirm("Put every shortcut back to the default?", "Reset shortcuts", "Reset")) { resetShortcuts(); toast("Shortcuts reset.", "good"); }
        return;
      case "advanced.open_data_folder": {
        const u: any = await run(() => call("app.info"));
        if (u) setInfo(`Your data is kept in: ${u.data_dir}`);
        return;
      }
      case "advanced.export_diagnostics": {
        const info: any = await run(() => call("app.info"));
        const usage: any = await run(() => call("data.usage"));
        const diag = { app: "Investafiction", version: info?.version, schema_major: info?.schema_major, platform: navigator.platform, user_agent: navigator.userAgent,
          screen: `${screen.width}x${screen.height}`, settings_changed: changedFromDefault(), storage: usage && { ...usage, data_dir: "(removed)" },
          note: "No case answers, saves or personal data are included." };
        const r: any = await run(() => call("data.write_file", { filename: "investafiction-diagnostics.json", data_b64: textToBase64(JSON.stringify(diag, null, 1)) }));
        if (r) { offerDownload(r.filename, r.data_b64); toast(`Diagnostics saved to ${r.path}`, "good"); }
        return;
      }
      case "advanced.reset_all_settings":
        if (await confirm("Put every setting back to its default? Saves and Academy progress are not touched.", "Reset all settings", "Reset")) { resetAll(); toast("All settings reset.", "good"); }
        return;
    }
  };
  return (
    <span className="action-wrap">
      <button className={danger ? "danger" : ""} onClick={go}>{labels[d.id] ?? "Run"}</button>
      {info && <span className="muted small action-info">{info}</span>}
      {d.id === "saves.import_saves" && (
        <input ref={importRef} type="file" accept=".json" hidden onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          const r: any = await run(async () => call("data.import_saves", { data_b64: await fileToBase64(f) }));
          if (r) toast(`Imported ${r.added} save(s). ${r.skipped} already here, ${r.rejected} could not be read.`, r.rejected ? "error" : "good");
          e.target.value = "";
        }} />
      )}
    </span>
  );
}
