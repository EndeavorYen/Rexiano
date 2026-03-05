import { describe, test, expect, beforeEach, vi } from "vitest";

// ─── Mock localStorage ─────────────────────────────────
const storage = new Map<string, string>();
const localStorageMock = {
  getItem: vi.fn((key: string) => storage.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => storage.set(key, value)),
  removeItem: vi.fn((key: string) => storage.delete(key)),
  clear: vi.fn(() => storage.clear()),
  get length() {
    return storage.size;
  },
  key: vi.fn(() => null),
};
Object.defineProperty(globalThis, "localStorage", { value: localStorageMock });

// ─── Mock document.documentElement ─────────────────────
const styleProperties = new Map<string, string>();
const mockStyle = {
  setProperty: vi.fn((name: string, value: string) => {
    styleProperties.set(name, value);
  }),
};
vi.stubGlobal("document", {
  documentElement: { style: mockStyle },
});

const STORAGE_KEY = "rexiano-theme";

describe("useThemeStore", () => {
  beforeEach(() => {
    storage.clear();
    styleProperties.clear();
    vi.clearAllMocks();
    vi.resetModules();
  });

  async function getStore() {
    const mod = await import("./useThemeStore");
    return mod.useThemeStore;
  }

  async function getThemes() {
    const mod = await import("@renderer/themes/tokens");
    return mod.themes;
  }

  // ─── Initial state ────────────────────────────────────

  test("has ocean as the default theme when localStorage is empty", async () => {
    const store = await getStore();
    const s = store.getState();
    expect(s.themeId).toBe("ocean");
  });

  test("initial theme tokens match the ocean theme definition", async () => {
    const store = await getStore();
    const themes = await getThemes();
    const s = store.getState();
    expect(s.theme).toEqual(themes.ocean);
  });

  test("applies ocean CSS variables to DOM on initial creation", async () => {
    await getStore();
    // The ocean theme should have set --color-bg on the document root
    expect(mockStyle.setProperty).toHaveBeenCalledWith("--color-bg", "#F2F6F6");
    expect(mockStyle.setProperty).toHaveBeenCalledWith(
      "--color-accent",
      "#1E6E72",
    );
  });

  // ─── loadSavedTheme() behavior ───────────────────────

  test("loads saved theme when valid id is stored in localStorage", async () => {
    storage.set(STORAGE_KEY, "lavender");
    const store = await getStore();
    expect(store.getState().themeId).toBe("lavender");
  });

  test("falls back to ocean when localStorage has invalid theme id", async () => {
    storage.set(STORAGE_KEY, "nonexistent-theme");
    const store = await getStore();
    expect(store.getState().themeId).toBe("ocean");
  });

  test("falls back to ocean when localStorage has empty string", async () => {
    storage.set(STORAGE_KEY, "");
    const store = await getStore();
    expect(store.getState().themeId).toBe("ocean");
  });

  // ─── setTheme() ──────────────────────────────────────

  test("setTheme changes themeId", async () => {
    const store = await getStore();
    store.getState().setTheme("peach");
    expect(store.getState().themeId).toBe("peach");
  });

  test("setTheme updates theme tokens to match the new theme", async () => {
    const store = await getStore();
    const themes = await getThemes();
    store.getState().setTheme("lavender");
    expect(store.getState().theme).toEqual(themes.lavender);
  });

  test("setTheme persists the theme id to localStorage", async () => {
    const store = await getStore();
    store.getState().setTheme("peach");
    expect(storage.get(STORAGE_KEY)).toBe("peach");
  });

  test("setTheme applies CSS variables to DOM", async () => {
    const store = await getStore();
    vi.clearAllMocks(); // Clear calls from initial store creation
    styleProperties.clear();

    store.getState().setTheme("midnight");

    // Verify CSS custom properties were set for the midnight theme
    expect(mockStyle.setProperty).toHaveBeenCalledWith("--color-bg", "#0E1013");
    expect(mockStyle.setProperty).toHaveBeenCalledWith(
      "--color-accent",
      "#5DA3B8",
    );
    expect(mockStyle.setProperty).toHaveBeenCalledWith(
      "--color-text",
      "#E8EDF2",
    );
  });

  test("setTheme converts camelCase keys to kebab-case CSS variables", async () => {
    const store = await getStore();
    vi.clearAllMocks();

    store.getState().setTheme("ocean");

    // surfaceAlt should become --color-surface-alt
    expect(mockStyle.setProperty).toHaveBeenCalledWith(
      "--color-surface-alt",
      "#D6E2E1",
    );
    // accentHover should become --color-accent-hover
    expect(mockStyle.setProperty).toHaveBeenCalledWith(
      "--color-accent-hover",
      "#165A5D",
    );
    // textMuted should become --color-text-muted
    expect(mockStyle.setProperty).toHaveBeenCalledWith(
      "--color-text-muted",
      "#4F686A",
    );
  });

  test("persisted theme is restored after store re-creation", async () => {
    const store1 = await getStore();
    store1.getState().setTheme("midnight");

    vi.resetModules();

    const store2 = await getStore();
    expect(store2.getState().themeId).toBe("midnight");
  });

  test("setTheme can switch through all four themes", async () => {
    const store = await getStore();

    store.getState().setTheme("lavender");
    expect(store.getState().themeId).toBe("lavender");

    store.getState().setTheme("ocean");
    expect(store.getState().themeId).toBe("ocean");

    store.getState().setTheme("peach");
    expect(store.getState().themeId).toBe("peach");

    store.getState().setTheme("midnight");
    expect(store.getState().themeId).toBe("midnight");
  });
});
