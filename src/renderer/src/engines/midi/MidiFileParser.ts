import { Midi } from "@tonejs/midi";
import type {
  ParsedSong,
  ParsedTrack,
  ParsedNote,
  TempoEvent,
  TimeSignatureEvent,
  KeySignatureEvent,
} from "./types";

/**
 * Parse raw MIDI file bytes into a structured ParsedSong.
 *
 * @param fileName - Original file name for display
 * @param data - Raw MIDI file content as number array (from IPC)
 */
export function parseMidiFile(fileName: string, data: number[]): ParsedSong {
  const midi = new Midi(new Uint8Array(data));

  const tracks: ParsedTrack[] = midi.tracks
    .filter((track) => track.notes.length > 0)
    .map((track) => {
      const notes: ParsedNote[] = track.notes.map((note) => ({
        midi: note.midi,
        name: note.name + note.octave,
        time: note.time,
        duration: note.duration,
        velocity: Math.round(note.velocity * 127),
      }));

      // Sort by time, then by pitch for consistent ordering
      notes.sort((a, b) => a.time - b.time || a.midi - b.midi);

      return {
        name: track.name || `Track ${track.channel + 1}`,
        instrument: track.instrument.name || "Piano",
        channel: track.channel,
        notes,
      };
    });

  const tempos: TempoEvent[] = midi.header.tempos.map((t) => ({
    time: midi.header.ticksToSeconds(t.ticks),
    bpm: Math.round(t.bpm * 10) / 10,
  }));

  const timeSignatures: TimeSignatureEvent[] = midi.header.timeSignatures.map(
    (ts) => ({
      time: midi.header.ticksToSeconds(ts.ticks),
      numerator: ts.timeSignature[0],
      denominator: ts.timeSignature[1],
    }),
  );

  // @tonejs/midi stores key as string (e.g. "C", "G", "Eb") and scale as string ("major"/"minor").
  // Convert to numeric representation: key = number of sharps/flats, scale = 0 (major) / 1 (minor).
  const keyNameToSharps: Record<string, number> = {
    Cb: -7, Gb: -6, Db: -5, Ab: -4, Eb: -3, Bb: -2, F: -1,
    C: 0, G: 1, D: 2, A: 3, E: 4, B: 5, "F#": 6, "C#": 7,
  };
  const keySignatures: KeySignatureEvent[] = (midi.header.keySignatures ?? []).map(
    (ks) => ({
      time: midi.header.ticksToSeconds(ks.ticks),
      key: keyNameToSharps[ks.key] ?? 0,
      scale: ks.scale === "minor" ? 1 : 0,
    }),
  );

  const noteCount = tracks.reduce((sum, track) => sum + track.notes.length, 0);

  // Use the end time of the last audible note instead of midi.duration,
  // which includes MIDI end-of-track metadata and trailing silence.
  const lastNoteEnd = tracks.reduce((max, track) => {
    if (track.notes.length === 0) return max;
    const last = track.notes[track.notes.length - 1];
    return Math.max(max, last.time + last.duration);
  }, 0);

  return {
    fileName,
    duration: lastNoteEnd > 0 ? lastNoteEnd : midi.duration,
    tracks,
    tempos,
    timeSignatures,
    keySignatures,
    noteCount,
  };
}
