import { describe, expect, test } from "vitest";
import type { BuiltinSongMeta } from "@shared/types";
import { diagnoseBuiltinSongMetadata } from "./builtinSongMetadataDiagnostics";

function makeSong(
  id: string,
  overrides: Partial<BuiltinSongMeta> = {},
): BuiltinSongMeta {
  return {
    id,
    file: `${id}.mid`,
    title: id,
    composer: "Traditional",
    difficulty: "beginner",
    category: "popular",
    durationSeconds: 60,
    tags: ["melody", "level-2"],
    grade: 2,
    ...overrides,
  };
}

describe("diagnoseBuiltinSongMetadata", () => {
  test("returns no diagnostics for graded songs with matching level tags", () => {
    expect(
      diagnoseBuiltinSongMetadata(
        makeSong("london", {
          grade: 2,
          tags: ["melody", "Level-2"],
        }),
      ),
    ).toEqual([]);
  });

  test("warns when a built-in song is missing grade metadata", () => {
    expect(
      diagnoseBuiltinSongMetadata(
        makeSong("ungraded", {
          grade: undefined,
          tags: ["melody"],
        }),
      ),
    ).toEqual([
      {
        code: "missing-grade",
        severity: "warning",
        blocking: false,
        message:
          "Add a grade from L0 to L8 so learners and filters can place this song.",
      },
    ]);
  });

  test("warns when the level tag does not match the grade", () => {
    expect(
      diagnoseBuiltinSongMetadata(
        makeSong("mismatch", {
          grade: 4,
          tags: ["melody", "level-3"],
        }),
      ),
    ).toEqual([
      {
        code: "missing-level-tag",
        severity: "warning",
        blocking: false,
        message: "Add tag level-4 to mirror the song grade metadata.",
      },
    ]);
  });
});
