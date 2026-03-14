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
 */
function applyMuteState(nextMuted: boolean): void {
  const pb = usePlaybackStore.getState();
  const settings = useSettingsStore.getState();

  if (nextMuted) {
    // Muting: save current volume as lastNonZeroVolume if > 0, then set to 0
    if (pb.volume > 0) {
      settings.setVolume(Math.round(pb.volume * 100));
    }
    settings.setMuted(true);
    pb.setVolume(0);
  } else {
    // Unmuting: restore from persisted lastNonZeroVolume
    const restoreVolume = settings.lastNonZeroVolume;
    const vol01 = restoreVolume > 0 ? restoreVolume / 100 : DEFAULT_VOLUME;
    settings.setMuted(false);
    pb.setVolume(vol01);
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
