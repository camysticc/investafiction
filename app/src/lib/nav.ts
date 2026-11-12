/* Which main area is showing, and helpers any screen can call to move the
 * player to another area. Seven areas, as in plan section 4.5. */
import { useSyncExternalStore } from "react";

export type Area = "library" | "workspace" | "academy" | "settings" | "help" | "progress" | "profile";
type NavState = {
  area: Area;
  settingsTarget: string | null; // category id or setting id
  helpOpen: boolean; // side panel
  helpArticle: string | null;
  helpQuery: string;
  lesson: string | null;
  replay: { case_id: string; attempt_id: string } | null;
  quickIntro: boolean;
  whatIsThis: boolean;
};
let state: NavState = { area: "library", settingsTarget: null, helpOpen: false, helpArticle: null, helpQuery: "", lesson: null, replay: null, quickIntro: false, whatIsThis: false };
const listeners = new Set<() => void>();
function setState(p: Partial<NavState>) {
  state = { ...state, ...p };
  listeners.forEach((l) => l());
}
export function useNav(): NavState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
  );
}
export const getNav = () => state;
export const goTo = (area: Area) => setState({ area });
export const openSettings = (target: string | null = null) => setState({ area: "settings", settingsTarget: target });
export const openAcademy = (lesson: string | null = null) => setState({ area: "academy", lesson });
export const openQuickIntro = () => setState({ quickIntro: true });
export const closeQuickIntro = () => setState({ quickIntro: false });
export const openReplay = (case_id: string, attempt_id: string) => setState({ replay: { case_id, attempt_id } });
export const closeReplay = () => setState({ replay: null });
export const setWhatIsThis = (on: boolean) => setState({ whatIsThis: on });
let helpMode: () => "side_panel" | "separate_window" = () => "side_panel";
export const setHelpModeSource = (fn: typeof helpMode) => (helpMode = fn);
/** Open the help centre, optionally at an article or with a search filled in. */
export function openHelp(article: string | null = null, query = "") {
  if (helpMode() === "separate_window") setState({ area: "help", helpArticle: article, helpQuery: query, helpOpen: false });
  else setState({ helpOpen: true, helpArticle: article, helpQuery: query });
}
export const closeHelp = () => setState({ helpOpen: false });
