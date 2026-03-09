import { Midi } from "@tonejs/midi";
import type {
  ParsedSong,
  ParsedTrack,
  ParsedNote,
  TempoEvent,
  TimeSignatureEvent,
  KeySignatureEvent,
  DynamicsMarking,
} from "./types";
import { analyzeExpressions } from "./ExpressionAnalyzer";

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
        name: note.name,
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
    Cb: -7,
    Gb: -6,
    Db: -5,
    Ab: -4,
    Eb: -3,
    Bb: -2,
    F: -1,
    C: 0,
    G: 1,
    D: 2,
    A: 3,
    E: 4,
    B: 5,
    "F#": 6,
    "C#": 7,
  };
  const keySignatures: KeySignatureEvent[] = (
    midi.header.keySignatures ?? []
  ).map((ks) => ({
    time: midi.header.ticksToSeconds(ks.ticks),
    key: keyNameToSharps[ks.key] ?? 0,
    scale: ks.scale === "minor" ? 1 : 0,
  }));

  const noteCount = tracks.reduce((sum, track) => sum + track.notes.length, 0);

  // Use the end time of the last audible note instead of midi.duration,
  // which includes MIDI end-of-track metadata and trailing silence.
  const lastNoteEnd = tracks.reduce((max, track) => {
    if (track.notes.length === 0) return max;
    const last = track.notes[track.notes.length - 1];
    return Math.max(max, last.time + last.duration);
  }, 0);

  const duration = lastNoteEnd > 0 ? lastNoteEnd : midi.duration;

  // Compute measure boundary times from time signatures and tempos
  const measureTimes = computeMeasureTimes(duration, timeSignatures, tempos);

  // Infer dynamics from velocity patterns across 2-measure windows
  const dynamics = inferDynamics(tracks, measureTimes);

  // Infer expression markings from tempo changes, note durations, and overlaps
  const expressions = analyzeExpressions(tracks, tempos);

  return {
    fileName,
    duration,
    tracks,
    tempos,
    timeSignatures,
    keySignatures,
    noteCount,
    measureTimes,
    dynamics,
    expressions,
  };
}

/**
 * Compute the start time (in seconds) of each measure from time signatures and tempo events.
 * Walks through the song chronologically, advancing by measure-length increments.
 */
function computeMeasureTimes(
  duration: number,
  timeSignatures: TimeSignatureEvent[],
  tempos: TempoEvent[],
): number[] {
  const measures: number[] = [];

  // Default time signature: 4/4
  let tsNum = 4;
  let tsDen = 4;
  let tsIdx = 0;

  // Default tempo: 120 BPM
  let bpm = 120;
  let tempoIdx = 0;

  // Apply initial time signature if it starts at t=0
  if (timeSignatures.length > 0 && timeSignatures[0].time <= 0) {
    tsNum = timeSignatures[0].numerator;
    tsDen = timeSignatures[0].denominator;
    tsIdx = 1;
  }

  // Apply initial tempo if it starts at t=0
  if (tempos.length > 0 && tempos[0].time <= 0) {
    bpm = tempos[0].bpm;
    tempoIdx = 1;
  }

  let t = 0;

  while (t < duration) {
    measures.push(t);

    // Check for time signature changes before computing this measure's length
    while (tsIdx < timeSignatures.length && timeSignatures[tsIdx].time <= t) {
      tsNum = timeSignatures[tsIdx].numerator;
      tsDen = timeSignatures[tsIdx].denominator;
      tsIdx++;
    }

    // Check for tempo changes
    while (tempoIdx < tempos.length && tempos[tempoIdx].time <= t) {
      bpm = tempos[tempoIdx].bpm;
      tempoIdx++;
    }

    // Duration of one beat (quarter note) in seconds
    const beatDuration = 60 / bpm;
    // Duration of one measure: (numerator) beats, where each beat is (4/denominator) quarter notes
    const measureDuration = tsNum * (4 / tsDen) * beatDuration;

    t += measureDuration;
  }

  return measures;
}

/**
 * Map average velocity to a dynamics marking string.
 * Thresholds: pp (<40), p (<64), mp (<80), mf (<96), f (<112), ff (>=112)
 */
function velocityToMarking(avgVelocity: number): DynamicsMarking["marking"] {
  if (avgVelocity < 40) return "pp";
  if (avgVelocity < 64) return "p";
  if (avgVelocity < 80) return "mp";
  if (avgVelocity < 96) return "mf";
  if (avgVelocity < 112) return "f";
  return "ff";
}

/**
 * Infer dynamics markings by sampling average velocity over 2-measure windows.
 * Only emits a new marking when the dynamics level changes from the previous window.
 */
function inferDynamics(
  tracks: ParsedTrack[],
  measureTimes: number[],
): DynamicsMarking[] {
  if (measureTimes.length < 2) return [];

  // Collect all notes across all tracks
  const allNotes: ParsedNote[] = [];
  for (const track of tracks) {
    for (const note of track.notes) {
      allNotes.push(note);
    }
  }
  if (allNotes.length === 0) return [];
  allNotes.sort((a, b) => a.time - b.time);

  const markings: DynamicsMarking[] = [];
  let prevMarking: DynamicsMarking["marking"] | null = null;

  // Walk through 2-measure windows
  for (let i = 0; i < measureTimes.length; i += 2) {
    const windowStart = measureTimes[i];
    const windowEnd =
      i + 2 < measureTimes.length
        ? measureTimes[i + 2]
        : measureTimes[measureTimes.length - 1] + 10; // extend past last measure

    // Collect velocities in this window
    let velSum = 0;
    let velCount = 0;
    for (const note of allNotes) {
      if (note.time >= windowEnd) break;
      if (note.time >= windowStart) {
        velSum += note.velocity;
        velCount++;
      }
    }

    if (velCount === 0) continue;

    const avgVel = velSum / velCount;
    const marking = velocityToMarking(avgVel);

    if (marking !== prevMarking) {
      markings.push({ time: windowStart, marking });
      prevMarking = marking;
    }
  }

  return markings;
}
