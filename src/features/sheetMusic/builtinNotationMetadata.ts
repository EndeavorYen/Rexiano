import type { BuiltinSongMeta } from "@shared/types";

export interface BuiltinNotationMetadata {
  timeSignatureTop?: number;
  timeSignatureBottom?: number;
  keySignature?: number;
}

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

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function parseTimeSignatureTag(
  tag: string,
): Pick<
  BuiltinNotationMetadata,
  "timeSignatureTop" | "timeSignatureBottom"
> | null {
  const match = /^(\d+)-(\d+)$/.exec(tag);
  if (!match) return null;

  const top = Number(match[1]);
  const bottom = Number(match[2]);
  if (!Number.isInteger(top) || !Number.isInteger(bottom)) return null;
  if (top <= 0 || bottom <= 0) return null;

  return {
    timeSignatureTop: top,
    timeSignatureBottom: bottom,
  };
}

export function parseBuiltinNotationMetadata(
  tags: readonly string[],
): BuiltinNotationMetadata {
  const metadata: BuiltinNotationMetadata = {};

  for (const rawTag of tags) {
    const tag = normalize(rawTag);
    const timeSignature = parseTimeSignatureTag(tag);
    if (timeSignature) {
      metadata.timeSignatureTop ??= timeSignature.timeSignatureTop;
      metadata.timeSignatureBottom ??= timeSignature.timeSignatureBottom;
      continue;
    }

    const keySignature = KEY_SIGNATURE_BY_TAG.get(tag);
    if (keySignature !== undefined && metadata.keySignature === undefined) {
      metadata.keySignature = keySignature;
    }
  }

  return metadata;
}

export function resolveBuiltinNotationMetadata(
  songFileName: string,
  builtInSongs: readonly BuiltinSongMeta[],
): BuiltinNotationMetadata | null {
  const candidate = normalize(songFileName);
  if (!candidate) return null;

  const match = builtInSongs.find((song) =>
    [song.id, song.file, song.title].some(
      (value) => normalize(value) === candidate,
    ),
  );
  if (!match) return null;

  return parseBuiltinNotationMetadata(match.tags);
}
