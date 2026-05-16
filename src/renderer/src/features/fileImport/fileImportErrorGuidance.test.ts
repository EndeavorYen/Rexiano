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
    });
  });

  test("maps missing recent files to re-import guidance", () => {
    expect(
      getFileImportErrorGuidance(
        { kind: "missing-recent", fileName: "old-song.mid", path: "/old.mid" },
        t,
      ),
    ).toEqual({
      title: "app.importErrorMissingTitle",
      guidance: "app.importErrorMissingGuidance:fileName=old-song.mid",
      diagnostic: "/old.mid",
    });
  });
});
