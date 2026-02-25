import { create } from 'zustand'

interface PlaybackState {
  /** Current playback position in seconds */
  currentTime: number
  /** Whether auto-play is active */
  isPlaying: boolean
  /** Vertical zoom: how many pixels represent one second of music */
  pixelsPerSecond: number

  setCurrentTime: (time: number) => void
  setPlaying: (playing: boolean) => void
  setPixelsPerSecond: (pps: number) => void
  /** Reset to beginning */
  reset: () => void
}

export const usePlaybackStore = create<PlaybackState>()((set) => ({
  currentTime: 0,
  isPlaying: false,
  pixelsPerSecond: 200,

  setCurrentTime: (time) => set({ currentTime: time }),
  setPlaying: (playing) => set({ isPlaying: playing }),
  setPixelsPerSecond: (pps) => set({ pixelsPerSecond: pps }),
  reset: () => set({ currentTime: 0, isPlaying: false }),
}))
