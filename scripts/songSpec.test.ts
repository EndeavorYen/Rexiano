import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { Midi } from "@tonejs/midi";
import { buildMidiFromSpec, loadSongSpec, type SongSpec } from "./songSpec";

const here = dirname(fileURLToPath(import.meta.url));
const specDir = join(here, "songSpecs");
const midiDir = join(here, "..", "resources", "midi");

const spec: SongSpec = {
  id: "happy-birthday",
  meter: [3, 4],
  keyFifths: -1,
  mode: "major",
  pickupBeats: 1,
  rh: [
    [60, 0, 0.75],
    [60, 0.75, 0.25],
    [62, 1, 1],
  ],
  lh: [[41, 1, 3]],
  sources: [],
  notes: "",
};

describe("buildMidiFromSpec (#333/#334)", () => {
  it("writes the pickup as a short first time signature", () => {
    const midi = new Midi(buildMidiFromSpec(spec, 100).toArray());
    const ppq = midi.header.ppq;
    expect(
      midi.header.timeSignatures.map((ts) => [ts.ticks, ts.timeSignature]),
    ).toEqual([
      [0, [1, 4]],
      [ppq, [3, 4]],
    ]);
    // The generator writes the key from the song's tags on export, because
    // Tone.js drops key names when encoding.
    expect(buildMidiFromSpec(spec, 100).header.keySignatures[0]).toMatchObject({
      key: "F",
      scale: "major",
    });
  });

  it("puts each hand on its own named track at the given tempo", () => {
    const midi = new Midi(buildMidiFromSpec(spec, 100).toArray());
    expect(midi.tracks.map((t) => t.name)).toEqual(["Right Hand", "Left Hand"]);
    const [right, left] = midi.tracks;
    expect(right.notes.map((n) => [n.midi, n.ticks])).toEqual([
      [60, 0],
      [60, 0.75 * midi.header.ppq],
      [62, midi.header.ppq],
    ]);
    expect(left.notes[0].durationTicks).toBe(3 * midi.header.ppq);
    expect(midi.header.tempos[0].bpm).toBeCloseTo(100);
  });

  it("a melody-only spec has a single Piano track and no pickup meter", () => {
    const midi = buildMidiFromSpec({ ...spec, pickupBeats: 0, lh: [] }, 100);
    expect(midi.tracks.map((t) => t.name)).toEqual(["Piano"]);
    expect(midi.header.timeSignatures).toHaveLength(1);
  });
});

describe("packaged songs match their checked specs (#334)", () => {
  const ids = readdirSync(specDir)
    .filter((file) => file.endsWith(".json"))
    .map((file) => file.replace(/\.json$/, ""));

  it.each(ids)("%s", (id) => {
    const spec = loadSongSpec(join(specDir, `${id}.json`));
    const midi = new Midi(readFileSync(join(midiDir, `${id}.mid`)));
    const ppq = midi.header.ppq;
    const key = ([note, start, duration]: readonly number[]): string =>
      `${note}@${start.toFixed(3)}+${duration.toFixed(3)}`;
    const expected = [...spec.rh, ...spec.lh]
      .filter(([, , duration]) => duration > 0)
      .map(key)
      .sort();
    const actual = midi.tracks
      .flatMap((track) => track.notes)
      .map((n) => key([n.midi, n.ticks / ppq, n.durationTicks / ppq]))
      .sort();
    expect(actual).toEqual(expected);
  });
});
