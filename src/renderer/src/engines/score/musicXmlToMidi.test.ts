import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { parseMidiFile } from "../midi/MidiFileParser";
import type { ParsedNote, ParsedSong } from "../midi/types";
import { musicXmlToMidi } from "./musicXmlToMidi";

const AU_CLAIR_XML = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../../resources/scores/au-clair-de-la-lune.musicxml",
);

/** Matches the public-domain Au Clair melody encoded in the repo MusicXML. */
const AU_CLAIR_NOTES = [
  { midi: 60, startBeat: 0, durationBeats: 1 },
  { midi: 60, startBeat: 1, durationBeats: 1 },
  { midi: 60, startBeat: 2, durationBeats: 1 },
  { midi: 62, startBeat: 3, durationBeats: 1 },
  { midi: 64, startBeat: 4, durationBeats: 2 },
  { midi: 62, startBeat: 6, durationBeats: 2 },
  { midi: 60, startBeat: 8, durationBeats: 1 },
  { midi: 64, startBeat: 9, durationBeats: 1 },
  { midi: 62, startBeat: 10, durationBeats: 1 },
  { midi: 62, startBeat: 11, durationBeats: 1 },
  { midi: 60, startBeat: 12, durationBeats: 4 },
  { midi: 60, startBeat: 16, durationBeats: 1 },
  { midi: 60, startBeat: 17, durationBeats: 1 },
  { midi: 60, startBeat: 18, durationBeats: 1 },
  { midi: 62, startBeat: 19, durationBeats: 1 },
  { midi: 64, startBeat: 20, durationBeats: 2 },
  { midi: 62, startBeat: 22, durationBeats: 2 },
  { midi: 60, startBeat: 24, durationBeats: 1 },
  { midi: 64, startBeat: 25, durationBeats: 1 },
  { midi: 62, startBeat: 26, durationBeats: 1 },
  { midi: 62, startBeat: 27, durationBeats: 1 },
  { midi: 60, startBeat: 28, durationBeats: 4 },
] as const;

function parsedNotesFromXml(xml: string): {
  parsed: ParsedSong;
  notes: ParsedNote[];
} {
  const midi = musicXmlToMidi(xml);
  const parsed = parseMidiFile("from-score.mid", Array.from(midi.toArray()));
  return { parsed, notes: parsed.tracks.flatMap((track) => track.notes) };
}

describe("musicXmlToMidi", () => {
  test("converts a one-note MusicXML score to matching MIDI pitch and time", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <part id="P1">
    <measure number="1">
      <attributes><divisions>1</divisions></attributes>
      <sound tempo="120"/>
      <note>
        <pitch><step>C</step><octave>4</octave></pitch>
        <duration>1</duration>
      </note>
    </measure>
  </part>
</score-partwise>`;

    const { parsed, notes } = parsedNotesFromXml(xml);

    expect(parsed.tempos[0]?.bpm).toBe(120);
    expect(notes).toHaveLength(1);
    expect(notes[0].midi).toBe(60);
    expect(notes[0].ticks).toBe(0);
    expect(notes[0].durationTicks).toBe(parsed.ppq);
  });

  test("maps Au Clair MusicXML pitches and beat times onto MIDI", () => {
    const xml = readFileSync(AU_CLAIR_XML, "utf8");
    const { parsed, notes } = parsedNotesFromXml(xml);

    expect(parsed.tempos[0]?.bpm).toBe(96);
    expect(parsed.ppq).toBeDefined();
    const ppq = parsed.ppq ?? 0;
    expect(notes.map((note) => note.midi)).toEqual(
      AU_CLAIR_NOTES.map((note) => note.midi),
    );
    expect(notes.map((note) => note.ticks)).toEqual(
      AU_CLAIR_NOTES.map((note) => note.startBeat * ppq),
    );
    expect(notes.map((note) => note.durationTicks)).toEqual(
      AU_CLAIR_NOTES.map((note) => note.durationBeats * ppq),
    );
  });
});
