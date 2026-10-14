// Display preferences (browser only): theme, font scale, high contrast.
export type Prefs = { theme: "light" | "dark"; fontScale: number; contrast: boolean; notify: boolean };
const KEY = "uni-prefs";
export const DEFAULT_PREFS: Prefs = { theme: "light", fontScale: 1, contrast: false, notify: true };

export function loadPrefs(): Prefs {
  try {
    return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(p: Prefs) {
  localStorage.setItem(KEY, JSON.stringify(p));
  applyPrefs(p);
}

export function applyPrefs(p: Prefs) {
  const el = document.documentElement;
  el.classList.toggle("dark", p.theme === "dark");
  el.classList.toggle("hc", p.contrast);
  el.style.setProperty("--font-scale", String(p.fontScale));
}

export function applyStoredPrefs() {
  if (typeof window !== "undefined") applyPrefs(loadPrefs());
}
