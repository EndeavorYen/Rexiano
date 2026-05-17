import { describe, expect, test } from "vitest";
import type { InterpolationParams, TranslationKey } from "@renderer/i18n/types";
import { getFileImportErrorGuidance } from "./fileImportErrorGuidance";

const t = (key: TranslationKey, params?: InterpolationParams): string => {
  const suffix = params
    ? `:${Object.entries(params)
        .map(([k, v]) => `${k}=${v}`)
        .join(",")}`
    : "";
  return `${key}${suffix}`;
};

describe("getFileImportErrorGuidance", () => {
  test("maps unsupported file extensions to localized actionable guidance", () => {
    expect(
      getFileImportErrorGuidance(
        { kind: "unsupported-type", ext: ".pdf", fileName: "score.pdf" },
        t,
      ),
    ).toEqual({
      title: "app.importErrorUnsupportedTitle",
      guidance: "app.importErrorUnsupportedGuidance:ext=.pdf",
      diagnostic: "score.pdf",
      actions: [
        {
          id: "choose-midi-file",
          label: "app.importActionChooseMidi",
          emphasis: "primary",
        },
      ],
    });
  });

  test("maps parse failures while preserving diagnostic details", () => {
    expect(
      getFileImportErrorGuidance(
        {
          kind: "parse-failed",
          fileName: "lesson.mid",
          diagnostic: new Error("Track chunk is malformed"),
        },
        t,
      ),
    ).toEqual({
      title: "app.importErrorParseTitle",
      guidance: "app.importErrorParseGuidance:fileName=lesson.mid",
      diagnostic: "Track chunk is malformed",
      actions: [
        {
          id: "reimport-file",
          label: "app.importActionReimport",
          emphasis: "primary",
        },
      ],
    });
  });

  test("maps missing recent files to re-import and remove actions", () => {
    expect(
      getFileImportErrorGuidance(
        { kind: "missing-recent", fileName: "old-song.mid", path: "/old.mid" },
        t,
      ),
    ).toEqual({
      title: "app.importErrorMissingTitle",
      guidance: "app.importErrorMissingGuidance:fileName=old-song.mid",
      diagnostic: "/old.mid",
      actions: [
        {
          id: "reimport-file",
          label: "app.importActionReimport",
          emphasis: "primary",
        },
        {
          id: "remove-recent",
          label: "library.removeRecent",
          emphasis: "secondary",
        },
      ],
    });
  });

  test("maps read failures to retry and re-import actions", () => {
    expect(
      getFileImportErrorGuidance(
        { kind: "read-failed", fileName: "locked.mid", path: "/locked.mid" },
        t,
      ),
    ).toEqual({
      title: "app.importErrorReadTitle",
      guidance: "app.importErrorReadGuidance:fileName=locked.mid",
      diagnostic: "/locked.mid",
      actions: [
        {
          id: "retry-read",
          label: "app.importActionRetry",
          emphasis: "primary",
        },
        {
          id: "reimport-file",
          label: "app.importActionReimport",
          emphasis: "secondary",
        },
      ],
    });
  });

  test("adds a file-permission action for permission-denied read failures", () => {
    expect(
      getFileImportErrorGuidance(
        {
          kind: "read-failed",
          fileName: "locked.mid",
          path: "/locked.mid",
          diagnostic: new Error("EACCES: permission denied, open locked.mid"),
        },
        t,
      ).actions,
    ).toEqual([
      {
        id: "retry-read",
        label: "app.importActionRetry",
        emphasis: "primary",
      },
      {
        id: "open-file-permissions",
        label: "app.importActionOpenPermissions",
        emphasis: "secondary",
      },
      {
        id: "reimport-file",
        label: "app.importActionReimport",
        emphasis: "secondary",
      },
    ]);
  });
});
