import { describe, expect, it } from "vitest";
import { Midi } from "@tonejs/midi";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

type SongMeta = {
  id: string;
  file: string;
  tags: string[];
};

type ExpectedKeySignature = {
  key: string;
  scale: "major" | "minor";
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const resourcesDir = join(__dirname, "..", "resources", "midi");
const manifest = JSON.parse(
  readFileSync(join(resourcesDir, "songs.json"), "utf8"),
) as SongMeta[];

const KEY_SIGNATURE_KEYS = [
  "Cb",
  "Gb",
  "Db",
  "Ab",
  "Eb",
  "Bb",
  "F",
  "C",
  "G",
  "D",
  "A",
  "E",
  "B",
  "F#",
  "C#",
] as const;

const KEY_SIGNATURE_BY_TAG = new Map<string, number>([
  ["c-major", 0],
  ["g-major", 1],
  ["d-major", 2],
  ["a-major", 3],
  ["e-major", 4],
  ["b-major", 5],
  ["f#-major", 6],
  ["c#-major", 7],
  ["f-major", -1],
  ["bb-major", -2],
  ["eb-major", -3],
  ["ab-major", -4],
  ["db-major", -5],
  ["gb-major", -6],
  ["cb-major", -7],
  ["a-minor", 0],
  ["e-minor", 1],
  ["b-minor", 2],
  ["f#-minor", 3],
  ["c#-minor", 4],
  ["g#-minor", 5],
  ["d#-minor", 6],
  ["a#-minor", 7],
  ["d-minor", -1],
  ["g-minor", -2],
  ["c-minor", -3],
  ["f-minor", -4],
  ["bb-minor", -5],
  ["eb-minor", -6],
  ["ab-minor", -7],
]);

function readMidi(song: SongMeta): Midi {
  return new Midi(readFileSync(join(resourcesDir, song.file)));
}

function expectedTimeSignature(
  song: SongMeta,
): [numerator: number, denominator: number] | undefined {
  for (const tag of song.tags) {
    const match = /^(\d+)-(\d+)$/.exec(tag);
    if (match) return [Number(match[1]), Number(match[2])];
  }
  return undefined;
}

function expectedKeySignature(
  song: SongMeta,
): ExpectedKeySignature | undefined {
  for (const tag of song.tags) {
    const accidentals = KEY_SIGNATURE_BY_TAG.get(tag);
    if (accidentals === undefined) continue;

    const scale = tag.endsWith("-minor") ? "minor" : "major";
    return {
      key: KEY_SIGNATURE_KEYS[accidentals + 7],
      scale,
    };
  }
  return undefined;
}

describe("generated built-in MIDI resources", () => {
  it("carry matching key and time signature headers from songs.json tags", () => {
    const mismatches: string[] = [];

    for (const song of manifest) {
      const midi = readMidi(song);
      const timeSignature = expectedTimeSignature(song);
      const keySignature = expectedKeySignature(song);

      if (timeSignature) {
        const headerTimeSignature = midi.header.timeSignatures[0];
        if (
          headerTimeSignature?.ticks !== 0 ||
          headerTimeSignature.timeSignature[0] !== timeSignature[0] ||
          headerTimeSignature.timeSignature[1] !== timeSignature[1]
        ) {
          mismatches.push(
            `${song.id}: expected ${timeSignature.join("/")}, got ${JSON.stringify(headerTimeSignature?.timeSignature ?? null)}`,
          );
        }
      }

      if (keySignature) {
        const headerKeySignature = midi.header.keySignatures[0];
        if (
          headerKeySignature?.ticks !== 0 ||
          headerKeySignature.key !== keySignature.key ||
          headerKeySignature.scale !== keySignature.scale
        ) {
          mismatches.push(
            `${song.id}: expected ${keySignature.key} ${keySignature.scale}, got ${headerKeySignature?.key ?? "none"} ${headerKeySignature?.scale ?? ""}`.trim(),
          );
        }
      }
    }

    expect(mismatches).toEqual([]);
  });

  it("keeps simple generated song note durations on the notation grid", () => {
    const song = manifest.find((entry) => entry.id === "hot-cross-buns");
    expect(song).toBeDefined();

    const midi = readMidi(song!);
    const durationGridTicks = midi.header.ppq / 4;
    const offGridDurations = midi.tracks.flatMap((track) =>
      track.notes
        .filter(
          (note) => Math.round(note.durationTicks) % durationGridTicks !== 0,
        )
        .map((note) => ({
          midi: note.midi,
          durationTicks: Math.round(note.durationTicks),
        })),
    );

    expect(offGridDurations).toEqual([]);
  });
});
