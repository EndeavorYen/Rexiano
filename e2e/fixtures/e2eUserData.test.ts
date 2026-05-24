import { describe, expect, test } from "vitest";
import { createE2eUserDataPath } from "./e2eUserData";

describe("e2eUserData", () => {
  test("creates stable isolated paths per worker and test id", () => {
    expect(
      createE2eUserDataPath({
        outputDir: "/repo/test-results",
        projectName: "chromium",
        workerIndex: 2,
        testId: "song-library shows continue practice",
      }),
    ).toBe(
      "/repo/test-results/electron-user-data/chromium/worker-2/song-library-shows-continue-practice",
    );
  });

  test("sanitizes names that are unsafe for filesystem paths", () => {
    expect(
      createE2eUserDataPath({
        outputDir: "/repo/test-results",
        projectName: "Electron / Windows",
        workerIndex: 0,
        testId: "loads: Hot Cross Buns?",
      }),
    ).toBe(
      "/repo/test-results/electron-user-data/electron-windows/worker-0/loads-hot-cross-buns",
    );
  });
});
