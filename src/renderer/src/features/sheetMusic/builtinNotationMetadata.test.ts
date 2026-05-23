import { describe, expect, it } from "vitest";
import type { BuiltinSongMeta } from "@shared/types";
import {
  parseBuiltinNotationMetadata,
  resolveBuiltinNotationMetadata,
} from "./builtinNotationMetadata";

function builtinSong(
  overrides: Partial<BuiltinSongMeta> = {},
): BuiltinSongMeta {
  return {
    id: "amazing-grace",
    file: "amazing-grace.mid",
    title: "Amazing Grace",
    composer: "Traditional",
    difficulty: "intermediate",
    category: "popular",
    durationSeconds: 60,
    tags: ["traditional", "3-4", "g-major", "level-4"],
    ...overrides,
  };
}

describe("builtin notation metadata", () => {
  it("maps meter and major key tags into notation options", () => {
    expect(
      parseBuiltinNotationMetadata(["traditional", "3-4", "g-major"]),
    ).toEqual({
      timeSignatureTop: 3,
      timeSignatureBottom: 4,
      keySignature: 1,
    });

    expect(parseBuiltinNotationMetadata(["d-major", "3-4"])).toMatchObject({
      timeSignatureTop: 3,
      timeSignatureBottom: 4,
      keySignature: 2,
    });
  });

  it("maps minor key tags by relative key signature", () => {
    expect(parseBuiltinNotationMetadata(["a-minor", "3-4"])).toMatchObject({
      keySignature: 0,
    });
  });

  it("resolves metadata by built-in title or file name", () => {
    const songs = [
      builtinSong(),
      builtinSong({
        id: "german-dance",
        file: "german-dance.mid",
        title: "German Dance (WoO 8 No. 1)",
        tags: ["classical", "dance", "d-major", "3-4", "level-6"],
      }),
    ];

    expect(resolveBuiltinNotationMetadata("Amazing Grace", songs)).toEqual({
      timeSignatureTop: 3,
      timeSignatureBottom: 4,
      keySignature: 1,
    });
    expect(resolveBuiltinNotationMetadata("german-dance.mid", songs)).toEqual({
      timeSignatureTop: 3,
      timeSignatureBottom: 4,
      keySignature: 2,
    });
  });

  it("returns null when no built-in song metadata matches", () => {
    expect(resolveBuiltinNotationMetadata("custom-song.mid", [])).toBeNull();
  });
});
