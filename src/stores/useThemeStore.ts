import { create } from "zustand";
import {
  themes,
  type ThemeId,
  type ThemePreference,
  type ThemeTokens,
} from "@renderer/themes/tokens";

const STORAGE_KEY = "rexiano-theme";

function loadPreference(): ThemePreference {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark" || saved === "system") {
      return saved;
    }
  } catch {
    // localStorage might not be available
  }
  // Older builds stored a palette name (ocean, midnight…): follow the system.
  return "system";
}

function systemPrefersDark(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

export function resolveTheme(
  preference: ThemePreference,
  prefersDark: boolean,
): ThemeId {
  if (preference === "system") return prefersDark ? "dark" : "light";
  return preference;
}

/** Apply theme CSS custom properties to document root.
 *  Derives CSS variable names from object keys automatically:
 *  camelCase → kebab-case (e.g. surfaceAlt → --color-surface-alt) */
function applyThemeToDOM(tokens: ThemeTokens): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  for (const [key, value] of Object.entries(tokens.colors)) {
    const cssName =
      "--color-" + key.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase());
    root.style.setProperty(cssName, value);
  }
  root.dataset.theme = tokens.id;
  root.style.colorScheme = tokens.id;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", tokens.colors.bg);
}

interface ThemeState {
  preference: ThemePreference;
  themeId: ThemeId;
  theme: ThemeTokens;
  setPreference: (preference: ThemePreference) => void;
}

export const useThemeStore = create<ThemeState>()((set, get) => {
  const preference = loadPreference();
  const themeId = resolveTheme(preference, systemPrefersDark());
  applyThemeToDOM(themes[themeId]);

  const apply = (next: ThemePreference): void => {
    const id = resolveTheme(next, systemPrefersDark());
    applyThemeToDOM(themes[id]);
    set({ preference: next, themeId: id, theme: themes[id] });
  };

  if (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function"
  ) {
    window
      .matchMedia("(prefers-color-scheme: dark)")
      .addEventListener?.("change", () => {
        if (get().preference === "system") apply("system");
      });
  }

  return {
    preference,
    themeId,
    theme: themes[themeId],
    setPreference: (next) => {
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // localStorage might not be available in some environments
      }
      apply(next);
    },
  };
});
