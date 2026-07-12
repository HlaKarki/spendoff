/* Theme override is a per-device preference (decided on HLA-92): localStorage,
 * no backend column. "auto" means no override — the device's color scheme wins.
 * A matching inline script in __root.tsx applies the stored override before
 * first paint; keep the storage key and attribute in sync with it. */

export type ThemePref = "auto" | "light" | "dark";

export const THEME_STORAGE_KEY = "spendoff-theme";

const THEME_COLORS = { light: "#efece3", dark: "#211f1a" } as const;

export function getThemePref(): ThemePref {
  try {
    const v = window.localStorage.getItem(THEME_STORAGE_KEY);
    return v === "light" || v === "dark" ? v : "auto";
  } catch {
    return "auto";
  }
}

export function setThemePref(pref: ThemePref): void {
  try {
    if (pref === "auto") window.localStorage.removeItem(THEME_STORAGE_KEY);
    else window.localStorage.setItem(THEME_STORAGE_KEY, pref);
  } catch {
    // Storage unavailable (private mode) — still apply for this page's lifetime.
  }
  applyThemePref(pref);
}

export function applyThemePref(pref: ThemePref): void {
  const root = document.documentElement;
  if (pref === "auto") delete root.dataset.theme;
  else root.dataset.theme = pref;
  syncThemeColorMeta(pref);
}

/* The browser chrome (PWA title bar, iOS status bar) follows <meta name="theme-color">.
 * The media-scoped pair handles "auto"; an explicit override collapses both to one color. */
function syncThemeColorMeta(pref: ThemePref): void {
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    const scheme = (meta.getAttribute("media") ?? "").includes("dark") ? "dark" : "light";
    meta.content = pref === "auto" ? THEME_COLORS[scheme] : THEME_COLORS[pref];
  }
}
