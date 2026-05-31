/**
 * Generate built-in MIDI files for the Rexiano song library.
 *
 * Run: pnpm exec jiti scripts/generate-songs.ts
 *
 * Produces generated MIDI files in resources/midi/ and updates songs.json.
 * Existing curated songs.json fields such as grade and level tags are preserved.
 * Uses @tonejs/midi for MIDI file creation.
 */
import { Midi } from "@tonejs/midi";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import {
  addNotesFromBeats,
  applyInferredHandTrackNames,
  createSongMetaFromDefinition,
  encodeMidiWithNotationHeaderMetadata,
  mergeGeneratedSongMetadata,
  type Category,
  type NoteEntry,
  type SongDef,
  type SongMeta,
} from "./generatedSongLibrary";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "resources", "midi");

// ─── MIDI note constants ─────────────────────────────────────────────

const C3 = 48;
const D3 = 50;
const E3 = 52;
const F3 = 53;
const G3 = 55;
const A3 = 57;
const B3 = 59;
const C4 = 60;
const Cs4 = 61;
const D4 = 62;
const Ds4 = 63;
const E4 = 64;
const F4 = 65;
const Fs4 = 66;
const G4 = 67;
const Gs4 = 68;
const A4 = 69;
const Bb4 = 70;
const B4 = 71;
const C5 = 72;
const Cs5 = 73;
const D5 = 74;
const Ds5 = 75;
const E5 = 76;
const F5 = 77;
const Fs5 = 78;
const G5 = 79;
const Gs5 = 80;
const A5 = 81;

// Suppress unused-variable warnings for note constants we define
// but may not directly reference (they serve as a lookup table).
void [C3, D3, E3, F3, G3, A3, B3, Cs4, Ds4, Fs4, Gs4, Cs5, Ds5, Gs5, A5];

// ─── Helper: beat-based note entry ───────────────────────────────────

/**
 * Helper: given a sequence of [midiNote, durationInBeats] pairs,
 * compute NoteEntry[] with cumulative start beats.
 */
function sequentialNotes(
  pairs: [midi: number, dur: number][],
  startBeat: number = 0,
): NoteEntry[] {
  const result: NoteEntry[] = [];
  let beat = startBeat;
  for (const [midi, dur] of pairs) {
    result.push([midi, beat, dur]);
    beat += dur;
  }
  return result;
}

// ─── Song builders ───────────────────────────────────────────────────

function buildCMajorScale(): Midi {
  const midi = new Midi();
  midi.header.setTempo(120);
  const track = midi.addTrack();
  track.name = "Piano";
  track.channel = 0;

  const ascending = [C4, D4, E4, F4, G4, A4, B4, C5];
  const allNotes = [...ascending, ...[...ascending].reverse().slice(1)];
  const entries: NoteEntry[] = allNotes.map((n, i) => [n, i * 1, 1]);
  addNotesFromBeats(track, entries, 120, 0.7);
  return midi;
}

function buildTwinkleTwinkle(): Midi {
  const midi = new Midi();
  midi.header.setTempo(100);
  const track = midi.addTrack();
  track.name = "Piano";
  track.channel = 0;

  // C C G G A A G(half) | F F E E D D C(half) | ...
  const melody: [number, number][] = [
    [C4, 1],
    [C4, 1],
    [G4, 1],
    [G4, 1],
    [A4, 1],
    [A4, 1],
    [G4, 2],
    [F4, 1],
    [F4, 1],
    [E4, 1],
    [E4, 1],
    [D4, 1],
    [D4, 1],
    [C4, 2],
    [G4, 1],
    [G4, 1],
    [F4, 1],
    [F4, 1],
    [E4, 1],
    [E4, 1],
    [D4, 2],
    [G4, 1],
    [G4, 1],
    [F4, 1],
    [F4, 1],
    [E4, 1],
    [E4, 1],
    [D4, 2],
    [C4, 1],
    [C4, 1],
    [G4, 1],
    [G4, 1],
    [A4, 1],
    [A4, 1],
    [G4, 2],
    [F4, 1],
    [F4, 1],
    [E4, 1],
    [E4, 1],
    [D4, 1],
    [D4, 1],
    [C4, 2],
  ];

  const entries = sequentialNotes(melody);
  addNotesFromBeats(track, entries, 100, 0.75);
  return midi;
}

function buildOdeToJoy(): Midi {
  const midi = new Midi();
  midi.header.setTempo(120);
  const track = midi.addTrack();
  track.name = "Piano";
  track.channel = 0;

  const melody: [number, number][] = [
    [E4, 1],
    [E4, 1],
    [F4, 1],
    [G4, 1],
    [G4, 1],
    [F4, 1],
    [E4, 1],
    [D4, 1],
    [C4, 1],
    [C4, 1],
    [D4, 1],
    [E4, 1],
    [E4, 1.5],
    [D4, 0.5],
    [D4, 2],
    [E4, 1],
    [E4, 1],
    [F4, 1],
    [G4, 1],
    [G4, 1],
    [F4, 1],
    [E4, 1],
    [D4, 1],
    [C4, 1],
    [C4, 1],
    [D4, 1],
    [E4, 1],
    [D4, 1.5],
    [C4, 0.5],
    [C4, 2],
  ];

  const entries = sequentialNotes(melody);
  addNotesFromBeats(track, entries, 120, 0.7);
  return midi;
}

