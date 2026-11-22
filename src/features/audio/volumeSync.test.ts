import { beforeEach, describe, expect, test, vi } from "vitest";

const storage = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  value: {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => storage.set(k, v),
    removeItem: (k: string) => storage.delete(k),
    clear: () => storage.clear(),
  },
});

describe("one volume for the control bar and the settings drawer", () => {
  beforeEach(() => {
    storage.clear();
    vi.resetModules();
    vi.stubGlobal("navigator", { language: "en-US" });
  });

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  async function load() {
    const settings = (await import("@renderer/stores/useSettingsStore"))
      .useSettingsStore;
    const playback = (await import("@renderer/stores/usePlaybackStore"))
      .usePlaybackStore;
    const sync = await import("./volumeSync");
    return { settings, playback, sync };
  }

  test("the engine volume starts from the saved setting", async () => {
    storage.set("rexiano-settings", JSON.stringify({ volume: 55 }));
    const { playback, sync } = await load();
    const stop = sync.installVolumeSync();
    expect(playback.getState().volume).toBeCloseTo(0.55);
    stop();
  });

  test("moving the drawer slider moves the engine volume", async () => {
    const { settings, playback, sync } = await load();
    const stop = sync.installVolumeSync();
    settings.getState().setVolume(75);
    expect(playback.getState().volume).toBeCloseTo(0.75);
    stop();
  });

  test("the control-bar slider writes the setting the drawer shows", async () => {
    const { settings, sync } = await load();
    sync.setSharedVolume(30);
    expect(settings.getState().volume).toBe(30);
    expect(settings.getState().muted).toBe(false);
  });

  test("dragging the slider up from mute un-mutes", async () => {
    const { settings, sync } = await load();
    settings.getState().setMuted(true);
    sync.setSharedVolume(40);
    expect(settings.getState().muted).toBe(false);
  });

  test("the mute button and the drawer switch are the same state", async () => {
    const { settings, sync } = await load();
    sync.toggleSharedMute();
    expect(settings.getState().muted).toBe(true);
    sync.toggleSharedMute();
    expect(settings.getState().muted).toBe(false);
  });
});
