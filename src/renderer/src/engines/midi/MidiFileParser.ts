import { Midi } from "@tonejs/midi";
import type {
  ParsedSong,
  ParsedTrack,
  ParsedNote,
  TempoEvent,
  TimeSignatureEvent,
} from "./types";

/**
 * Parse raw MIDI file bytes into a structured ParsedSong.
 *
 * Both time bases are preserved: seconds drive playback (the audio clock is the
 * master clock) and ticks drive notation. Deriving one from the other with a
 * single BPM is only valid for constant-tempo songs, so neither is dropped.
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
        ticks: note.ticks,
        durationTicks: note.durationTicks,
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
    bpm: Math.round(t.bpm),
    ticks: t.ticks,
  }));

  const timeSignatures: TimeSignatureEvent[] = midi.header.timeSignatures.map(
    (ts) => ({
      time: midi.header.ticksToSeconds(ts.ticks),
      numerator: ts.timeSignature[0],
      denominator: ts.timeSignature[1],
      ticks: ts.ticks,
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
    noteCount,
    ppq: midi.header.ppq,
  };
}