function buildMaryHadALittleLamb(): Midi {
  const midi = new Midi();
  midi.header.setTempo(100);
  const track = midi.addTrack();
  track.name = "Piano";
  track.channel = 0;

  // Mary Had a Little Lamb in C
  const melody: [number, number][] = [
    // Mary had a little lamb
    [E4, 1],
    [D4, 1],
    [C4, 1],
    [D4, 1],
    [E4, 1],
    [E4, 1],
    [E4, 2],
    // Little lamb, little lamb
    [D4, 1],
    [D4, 1],
    [D4, 2],
    [E4, 1],
    [G4, 1],
    [G4, 2],
    // Mary had a little lamb, its fleece was white as snow
    [E4, 1],
    [D4, 1],
    [C4, 1],
    [D4, 1],
    [E4, 1],
    [E4, 1],
    [E4, 1],
    [E4, 1],
    [D4, 1],
    [D4, 1],
    [E4, 1],
    [D4, 1],
    [C4, 2],
  ];

  const entries = sequentialNotes(melody);
  addNotesFromBeats(track, entries, 100, 0.7);
  return midi;
}

function buildHotCrossBuns(): Midi {
  const midi = new Midi();
  midi.header.setTempo(100);
  const track = midi.addTrack();
  track.name = "Piano";
  track.channel = 0;

  const melody: [number, number][] = [
    // Hot cross buns (descending, half notes)
    [E4, 2],
    [D4, 2],
    [C4, 2],
    /* rest */ [C4, 0],
    // Hot cross buns
    [E4, 2],
    [D4, 2],
    [C4, 2],
    // One a penny, two a penny (eighth notes run)
    [C4, 0.5],
    [C4, 0.5],
    [C4, 0.5],
    [C4, 0.5],
    [D4, 0.5],
    [D4, 0.5],
    [D4, 0.5],
    [D4, 0.5],
    // Hot cross buns
    [E4, 2],
    [D4, 2],
    [C4, 2],
  ];

  // Remove the zero-duration "rest" placeholder
  const filtered = melody.filter(([, d]) => d > 0);
  const entries = sequentialNotes(filtered);
  addNotesFromBeats(track, entries, 100, 0.7);
  return midi;
}

function buildJingleBells(): Midi {
  const midi = new Midi();
  midi.header.setTempo(120);
  const track = midi.addTrack();
  track.name = "Piano";
  track.channel = 0;

  // Chorus only: Jingle bells, jingle bells, jingle all the way...
  const melody: [number, number][] = [
    // Jingle bells, jingle bells
    [E4, 1],
    [E4, 1],
    [E4, 2],
    [E4, 1],
    [E4, 1],
    [E4, 2],
    // Jingle all the way
    [E4, 1],
    [G4, 1],
    [C4, 1],
    [D4, 1],
    [E4, 4],
    // Oh what fun it is to ride
    [F4, 1],
    [F4, 1],
    [F4, 1],
    [F4, 1],
    // In a one-horse open sleigh
    [F4, 1],
    [E4, 1],
    [E4, 1],
    [E4, 1],
    // (hey!) Jingle bells...
    [E4, 1],
    [D4, 1],
    [D4, 1],
    [E4, 1],
    [D4, 2],
    [G4, 2],
  ];

  const entries = sequentialNotes(melody);
  addNotesFromBeats(track, entries, 120, 0.7);
  return midi;
}

function buildHappyBirthday(): Midi {
  const midi = new Midi();
  midi.header.setTempo(100);
  const track = midi.addTrack();
  track.name = "Piano";
  track.channel = 0;

  // Happy Birthday in F major (starts on C4)
  // 3/4 time — durations in quarter note beats
  const melody: [number, number][] = [
    // Happy birth-day to you
    [C4, 0.75],
    [C4, 0.25],
    [D4, 1],
    [C4, 1],
    [F4, 1],
    [E4, 2],
    // Happy birth-day to you
    [C4, 0.75],
    [C4, 0.25],
    [D4, 1],
    [C4, 1],
    [G4, 1],
    [F4, 2],
    // Happy birth-day dear (name)
    [C4, 0.75],
    [C4, 0.25],
    [C5, 1],
    [A4, 1],
    [F4, 1],
    [E4, 1],
    [D4, 2],
    // Happy birth-day to you
    [Bb4, 0.75],
    [Bb4, 0.25],
    [A4, 1],
    [F4, 1],
    [G4, 1],
    [F4, 2],
  ];

  const entries = sequentialNotes(melody);
  addNotesFromBeats(track, entries, 100, 0.7);
  return midi;
}

