import type { BuiltinSongMeta } from "@shared/types";

export type BuiltinSongMetadataDiagnosticCode =
  | "missing-grade"
  | "missing-level-tag";

export interface BuiltinSongMetadataDiagnostic {
  code: BuiltinSongMetadataDiagnosticCode;
  severity: "warning";
  blocking: false;
  message: string;
}

function hasLevelTag(song: BuiltinSongMeta): boolean {
  const expectedTag = `level-${song.grade}`;

  return song.tags.some((tag) => tag.trim().toLowerCase() === expectedTag);
}

export function diagnoseBuiltinSongMetadata(
  song: BuiltinSongMeta,
): BuiltinSongMetadataDiagnostic[] {
  if (song.grade === undefined) {
    return [
      {
        code: "missing-grade",
        severity: "warning",
        blocking: false,
        message:
          "Add a grade from L0 to L8 so learners and filters can place this song.",
      },
    ];
  }

  if (!hasLevelTag(song)) {
    return [
      {
        code: "missing-level-tag",
        severity: "warning",
        blocking: false,
        message: `Add tag level-${song.grade} to mirror the song grade metadata.`,
      },
    ];
  }

  return [];
}
