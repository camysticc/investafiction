import { useEffect, useState } from "react";
import { ACTIONS, actionFor, comboOf, keyFor } from "../lib/shortcuts";
import { goTo, openHelp, openSettings, setWhatIsThis, getNav } from "../lib/nav";
import { get, set } from "../lib/settings";
import { useApp } from "../lib/store";
import { Modal } from "./common";

/** Global keyboard handler. Area and interface actions run here; case
 * actions are passed on as an "inv:cmd" event to the screen that owns them. */
export default function Shortcuts() {
  const { game, setTab, act } = useApp();
  const [sheet, setSheet] = useState(false);
  useEffect(() => {
    const open = () => setSheet(true);
    window.addEventListener("inv:shortcut-sheet", open);
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
      const combo = comboOf(e);
      const id = actionFor(combo);
      if (!id) return;
      const plain = !/Ctrl|Alt|F\d/.test(combo);
      if (typing && plain) return;
      if (document.querySelector(".su-root, .academy")) return;
      e.preventDefault();
      const tabs: Record<string, string> = { "tab.viewer": "viewer", "tab.search": "search", "tab.statements": "statements", "tab.timeline": "timeline", "tab.links": "links", "tab.map": "map", "tab.browser": "browser", "tab.requests": "requests", "tab.integrity": "integrity", "tab.report": "report", "tab.debrief": "debrief" };
      if (id in tabs) {
        if (game) {
          goTo("workspace");
          setTab(tabs[id]);
        }
        return;
      }
      switch (id) {
        case "area.library": return goTo("library");
        case "area.workspace": return game && goTo("workspace");
        case "area.academy": return goTo("academy");
        case "area.progress": return goTo("progress");
        case "area.settings": return openSettings();
        case "area.help": return openHelp();
        case "area.profile": return goTo("profile");
        case "ui.what_is_this": return get("academy.what_is_this_mode") && setWhatIsThis(!getNav().whatIsThis);
        case "ui.shortcut_sheet": return setSheet(true);
        case "ui.toggle_theme": return set("appearance.theme", document.documentElement.dataset.theme === "dark" ? "light" : "dark");
        case "ui.text_bigger": case "ui.text_smaller": {
          const order = ["small", "medium", "large", "extra_large", "huge"];
          const i = order.indexOf(get("appearance.text_size"));
          return set("appearance.text_size", order[Math.max(0, Math.min(order.length - 1, i + (id === "ui.text_bigger" ? 1 : -1)))]);
        }
        case "case.save": return game && act({ type: "save" });
        default:
          window.dispatchEvent(new CustomEvent("inv:cmd", { detail: id }));
      }
    };
    window.addEventListener("keydown", h);
    return () => {
      window.removeEventListener("keydown", h);
      window.removeEventListener("inv:shortcut-sheet", open);
    };
  }, [game?.attempt.id]);
  if (!sheet) return null;
  const groups = [...new Set(ACTIONS.map((a) => a.group))];
  return (
    <Modal title="Keyboard shortcuts" onClose={() => setSheet(false)} wide>
      <div className="shortcut-sheet">
        {groups.map((g) => (
          <section key={g}>
            <h4>{g}</h4>
            <table className="grid">
              <tbody>
                {ACTIONS.filter((a) => a.group === g).map((a) => (
                  <tr key={a.id}><td>{a.label}</td><td><kbd>{keyFor(a.id) || "none"}</kbd></td></tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
      </div>
      <div className="row-end"><button onClick={() => window.print()}>Print</button></div>
    </Modal>
  );
}