function buildLondonBridge(): Midi {
  const midi = new Midi();
  midi.header.setTempo(120);
  const track = midi.addTrack();
  track.name = "Piano";
  track.channel = 0;

  const melody: [number, number][] = [
    // London Bridge is falling down
    [G4, 1.5],
    [A4, 0.5],
    [G4, 1],
    [F4, 1],
    [E4, 1],
    [F4, 1],
    [G4, 2],
    // Falling down, falling down
    [D4, 1],
    [E4, 1],
    [F4, 2],
    [E4, 1],
    [F4, 1],
    [G4, 2],
    // London Bridge is falling down
    [G4, 1.5],
    [A4, 0.5],
    [G4, 1],
    [F4, 1],
    [E4, 1],
    [F4, 1],
    [G4, 2],
    // My fair lady
    [D4, 2],
    [G4, 1],
    [E4, 1],
    [C4, 4],
  ];

  const entries = sequentialNotes(melody);
  addNotesFromBeats(track, entries, 120, 0.7);
  return midi;
}

function buildRowRowRow(): Midi {
  const midi = new Midi();
  midi.header.setTempo(100);
  const track = midi.addTrack();
  track.name = "Piano";
  track.channel = 0;

  // Row Row Row Your Boat in 6/8 feel (dotted quarter = 1 beat group)
  // Written in quarter beats
  const melody: [number, number][] = [
    // Row, row, row your boat
    [C4, 1.5],
    [C4, 1.5],
    [C4, 1],
    [D4, 0.5],
    [E4, 1.5],
    // Gently down the stream
    [E4, 1],
    [D4, 0.5],
    [E4, 1],
    [F4, 0.5],
    [G4, 3],
    // Merrily merrily merrily merrily
    [C5, 0.5],
    [C5, 0.5],
    [C5, 0.5],
    [G4, 0.5],
    [G4, 0.5],
    [G4, 0.5],
    [E4, 0.5],
    [E4, 0.5],
    [E4, 0.5],
    [C4, 0.5],
    [C4, 0.5],
    [C4, 0.5],
    // Life is but a dream
    [G4, 1],
    [F4, 0.5],
    [E4, 1],
    [D4, 0.5],
    [C4, 3],
  ];

  const entries = sequentialNotes(melody);
  addNotesFromBeats(track, entries, 100, 0.7);
  return midi;
}

function buildFurElise(): Midi {
  const midi = new Midi();
  midi.header.setTempo(72);
  const track = midi.addTrack();
  track.name = "Piano Right Hand";
  track.channel = 0;

  // Fur Elise opening theme — right hand only
  // 3/8 time, written in eighth-note beats (1 beat = 1 eighth note)
  const melody: [number, number][] = [
    // E5 D#5 E5 D#5 E5 B4 D5 C5 A4 (the iconic opening)
    [E5, 1],
    [Ds5, 1],
    [E5, 1],
    [Ds5, 1],
    [E5, 1],
    [B4, 1],
    [D5, 1],
    [C5, 1],
    [A4, 2],
    // C4 E4 A4 B4
    [C4, 1],
    [E4, 1],
    [A4, 1],
    [B4, 2],
    // E4 G#4 B4 C5
    [E4, 1],
    [Gs4, 1],
    [B4, 1],
    [C5, 2],
    // E4 E5 D#5 E5 D#5 E5 B4 D5 C5 A4 (repeat)
    [E4, 1],
    [E5, 1],
    [Ds5, 1],
    [E5, 1],
    [Ds5, 1],
    [E5, 1],
    [B4, 1],
    [D5, 1],
    [C5, 1],
    [A4, 2],
    // C4 E4 A4 B4
    [C4, 1],
    [E4, 1],
    [A4, 1],
    [B4, 2],
    // E4 C5 B4 A4
    [E4, 1],
    [C5, 1],
    [B4, 1],
    [A4, 3],
  ];

  const entries = sequentialNotes(melody);
  addNotesFromBeats(track, entries, 72, 0.7);
  return midi;
}

