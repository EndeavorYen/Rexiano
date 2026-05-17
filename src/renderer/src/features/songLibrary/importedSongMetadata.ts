export type ImportedSongCategory =
  | "exercise"
  | "classical"
  | "popular"
  | "holiday";

const importedSongCategories = [
  "exercise",
  "classical",
  "popular",
  "holiday",
] as const satisfies readonly ImportedSongCategory[];

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

export type ImportedSongSidecarValidationResult =
  | {
      ok: true;
      patch: ImportedSongMetadataPatch;
      warnings: string[];
    }
  | {
      ok: false;
      errors: string[];
      warnings: string[];
    };

export function normalizeImportedSongPath(sourcePath: string): string {
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isImportedSongGrade(
  value: unknown,
): value is NonNullable<ImportedSongRecord["grade"]> {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 8;
}

function isImportedSongCategory(value: unknown): value is ImportedSongCategory {
  return (
    typeof value === "string" &&
    importedSongCategories.includes(value as ImportedSongCategory)
  );
}

export function validateImportedSongSidecarMetadata(
  input: unknown,
): ImportedSongSidecarValidationResult {
  if (!isRecord(input)) {
    return {
      ok: false,
      errors: ["Sidecar metadata must be an object."],
      warnings: [],
    };
  }

  const patch: ImportedSongMetadataPatch = {};
  const errors: string[] = [];
  const warnings: string[] = [];
  const supportedFields = new Set([
    "title",
    "composer",
    "tags",
    "grade",
    "category",
  ]);

  for (const field of ["title", "composer"] as const) {
    if (!(field in input)) continue;

    const value = input[field];
    if (typeof value !== "string") {
      warnings.push(`Ignored invalid sidecar ${field}.`);
      continue;
    }

    const trimmed = value.trim();
    if (!trimmed) {
      warnings.push(`Ignored blank sidecar ${field}.`);
      continue;
    }

    patch[field] = trimmed;
  }

  if ("tags" in input) {
    const value = input.tags;
    if (Array.isArray(value)) {
      const tags: string[] = [];
      value.forEach((tag, index) => {
        if (typeof tag !== "string") {
          warnings.push(`Ignored invalid sidecar tag at index ${index}.`);
          return;
        }
        tags.push(tag);
      });
      patch.tags = cleanTags(tags);
    } else {
      warnings.push("Ignored invalid sidecar tags.");
    }
  }

  if ("grade" in input) {
    if (isImportedSongGrade(input.grade)) {
      patch.grade = input.grade;
    } else {
      errors.push("Sidecar grade must be an integer from L0 to L8.");
    }
  }

  if ("category" in input) {
    if (isImportedSongCategory(input.category)) {
      patch.category = input.category;
    } else if (typeof input.category === "string") {
      errors.push(`Sidecar category is not supported: ${input.category}.`);
    } else {
      errors.push(
        `Sidecar category must be one of ${importedSongCategories.join(", ")}.`,
      );
    }
  }

  const unsupportedFields = Object.keys(input)
    .filter((field) => !supportedFields.has(field))
    .sort();
  if (unsupportedFields.length > 0) {
    warnings.push(
      `Ignored unsupported sidecar fields: ${unsupportedFields.join(", ")}.`,
    );
  }

  if (errors.length > 0) {
    return { ok: false, errors, warnings };
  }

  return { ok: true, patch, warnings };
}

export function createImportedSongId(sourcePath: string): string {
  return `user:${stableHash(normalizeImportedSongPath(sourcePath))}`;
}

function deriveTitleFromSourcePath(sourcePath: string): string {
  const fileName = sourcePath.split("/").pop()?.trim() ?? "";
  const title = fileName.replace(/\.(midi?|kar)$/i, "").trim();
  return title || "Untitled MIDI";
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

export function buildImportedSongRecordsFromDiscoveredPaths(
  sourcePaths: string[],
  existingRecords: ImportedSongRecord[] = [],
): ImportedSongRecord[] {
  const existingById = new Map(
    existingRecords.map((record) => [record.id, record]),
  );
  const existingByPath = new Map(
    existingRecords.map((record) => [
      normalizeImportedSongPath(record.sourcePath),
      record,
    ]),
  );
  const seen = new Set<string>();
  const records: ImportedSongRecord[] = [];

  for (const sourcePath of sourcePaths) {
    const normalizedPath = normalizeImportedSongPath(sourcePath);
    if (!normalizedPath || seen.has(normalizedPath)) continue;
    seen.add(normalizedPath);

    const id = createImportedSongId(normalizedPath);
    const existing = existingById.get(id) ?? existingByPath.get(normalizedPath);

    records.push(
      existing
        ? {
            ...existing,
            id,
            sourcePath: normalizedPath,
            missing: false,
          }
        : {
            id,
            sourcePath: normalizedPath,
            title: deriveTitleFromSourcePath(normalizedPath),
            tags: [],
            missing: false,
          },
    );
  }

  return records;
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

export function reconcileImportedSongAvailability(
  records: ImportedSongRecord[],
  availableSourcePaths: string[],
): ImportedSongRecord[] {
  const availablePaths = new Set(
    availableSourcePaths.map(normalizeImportedSongPath),
  );

  return records.map((record) => ({
    ...record,
    missing: !availablePaths.has(normalizeImportedSongPath(record.sourcePath)),
  }));
}
