/* eslint-disable @typescript-eslint/explicit-function-return-type */
/**
 * Generate demo MIDI files for the built-in song library.
 * Run: node scripts/generate-demo-midi.mjs
 */
import pkg from "@tonejs/midi";
const { Midi } = pkg;
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "resources", "midi");
mkdirSync(outDir, { recursive: true });

function saveMidi(midi, filename) {
  const buffer = Buffer.from(midi.toArray());
  writeFileSync(join(outDir, filename), buffer);
  console.log(`  Created ${filename} (${buffer.length} bytes)`);
}

// ─── C Major Scale ──────────────────────────────────────
function createCMajorScale() {
  const midi = new Midi();
  midi.header.setTempo(120);
  const track = midi.addTrack();
  track.name = "Piano";
  track.channel = 0;

  // C4 D4 E4 F4 G4 A4 B4 C5 (ascending)
  const notes = [60, 62, 64, 65, 67, 69, 71, 72];
  // then descending back
  const allNotes = [...notes, ...[...notes].reverse().slice(1)];

  allNotes.forEach((midi_note, i) => {
    track.addNote({
      midi: midi_note,
      time: i * 0.5,
      duration: 0.45,
      velocity: 0.7,
    });
  });

  return midi;
}

// ─── Twinkle Twinkle Little Star ────────────────────────
function createTwinkleTwinkle() {
  const midi = new Midi();
  midi.header.setTempo(100);
  const track = midi.addTrack();
  track.name = "Piano";
  track.channel = 0;

  // Melody in C major
  // C C G G A A G | F F E E D D C | G G F F E E D | G G F F E E D
  // C C G G A A G | F F E E D D C
  const melody = [
    // Line 1: Twinkle twinkle little star
    60, 60, 67, 67, 69, 69, 67,
    // Line 2: How I wonder what you are
    65, 65, 64, 64, 62, 62, 60,
    // Line 3: Up above the world so high
    67, 67, 65, 65, 64, 64, 62,
    // Line 4: Like a diamond in the sky
    67, 67, 65, 65, 64, 64, 62,
    // Line 5: Twinkle twinkle little star
    60, 60, 67, 67, 69, 69, 67,
    // Line 6: How I wonder what you are
    65, 65, 64, 64, 62, 62, 60,
  ];

  // Rhythm: quarter notes with half note at end of each phrase
  const durations = [
    0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 1.0, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 1.0, 0.5,
    0.5, 0.5, 0.5, 0.5, 0.5, 1.0, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 1.0, 0.5, 0.5,
    0.5, 0.5, 0.5, 0.5, 1.0, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 1.0,
  ];

  let time = 0;
  melody.forEach((note, i) => {
    track.addNote({
      midi: note,
      time,
      duration: durations[i] * 0.9,
      velocity: 0.75,
    });
    time += durations[i];
  });

  return midi;
}

// ─── Ode to Joy ─────────────────────────────────────────
function createOdeToJoy() {
  const midi = new Midi();
  midi.header.setTempo(120);
  const track = midi.addTrack();
  track.name = "Piano";
  track.channel = 0;

  // E E F G | G F E D | C C D E | E D D
  // E E F G | G F E D | C C D E | D C C
  const melody = [
    // Line 1
    64, 64, 65, 67, 67, 65, 64, 62, 60, 60, 62, 64, 64, 62, 62,
    // Line 2
    64, 64, 65, 67, 67, 65, 64, 62, 60, 60, 62, 64, 62, 60, 60,
  ];

  const durations = [
    // Line 1
    0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.75, 0.25, 1.0,
    // Line 2
    0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.75, 0.25, 1.0,
  ];

  let time = 0;
  melody.forEach((note, i) => {
    track.addNote({
      midi: note,
      time,
      duration: durations[i] * 0.9,
      velocity: 0.7,
    });
    time += durations[i];
  });

  return midi;
}

console.log("Generating demo MIDI files...");
saveMidi(createCMajorScale(), "c-major-scale.mid");
saveMidi(createTwinkleTwinkle(), "twinkle-twinkle.mid");
saveMidi(createOdeToJoy(), "ode-to-joy.mid");
console.log("Done!");
