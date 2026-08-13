import { test, expect } from "./fixtures/electronApp";
import { _electron as electron } from "playwright";
import { access, readFile, writeFile } from "fs/promises";
import { join } from "path";

test.describe("Settings user data backup", () => {
  test("advanced settings exposes explicit backup, import, and reset actions", async ({
    appPage,
  }) => {
    await appPage
      .getByRole("button", { name: /^Settings$/ })
      .first()
      .click();
    await appPage.getByTestId("settings-mode-toggle").click();
    await appPage.getByTestId("settings-tab-backup").click();

    await expect(appPage.getByTestId("user-data-export")).toBeVisible();
    await expect(appPage.getByTestId("user-data-import")).toBeVisible();
    await expect(appPage.getByTestId("user-data-reset-settings")).toBeVisible();
    await expect(appPage.getByTestId("user-data-reset-progress")).toBeVisible();
    await expect(appPage.getByTestId("user-data-reset-recents")).toBeVisible();
    await expect(appPage.getByTestId("user-data-reset")).toBeVisible();
  });

  test("restart rolls an interrupted file and renderer transaction back", async ({
    electronApp,
    appPage,
  }) => {
    const userDataPath = await electronApp.evaluate(({ app }) =>
      app.getPath("userData"),
    );
    const progressPath = join(userDataPath, "progress.json");
    const journalPath = join(userDataPath, "user-data-transaction.json");
    const oldProgress = '[\n  {"id":"old-bytes"}\n]\n';
    const oldSettings = JSON.stringify({ language: "en", volume: 72 });
    await writeFile(progressPath, oldProgress, "utf-8");
    await appPage.evaluate((settings) => {
      localStorage.setItem("rexiano-settings", settings);
    }, oldSettings);

    const begun = await appPage.evaluate(
      async ({ settingsSnapshot }) =>
        window.api.importUserDataFiles(
          {
            progress: [
              {
                id: "new-session",
                songId: "song",
                songTitle: "Song",
                timestamp: 1,
                mode: "wait",
                speed: 1,
                score: {
                  totalNotes: 1,
                  hitNotes: 1,
                  missedNotes: 0,
                  accuracy: 100,
                  currentStreak: 1,
                  bestStreak: 1,
                },
                durationSeconds: 1,
                tracksPlayed: [0],
              },
            ],
          },
          ["progress"],
          { "rexiano-settings": settingsSnapshot },
        ),
      { settingsSnapshot: oldSettings },
    );
    expect(begun.ok).toBe(true);
    expect(await readFile(progressPath, "utf-8")).toContain("new-session");

    await electronApp.close();
    const electronBinary = (await import("electron")).default as string;
    const launchEnv: NodeJS.ProcessEnv = {
      ...process.env,
      REXIANO_E2E: "1",
      REXIANO_USER_DATA_DIR: userDataPath,
      TZ: "UTC",
    };
    delete launchEnv.ELECTRON_RUN_AS_NODE;
    const relaunched = await electron.launch({
      executablePath: electronBinary,
      cwd: process.cwd(),
      args: ["."],
      env: launchEnv,
    });

    try {
      const relaunchedPage = await relaunched.firstWindow();
      await relaunchedPage.waitForLoadState("domcontentloaded");
      await expect(relaunchedPage.locator("#root")).not.toBeEmpty();
      expect(await readFile(progressPath, "utf-8")).toBe(oldProgress);
      expect(
        await relaunchedPage.evaluate(() =>
          localStorage.getItem("rexiano-settings"),
        ),
      ).toBe(oldSettings);
      await expect(access(journalPath)).rejects.toThrow();
    } finally {
      await relaunched.close();
    }
  });
});
