import { useSettingsStore } from "@renderer/stores/useSettingsStore";
import { usePlaybackStore } from "@renderer/stores/usePlaybackStore";

/**
 * Volume and mute live in one place: the settings store (0-100, saved). The
 * control-bar slider, the settings drawer and the M key all write there, and
 * the audio engine's own 0-1 value follows it.
 */
export function installVolumeSync(): () => void {
  const apply = (): void => {
    usePlaybackStore
      .getState()
      .setVolume(useSettingsStore.getState().volume / 100);
  };
  apply();
  return useSettingsStore.subscribe((state, prev) => {
    if (state.volume !== prev.volume) apply();
  });
}

/** Slider value 0-100. Moving it is a decision to hear sound again. */
export function setSharedVolume(volume: number): void {
  const settings = useSettingsStore.getState();
  settings.setVolume(volume);
  if (volume > 0 && settings.muted) settings.setMuted(false);
}

export function toggleSharedMute(): void {
  const settings = useSettingsStore.getState();
  settings.setMuted(!settings.muted);
}
