import { test, expect } from "./fixtures/electronApp";
import type { Page } from "@playwright/test";

async function openAboutSettings(appPage: Page): Promise<void> {
  await appPage
    .getByRole("button", { name: /^Settings$/ })
    .first()
    .click();
  await appPage.getByTestId("settings-mode-toggle").click();
  await appPage.getByTestId("settings-tab-about").click();
}

test.describe("Settings update flow", () => {
  test("development builds expose a non-disruptive disabled update state", async ({
    appPage,
  }) => {
    await openAboutSettings(appPage);

    await expect(appPage.getByTestId("app-update-panel")).toBeVisible();
    await appPage.getByTestId("app-update-check").click();
    await expect(appPage.getByTestId("app-update-status")).toContainText(
      "packaged builds",
    );
  });
});
