import { useEffect, useState } from "react";
import { useApp } from "../lib/store";
import EvidenceList from "./EvidenceList";
import EvidenceViewer from "../viewers/EvidenceViewer";
import Timeline from "./Timeline";
import LinkGraph from "./LinkGraph";
import MapView from "./MapView";
import Browser from "./Browser";
import Requests from "./Requests";
import Integrity from "./Integrity";
import ReportView from "./ReportView";
import Debrief from "./Debrief";
import SidePanel from "./SidePanel";
import SearchPanel from "./SearchPanel";
import Statements from "./Statements";
import ToolPrompt from "../academy/ToolPrompt";

const TABS = [
  ["viewer", "Evidence viewer"],
  ["search", "Search"],
  ["statements", "Statements"],
  ["timeline", "Timeline"],
  ["links", "Link chart"],
  ["map", "Map"],
  ["browser", "Web browser"],
  ["requests", "Requests"],
  ["integrity", "Integrity"],
  ["report", "Report"],
] as const;

export default function Workspace() {
  const { game, tab, setTab } = useApp();
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    if (!restored && game?.attempt.view?.tab) {
      setTab(game.attempt.submitted ? "debrief" : game.attempt.view.tab);
    } else if (!restored && game?.attempt.submitted) setTab("debrief");
    setRestored(true);
  }, []);
  if (!game) return null;
  const a = game.attempt;
  const tabs = a.submitted ? [["debrief", "Debrief"] as const, ...TABS] : TABS;
  return (
    <div className="workspace">
      <aside className="left" aria-label="Evidence list">
        <EvidenceList />
      </aside>
      <main className="centre">
        <nav className="tabs" role="tablist">
          {tabs.map(([k, label]) => (
            <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>
              {label}
              {k === "requests" && game.case.request_types.length > 0 && a.requests.length === 0 ? <span className="dot" /> : null}
            </button>
          ))}
        </nav>
        <ToolPrompt />
        <div className="tab-body">
          {tab === "viewer" && <EvidenceViewer />}
          {tab === "search" && <SearchPanel />}
          {tab === "statements" && <Statements />}
          {tab === "timeline" && <Timeline />}
          {tab === "links" && <LinkGraph />}
          {tab === "map" && <MapView />}
          {tab === "browser" && <Browser />}
          {tab === "requests" && <Requests />}
          {tab === "integrity" && <Integrity />}
          {tab === "report" && <ReportView />}
          {tab === "debrief" && <Debrief />}
        </div>
      </main>
      <aside className="right" aria-label="Notes, findings and log">
        <SidePanel />
      </aside>
    </div>
  );
}