function buildMinuetInG(): Midi {
  const midi = new Midi();
  midi.header.setTempo(108);

  // Right hand
  const rh = midi.addTrack();
  rh.name = "Right Hand";
  rh.channel = 0;

  // Bach Minuet in G Major (first 8 bars, simplified)
  // 3/4 time, durations in quarter beats
  const rhMelody: [number, number][] = [
    // Bar 1: D5 (quarter), G4 A4 B4 C5 (eighths), D5 (quarter)
    [D5, 2],
    [G4, 0.5],
    [A4, 0.5],
    [B4, 0.5],
    [C5, 0.5],
    // Bar 2: D5 (quarter), G4 (quarter), G4 (quarter)
    [D5, 1],
    [G4, 1],
    [G4, 1],
    // Bar 3: E5, C5 D5 E5 F#5 (eighths), G5
    [E5, 2],
    [C5, 0.5],
    [D5, 0.5],
    [E5, 0.5],
    [Fs5, 0.5],
    // Bar 4: G5 (quarter), G4 (quarter), G4 (quarter)
    [G5, 1],
    [G4, 1],
    [G4, 1],
    // Bar 5: C5, D5 C5 B4 A4 (eighths)
    [C5, 1],
    [D5, 0.5],
    [C5, 0.5],
    [B4, 0.5],
    [A4, 0.5],
    // Bar 6: B4, C5 B4 A4 G4 (eighths)
    [B4, 1],
    [C5, 0.5],
    [B4, 0.5],
    [A4, 0.5],
    [G4, 0.5],
    // Bar 7: Fs4, G4 A4 B4 G4 (eighths)
    [Fs4, 1],
    [G4, 0.5],
    [A4, 0.5],
    [B4, 0.5],
    [G4, 0.5],
    // Bar 8: A4 (dotted half)
    [A4, 3],
  ];

  const rhEntries = sequentialNotes(rhMelody);
  addNotesFromBeats(rh, rhEntries, 108, 0.7);

  // Left hand — simple bass
  const lh = midi.addTrack();
  lh.name = "Left Hand";
  lh.channel = 1;

  const lhMelody: [number, number][] = [
    // Bars 1-2: G3 whole notes (simplified)
    [G3, 3],
    [G3, 3],
    // Bars 3-4: C4, then G3
    [C4, 3],
    [G3, 3],
    // Bars 5-6: A3, then G3
    [A3, 3],
    [G3, 3],
    // Bars 7-8: D3, then D3
    [D3, 3],
    [D3, 3],
  ];

  const lhEntries = sequentialNotes(lhMelody);
  addNotesFromBeats(lh, lhEntries, 108, 0.6);

  return midi;
}

function buildPreludeInC(): Midi {
  const midi = new Midi();
  midi.header.setTempo(72);

  const rh = midi.addTrack();
  rh.name = "Right Hand";
  rh.channel = 0;

  const lh = midi.addTrack();
  lh.name = "Left Hand";
  lh.channel = 1;

  // BWV 846 Prelude in C Major — simplified arpeggiated pattern
  // Each measure: 8 sixteenth notes arpeggiated
  // Pattern per chord: bass, inner, top, inner, top, inner, top, inner
  // Simplified to 8 measures

  const chords: { bass: number; notes: number[] }[] = [
    { bass: C3, notes: [E4, G4, C5, E5] }, // C major
    { bass: D3, notes: [D4, A4, D5, F5] }, // Dm
    { bass: G3, notes: [D4, G4, B4, F5] }, // G7
    { bass: C3, notes: [E4, G4, C5, E5] }, // C major
    { bass: A3, notes: [E4, A4, C5, E5] }, // Am
    { bass: D3, notes: [Fs4, A4, D5, Fs5] }, // D7
    { bass: G3, notes: [D4, G4, B4, D5] }, // G major
    { bass: C3, notes: [E4, G4, C5, E5] }, // C major (ending)
  ];

  let beat = 0;
  const secPerBeat = 60 / 72;

  for (const chord of chords) {
    // Left hand: bass note held for 2 beats
    lh.addNote({
      midi: chord.bass,
      time: beat * secPerBeat,
      duration: 2 * secPerBeat * 0.95,
      velocity: 0.6,
    });

    // Right hand: arpeggiate the upper notes as sixteenth notes
    // Pattern: 8 sixteenth notes = 2 beats
    const pattern = [
      chord.notes[0],
      chord.notes[1],
      chord.notes[2],
      chord.notes[3],
      chord.notes[2],
      chord.notes[1],
      chord.notes[2],
      chord.notes[3],
    ];

    for (let i = 0; i < pattern.length; i++) {
      rh.addNote({
        midi: pattern[i],
        time: (beat + i * 0.25) * secPerBeat,
        duration: 0.25 * secPerBeat * 0.9,
        velocity: 0.65,
      });
    }

    beat += 2;
  }

  return midi;
}

function buildCanonInD(): Midi {
  const midi = new Midi();
  midi.header.setTempo(80);

  const rh = midi.addTrack();
  rh.name = "Melody";
  rh.channel = 0;

  const lh = midi.addTrack();
  lh.name = "Bass";
  lh.channel = 1;

  // Simplified Canon in D — melody over bass progression
  // Bass: D A B F# G D G A (each 2 beats)
  const bassNotes: [number, number][] = [
    [D3, 2],
    [A3, 2],
    [B3, 2],
    [Fs4 - 12, 2], // F#3 = 54
    [G3, 2],
    [D3, 2],
    [G3, 2],
    [A3, 2],
  ];

  const bassEntries = sequentialNotes(bassNotes);
  addNotesFromBeats(lh, bassEntries, 80, 0.6);

  // Melody: F#5 E5 D5 C#5 B4 A4 B4 C#5 (each 2 beats, then variation)
  const melodyNotes: [number, number][] = [
    [Fs5, 2],
    [E5, 2],
    [D5, 2],
    [Cs5, 2],
    [B4, 2],
    [A4, 2],
    [B4, 2],
    [Cs5, 2],
  ];

  const melodyEntries = sequentialNotes(melodyNotes);
  addNotesFromBeats(rh, melodyEntries, 80, 0.7);

  return midi;
}

