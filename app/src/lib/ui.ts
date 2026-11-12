/* Kept for older imports: thin wrappers over the navigation helpers. */
export { openSettings, openHelp, openQuickIntro } from "./nav";
import { openAcademy as oa } from "./nav";
export const openAcademy = () => oa(null);
