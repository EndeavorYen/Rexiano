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
import { findPickup } from "../src/engines/midi/pickup";
import {
  classifySongLessonGroup,
  type LessonGroupId,
} from "@renderer/features/songLibrary/lessonProgression";

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

/** Short, familiar public-domain songs for the first lesson groups. */
const BEGINNER_EXPANSION: readonly {
  id: string;
  title: string;
  titleZhTW: string;
  composer: string;
  grade: number;
  group: LessonGroupId;
}[] = [
  {
    id: "the-cuckoo",
    title: "The Cuckoo",
    titleZhTW: "布穀",
    composer: "Traditional (German)",
    grade: 0,
    group: "first-notes",
  },
  {
    id: "largo-new-world",
    title: "Largo (New World Symphony)",
    titleZhTW: "念故鄉",
    composer: "Antonín Dvořák",
    grade: 0,
    group: "first-notes",
  },
  {
    id: "buzz-buzz-buzz",
    title: "Buzz, Buzz, Buzz",
    titleZhTW: "蜜蜂嗡嗡嗡",
    composer: "Traditional (German)",
    grade: 0,
    group: "first-notes",
  },
  {
    id: "the-more-we-get-together",
    title: "The More We Get Together",
    titleZhTW: "當我們同在一起",
    composer: "Traditional",
    grade: 2,
    group: "right-hand-melodies",
  },
  {
    id: "oh-my-darling-clementine",
    title: "Oh My Darling, Clementine",
    titleZhTW: "新年好",
    composer: "Traditional",
    grade: 2,
    group: "right-hand-melodies",
  },
  {
    id: "alle-voegel-sind-schon-da",
    title: "Alle Vögel sind schon da",
    titleZhTW: "春神來了",
    composer: "Traditional (German)",
    grade: 2,
    group: "right-hand-melodies",
  },
  {
    id: "song-bie",
    title: "Farewell (Song Bie)",
    titleZhTW: "送別",
    composer: "John P. Ordway",
    grade: 2,
    group: "right-hand-melodies",
  },
  {
    id: "sakura",
    title: "Sakura Sakura",
    titleZhTW: "櫻花",
    composer: "Traditional (Japanese)",
    grade: 2,
    group: "right-hand-melodies",
  },
  {
    id: "frog-song",
    title: "Frog Song",
    titleZhTW: "青蛙合唱",
    composer: "Traditional (German)",
    grade: 2,
    group: "right-hand-melodies",
  },
  {
    id: "korobeiniki",
    title: "Korobeiniki",
    titleZhTW: "貨郎",
    composer: "Traditional (Russian)",
    grade: 2,
    group: "right-hand-melodies",
  },
  {
    id: "surprise-symphony",
    title: "Surprise Symphony (Theme)",
    titleZhTW: "驚愕交響曲",
    composer: "Joseph Haydn",
    grade: 2,
    group: "right-hand-melodies",
  },
  {
    id: "we-wish-you-a-merry-christmas",
    title: "We Wish You a Merry Christmas",
    titleZhTW: "祝你聖誕快樂",
    composer: "Traditional (English)",
    grade: 2,
    group: "right-hand-melodies",
  },
  {
    id: "good-king-wenceslas",
    title: "Good King Wenceslas",
    titleZhTW: "好國王溫徹斯拉",
    composer: "Traditional",
    grade: 2,
    group: "right-hand-melodies",
  },
  {
    id: "the-first-noel",
    title: "The First Noel",
    titleZhTW: "聖誕佳音",
    composer: "Traditional (English)",
    grade: 2,
    group: "right-hand-melodies",
  },
  {
    id: "auld-lang-syne",
    title: "Auld Lang Syne",
    titleZhTW: "驪歌",
    composer: "Traditional (Scottish)",
    grade: 3,
    group: "first-two-hand",
  },
  {
    id: "aura-lee",
    title: "Aura Lee",
    titleZhTW: "奧拉莉",
    composer: "George R. Poulton",
    grade: 3,
    group: "first-two-hand",
  },
  {
    id: "joy-to-the-world",
    title: "Joy to the World",
    titleZhTW: "普世歡騰",
    composer: "Lowell Mason",
    grade: 3,
    group: "first-two-hand",
  },
  {
    id: "jasmine-flower",
    title: "Jasmine Flower (Mo Li Hua)",
    titleZhTW: "茉莉花",
    composer: "Traditional (Chinese)",
    grade: 3,
    group: "first-two-hand",
  },
  {
    id: "arirang",
    title: "Arirang",
    titleZhTW: "阿里郎",
    composer: "Traditional (Korean)",
    grade: 3,
    group: "first-two-hand",
  },
  {
    id: "greensleeves",
    title: "Greensleeves",
    titleZhTW: "綠袖子",
    composer: "Traditional (English)",
    grade: 3,
    group: "rhythm-and-expression",
  },
];

