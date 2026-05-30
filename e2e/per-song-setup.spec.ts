import { test, expect } from "./fixtures/electronApp";
import { gotoLibrary, startBuiltInSongFromLibrary } from "./helpers/appHarness";

test.describe("Per-song practice setup", () => {
  test("mode selection is saved for the loaded song without changing tracks", async ({
    appPage,
  }) => {
    await appPage.evaluate(() => {
      localStorage.removeItem("rexiano-song-practice-setup");
    });
    await gotoLibrary(appPage);

    await startBuiltInSongFromLibrary(appPage, "chopsticks");
    await expect(appPage.getByTestId("mode-select-wait")).toBeVisible({
      timeout: 20_000,
    });
    await appPage.getByTestId("mode-select-wait").click();
    await expect(appPage.getByTestId("practice-toolbar")).toBeVisible();

    const savedSetup = await appPage.evaluate(() => {
      const raw = localStorage.getItem("rexiano-song-practice-setup");
      return raw ? JSON.parse(raw) : {};
    });

    expect(savedSetup["name:Chopsticks"]).toMatchObject({
      defaultMode: "wait",
    });
  });

  test("track selection changes are saved for the loaded song", async ({
    appPage,
  }) => {
    await appPage.evaluate(() => {
      localStorage.removeItem("rexiano-song-practice-setup");
    });
    await gotoLibrary(appPage);

    await startBuiltInSongFromLibrary(appPage, "chopsticks");
    await expect(appPage.getByTestId("mode-select-wait")).toBeVisible({
      timeout: 20_000,
    });
    await appPage.getByTestId("mode-select-wait").click();

    await appPage
      .getByRole("button", { name: /Show advanced controls/i })
      .click();
    await appPage.getByRole("button", { name: "Mute All" }).click();

    const savedSetup = await appPage.evaluate(() => {
      const raw = localStorage.getItem("rexiano-song-practice-setup");
      return raw ? JSON.parse(raw) : {};
    });

    expect(savedSetup["name:Chopsticks"]).toMatchObject({
      activeTracks: [],
      defaultMode: "wait",
    });
  });
});
