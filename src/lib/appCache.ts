export const APP_DATA_CACHE_KEY = "koenen:app-data-cache:v7";

const LEGACY_APP_DATA_CACHE_KEYS = [
  "koenen:app-data-cache:v2",
  "koenen:app-data-cache:v3",
  "koenen:app-data-cache:v4",
  "koenen:app-data-cache:v5",
  "koenen:app-data-cache:v6",
];

export function clearAppDataCache() {
  if (typeof window === "undefined") return;

  for (const key of [APP_DATA_CACHE_KEY, ...LEGACY_APP_DATA_CACHE_KEYS]) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Storage may be unavailable in private mode; ignore.
    }
  }
}

export function emitFinanceEntryChanged() {
  if (typeof window === "undefined") return;
  clearAppDataCache();
  window.dispatchEvent(new CustomEvent("koenen:finance-entry-changed"));
}
