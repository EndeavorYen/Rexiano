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
  | "retry-read"
  | "open-file-permissions";

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

export interface FileImportRecoveryPlan extends FileImportErrorGuidance {
  primaryActionId: FileImportRecoveryActionId;
  secondaryActionIds: FileImportRecoveryActionId[];
  canRetry: boolean;
  canRemoveStaleReference: boolean;
  requiresPermissionHelp: boolean;
}

function diagnosticToString(error: FileImportErrorInput): string {
  if (error.diagnostic instanceof Error) return error.diagnostic.message;
  if (typeof error.diagnostic === "string") return error.diagnostic;
  return error.path ?? error.fileName ?? "";
}

function isPermissionDeniedRead(error: FileImportErrorInput): boolean {
  const diagnostic = diagnosticToString(error).toLowerCase();
  return (
    diagnostic.includes("eacces") ||
    diagnostic.includes("eperm") ||
    diagnostic.includes("permission denied") ||
    diagnostic.includes("operation not permitted")
  );
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
    case "read-failed": {
      const actions: FileImportRecoveryAction[] = [
        {
          id: "retry-read",
          label: t("app.importActionRetry"),
          emphasis: "primary",
        },
      ];
      if (isPermissionDeniedRead(error)) {
        actions.push({
          id: "open-file-permissions",
          label: t("app.importActionOpenPermissions"),
          emphasis: "secondary",
        });
      }
      actions.push({
        id: "reimport-file",
        label: t("app.importActionReimport"),
        emphasis: "secondary",
      });

      return {
        title: t("app.importErrorReadTitle"),
        guidance: t("app.importErrorReadGuidance", {
          fileName: error.fileName ?? t("app.importErrorUnknownFile"),
        }),
        diagnostic: diagnosticToString(error),
        actions,
      };
    }
  }
}

export function buildFileImportRecoveryPlan(
  error: FileImportErrorInput,
  t: Translate,
): FileImportRecoveryPlan {
  const guidance = getFileImportErrorGuidance(error, t);
  const primaryAction =
    guidance.actions.find((action) => action.emphasis === "primary") ??
    guidance.actions[0];
  const actionIds = guidance.actions.map((action) => action.id);

  return {
    ...guidance,
    primaryActionId: primaryAction.id,
    secondaryActionIds: guidance.actions
      .filter((action) => action.id !== primaryAction.id)
      .map((action) => action.id),
    canRetry: actionIds.includes("retry-read"),
    canRemoveStaleReference: actionIds.includes("remove-recent"),
    requiresPermissionHelp: actionIds.includes("open-file-permissions"),
  };
}
