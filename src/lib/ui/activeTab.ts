export const ACTIVE_TAB_STORAGE_KEY = "practice.activeTab";

export type HomeTab = "songs" | "exercises";

export function setActiveHomeTab(tab: HomeTab): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, tab);
  } catch {
    // ignore quota / privacy-mode errors
  }
}
