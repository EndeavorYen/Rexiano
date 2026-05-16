import type { TranslationKey, InterpolationParams } from "@renderer/i18n/types";

type Translate = (key: TranslationKey, params?: InterpolationParams) => string;

export type FileImportErrorKind =
  | "unsupported-type"
  | "read-failed"
  | "parse-failed"
  | "missing-recent";

export interface FileImportErrorInput {
  kind: FileImportErrorKind;
  ext?: string;
  fileName?: string;
  path?: string;
  diagnostic?: unknown;
}

export interface FileImportErrorGuidance {
  title: string;
  guidance: string;
  diagnostic: string;
}

function diagnosticToString(error: FileImportErrorInput): string {
  if (error.diagnostic instanceof Error) return error.diagnostic.message;
  if (typeof error.diagnostic === "string") return error.diagnostic;
  return error.path ?? error.fileName ?? "";
}

export function getFileImportErrorGuidance(
  error: FileImportErrorInput,
  t: Translate,
): FileImportErrorGuidance {
  switch (error.kind) {
    case "unsupported-type":
      return {
        title: t("app.importErrorUnsupportedTitle"),
        guidance: t("app.importErrorUnsupportedGuidance", {
          ext: error.ext ?? "",
        }),
        diagnostic: diagnosticToString(error),
      };
    case "parse-failed":
      return {
        title: t("app.importErrorParseTitle"),
        guidance: t("app.importErrorParseGuidance", {
          fileName: error.fileName ?? t("app.importErrorUnknownFile"),
        }),
        diagnostic: diagnosticToString(error),
      };
    case "missing-recent":
      return {
        title: t("app.importErrorMissingTitle"),
        guidance: t("app.importErrorMissingGuidance", {
          fileName: error.fileName ?? t("app.importErrorUnknownFile"),
        }),
        diagnostic: diagnosticToString(error),
      };
    case "read-failed":
      return {
        title: t("app.importErrorReadTitle"),
        guidance: t("app.importErrorReadGuidance", {
          fileName: error.fileName ?? t("app.importErrorUnknownFile"),
        }),
        diagnostic: diagnosticToString(error),
      };
  }
}
