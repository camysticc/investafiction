import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { ApiError, call, offerDownload } from "./api";
import type { GameState, Profile } from "./types";
import { get as setting, playSound } from "./settings";
import { openHelp } from "./nav";

type Toast = { id: number; text: string; kind: "info" | "error" | "good"; help?: string | null };
type Confirm = { text: string; title?: string; okLabel?: string; resolve: (ok: boolean) => void } | null;

type Ctx = {
  profile: Profile | null;
  setProfile: (p: Profile | null) => void;
  game: GameState | null;
  setGame: (g: GameState | null) => void;
  saving: boolean;
  lastSaved: Date | null;
  toast: (text: string, kind?: Toast["kind"], help?: string | null) => void;
  confirm: (text: string, title?: string, okLabel?: string) => Promise<boolean>;
  /** Apply an action. Training-mode warnings are shown and confirmed here. */
  act: (args: Record<string, unknown>) => Promise<any | null>;
  /** Call a command that may return a warning needing confirmation. */
  guarded: (cmd: string, args: Record<string, unknown>) => Promise<any | null>;
  run: <T>(fn: () => Promise<T>) => Promise<T | null>;
  exportFile: (kind: string, extra?: Record<string, unknown>) => Promise<void>;
  tab: string;
  setTab: (t: string) => void;
  selected: string | null;
  select: (id: string | null) => void;
  browserTarget: string | null;
  openPage: (pageId: string | null) => void;
};

const AppCtx = createContext<Ctx | null>(null);

export function useApp(): Ctx {
  const c = useContext(AppCtx);
  if (!c) throw new Error("no app context");
  return c;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [game, setGameRaw] = useState<GameState | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmState, setConfirm] = useState<Confirm>(null);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [tab, setTabRaw] = useState("viewer");
  const [selected, setSelected] = useState<string | null>(null);
  const [browserTarget, setBrowserTarget] = useState<string | null>(null);
  const n = useRef(0);

  const toast = useCallback((text: string, kind: Toast["kind"] = "info", help: string | null = null) => {
    const id = ++n.current;
    setToasts((t) => [...t.slice(-4), { id, text, kind, help }]);
    const d = setting<string>("notifications.notification_duration");
    const ms = d === "3_seconds" ? 3000 : d === "10_seconds" ? 10000 : d === "until_closed" ? 0 : 5500;
    if (ms) setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "error" ? Math.max(ms, 9000) : ms);
    if (text.includes("is open.")) playSound("chime");
  }, []);

  const confirm = useCallback((text: string, title?: string, okLabel?: string) => new Promise<boolean>((resolve) => setConfirm({ text, title, okLabel, resolve })), []);

  const setGame = useCallback((g: GameState | null) => {
    setGameRaw(g);
    if (g?.profile) setProfile(g.profile);
  }, []);

  const showError = useCallback(
    (e: unknown) => {
      const msg = e instanceof ApiError ? (e.details.length ? `${e.message} ${e.details.slice(0, 3).join(" ")}` : e.message) : String(e);
      import("../help/search").then((H) => H.warmUp().then(() => {
        const a = H.articleForError(msg) ?? (e instanceof ApiError ? H.articleForError(e.details.join(" ")) : null);
        toast(msg, "error", a?.id ?? null);
      })).catch(() => toast(msg, "error"));
    },
    [toast],
  );

  const run = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T | null> => {
      try {
        return await fn();
      } catch (e) {
        showError(e);
        return null;
      }
    },
    [showError],
  );

  const guarded = useCallback(
    async (cmd: string, args: Record<string, unknown>) => {
      try {
        setSaving(true);
        let r = await call(cmd, args);
        if (r?.warning) {
          playSound("warning");
          const ok = await confirm(r.warning, "Training mode warning", "Continue anyway");
          if (!ok) return null;
          r = await call(cmd, { ...args, confirm: true });
        }
        if (r?.state) setGame(r.state);
        for (const note of r?.notices ?? []) toast(note, note.startsWith("Objective complete") || note.includes("is open") ? "good" : "info");
        setLastSaved(new Date());
        return r;
      } catch (e) {
        showError(e);
        return null;
      } finally {
        setSaving(false);
      }
    },
    [confirm, setGame, toast, showError],
  );

  const act = useCallback((args: Record<string, unknown>) => guarded("act", args), [guarded]);

  const exportFile = useCallback(
    async (kind: string, extra: Record<string, unknown> = {}) => {
      const r = await run(() => call("export", { kind, ...extra }));
      if (r) {
        offerDownload(r.filename, r.data_b64);
        toast(`Exported ${r.filename}. Saved to ${r.path}`, "good");
      }
    },
    [run, toast],
  );

  const setTab = useCallback((t: string) => {
    setTabRaw(t);
    call("act", { type: "view", view: { tab: t } }).catch(() => {});
  }, []);

  const select = useCallback((id: string | null) => {
    setSelected(id);
    if (id) setTabRaw("viewer");
  }, []);

  const openPage = useCallback((p: string | null) => {
    setBrowserTarget(p);
    setTabRaw("browser");
  }, []);

  // Track active time while the window is visible and the player is active.
  const lastInput = useRef(Date.now());
  useEffect(() => {
    const bump = () => (lastInput.current = Date.now());
    window.addEventListener("keydown", bump);
    window.addEventListener("mousedown", bump);
    window.addEventListener("mousemove", bump);
    return () => {
      window.removeEventListener("keydown", bump);
      window.removeEventListener("mousedown", bump);
      window.removeEventListener("mousemove", bump);
    };
  }, []);
  useEffect(() => {
    if (!game || game.attempt.submitted) return;
    const h = setInterval(async () => {
      const idle = setting<string>("gameplay.pause_the_clock_when_idle");
      const limit = idle === "off" ? Infinity : idle === "after_2_minutes" ? 2 * 60_000 : 5 * 60_000;
      if (document.visibilityState !== "visible" || Date.now() - lastInput.current > limit) return;
      try {
        const r = await call("act", { type: "tick", seconds: 30 });
        setGameRaw(r.state);
        setLastSaved(new Date());
      } catch {
        /* the next tick will retry */
      }
    }, 30_000);
    return () => clearInterval(h);
  }, [game?.attempt.id, game?.attempt.submitted]);

  const value: Ctx = { profile, setProfile, game, setGame, saving, lastSaved, toast, confirm, act, guarded, run, exportFile, tab, setTab, selected, select, browserTarget, openPage };

  return (
    <AppCtx.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`}>
            <span>{t.text}</span>
            {t.help && <button className="small toast-help" onClick={() => openHelp(t.help!)}>Help</button>}
            <button className="toast-x" aria-label="Dismiss" onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}>✕</button>
          </div>
        ))}
      </div>
      {confirmState && (
        <div className="modal-back" role="dialog" aria-modal="true">
          <div className="modal modal-small">
            <h3>{confirmState.title ?? "Please confirm"}</h3>
            <p>{confirmState.text}</p>
            <div className="row-end">
              <button
                autoFocus
                onClick={() => {
                  confirmState.resolve(false);
                  setConfirm(null);
                }}
              >
                Go back
              </button>
              <button
                className="danger"
                onClick={() => {
                  confirmState.resolve(true);
                  setConfirm(null);
                }}
              >
                {confirmState.okLabel ?? "Continue"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppCtx.Provider>
  );
}
