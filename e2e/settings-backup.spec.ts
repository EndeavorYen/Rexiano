import { test, expect } from "./fixtures/electronApp";

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
});
