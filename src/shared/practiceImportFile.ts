export const PRACTICE_IMPORT_EXTENSIONS = [
  ".mid",
  ".midi",
  ".kar",
  ".musicxml",
  ".xml",
] as const;

export type PracticeImportExtension =
  (typeof PRACTICE_IMPORT_EXTENSIONS)[number];

export function getPracticeImportExtension(fileName: string): string {
  const start = fileName.lastIndexOf(".");
  return start === -1 ? "" : fileName.slice(start).toLowerCase();
}

export function isPracticeImportPath(candidate: string): boolean {
  return PRACTICE_IMPORT_EXTENSIONS.includes(
    getPracticeImportExtension(candidate) as PracticeImportExtension,
  );
}

export function isScoreImportPath(candidate: string): boolean {
  const ext = getPracticeImportExtension(candidate);
  return ext === ".musicxml" || ext === ".xml";
}
