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

    expect(parseBuiltinNotationMetadata(["exercise", "4-4"])).toMatchObject({
      timeSignatureTop: 4,
      timeSignatureBottom: 4,
    });
  });

  it("maps minor key tags by relative key signature", () => {
    expect(parseBuiltinNotationMetadata(["a-minor", "3-4"])).toMatchObject({
      keySignature: 0,
    });

    expect(parseBuiltinNotationMetadata(["c#-minor", "2-2"])).toMatchObject({
      timeSignatureTop: 2,
      timeSignatureBottom: 2,
      keySignature: 4,
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

  it("resolves verified built-in repertoire metadata tags", () => {
    const songs = [
      builtinSong({
        id: "minuet-in-g",
        file: "minuet-in-g.mid",
        title: "Minuet in G Major",
        tags: ["classical", "baroque", "g-major", "3-4", "level-5"],
      }),
      builtinSong({
        id: "canon-in-d",
        file: "canon-in-d.mid",
        title: "Canon in D",
        tags: ["classical", "baroque", "d-major", "4-4", "level-5"],
      }),
      builtinSong({
        id: "fur-elise",
        file: "fur-elise.mid",
        title: "Fur Elise",
        tags: ["classical", "romantic", "a-minor", "3-8", "level-5"],
      }),
      builtinSong({
        id: "moonlight-sonata",
        file: "moonlight-sonata.mid",
        title: "Moonlight Sonata (1st mvt)",
        tags: ["classical", "romantic", "c#-minor", "2-2", "level-7"],
      }),
    ];

    expect(resolveBuiltinNotationMetadata("minuet-in-g.mid", songs)).toEqual({
      timeSignatureTop: 3,
      timeSignatureBottom: 4,
      keySignature: 1,
    });
    expect(resolveBuiltinNotationMetadata("canon-in-d.mid", songs)).toEqual({
      timeSignatureTop: 4,
      timeSignatureBottom: 4,
      keySignature: 2,
    });
    expect(resolveBuiltinNotationMetadata("fur-elise.mid", songs)).toEqual({
      timeSignatureTop: 3,
      timeSignatureBottom: 8,
      keySignature: 0,
    });
    expect(
      resolveBuiltinNotationMetadata("moonlight-sonata.mid", songs),
    ).toEqual({
      timeSignatureTop: 2,
      timeSignatureBottom: 2,
      keySignature: 4,
    });
  });

  it("returns null when no built-in song metadata matches", () => {
    expect(resolveBuiltinNotationMetadata("custom-song.mid", [])).toBeNull();
  });
});
