import { test, expect } from "./fixtures/electronApp";
import { gotoLibrary, loadFirstBuiltInSong } from "./helpers/appHarness";

async function resetLibraryPrefs(appPage: {
  evaluate: (fn: () => void) => Promise<void>;
  reload: () => Promise<unknown>;
}): Promise<void> {
  await appPage.evaluate(() => {
    localStorage.setItem(
      "rexiano-song-library",
      JSON.stringify({
        viewMode: "list",
        sortMode: "recent",
        favoriteSongIds: [],
      }),
    );
  });
  await appPage.reload();
}

test.describe("Song library selection workflow", () => {
  test("supports compact list sorting and favorite pinning", async ({
    appPage,
  }) => {
    await resetLibraryPrefs(appPage);
    await gotoLibrary(appPage);

    const list = appPage.getByTestId("song-library-list");
    await expect(list).toBeVisible();

    await appPage.getByTestId("song-library-sort").selectOption("title");
    const titleTexts = await appPage
      .getByTestId("song-list-row-title")
      .allTextContents();
    const sortedTitles = [...titleTexts].sort((a, b) => a.localeCompare(b));
    expect(titleTexts.slice(0, 6)).toEqual(sortedTitles.slice(0, 6));

    const lastFavoriteButton = appPage
      .getByTestId("song-favorite-toggle")
      .last();
    const favoriteTitle = await appPage
      .getByTestId("song-list-row-title")
      .last()
      .textContent();
    await lastFavoriteButton.click();

    await appPage.getByTestId("song-library-sort").selectOption("recent");
    await expect(appPage.getByTestId("song-list-row-title").first()).toHaveText(
      favoriteTitle ?? "",
    );
    await expect(
      appPage.getByTestId("song-favorite-toggle").first(),
    ).toHaveAttribute("aria-pressed", "true");
  });

  test("shows a continue practice action after loading a song", async ({
    appPage,
  }) => {
    await resetLibraryPrefs(appPage);
    await gotoLibrary(appPage);

    const firstTitle = await appPage
      .getByTestId("song-select-hot-cross-buns")
      .getByTestId("song-list-row-title")
      .textContent();

    await loadFirstBuiltInSong(appPage);
    await appPage.getByRole("button", { name: /Library|曲庫/ }).click();
    await gotoLibrary(appPage);

    const continuePractice = appPage.getByTestId("song-library-continue");
    await expect(continuePractice).toBeVisible();
    await expect(continuePractice).toContainText(firstTitle ?? "");
  });
});
