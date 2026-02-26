import { create } from 'zustand'
import type { AudioEngineStatus } from '@renderer/engines/audio/types'

interface PlaybackState {
  /** Current playback position in seconds */
  currentTime: number
  /** Whether auto-play is active */
  isPlaying: boolean
  /** Vertical zoom: how many pixels represent one second of music */
  pixelsPerSecond: number

  // ─── Phase 4: Audio state ──────────────────
  /** AudioEngine lifecycle status */
  audioStatus: AudioEngineStatus
  /** Master volume 0.0–1.0 */
  volume: number

  setCurrentTime: (time: number) => void
  setPlaying: (playing: boolean) => void
  setPixelsPerSecond: (pps: number) => void
  setAudioStatus: (status: AudioEngineStatus) => void
  setVolume: (volume: number) => void
  /** Reset to beginning */
  reset: () => void
}

export const usePlaybackStore = create<PlaybackState>()((set) => ({
  currentTime: 0,
  isPlaying: false,
  pixelsPerSecond: 200,

  // Phase 4 defaults
  audioStatus: 'uninitialized',
  volume: 0.8,

  setCurrentTime: (time) => set({ currentTime: time }),
  setPlaying: (playing) => set({ isPlaying: playing }),
  setPixelsPerSecond: (pps) => set({ pixelsPerSecond: pps }),
  setAudioStatus: (status) => set({ audioStatus: status }),
  setVolume: (volume) => set({ volume: Math.max(0, Math.min(1, volume)) }),
  reset: () => set({ currentTime: 0, isPlaying: false }),
}))
