import type { AppUpdateStatus } from "@shared/types";
import type { TranslationKey } from "@renderer/i18n/types";

export type AppUpdateUiState =
  | AppUpdateStatus
  | { status: "idle" | "checking" };

export interface AppUpdateViewModel {
  headingKey: TranslationKey;
  busy: boolean;
  canCheck: boolean;
  canDownload: boolean;
  canOpenDownloaded: boolean;
  canOpenRelease: boolean;
  progressPercent: number | null;
}

export function createAppUpdateViewModel(
  status: AppUpdateUiState,
): AppUpdateViewModel {
  switch (status.status) {
    case "checking":
      return {
        headingKey: "about.updateChecking",
        busy: true,
        canCheck: false,
        canDownload: false,
        canOpenDownloaded: false,
        canOpenRelease: false,
        progressPercent: null,
      };
    case "disabled":
      return {
        headingKey: "about.updateDisabledDev",
        busy: false,
        canCheck: true,
        canDownload: false,
        canOpenDownloaded: false,
        canOpenRelease: false,
        progressPercent: null,
      };
    case "not-available":
      return {
        headingKey: "about.updateNotAvailable",
        busy: false,
        canCheck: true,
        canDownload: false,
        canOpenDownloaded: false,
        canOpenRelease: true,
        progressPercent: null,
      };
    case "available":
      return {
        headingKey: "about.updateAvailable",
        busy: false,
        canCheck: true,
        canDownload: true,
        canOpenDownloaded: false,
        canOpenRelease: true,
        progressPercent: null,
      };
    case "downloading":
      return {
        headingKey: "about.updateDownloading",
        busy: true,
        canCheck: false,
        canDownload: false,
        canOpenDownloaded: false,
        canOpenRelease: false,
        progressPercent: status.progress.percent,
      };
    case "ready":
      return {
        headingKey: "about.updateReady",
        busy: false,
        canCheck: true,
        canDownload: false,
        canOpenDownloaded: true,
        canOpenRelease: true,
        progressPercent: status.progress.percent,
      };
    case "failed":
      return {
        headingKey: "about.updateFailed",
        busy: false,
        canCheck: true,
        canDownload: false,
        canOpenDownloaded: false,
        canOpenRelease: false,
        progressPercent: null,
      };
    case "idle":
      return {
        headingKey: "about.updateIdle",
        busy: false,
        canCheck: true,
        canDownload: false,
        canOpenDownloaded: false,
        canOpenRelease: false,
        progressPercent: null,
      };
  }
}