function buildMoonlightSonata(): Midi {
  const midi = new Midi();
  midi.header.setTempo(56);

  const rh = midi.addTrack();
  rh.name = "Right Hand";
  rh.channel = 0;

  const lh = midi.addTrack();
  lh.name = "Left Hand";
  lh.channel = 1;

  // Moonlight Sonata mvt 1 — simplified triplet arpeggios
  // Each beat has a triplet arpeggio (3 eighth-note triplets)
  // 4/4 time, 8 measures

  const measures: { bass: number; tripletNotes: number[] }[] = [
    // Bar 1-2: C#m arpeggio over C#3 bass
    { bass: Cs4 - 12, tripletNotes: [Gs4, Cs5, E5] }, // C#3=49
    { bass: Cs4 - 12, tripletNotes: [Gs4, Cs5, E5] },
    // Bar 3-4: over B2
    { bass: B3 - 12, tripletNotes: [Gs4, Cs5, E5] }, // B2=47
    { bass: B3 - 12, tripletNotes: [Gs4, Cs5, E5] },
    // Bar 5-6: A major over A2
    { bass: A3 - 12, tripletNotes: [A4, Cs5, E5] }, // A2=45
    { bass: A3 - 12, tripletNotes: [A4, Cs5, E5] },
    // Bar 7-8: F#m over F#2, then G#7 over G#2
    { bass: Fs4 - 24, tripletNotes: [Fs4, A4, Cs5] }, // F#2=42
    { bass: Gs4 - 24, tripletNotes: [Gs4, B4, E5] }, // G#2=44
  ];

  let beat = 0;
  const secPerBeat = 60 / 56;

  for (const bar of measures) {
    // Bass note: whole note (4 beats)
    lh.addNote({
      midi: bar.bass,
      time: beat * secPerBeat,
      duration: 4 * secPerBeat * 0.95,
      velocity: 0.55,
    });

    // Also an octave higher bass
    lh.addNote({
      midi: bar.bass + 12,
      time: beat * secPerBeat,
      duration: 4 * secPerBeat * 0.95,
      velocity: 0.45,
    });

    // Triplet arpeggios: 4 groups of 3 per bar
    for (let group = 0; group < 4; group++) {
      for (let t = 0; t < 3; t++) {
        const tripletOffset = group + t / 3;
        rh.addNote({
          midi: bar.tripletNotes[t],
          time: (beat + tripletOffset) * secPerBeat,
          duration: (1 / 3) * secPerBeat * 0.9,
          velocity: t === 2 ? 0.65 : 0.5, // top note slightly louder
        });
      }
    }

    beat += 4;
  }

  return midi;
}

function buildTurkishMarch(): Midi {
  const midi = new Midi();
  midi.header.setTempo(132);
  const track = midi.addTrack();
  track.name = "Piano Right Hand";
  track.channel = 0;

  // Turkish March (Rondo Alla Turca) — simplified opening theme
  // 2/4 time, sixteenth note runs
  const melody: [number, number][] = [
    // Opening motif: B A G# A — C5 (16ths then quarter)
    [B4, 0.25],
    [A4, 0.25],
    [Gs4, 0.25],
    [A4, 0.25],
    [C5, 1],
    // D5 C5 B4 C5 — E5
    [D5, 0.25],
    [C5, 0.25],
    [B4, 0.25],
    [C5, 0.25],
    [E5, 1],
    // F5 E5 D#5 E5 — B4 B4 B4
    [F5, 0.25],
    [E5, 0.25],
    [Ds5, 0.25],
    [E5, 0.25],
    [B4, 0.5],
    [B4, 0.5],
    [B4, 0.5],
    // Repeat variation
    [B4, 0.25],
    [A4, 0.25],
    [Gs4, 0.25],
    [A4, 0.25],
    [C5, 1],
    [D5, 0.25],
    [C5, 0.25],
    [B4, 0.25],
    [C5, 0.25],
    [E5, 1],
    // Descending run
    [F5, 0.25],
    [E5, 0.25],
    [Ds5, 0.25],
    [E5, 0.25],
    [B4, 0.5],
    [C5, 0.5],
    // A major ending
    [A4, 1],
    [A4, 1],
  ];

  const entries = sequentialNotes(melody);
  addNotesFromBeats(track, entries, 132, 0.75);
  return midi;
}

function buildAuClairDeLaLune(): Midi {
  const midi = new Midi();
  midi.header.setTempo(96);
  const track = midi.addTrack();
  track.name = "Piano";
  track.channel = 0;

  // Au Clair de la Lune — simple French folk song, great for beginners
  const melody: [number, number][] = [
    // Au clair de la lune
    [C4, 1],
    [C4, 1],
    [C4, 1],
    [D4, 1],
    [E4, 2],
    [D4, 2],
    // Mon ami Pierrot
    [C4, 1],
    [E4, 1],
    [D4, 1],
    [D4, 1],
    [C4, 4],
    // Prete-moi ta plume
    [C4, 1],
    [C4, 1],
    [C4, 1],
    [D4, 1],
    [E4, 2],
    [D4, 2],
    // Pour ecrire un mot
    [C4, 1],
    [E4, 1],
    [D4, 1],
    [D4, 1],
    [C4, 4],
  ];

  const entries = sequentialNotes(melody);
  addNotesFromBeats(track, entries, 96, 0.7);
  return midi;
}

