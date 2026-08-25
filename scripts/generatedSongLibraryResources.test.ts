import { describe, expect, it } from "vitest";
import { Midi } from "@tonejs/midi";
import { existsSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { parseMidiFile } from "@renderer/engines/midi/MidiFileParser";
import type { ParsedSong } from "@renderer/engines/midi/types";
import { buildMidiDiagnosticNotice } from "@renderer/features/midiDiagnostics/midiDiagnosticNotice";
import type { BuiltinSongMeta } from "@shared/types";
import { filterSongsForLibrary } from "@renderer/features/songLibrary/songLibrarySelectors";
import { buildGeneratedSongArtifacts } from "./generate-songs";

type SongMeta = {
  id: string;
  file: string;
  title?: string;
  composer?: string;
  grade?: number;
  tags: string[];
};

const PUBLIC_DOMAIN_EXPANSION = [
  {
    id: "lightly-row",
    title: "Lightly Row",
    composer: "Traditional",
    grade: 1,
  },
  {
    id: "old-macdonald",
    title: "Old MacDonald",
    composer: "Traditional",
    grade: 2,
  },
  {
    id: "this-old-man",
    title: "This Old Man",
    composer: "Traditional",
    grade: 2,
  },
  {
    id: "alouette",
    title: "Alouette",
    composer: "Traditional (French)",
    grade: 2,
  },
  {
    id: "go-tell-aunt-rhody",
    title: "Go Tell Aunt Rhody",
    composer: "Traditional",
    grade: 3,
  },
  {
    id: "when-the-saints",
    title: "When the Saints Go Marching In",
    composer: "Traditional",
    grade: 3,
  },
  {
    id: "oh-susanna",
    title: "Oh! Susanna",
    composer: "Stephen Foster",
    grade: 4,
  },
  {
    id: "silent-night",
    title: "Silent Night",
    composer: "Franz Xaver Gruber",
    grade: 4,
  },
] as const;

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

function readParsedSong(song: SongMeta): ParsedSong {
  return parseMidiFile(
    song.file,
    Array.from(readFileSync(join(resourcesDir, song.file))),
  );
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
  it("keeps release built-ins free of visible MIDI diagnostic notices", () => {
    const visibleNotices = manifest.flatMap((song) => {
      const notice = buildMidiDiagnosticNotice(readParsedSong(song), {
        hasTimeSignatureMetadata: expectedTimeSignature(song) !== undefined,
      });
      return notice
        ? [
            {
              id: song.id,
              title: notice.title,
              codes: notice.codes,
              details: notice.details,
            },
          ]
        : [];
    });

    expect(visibleNotices).toEqual([]);
  });

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

  it("generates public-domain expansion songs with title, composer, and grade", () => {
    const { midiFiles, songsMeta } = buildGeneratedSongArtifacts([]);

    for (const expected of PUBLIC_DOMAIN_EXPANSION) {
      expect(songsMeta.find((song) => song.id === expected.id)).toMatchObject(
        expected,
      );
      expect(midiFiles.some((file) => file.id === expected.id)).toBe(true);
    }
  });

  it("ships searchable expansion songs with MIDI files and catalog metadata", () => {
    const catalog = manifest as BuiltinSongMeta[];

    for (const expected of PUBLIC_DOMAIN_EXPANSION) {
      const song = catalog.find((entry) => entry.id === expected.id);
      expect(song).toMatchObject(expected);
      expect(song?.file).toBeTruthy();
      expect(existsSync(join(resourcesDir, song!.file))).toBe(true);
    }

    expect(
      filterSongsForLibrary(catalog, {
        difficultyFilter: "all",
        gradeFilter: "all",
        searchQuery: "aunt rhody",
      }).map((song) => song.id),
    ).toContain("go-tell-aunt-rhody");
    expect(
      filterSongsForLibrary(catalog, {
        difficultyFilter: "all",
        gradeFilter: "all",
        searchQuery: "stephen foster",
      }).map((song) => song.id),
    ).toContain("oh-susanna");
    expect(
      filterSongsForLibrary(catalog, {
        difficultyFilter: "all",
        gradeFilter: 4,
        searchQuery: "",
      }).map((song) => song.id),
    ).toEqual(expect.arrayContaining(["oh-susanna", "silent-night"]));
  });
});
