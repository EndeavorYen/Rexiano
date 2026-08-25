import { Midi } from "@tonejs/midi";
import { describe, expect, it } from "vitest";
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
