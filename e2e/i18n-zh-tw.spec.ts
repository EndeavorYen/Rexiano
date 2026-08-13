import { test, expect, waitForUiSettled } from "./fixtures/electronApp";
import { gotoLibrary } from "./helpers/appHarness";

const FORBIDDEN_ENGLISH_UI =
  /First notes|Right-hand melodies|Exercises|Popular|Holiday|Classical|Change theme|Practice mode|Set speed to|Playback speed percentage|Piano roll editor tools|Add track|MIDI input device|MIDI output device/;

test.describe("Traditional Chinese player flow", () => {
  test("keeps library, practice, device, and editor UI localized", async ({
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

    await expect(appPage.getByTestId("lesson-group-first-notes")).toContainText(
      "初次識譜",
    );
    await expect(
      appPage.getByRole("button", { name: "切換主題" }),
    ).toBeVisible();
    const libraryAx = await appPage.locator("body").ariaSnapshot();
    expect(libraryAx).not.toMatch(FORBIDDEN_ENGLISH_UI);

    const libraryScreenshot = testInfo.outputPath("zh-tw-library.png");
    await appPage.screenshot({ path: libraryScreenshot, fullPage: true });
    await testInfo.attach("zh-TW library", {
      path: libraryScreenshot,
      contentType: "image/png",
    });

    await appPage.getByTestId("song-select-hot-cross-buns").click();
    const previewPractice = appPage.getByTestId(
      "song-selection-preview-practice",
    );
    await expect(previewPractice).toHaveAccessibleName("開始練習");
    await previewPractice.click();
    await appPage.getByTestId("mode-select-wait").click();

    const practiceModes = appPage.getByRole("radiogroup", {
      name: "練習模式",
    });
    await expect(practiceModes).toBeVisible({ timeout: 20_000 });
    await expect(
      appPage.getByRole("button", { name: "將速度設為 50%" }),
    ).toBeVisible();

    await appPage.getByTestId("playback-drawer-trigger").click();
    await expect(appPage.getByTestId("open-editor")).toHaveAccessibleName(
      "開啟鋼琴捲軸編輯器",
    );
    await appPage.getByTestId("open-editor").click();

    const editor = appPage.getByTestId("piano-roll-editor");
    await expect(editor).toBeVisible();
    await expect(
      editor.getByRole("toolbar", { name: "鋼琴捲軸編輯工具" }),
    ).toBeVisible();
    await expect(
      editor.getByRole("button", { name: "新增軌道" }),
    ).toBeVisible();
    await expect(editor).toContainText("未選取音符");
    const editorAx = await editor.ariaSnapshot();
    expect(editorAx).not.toMatch(FORBIDDEN_ENGLISH_UI);

    const editorScreenshot = testInfo.outputPath("zh-tw-editor.png");
    await appPage.screenshot({ path: editorScreenshot, fullPage: true });
    await testInfo.attach("zh-TW editor", {
      path: editorScreenshot,
      contentType: "image/png",
    });
  });
});
