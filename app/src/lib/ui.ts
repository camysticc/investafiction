/** Tiny helpers so any screen can open the global Settings window or the Academy. */
export const openSettings = () => window.dispatchEvent(new CustomEvent("inv:settings"));
export const openAcademy = () => window.dispatchEvent(new CustomEvent("inv:academy"));
