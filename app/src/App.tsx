import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { call } from "./lib/api";
import { useApp } from "./lib/store";
import Welcome from "./components/Welcome";
import Library from "./components/Library";
import Workspace from "./components/Workspace";
import TopBar from "./components/TopBar";
import BriefView from "./components/BriefView";
import Academy from "./components/Academy";
import Tour from "./components/Tour";
import LeftMenu from "./components/LeftMenu";
import StatusBar from "./components/StatusBar";
import ReadingRuler from "./components/ReadingRuler";
import Shortcuts from "./components/Shortcuts";
import SandboxOverlay from "./academy/SandboxOverlay";
import PracticeGuide from "./academy/PracticeGuide";
import { sandboxActive } from "./academy/sandbox";
import StartupSequence, { type StartupWork } from "./startup/StartupSequence";
import { loadSettings, get as setting, useSetting } from "./lib/settings";
import { loadProgress, useProgress } from "./lib/progress";
import { closeQuickIntro, closeReplay, goTo, openQuickIntro, setHelpModeSource, useNav } from "./lib/nav";

const SettingsPage = lazy(() => import("./components/SettingsPage"));
const AcademyHome = lazy(() => import("./academy/AcademyHome"));
const HelpCentre = lazy(() => import("./help/HelpCentre"));
const Progress = lazy(() => import("./components/Progress"));
const ProfilePage = lazy(() => import("./components/ProfilePage"));
const Replay = lazy(() => import("./components/Replay"));
const WhatIsThis = lazy(() => import("./help/WhatIsThis"));

export default function App() {
  const { profile, setProfile, game, setGame, run, toast } = useApp();
  const [phase, setPhase] = useState<"boot" | "name" | "startup" | "app">("boot");
  const nav = useNav();
  const progress = useProgress();
  const reduced = useSetting<boolean>("accessibility.reduce_motion");
  const settingsLoaded = useRef(false);
  setHelpModeSource(() => setting("academy.open_help_in"));

  useEffect(() => {
    run(async () => {
      // Quietly load display settings so the name screen already uses them.
      await Promise.all([loadSettings(), loadProgress()]);
      settingsLoaded.current = true;
      const r = await call("profile.get");
      setProfile(r.profile);
      setPhase(r.profile ? "startup" : "name");
    });
  }, []);

  // A name chosen on the first launch leads straight into the start-up sequence.
  useEffect(() => {
    if (phase === "name" && profile) setPhase("startup");
    if (phase === "app" && !profile) setPhase("name");
  }, [profile, phase]);

  // Opening an attempt takes the player to the workspace.
  const lastGame = useRef<string | null>(null);
  useEffect(() => {
    const id = game?.attempt.id ?? null;
    if (id && id !== lastGame.current) goTo("workspace");
    if (!id && nav.area === "workspace") goTo("library");
    lastGame.current = id;
  }, [game?.attempt.id]);

  // Confirm before closing, if the player wants it.
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (setting("general.confirm_before_closing") && phase === "app") {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [phase]);

  const work: StartupWork = [
    {
      label: "Checking saved work",
      run: async () => {
        const r = await loadSettings();
        await loadProgress();
        if (r.damaged) setTimeout(() => toast("Your settings file could not be read, so the defaults are in use. Case saves are not affected.", "error"), 400);
      },
    },
    { label: "Verifying case packs", run: () => call("library.list") },
    { label: "Loading the help centre", run: () => import("./help/search").then((m) => m.warmUp()) },
    {
      label: "Restoring your desk",
      run: async () => {
        const start = setting<string>("general.default_start_screen");
        if (setting("general.open_last_case_automatically") || start === "last_case") {
          const lib = await call("library.list");
          let best: { c: string; a: string; t: string } | null = null;
          for (const c of lib.cases) for (const a of c.attempts) if (!a.submitted && (!best || a.updated > best.t)) best = { c: c.id, a: a.id, t: a.updated };
          if (best) {
            setGame(await call("attempt.open", { case_id: best.c, attempt_id: best.a }));
            return;
          }
        }
        goTo(start === "academy" ? "academy" : "library");
      },
    },
  ];

  if (phase === "boot") return <div className="splash">Opening your desk…</div>;
  if (phase === "name") return <Welcome />;
  if (phase === "startup")
    return (
      <StartupSequence
        name={profile!.name}
        reducedMotion={reduced}
        work={work}
        onDone={() => {
          setPhase("app");
          if (progress.academy === "new") setTimeout(openQuickIntro, 300);
        }}
      />
    );

  const inWorkspace = !!game && game.attempt.scope_acknowledged && nav.area === "workspace";
  const area = nav.area === "workspace" && !game ? "library" : nav.area;
  return (
    <>
      <div className="app">
        <TopBar onLeave={async () => { await run(() => call("attempt.close")); setGame(null); goTo("library"); }} />
        <div className={`shell ${nav.helpOpen ? "with-help" : ""}`}>
          <LeftMenu />
          <div className="area" id="main-area">
            <Suspense fallback={<div className="splash small">Loading…</div>}>
              {area === "library" && <Library />}
              {area === "workspace" && game && (!game.attempt.scope_acknowledged ? <BriefView firstTime /> : <Workspace />)}
              {area === "academy" && <AcademyHome />}
              {area === "settings" && <SettingsPage />}
              {area === "help" && <HelpCentre full />}
              {area === "progress" && <Progress />}
              {area === "profile" && <ProfilePage />}
            </Suspense>
          </div>
          {nav.helpOpen && (
            <Suspense fallback={null}>
              <HelpCentre />
            </Suspense>
          )}
        </div>
        <StatusBar />
      </div>
      {nav.quickIntro && <Academy onClose={closeQuickIntro} />}
      {nav.replay && (
        <Suspense fallback={null}>
          <Replay caseId={nav.replay.case_id} attemptId={nav.replay.attempt_id} onClose={closeReplay} />
        </Suspense>
      )}
      {nav.whatIsThis && (
        <Suspense fallback={null}>
          <WhatIsThis />
        </Suspense>
      )}
      {inWorkspace && !nav.quickIntro && !game!.attempt.submitted && progress.tour === "new" && !sandboxActive() && <Tour />}
      {nav.area === "workspace" && <SandboxOverlay />}
      {nav.area === "workspace" && <PracticeGuide />}
      <ReadingRuler />
      <Shortcuts />
    </>
  );
}