function buildChopsticks(): Midi {
  const midi = new Midi();
  midi.header.setTempo(120);

  const rh = midi.addTrack();
  rh.name = "Right Hand";
  rh.channel = 0;

  // Chopsticks — the classic beginner duet, right hand part
  // Played as repeated note pairs (both notes struck together)
  // 3/4 time

  // The famous two-note pattern: F4+G4, then stepping up
  const pairs: [number, number, number][] = [
    // Section 1: F+G repeated, then step up
    [F4, G4, 1],
    [F4, G4, 1],
    [F4, G4, 1],
    [E4, G4, 1],
    [E4, G4, 1],
    [E4, G4, 1],
    [D4, B4, 1],
    [D4, B4, 1],
    [D4, B4, 1],
    [C4, C5, 1],
    [C4, C5, 1],
    [C4, C5, 1],
    // Section 2: descend
    [D4, B4, 1],
    [D4, B4, 1],
    [D4, B4, 1],
    [E4, G4, 1],
    [E4, G4, 1],
    [E4, G4, 1],
    [F4, G4, 1],
    [F4, G4, 1],
    [F4, G4, 1],
    [E4, C5, 2],
    [E4, C5, 1],
  ];

  const secPerBeat = 60 / 120;
  let beat = 0;
  for (const [low, high, dur] of pairs) {
    rh.addNote({
      midi: low,
      time: beat * secPerBeat,
      duration: dur * secPerBeat * 0.9,
      velocity: 0.7,
    });
    rh.addNote({
      midi: high,
      time: beat * secPerBeat,
      duration: dur * secPerBeat * 0.9,
      velocity: 0.7,
    });
    beat += dur;
  }

  return midi;
}

function buildLavenderBlue(): Midi {
  const midi = new Midi();
  midi.header.setTempo(100);
  const track = midi.addTrack();
  track.name = "Piano";
  track.channel = 0;

  // Lavender's Blue — English folk song, 3/4 waltz
  // Key of C major
  const melody: [number, number][] = [
    // Lavender's blue, dilly dilly
    [C4, 2],
    [E4, 1],
    [G4, 2],
    [E4, 1],
    // Lavender's green
    [F4, 2],
    [E4, 1],
    [D4, 3],
    // When I am king, dilly dilly
    [E4, 2],
    [G4, 1],
    [C5, 2],
    [G4, 1],
    // You shall be queen
    [A4, 2],
    [G4, 1],
    [F4, 3],
    // Who told you so, dilly dilly
    [G4, 2],
    [A4, 1],
    [G4, 2],
    [F4, 1],
    // Who told you so
    [E4, 2],
    [D4, 1],
    [C4, 3],
  ];

  const entries = sequentialNotes(melody);
  addNotesFromBeats(track, entries, 100, 0.7);
  return midi;
}

// ─── Song definitions ────────────────────────────────────────────────