type ExpectedKeySignature = {
  key: string;
  scale: "major" | "minor";
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const resourcesDir = join(__dirname, "..", "public", "midi");
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
        // A pickup bar comes first; the tagged meter starts after it (#333).
        const pickup = findPickup(
          midi.header.timeSignatures.map((ts) => ({
            ticks: ts.ticks,
            numerator: ts.timeSignature[0],
            denominator: ts.timeSignature[1],
          })),
          midi.header.ppq,
        );
        const headerTimeSignature = midi.header.timeSignatures.find(
          (ts) => ts.ticks === (pickup?.ticks ?? 0),
        );
        if (
          headerTimeSignature?.ticks !== (pickup?.ticks ?? 0) ||
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

  it("generates the beginner expansion with title, composer, and grade", () => {
    const { midiFiles, songsMeta } = buildGeneratedSongArtifacts([]);

    for (const { id, title, composer, grade } of BEGINNER_EXPANSION) {
      expect(songsMeta.find((song) => song.id === id)).toMatchObject({
        title,
        composer,
        grade,
      });
      expect(midiFiles.some((file) => file.id === id)).toBe(true);
    }
  });

  it("ships the beginner expansion in the lesson group it was written for", () => {
    const catalog = manifest as BuiltinSongMeta[];

    for (const expected of BEGINNER_EXPANSION) {
      const song = catalog.find((entry) => entry.id === expected.id);
      expect(song, expected.id).toMatchObject({
        title: expected.title,
        titleZhTW: expected.titleZhTW,
        composer: expected.composer,
        grade: expected.grade,
        difficulty: "beginner",
        origin: "score",
      });
      expect(song!.tags, expected.id).toContain(`level-${expected.grade}`);
      expect(classifySongLessonGroup(song!), expected.id).toBe(expected.group);
      expect(existsSync(join(resourcesDir, song!.file)), expected.id).toBe(
        true,
      );
    }
  });

  it("keeps first-notes songs in C position with whole, half and quarter notes", () => {
    const catalog = manifest as BuiltinSongMeta[];

    for (const expected of BEGINNER_EXPANSION) {
      if (expected.group !== "first-notes") continue;
      const song = catalog.find((entry) => entry.id === expected.id);
      expect(song, expected.id).toBeDefined();
      const midi = readMidi(song!);
      const notes = midi.tracks.flatMap((track) => track.notes);
      expect(
        midi.tracks.filter((track) => track.notes.length > 0),
      ).toHaveLength(1);
      for (const note of notes) {
        expect(note.midi, expected.id).toBeGreaterThanOrEqual(60);
        expect(note.midi, expected.id).toBeLessThanOrEqual(67);
        expect([1, 2, 3, 4], expected.id).toContain(
          note.durationTicks / midi.header.ppq,
        );
      }
    }
  });

  it("keeps beginner melodies on one hand and two-hand pieces on two", () => {
    const catalog = manifest as BuiltinSongMeta[];

    for (const expected of BEGINNER_EXPANSION) {
      const song = catalog.find((entry) => entry.id === expected.id);
      expect(song, expected.id).toBeDefined();
      // A melody note below middle C is written on the bass staff and would
      // turn a right-hand song into a two-hand one.
      const playedTracks = readMidi(song!).tracks.filter(
        (track) => track.notes.length > 0,
      );
      expect(playedTracks.length, expected.id).toBe(
        song!.tags.includes("two-hands") ? 2 : 1,
      );
    }
  });
});
