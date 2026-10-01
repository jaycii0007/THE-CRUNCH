import type { Tab } from "./types/inventory";

export const STOCK_MANAGER_PATH = "/stockmanager";
export const STOCK_MANAGER_ACTIVE_TAB_STORAGE_KEY = "stockmanager.activeTab";
export const STOCK_MANAGER_TAB_REQUEST_EVENT = "stockmanager.tab.request";

export function requestStockManagerTab(tab: Tab) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STOCK_MANAGER_ACTIVE_TAB_STORAGE_KEY, tab);
  window.dispatchEvent(
    new CustomEvent(STOCK_MANAGER_TAB_REQUEST_EVENT, { detail: { tab } }),
  );
}
