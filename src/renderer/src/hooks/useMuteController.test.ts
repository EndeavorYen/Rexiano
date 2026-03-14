// @ts-nocheck
/**
 * Tests for the mute controller — centralised mute/unmute logic.
 *
 * Validates that toggleMute and setMuted correctly synchronise
 * useSettingsStore.muted, useSettingsStore.lastNonZeroVolume,
 * and usePlaybackStore.volume.
 */
import { describe, test, expect, vi, beforeEach } from "vitest";

// ─── Mock stores ────────────────────────────────────────────
const playbackState = {
  volume: 0.8,
  setVolume: vi.fn(),
};

vi.mock("@renderer/stores/usePlaybackStore", () => {
  const store = Object.assign(() => playbackState, {
    getState: () => playbackState,
    subscribe: vi.fn(),
    setState: vi.fn(),
  });
  return { usePlaybackStore: store };
});

const settingsState = {
  volume: 80,
  muted: false,
  lastNonZeroVolume: 80,
  setVolume: vi.fn(),
  setMuted: vi.fn(),
};

vi.mock("@renderer/stores/useSettingsStore", () => {
  const store = Object.assign(() => settingsState, {
    getState: () => settingsState,
    subscribe: vi.fn(),
    setState: vi.fn(),
  });
  return { useSettingsStore: store };
});

import { toggleMute, setMuted } from "./useMuteController";

beforeEach(() => {
  vi.clearAllMocks();
  // Reset state to defaults
  playbackState.volume = 0.8;
  settingsState.volume = 80;
  settingsState.muted = false;
  settingsState.lastNonZeroVolume = 80;
});

describe("toggleMute", () => {
  test("muting: saves current volume and sets playback to 0", () => {
    playbackState.volume = 0.6;
    settingsState.muted = false;

    toggleMute();

    expect(settingsState.setVolume).toHaveBeenCalledWith(60);
    expect(settingsState.setMuted).toHaveBeenCalledWith(true);
    expect(playbackState.setVolume).toHaveBeenCalledWith(0);
  });

  test("unmuting: restores from lastNonZeroVolume", () => {
    playbackState.volume = 0;
    settingsState.muted = true;
    settingsState.lastNonZeroVolume = 75;

    toggleMute();

    expect(settingsState.setMuted).toHaveBeenCalledWith(false);
    expect(playbackState.setVolume).toHaveBeenCalledWith(0.75);
  });

  test("unmuting with lastNonZeroVolume=0 uses default 0.8", () => {
    playbackState.volume = 0;
    settingsState.muted = true;
    settingsState.lastNonZeroVolume = 0;

    toggleMute();

    expect(settingsState.setMuted).toHaveBeenCalledWith(false);
    expect(playbackState.setVolume).toHaveBeenCalledWith(0.8);
  });

  test("muting when already at volume 0 does not overwrite lastNonZeroVolume", () => {
    playbackState.volume = 0;
    settingsState.muted = false;

    toggleMute();

    // setVolume should NOT be called (volume is 0, nothing to save)
    expect(settingsState.setVolume).not.toHaveBeenCalled();
    expect(settingsState.setMuted).toHaveBeenCalledWith(true);
    expect(playbackState.setVolume).toHaveBeenCalledWith(0);
  });
});

describe("setMuted", () => {
  test("explicit mute: saves volume and sets to 0", () => {
    playbackState.volume = 0.5;
    settingsState.muted = false;

    setMuted(true);

    expect(settingsState.setVolume).toHaveBeenCalledWith(50);
    expect(settingsState.setMuted).toHaveBeenCalledWith(true);
    expect(playbackState.setVolume).toHaveBeenCalledWith(0);
  });

  test("explicit unmute: restores from lastNonZeroVolume", () => {
    playbackState.volume = 0;
    settingsState.muted = true;
    settingsState.lastNonZeroVolume = 60;

    setMuted(false);

    expect(settingsState.setMuted).toHaveBeenCalledWith(false);
    expect(playbackState.setVolume).toHaveBeenCalledWith(0.6);
  });

  test("setting muted=true when already muted still executes", () => {
    playbackState.volume = 0;
    settingsState.muted = true;

    setMuted(true);

    // Should still set muted and volume to 0
    expect(settingsState.setMuted).toHaveBeenCalledWith(true);
    expect(playbackState.setVolume).toHaveBeenCalledWith(0);
  });

  test("setting muted=false with default lastNonZeroVolume uses fallback", () => {
    playbackState.volume = 0;
    settingsState.muted = true;
    settingsState.lastNonZeroVolume = 0;

    setMuted(false);

    expect(playbackState.setVolume).toHaveBeenCalledWith(0.8);
  });
});
