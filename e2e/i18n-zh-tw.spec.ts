import { test, expect, waitForUiSettled } from "./fixtures/electronApp";
import { gotoLibrary } from "./helpers/appHarness";

const FORBIDDEN_ENGLISH_UI =
  /First notes|Right-hand melodies|Exercises|Popular|Holiday|Classical|Change theme|Practice mode|Set speed to|Playback speed percentage|Piano roll editor tools|Add track|MIDI input device|MIDI output device/;

test.describe("Traditional Chinese player flow", () => {
  test("keeps library, Watch/Wait, speed, and MIDI input localized", async ({
    appPage,
  }, testInfo) => {
    await appPage.setViewportSize({ width: 1600, height: 900 });
    await appPage.evaluate(() => {
      const current = JSON.parse(
        localStorage.getItem("rexiano-settings") ?? "{}",
      ) as Record<string, unknown>;
      localStorage.setItem(
        "rexiano-settings",
        JSON.stringify({ ...current, language: "zh-TW" }),
      );
    });
    await appPage.reload();
    await waitForUiSettled(appPage);
    await gotoLibrary(appPage);

    await expect(
      appPage.getByRole("button", { name: "匯入自己的 MIDI 檔案" }),
    ).toBeVisible();
    await expect(appPage.getByTestId("lesson-group-first-notes")).toHaveCount(
      0,
    );
    await expect(appPage.getByRole("button", { name: "切換主題" })).toHaveCount(
      0,
    );
    const libraryAx = await appPage.locator("body").ariaSnapshot();
    expect(libraryAx).not.toMatch(FORBIDDEN_ENGLISH_UI);

    const libraryScreenshot = testInfo.outputPath("zh-tw-library.png");
    await appPage.screenshot({ path: libraryScreenshot, fullPage: true });
    await testInfo.attach("zh-TW library", {
      path: libraryScreenshot,
      contentType: "image/png",
    });

    await appPage.getByTestId("song-select-hot-cross-buns").click();
    await appPage.getByTestId("mode-select-wait").click();

    const practiceModes = appPage.getByRole("radiogroup", {
      name: "練習模式",
    });
    await expect(practiceModes).toBeVisible({ timeout: 20_000 });
    await expect(appPage.getByTestId("practice-mode-free")).toHaveCount(0);
    await expect(
      appPage.getByRole("button", { name: "將速度設為 50%" }),
    ).toBeVisible();

    await appPage.getByTestId("playback-drawer-trigger").click();
    await expect(appPage.getByTestId("open-editor")).toHaveCount(0);
    await expect(appPage.getByTestId("display-mode-sheet")).toHaveCount(0);
    await expect(appPage.getByTestId("insights-trigger")).toHaveCount(0);
    await expect(appPage.getByLabel("MIDI 輸出裝置")).toHaveCount(0);
    await expect(appPage.getByText("測試", { exact: true })).toHaveCount(0);

    const practiceAx = await appPage.locator("body").ariaSnapshot();
    expect(practiceAx).not.toMatch(FORBIDDEN_ENGLISH_UI);
  });
});
