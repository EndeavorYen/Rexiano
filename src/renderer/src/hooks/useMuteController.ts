/**
 * Centralised mute/unmute controller.
 *
 * Single source of truth for mute state, eliminating desync between
 * useSettingsStore.muted, usePlaybackStore.volume, and the persisted
 * lastNonZeroVolume. All mute operations (SettingsPanel toggle, keyboard
 * shortcut, MIDI CC) should go through this controller.
 */
import { usePlaybackStore } from "@renderer/stores/usePlaybackStore";
import { useSettingsStore } from "@renderer/stores/useSettingsStore";

/** Default volume (0-1 scale) if no previous non-zero volume exists */
const DEFAULT_VOLUME = 0.8;

/**
 * Core mute/unmute logic. Both toggleMute() and setMuted() delegate here
 * to eliminate duplication (R1-01 fix).
 *
 * R2-03 fix: Operation ordering ensures consistent cross-store state.
 * Live state (usePlaybackStore.volume) is updated FIRST so any subscriber
 * triggered by the settings persistence sees the correct live volume.
 * Read → mutate live → persist: no transient desync window.
 */
function applyMuteState(nextMuted: boolean): void {
  const pb = usePlaybackStore.getState();
  const settings = useSettingsStore.getState();

  if (nextMuted) {
    // 1. Capture current volume for persistence BEFORE zeroing
    const currentVol100 = pb.volume > 0 ? Math.round(pb.volume * 100) : 0;
    // 2. Set live volume to 0 first (audio engine sees this immediately)
    pb.setVolume(0);
    // 3. Persist: save volume snapshot + muted flag to settings/localStorage
    if (currentVol100 > 0) {
      settings.setVolume(currentVol100);
    }
    settings.setMuted(true);
  } else {
    // 1. Read restore target before any mutation
    const restoreVolume = settings.lastNonZeroVolume;
    const vol01 = restoreVolume > 0 ? restoreVolume / 100 : DEFAULT_VOLUME;
    // 2. Set live volume first (audio engine sees this immediately)
    pb.setVolume(vol01);
    // 3. Persist unmuted flag
    settings.setMuted(false);
  }
}

/**
 * Pure logic: toggle mute state and sync all stores.
 * Extracted so it can be called from both React hooks and imperative code.
 */
export function toggleMute(): void {
  const settings = useSettingsStore.getState();
  applyMuteState(!settings.muted);
}

/**
 * Set muted state explicitly (used by the SettingsPanel toggle).
 */
export function setMuted(nextMuted: boolean): void {
  applyMuteState(nextMuted);
}

/**
 * React hook that provides mute controller callbacks.
 * Use in components that need mute toggle or explicit set.
 *
 * toggleMute and setMuted are stable module-level functions —
 * no useCallback wrapper needed (R1-01 fix).
 */
export function useMuteController(): {
  toggleMute: () => void;
  setMuted: (muted: boolean) => void;
} {
  return { toggleMute, setMuted };
}