const songDefs: SongDef[] = [
  // ── Exercises ──
  {
    id: "c-major-scale",
    file: "c-major-scale.mid",
    title: "C Major Scale",
    composer: "Exercise",
    difficulty: "beginner",
    category: "exercise",
    tags: ["exercise", "scale", "c-major", "4-4"],
    bpm: 120,
    build: buildCMajorScale,
  },

  // ── Popular / Traditional ──
  {
    id: "mary-had-a-little-lamb",
    file: "mary-had-a-little-lamb.mid",
    title: "Mary Had a Little Lamb",
    composer: "Traditional",
    difficulty: "beginner",
    category: "popular",
    tags: ["traditional", "melody", "beginner", "c-major", "4-4"],
    bpm: 100,
    build: buildMaryHadALittleLamb,
  },
  {
    id: "hot-cross-buns",
    file: "hot-cross-buns.mid",
    title: "Hot Cross Buns",
    composer: "Traditional",
    difficulty: "beginner",
    category: "popular",
    tags: ["traditional", "melody", "beginner", "c-major", "4-4"],
    bpm: 100,
    build: buildHotCrossBuns,
  },
  {
    id: "twinkle-twinkle",
    file: "twinkle-twinkle.mid",
    title: "Twinkle Twinkle Little Star",
    composer: "Traditional",
    difficulty: "beginner",
    category: "popular",
    tags: ["traditional", "melody", "c-major", "4-4"],
    bpm: 100,
    build: buildTwinkleTwinkle,
  },
  {
    id: "happy-birthday",
    file: "happy-birthday.mid",
    title: "Happy Birthday",
    composer: "Traditional",
    difficulty: "beginner",
    category: "popular",
    tags: ["popular", "melody", "f-major", "3-4"],
    bpm: 100,
    build: buildHappyBirthday,
  },
  {
    id: "london-bridge",
    file: "london-bridge.mid",
    title: "London Bridge",
    composer: "Traditional",
    difficulty: "beginner",
    category: "popular",
    tags: ["traditional", "melody", "c-major", "4-4"],
    bpm: 120,
    build: buildLondonBridge,
  },
  {
    id: "row-row-row",
    file: "row-row-row.mid",
    title: "Row Row Row Your Boat",
    composer: "Traditional",
    difficulty: "beginner",
    category: "popular",
    tags: ["traditional", "melody", "c-major", "6-8"],
    bpm: 100,
    build: buildRowRowRow,
  },
  {
    id: "au-clair-de-la-lune",
    file: "au-clair-de-la-lune.mid",
    title: "Au Clair de la Lune",
    composer: "Traditional (French)",
    difficulty: "beginner",
    category: "popular",
    tags: ["traditional", "melody", "french", "c-major", "4-4"],
    bpm: 96,
    build: buildAuClairDeLaLune,
  },
  {
    id: "chopsticks",
    file: "chopsticks.mid",
    title: "Chopsticks",
    composer: "Euphemia Allen",
    difficulty: "beginner",
    category: "popular",
    tags: ["popular", "duet", "classic", "c-major", "3-4"],
    bpm: 120,
    build: buildChopsticks,
  },
  {
    id: "lavender-blue",
    file: "lavender-blue.mid",
    title: "Lavender's Blue",
    composer: "Traditional (English)",
    difficulty: "beginner",
    category: "popular",
    tags: ["traditional", "melody", "folk", "c-major", "3-4"],
    bpm: 100,
    build: buildLavenderBlue,
  },

  // ── Holiday ──
  {
    id: "jingle-bells",
    file: "jingle-bells.mid",
    title: "Jingle Bells",
    composer: "James Lord Pierpont",
    difficulty: "beginner",
    category: "holiday",
    tags: ["holiday", "christmas", "melody", "c-major", "4-4"],
    bpm: 120,
    build: buildJingleBells,
  },

  // ── Classical (Intermediate) ──
  {
    id: "ode-to-joy",
    file: "ode-to-joy.mid",
    title: "Ode to Joy",
    composer: "Ludwig van Beethoven",
    difficulty: "beginner",
    category: "classical",
    tags: ["classical", "melody", "c-major", "4-4"],
    bpm: 120,
    build: buildOdeToJoy,
  },
  {
    id: "fur-elise",
    file: "fur-elise.mid",
    title: "Fur Elise",
    composer: "Ludwig van Beethoven",
    difficulty: "intermediate",
    category: "classical",
    tags: ["classical", "romantic", "a-minor", "3-8"],
    bpm: 72,
    build: buildFurElise,
  },
  {
    id: "minuet-in-g",
    file: "minuet-in-g.mid",
    title: "Minuet in G Major",
    composer: "J.S. Bach",
    difficulty: "intermediate",
    category: "classical",
    tags: ["classical", "baroque", "g-major", "3-4", "two-hands"],
    bpm: 108,
    build: buildMinuetInG,
  },
  {
    id: "prelude-in-c",
    file: "prelude-in-c.mid",
    title: "Prelude in C Major (BWV 846)",
    composer: "J.S. Bach",
    difficulty: "intermediate",
    category: "classical",
    tags: [
      "classical",
      "baroque",
      "arpeggiated",
      "c-major",
      "4-4",
      "two-hands",
    ],
    bpm: 72,
    build: buildPreludeInC,
  },
  {
    id: "canon-in-d",
    file: "canon-in-d.mid",
    title: "Canon in D",
    composer: "Johann Pachelbel",
    difficulty: "intermediate",
    category: "classical",
    tags: ["classical", "baroque", "d-major", "4-4", "two-hands"],
    bpm: 80,
    build: buildCanonInD,
  },

  // ── Classical (Advanced) ──
  {
    id: "moonlight-sonata",
    file: "moonlight-sonata.mid",
    title: "Moonlight Sonata (1st mvt)",
    composer: "Ludwig van Beethoven",
    difficulty: "advanced",
    category: "classical",
    tags: ["classical", "romantic", "c#-minor", "2-2", "two-hands"],
    bpm: 56,
    build: buildMoonlightSonata,
  },
  {
    id: "turkish-march",
    file: "turkish-march.mid",
    title: "Turkish March",
    composer: "W.A. Mozart",
    difficulty: "advanced",
    category: "classical",
    tags: ["classical", "fast", "a-minor", "2-4"],
    bpm: 132,
    build: buildTurkishMarch,
  },
];

// ─── Main: generate all MIDI files + songs.json ──────────────────────

interface GeneratedMidiFile {
  id: string;
  file: string;
  title: string;
  category: Category;
  bytes: Buffer;
  durationSeconds: number;
}

interface GeneratedSongArtifacts {
  midiFiles: GeneratedMidiFile[];
  songsMeta: SongMeta[];
}

