import { test, expect, waitForUiSettled } from "./fixtures/electronApp";

test.describe("First-run onboarding", () => {
  test("fresh profiles show the welcome guide until dismissed", async ({
    electronApp,
  }) => {
    const page = await electronApp.firstWindow();
    await page.waitForLoadState("domcontentloaded");
    await waitForUiSettled(page);

    const card = page.getByTestId("onboarding-card");
    await expect(card).toBeVisible();

    await page.getByTestId("onboarding-skip").click();

    await expect(card).toBeHidden();
    await expect(
      page.evaluate(() => localStorage.getItem("rexiano-onboarding-completed")),
    ).resolves.toBe("1");
  });

  test("welcome guide follows the selected app language", async ({
    electronApp,
  }) => {
    const page = await electronApp.firstWindow();
    await page.waitForLoadState("domcontentloaded");
    await page.evaluate(() => {
      localStorage.removeItem("rexiano-onboarding-completed");
      localStorage.setItem(
        "rexiano-settings",
        JSON.stringify({
          language: "zh-TW",
          defaultMode: "watch",
          metronomeEnabled: false,
          showNoteLabels: true,
          showFallingNoteLabels: true,
        }),
      );
    });
    await page.reload();
    await page.waitForLoadState("domcontentloaded");
    await waitForUiSettled(page);

    const card = page.getByTestId("onboarding-card");
    await expect(card).toBeVisible();
    await expect(card).toContainText("開始練琴");
    await expect(card).toContainText("開啟曲庫");
    await expect(card).not.toContainText("Start Practicing");
  });
});
