import { create } from 'zustand'
import type { ParsedSong } from '@renderer/engines/midi/types'

interface SongState {
  song: ParsedSong | null
  loadSong: (song: ParsedSong) => void
  clearSong: () => void
}

export const useSongStore = create<SongState>()((set) => ({
  song: null,
  loadSong: (song) => set({ song }),
  clearSong: () => set({ song: null }),
}))