function readExistingManifest(): SongMeta[] {
  const songsJsonPath = join(outDir, "songs.json");
  if (!existsSync(songsJsonPath)) return [];
  return JSON.parse(readFileSync(songsJsonPath, "utf8")) as SongMeta[];
}

export function buildGeneratedSongArtifacts(
  existingManifest: readonly SongMeta[] = [],
): GeneratedSongArtifacts {
  const generatedDrafts = songDefs.map((def) => {
    const midiObj = def.build();
    applyInferredHandTrackNames(midiObj);
    const meta = createSongMetaFromDefinition(def, midiObj);
    return { def, midiObj, meta };
  });
  const generatedMeta = generatedDrafts.map((draft) => draft.meta);
  const songsMeta = mergeGeneratedSongMetadata(generatedMeta, existingManifest);
  const mergedMetaById = new Map(songsMeta.map((meta) => [meta.id, meta]));
  const midiFiles = generatedDrafts.map(({ def, midiObj, meta }) => {
    const mergedMeta = mergedMetaById.get(def.id) ?? meta;
    const bytes = Buffer.from(
      encodeMidiWithNotationHeaderMetadata(midiObj, mergedMeta.tags),
    );
    return {
      id: def.id,
      file: def.file,
      title: mergedMeta.title,
      category: mergedMeta.category,
      bytes,
      durationSeconds: mergedMeta.durationSeconds,
    };
  });

  return { midiFiles, songsMeta };
}

function updateExistingOnlyMidiHeaders(
  songsMeta: readonly SongMeta[],
  generatedIds: ReadonlySet<string>,
): void {
  for (const song of songsMeta) {
    if (generatedIds.has(song.id)) continue;

    const filePath = join(outDir, song.file);
    if (!existsSync(filePath)) {
      console.warn(`  [missing  ] ${song.title} → ${song.file}`);
      continue;
    }

    const midiObj = new Midi(readFileSync(filePath));
    applyInferredHandTrackNames(midiObj);
    writeFileSync(
      filePath,
      Buffer.from(encodeMidiWithNotationHeaderMetadata(midiObj, song.tags)),
    );
    console.log(`  [metadata ] ${song.title.padEnd(32)} → ${song.file}`);
  }
}

function jsonValue(value: unknown): string {
  return JSON.stringify(value);
}

function formatTags(tags: readonly string[]): string[] {
  const inlineTags = `[${tags.map(jsonValue).join(", ")}]`;
  if (tags.length <= 6 && inlineTags.length <= 68) {
    return [`    "tags": ${inlineTags}`];
  }

  return [
    `    "tags": [`,
    ...tags.map(
      (tag, index) =>
        `      ${jsonValue(tag)}${index === tags.length - 1 ? "" : ","}`,
    ),
    `    ]`,
  ];
}

function formatSongMeta(song: SongMeta): string {
  const lines = [
    `  {`,
    `    "id": ${jsonValue(song.id)},`,
    `    "file": ${jsonValue(song.file)},`,
    `    "title": ${jsonValue(song.title)},`,
    `    "composer": ${jsonValue(song.composer)},`,
    `    "difficulty": ${jsonValue(song.difficulty)},`,
    `    "category": ${jsonValue(song.category)},`,
  ];

  if (song.grade !== undefined) {
    lines.push(`    "grade": ${song.grade},`);
  }

  lines.push(`    "durationSeconds": ${song.durationSeconds},`);
  const tagLines = formatTags(song.tags);
  lines.push(...tagLines);
  lines.push(`  }`);

  return lines.join("\n");
}

function formatSongsJson(songsMeta: readonly SongMeta[]): string {
  return `${["[", songsMeta.map(formatSongMeta).join(",\n"), "]"].join(
    "\n",
  )}\n`;
}

export function runGenerateSongs(): void {
  mkdirSync(outDir, { recursive: true });

  console.log("Generating MIDI files for Rexiano song library...");
  console.log(
    "Merging generated timing with curated songs.json metadata (grade and level tags preserved).\n",
  );

  const existingManifest = readExistingManifest();
  const { midiFiles, songsMeta } =
    buildGeneratedSongArtifacts(existingManifest);
  const generatedIds = new Set(midiFiles.map((file) => file.id));

  for (const midiFile of midiFiles) {
    const filePath = join(outDir, midiFile.file);
    writeFileSync(filePath, midiFile.bytes);

    console.log(
      `  [${midiFile.category.padEnd(9)}] ${midiFile.title.padEnd(32)} → ${midiFile.file} (${midiFile.bytes.length} bytes, ${midiFile.durationSeconds}s)`,
    );
  }

  updateExistingOnlyMidiHeaders(songsMeta, generatedIds);

  const songsJsonPath = join(outDir, "songs.json");
  writeFileSync(songsJsonPath, formatSongsJson(songsMeta));
  console.log(
    `\nWrote ${songsJsonPath} with ${songsMeta.length} songs (${midiFiles.length} generated, ${songsMeta.length - midiFiles.length} metadata-only).`,
  );
  console.log("Done!");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runGenerateSongs();
}
