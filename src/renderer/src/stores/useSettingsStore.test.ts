import { describe, test, expect, beforeEach, vi } from "vitest";

// In-memory localStorage mock
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

const STORAGE_KEY = "rexiano-settings";

describe("useSettingsStore", () => {
  beforeEach(() => {
    storage.clear();
    vi.clearAllMocks();
    // Reset the module so the store is re-created with fresh localStorage
    vi.resetModules();
  });

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  async function getStore() {
    const mod = await import("./useSettingsStore");
    return mod.useSettingsStore;
  }

  describe("default values", () => {
    test("showNoteLabels defaults to true", async () => {
      const store = await getStore();
      expect(store.getState().showNoteLabels).toBe(true);
    });

    test("showFallingNoteLabels defaults to true", async () => {
      const store = await getStore();
      expect(store.getState().showFallingNoteLabels).toBe(true);
    });

    test("volume defaults to 80", async () => {
      const store = await getStore();
      expect(store.getState().volume).toBe(80);
    });

    test("muted defaults to false", async () => {
      const store = await getStore();
      expect(store.getState().muted).toBe(false);
    });

    test("defaultSpeed defaults to 1.0", async () => {
      const store = await getStore();
      expect(store.getState().defaultSpeed).toBe(1.0);
    });

    test("defaultMode defaults to watch", async () => {
      const store = await getStore();
      expect(store.getState().defaultMode).toBe("watch");
    });

    test("metronomeEnabled defaults to false", async () => {
      const store = await getStore();
      expect(store.getState().metronomeEnabled).toBe(false);
    });

    test("countInBeats defaults to 4", async () => {
      const store = await getStore();
      expect(store.getState().countInBeats).toBe(4);
    });
  });

  describe("setters update state", () => {
    test("setShowNoteLabels toggles the value", async () => {
      const store = await getStore();
      store.getState().setShowNoteLabels(false);
      expect(store.getState().showNoteLabels).toBe(false);
    });

    test("setShowFallingNoteLabels toggles the value", async () => {
      const store = await getStore();
      store.getState().setShowFallingNoteLabels(false);
      expect(store.getState().showFallingNoteLabels).toBe(false);
    });

    test("setVolume updates volume", async () => {
      const store = await getStore();
      store.getState().setVolume(50);
      expect(store.getState().volume).toBe(50);
    });

    test("setMuted toggles muted", async () => {
      const store = await getStore();
      store.getState().setMuted(true);
      expect(store.getState().muted).toBe(true);
    });

    test("setDefaultSpeed updates speed", async () => {
      const store = await getStore();
      store.getState().setDefaultSpeed(0.5);
      expect(store.getState().defaultSpeed).toBe(0.5);
    });

    test("setDefaultMode updates mode", async () => {
      const store = await getStore();
      store.getState().setDefaultMode("wait");
      expect(store.getState().defaultMode).toBe("wait");
    });

    test("setMetronomeEnabled toggles metronome", async () => {
      const store = await getStore();
      store.getState().setMetronomeEnabled(true);
      expect(store.getState().metronomeEnabled).toBe(true);
    });

    test("setCountInBeats updates count-in", async () => {
      const store = await getStore();
      store.getState().setCountInBeats(2);
      expect(store.getState().countInBeats).toBe(2);
    });
  });

  describe("value clamping", () => {
    test("volume is clamped to 0 minimum", async () => {
      const store = await getStore();
      store.getState().setVolume(-10);
      expect(store.getState().volume).toBe(0);
    });

    test("volume is clamped to 100 maximum", async () => {
      const store = await getStore();
      store.getState().setVolume(200);
      expect(store.getState().volume).toBe(100);
    });

    test("defaultSpeed is clamped to 0.25 minimum", async () => {
      const store = await getStore();
      store.getState().setDefaultSpeed(0.1);
      expect(store.getState().defaultSpeed).toBe(0.25);
    });

    test("defaultSpeed is clamped to 2.0 maximum", async () => {
      const store = await getStore();
      store.getState().setDefaultSpeed(5.0);
      expect(store.getState().defaultSpeed).toBe(2.0);
    });

    test("countInBeats is clamped to 0 minimum", async () => {
      const store = await getStore();
      store.getState().setCountInBeats(-3);
      expect(store.getState().countInBeats).toBe(0);
    });

    test("countInBeats is clamped to 8 maximum", async () => {
      const store = await getStore();
      store.getState().setCountInBeats(16);
      expect(store.getState().countInBeats).toBe(8);
    });

    test("countInBeats is rounded to integer", async () => {
      const store = await getStore();
      store.getState().setCountInBeats(3.7);
      expect(store.getState().countInBeats).toBe(4);
    });
  });

  describe("localStorage persistence", () => {
    test("setVolume persists to localStorage", async () => {
      const store = await getStore();
      store.getState().setVolume(42);
      const raw = storage.get(STORAGE_KEY);
      expect(raw).toBeDefined();
      const parsed = JSON.parse(raw!);
      expect(parsed.volume).toBe(42);
    });

    test("setDefaultMode persists to localStorage", async () => {
      const store = await getStore();
      store.getState().setDefaultMode("free");
      const raw = storage.get(STORAGE_KEY);
      const parsed = JSON.parse(raw!);
      expect(parsed.defaultMode).toBe("free");
    });

    test("saved values are restored on store re-creation", async () => {
      // First store instance: change volume
      const store1 = await getStore();
      store1.getState().setVolume(42);
      store1.getState().setDefaultMode("wait");
      store1.getState().setShowNoteLabels(false);

      // Reset module to simulate app restart
      vi.resetModules();

      // Second store instance: should load saved values
      const store2 = await getStore();
      expect(store2.getState().volume).toBe(42);
      expect(store2.getState().defaultMode).toBe("wait");
      expect(store2.getState().showNoteLabels).toBe(false);
    });

    test("clamped values are persisted (not original)", async () => {
      const store = await getStore();
      store.getState().setVolume(999);
      const raw = storage.get(STORAGE_KEY);
      const parsed = JSON.parse(raw!);
      expect(parsed.volume).toBe(100);
    });

    test("corrupt localStorage falls back to defaults", async () => {
      storage.set(STORAGE_KEY, "not valid json {{{");
      const store = await getStore();
      expect(store.getState().volume).toBe(80);
      expect(store.getState().defaultSpeed).toBe(1.0);
    });

    test("partial localStorage is merged with defaults", async () => {
      storage.set(STORAGE_KEY, JSON.stringify({ volume: 50 }));
      const store = await getStore();
      expect(store.getState().volume).toBe(50);
      expect(store.getState().defaultSpeed).toBe(1.0); // default
      expect(store.getState().showNoteLabels).toBe(true); // default
    });
  });
});
