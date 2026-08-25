import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Midi } from "@tonejs/midi";
import { describe, expect, it, test } from "vitest";
import { parseMidiFile } from "@renderer/engines/midi/MidiFileParser";
import type { ParsedSong } from "../src/renderer/src/engines/midi/types";
import { musicXmlToMidi } from "../src/renderer/src/engines/score/musicXmlToMidi";
import { buildGeneratedSongArtifacts } from "./generate-songs";

const D5 = 74;
const E5 = 76;
const Fs4 = 66;
const Fs5 = 78;
const G4 = 67;
const G5 = 79;
const A4 = 69;
const B4 = 71;
const C5 = 72;

/** Public-domain Petzold / Anna Magdalena first strain, 3/4, no ornaments. */
const PETZOLD_FIRST_STRAIN_RH: ReadonlyArray<
  ReadonlyArray<readonly [midi: number, durationBeats: number]>
> = [
  [
    [D5, 1],
    [G4, 0.5],
    [A4, 0.5],
    [B4, 0.5],
    [C5, 0.5],
  ],
  [
    [D5, 1],
    [G4, 1],
    [G4, 1],
  ],
  [
    [E5, 1],
    [C5, 0.5],
    [D5, 0.5],
    [E5, 0.5],
    [Fs5, 0.5],
  ],
  [
    [G5, 1],
    [G4, 1],
    [G4, 1],
  ],
  [
    [C5, 1],
    [D5, 0.5],
    [C5, 0.5],
    [B4, 0.5],
    [A4, 0.5],
  ],
  [
    [B4, 1],
    [C5, 0.5],
    [B4, 0.5],
    [A4, 0.5],
    [G4, 0.5],
  ],
  [
    [Fs4, 1],
    [G4, 0.5],
    [A4, 0.5],
    [B4, 0.5],
    [G4, 0.5],
  ],
  [[A4, 3]],
];

const resourcesRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "resources",
);
const midiDir = join(resourcesRoot, "midi");
const auClairScorePath = join(
  resourcesRoot,
  "scores",
  "au-clair-de-la-lune.musicxml",
);

const ONE_NOTE_SCORE = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <part id="P1">
    <measure number="1">
      <attributes><divisions>1</divisions></attributes>
      <sound tempo="96"/>
      <note>
        <pitch><step>D</step><octave>4</octave></pitch>
        <duration>1</duration>
      </note>
    </measure>
  </part>
</score-partwise>`;

function beatsFromTicks(ticks: number, ppq: number): number {
  return Math.round((ticks / ppq) * 4) / 4;
}

function groupTrackByThreeFourMeasures(
  track: Midi["tracks"][number],
  ppq: number,
): Array<Array<readonly [midi: number, durationBeats: number]>> {
  const measureBeats = 3;
  const measures: Array<Array<readonly [midi: number, durationBeats: number]>> =
    [];

  for (const note of track.notes) {
    const startBeat = beatsFromTicks(note.ticks, ppq);
    const durationBeats = beatsFromTicks(note.durationTicks, ppq);
    const measureIndex = Math.floor(startBeat / measureBeats);
    measures[measureIndex] ??= [];
    measures[measureIndex].push([note.midi, durationBeats]);
  }

  return measures;
}

function noteKeys(song: ParsedSong): Array<Array<number | undefined>> {
  return song.tracks.flatMap((track) =>
    track.notes.map((note) => [note.midi, note.ticks, note.durationTicks]),
  );
}

describe("buildMinuetInG", () => {
  it("groups the first strain into the public-domain Petzold 8 bars", () => {
    const { midiFiles } = buildGeneratedSongArtifacts();
    const minuet = midiFiles.find((file) => file.id === "minuet-in-g");
    expect(minuet).toBeDefined();

    const midi = new Midi(minuet!.bytes);
    const rightHand = midi.tracks.find((track) =>
      /right hand/i.test(track.name),
    );
    expect(rightHand).toBeDefined();

    const measures = groupTrackByThreeFourMeasures(rightHand!, midi.header.ppq);

    const lastNote = rightHand!.notes.at(-1);
    expect(lastNote).toBeDefined();
    expect(
      beatsFromTicks(
        lastNote!.ticks + lastNote!.durationTicks,
        midi.header.ppq,
      ),
    ).toBe(24);

    expect(measures).toHaveLength(8);
    expect(measures).toEqual(PETZOLD_FIRST_STRAIN_RH);
  });
});

describe("buildGeneratedSongArtifacts score-first contract", () => {
  test("uses MusicXML from scoresDir when a built-in score is present", () => {
    const scoresDir = mkdtempSync(join(tmpdir(), "rexiano-scores-"));
    writeFileSync(
      join(scoresDir, "au-clair-de-la-lune.musicxml"),
      ONE_NOTE_SCORE,
    );

    const { midiFiles } = buildGeneratedSongArtifacts([], { scoresDir });
    const auClair = midiFiles.find((file) => file.id === "au-clair-de-la-lune");
    expect(auClair).toBeDefined();

    const parsed = parseMidiFile(auClair!.file, Array.from(auClair!.bytes));
    const notes = parsed.tracks.flatMap((track) => track.notes);

    expect(notes).toHaveLength(1);
    expect(notes[0]?.midi).toBe(62);
    expect(notes[0]?.ticks).toBe(0);
  });

  test("leaves songs without MusicXML on the generated MIDI path", () => {
    const { midiFiles } = buildGeneratedSongArtifacts([], {
      scoresDir: mkdtempSync(join(tmpdir(), "rexiano-empty-scores-")),
    });
    const hotCross = midiFiles.find((file) => file.id === "hot-cross-buns");
    expect(hotCross).toBeDefined();

    const generated = parseMidiFile(
      hotCross!.file,
      Array.from(hotCross!.bytes),
    );
    const committed = parseMidiFile(
      "hot-cross-buns.mid",
      Array.from(readFileSync(join(midiDir, "hot-cross-buns.mid"))),
    );

    expect(generated.noteCount).toBeGreaterThan(0);
    expect(noteKeys(generated)).toEqual(noteKeys(committed));
  });

  test("keeps the packaged Au Clair MIDI aligned with the repo MusicXML", () => {
    const fromScore = parseMidiFile(
      "au-clair-from-score.mid",
      Array.from(
        musicXmlToMidi(readFileSync(auClairScorePath, "utf8")).toArray(),
      ),
    );
    const packaged = parseMidiFile(
      "au-clair-de-la-lune.mid",
      Array.from(readFileSync(join(midiDir, "au-clair-de-la-lune.mid"))),
    );

    expect(noteKeys(packaged)).toEqual(noteKeys(fromScore));
  });
});
