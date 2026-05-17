import type { RecentFile } from "@shared/types";
import type { InterpolationParams, TranslationKey } from "@renderer/i18n/types";
import {
  getFileImportErrorGuidance,
  type FileImportErrorGuidance,
} from "@renderer/features/fileImport/fileImportErrorGuidance";

type Translate = (key: TranslationKey, params?: InterpolationParams) => string;

export type RecentFileFailure =
  | { kind: "missing" }
  | { kind: "read-failed"; diagnostic?: unknown }
  | { kind: "parse-failed"; diagnostic?: unknown };

export interface RecentFileRecovery {
  guidance: FileImportErrorGuidance;
  canRemove: boolean;
  removePath: string;
  actionLabel: string;
}

export function getRecentFileRecovery(
  file: RecentFile,
  failure: RecentFileFailure,
  t: Translate,
): RecentFileRecovery {
  const guidance = getFileImportErrorGuidance(
    failure.kind === "missing"
      ? {
          kind: "missing-recent",
          fileName: file.name,
          path: file.path,
        }
      : {
          kind: failure.kind,
          fileName: file.name,
          path: file.path,
          diagnostic: failure.diagnostic,
        },
    t,
  );

  return {
    guidance,
    canRemove: failure.kind !== "parse-failed",
    removePath: file.path,
    actionLabel: t("library.removeRecent"),
  };
}
