export type ImportedSongCategory =
  | "exercise"
  | "classical"
  | "popular"
  | "holiday";

export interface ImportedSongRecord {
  id: string;
  sourcePath: string;
  title: string;
  composer?: string;
  tags: string[];
  grade?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  category?: ImportedSongCategory;
  missing: boolean;
}

export type ImportedSongMetadataPatch = Partial<
  Pick<
    ImportedSongRecord,
    "title" | "composer" | "tags" | "grade" | "category" | "missing"
  >
>;

function normalizePath(sourcePath: string): string {
  return sourcePath.trim().replaceAll("\\", "/");
}

function normalizeSearch(value: string): string {
  return value.trim().toLowerCase();
}

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function cleanText(
  value: string | undefined,
  fallback: string | undefined,
): string | undefined {
  const cleaned = value?.trim();
  return cleaned ? cleaned : fallback;
}

function cleanTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const cleaned: string[] = [];

  for (const tag of tags) {
    const trimmed = tag.trim();
    if (!trimmed) continue;

    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    cleaned.push(trimmed);
  }

  return cleaned;
}

export function createImportedSongId(sourcePath: string): string {
  return `user:${stableHash(normalizePath(sourcePath))}`;
}

export function mergeImportedSongMetadata(
  record: ImportedSongRecord,
  patch: ImportedSongMetadataPatch,
): ImportedSongRecord {
  return {
    ...record,
    title: cleanText(patch.title, record.title) ?? record.title,
    composer: cleanText(patch.composer, record.composer),
    tags: patch.tags ? cleanTags(patch.tags) : record.tags,
    grade: patch.grade ?? record.grade,
    category: patch.category ?? record.category,
    missing: patch.missing ?? record.missing,
  };
}

export function importedSongMatchesQuery(
  song: ImportedSongRecord,
  query: string,
): boolean {
  const normalizedQuery = normalizeSearch(query);
  if (!normalizedQuery) return true;

  const searchable = [
    song.title,
    song.composer ?? "",
    song.category ?? "",
    song.grade !== undefined ? `l${song.grade}` : "",
    song.sourcePath,
    ...song.tags,
  ]
    .map(normalizeSearch)
    .join(" ");

  return searchable.includes(normalizedQuery);
}
