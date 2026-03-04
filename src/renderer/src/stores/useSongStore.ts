import { create } from "zustand";
import type { ParsedSong } from "@renderer/engines/midi/types";
import { parseMidiFile } from "@renderer/engines/midi/MidiFileParser";
import {
  analyzeSegments,
  type SegmentDifficulty,
} from "@renderer/engines/midi/SegmentDifficultyAnalyzer";

export type { SegmentDifficulty };

interface SongState {
  song: ParsedSong | null;
  loadSong: (song: ParsedSong) => void;
  /** Parse raw MIDI data and load the resulting song */
  loadFromMidiData: (fileName: string, data: number[]) => ParsedSong;
  clearSong: () => void;
  /** Compute per-segment difficulty analysis for the current song */
  getSegmentDifficulties: (segmentDurationSec?: number) => SegmentDifficulty[];
}

export const useSongStore = create<SongState>()((set, get) => ({
  song: null,
  loadSong: (song) => set({ song }),
  loadFromMidiData: (fileName, data) => {
    const parsed = parseMidiFile(fileName, data);
    set({ song: parsed });
    return parsed;
  },
  clearSong: () => set({ song: null }),
  getSegmentDifficulties: (segmentDurationSec = 2) => {
    const { song } = get();
    if (!song) return [];
    return analyzeSegments(song, segmentDurationSec);
  },
}));
