import { describe, expect, test } from "vitest";
import type { RecentFile } from "@shared/types";
import type { InterpolationParams, TranslationKey } from "@renderer/i18n/types";
import { getRecentFileRecovery } from "./recentFileRecovery";

const t = (key: TranslationKey, params?: InterpolationParams): string => {
  const suffix = params
    ? `:${Object.entries(params)
        .map(([k, v]) => `${k}=${v}`)
        .join(",")}`
    : "";
  return `${key}${suffix}`;
};

const recentFile: RecentFile = {
  path: "/missing/lesson.mid",
  name: "lesson.mid",
  timestamp: 1234,
};

describe("getRecentFileRecovery", () => {
  test("offers removal for missing recent file paths", () => {
    expect(getRecentFileRecovery(recentFile, { kind: "missing" }, t)).toEqual({
      guidance: {
        title: "app.importErrorMissingTitle",
        guidance: "app.importErrorMissingGuidance:fileName=lesson.mid",
        diagnostic: "/missing/lesson.mid",
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
      },
      canRemove: true,
      removePath: "/missing/lesson.mid",
      actionLabel: "library.removeRecent",
    });
  });

  test("keeps parse failures actionable without treating the path as stale", () => {
    expect(
      getRecentFileRecovery(
        recentFile,
        { kind: "parse-failed", diagnostic: new Error("bad MIDI") },
        t,
      ),
    ).toMatchObject({
      guidance: {
        title: "app.importErrorParseTitle",
        guidance: "app.importErrorParseGuidance:fileName=lesson.mid",
        diagnostic: "bad MIDI",
      },
      canRemove: false,
      removePath: "/missing/lesson.mid",
    });
  });
});
