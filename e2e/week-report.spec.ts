import { test, expect } from "./fixtures/app";

test.describe("Week report", () => {
  test("opens from the home numbers, traps focus, Esc returns focus", async ({
    appPage,
  }) => {
    const trigger = appPage.getByTestId("home-stats-open-week");
    await expect(trigger).toBeVisible();
    await trigger.click();
    const sheet = appPage.getByTestId("week-sheet");
    await expect(sheet).toBeVisible();
    await expect(sheet.getByTestId("week-bar")).toHaveCount(7);
    expect(
      await appPage.evaluate(
        () =>
          !!document
            .querySelector('[data-testid="week-sheet"]')
            ?.contains(document.activeElement),
      ),
    ).toBe(true);
    await appPage.keyboard.press("Escape");
    await expect(sheet).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test("the daily goal can be changed and survives a reload", async ({
    appPage,
  }) => {
    await expect(appPage.getByTestId("home-stat-today")).toContainText("/ 10");
    await appPage.getByTestId("home-stats-open-week").click();
    await appPage.getByTestId("week-goal-15").click();
    await expect(appPage.getByTestId("week-goal-15")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await appPage.getByTestId("week-close").click();
    await expect(appPage.getByTestId("home-stat-today")).toContainText("/ 15");
    await appPage.reload();
    await expect(appPage.getByTestId("home-stat-today")).toContainText("/ 15");
  });

  test("settings has an entry to the same sheet", async ({ appPage }) => {
    await appPage.getByTestId("main-menu-settings").click();
    await appPage.getByTestId("settings-open-week").click();
    await expect(appPage.getByTestId("week-sheet")).toBeVisible();
    await appPage.keyboard.press("Escape");
    await expect(appPage.getByTestId("week-sheet")).toHaveCount(0);
    await expect(appPage.getByTestId("settings-panel")).toBeVisible();
    await expect(appPage.getByTestId("settings-open-week")).toBeFocused();
  });
});
