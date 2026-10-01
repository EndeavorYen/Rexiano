/**
 * Built-in songs described as plain note lists (#334).
 *
 * Each spec in `scripts/songSpecs/<id>.json` was checked against a
 * public-domain source (listed in `sources`). A pickup is written the common
 * MIDI way, as a short first time signature (#333).
 */
import { Midi } from "@tonejs/midi";
import { readFileSync } from "fs";
import { pickupTimeSignature } from "../src/renderer/src/engines/midi/pickup";
import type { NoteEntry } from "./generatedSongLibrary";

export interface SongSpec {
  id: string;
  meter: [numerator: number, denominator: number];
  keyFifths: number;
  mode: "major" | "minor";
  /** Quarter notes before bar 1; 0 when the song starts on the downbeat */
  pickupBeats: number;
  /** Right hand: [midi, startBeat, durationBeats], beat 0 = first note */
  rh: NoteEntry[];
  /** Left hand; empty for a melody-only song */
  lh: NoteEntry[];
  sources: string[];
  notes: string;
}

const MAJOR_KEYS = ["Cb", "Gb", "Db", "Ab", "Eb", "Bb", "F", "C"];
const MAJOR_KEYS_SHARP = ["C", "G", "D", "A", "E", "B", "F#", "C#"];
const MINOR_KEYS = ["Ab", "Eb", "Bb", "F", "C", "G", "D", "A"];
const MINOR_KEYS_SHARP = ["A", "E", "B", "F#", "C#", "G#", "D#", "A#"];

function keyName(fifths: number, mode: "major" | "minor"): string {
  if (mode === "minor") {
    return fifths < 0 ? MINOR_KEYS[7 + fifths] : MINOR_KEYS_SHARP[fifths];
  }
  return fifths < 0 ? MAJOR_KEYS[7 + fifths] : MAJOR_KEYS_SHARP[fifths];
}

export function loadSongSpec(path: string): SongSpec {
  return JSON.parse(readFileSync(path, "utf8")) as SongSpec;
}

export function buildMidiFromSpec(spec: SongSpec, bpm: number): Midi {
  const midi = new Midi();
  midi.header.setTempo(bpm);
  const ppq = midi.header.ppq;
  const [numerator, denominator] = spec.meter;
  midi.header.timeSignatures =
    spec.pickupBeats > 0
      ? [
          {
            ticks: 0,
            timeSignature: pickupTimeSignature(spec.pickupBeats, denominator),
          },
          {
            ticks: Math.round(spec.pickupBeats * ppq),
            timeSignature: [numerator, denominator],
          },
        ]
      : [{ ticks: 0, timeSignature: [numerator, denominator] }];
  midi.header.keySignatures = [
    { ticks: 0, key: keyName(spec.keyFifths, spec.mode), scale: spec.mode },
  ];

  const hands: [string, NoteEntry[]][] =
    spec.lh.length > 0
      ? [
          ["Right Hand", spec.rh],
          ["Left Hand", spec.lh],
        ]
      : [["Piano", spec.rh]];
  for (const [name, notes] of hands) {
    const track = midi.addTrack();
    track.name = name;
    track.channel = 0;
    for (const [note, startBeat, durationBeats] of notes) {
      if (durationBeats <= 0) continue;
      track.addNote({
        midi: note,
        ticks: Math.round(startBeat * ppq),
        durationTicks: Math.round(durationBeats * ppq),
        velocity: name === "Left Hand" ? 0.55 : 0.7,
      });
    }
  }
  midi.header.update();
  return midi;
}
