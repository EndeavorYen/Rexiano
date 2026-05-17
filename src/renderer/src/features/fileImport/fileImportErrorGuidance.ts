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

export type FileImportRecoveryActionId =
  | "choose-midi-file"
  | "reimport-file"
  | "remove-recent"
  | "retry-read";

export interface FileImportRecoveryAction {
  id: FileImportRecoveryActionId;
  label: string;
  emphasis: "primary" | "secondary";
}

export interface FileImportErrorGuidance {
  title: string;
  guidance: string;
  diagnostic: string;
  actions: FileImportRecoveryAction[];
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
        actions: [
          {
            id: "choose-midi-file",
            label: t("app.importActionChooseMidi"),
            emphasis: "primary",
          },
        ],
      };
    case "parse-failed":
      return {
        title: t("app.importErrorParseTitle"),
        guidance: t("app.importErrorParseGuidance", {
          fileName: error.fileName ?? t("app.importErrorUnknownFile"),
        }),
        diagnostic: diagnosticToString(error),
        actions: [
          {
            id: "reimport-file",
            label: t("app.importActionReimport"),
            emphasis: "primary",
          },
        ],
      };
    case "missing-recent":
      return {
        title: t("app.importErrorMissingTitle"),
        guidance: t("app.importErrorMissingGuidance", {
          fileName: error.fileName ?? t("app.importErrorUnknownFile"),
        }),
        diagnostic: diagnosticToString(error),
        actions: [
          {
            id: "reimport-file",
            label: t("app.importActionReimport"),
            emphasis: "primary",
          },
          {
            id: "remove-recent",
            label: t("library.removeRecent"),
            emphasis: "secondary",
          },
        ],
      };
    case "read-failed":
      return {
        title: t("app.importErrorReadTitle"),
        guidance: t("app.importErrorReadGuidance", {
          fileName: error.fileName ?? t("app.importErrorUnknownFile"),
        }),
        diagnostic: diagnosticToString(error),
        actions: [
          {
            id: "retry-read",
            label: t("app.importActionRetry"),
            emphasis: "primary",
          },
          {
            id: "reimport-file",
            label: t("app.importActionReimport"),
            emphasis: "secondary",
          },
        ],
      };
  }
}
