// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { applyThemePref, getThemePref, setThemePref, THEME_STORAGE_KEY } from "./theme";

function themeColorMetas() {
  document.head.innerHTML = `
    <meta name="theme-color" media="(prefers-color-scheme: light)" content="#efece3" />
    <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#211f1a" />
  `;
  return {
    light: () => document.querySelector<HTMLMetaElement>('meta[media*="light"]')!,
    dark: () => document.querySelector<HTMLMetaElement>('meta[media*="dark"]')!,
  };
}

/* Node 22+ ships a flag-gated `localStorage` global that shadows jsdom's and is
 * undefined without --localstorage-file, so the real thing must be stubbed in. */
function makeStorage(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    clear: () => void m.clear(),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() {
      return m.size;
    },
  };
}

beforeEach(() => {
  Object.defineProperty(window, "localStorage", { value: makeStorage(), configurable: true });
  delete document.documentElement.dataset.theme;
});

describe("theme pref", () => {
  it("defaults to auto with nothing stored", () => {
    expect(getThemePref()).toBe("auto");
  });

  it("ignores garbage in storage", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "hotdog");
    expect(getThemePref()).toBe("auto");
  });

  it("persists an override and applies data-theme", () => {
    themeColorMetas();
    setThemePref("dark");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(getThemePref()).toBe("dark");
  });

  it("auto clears both the storage and the attribute", () => {
    themeColorMetas();
    setThemePref("light");
    setThemePref("auto");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });

  it("collapses theme-color metas to the override, and restores them on auto", () => {
    const metas = themeColorMetas();
    applyThemePref("dark");
    expect(metas.light().content).toBe("#211f1a");
    expect(metas.dark().content).toBe("#211f1a");
    applyThemePref("auto");
    expect(metas.light().content).toBe("#efece3");
    expect(metas.dark().content).toBe("#211f1a");
  });
});
