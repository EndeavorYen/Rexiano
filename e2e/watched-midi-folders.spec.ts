import { test, expect } from "./fixtures/electronApp";
import { gotoLibrary } from "./helpers/appHarness";

test.describe("Watched MIDI folders", () => {
  test("library shows persisted imported songs and search matches metadata", async ({
    appPage,
  }) => {
    await appPage.evaluate(() => {
      localStorage.setItem(
        "rexiano-song-library",
        JSON.stringify({
          viewMode: "list",
          sortMode: "recent",
          favoriteSongIds: [],
          watchedFolders: ["/Users/rex/Music"],
          importedSongs: [
            {
              id: "user:scale",
              sourcePath: "/Users/rex/Music/Morning Scale.mid",
              title: "Morning Scale",
              composer: "Teacher",
              tags: ["legato"],
              category: "exercise",
              grade: 1,
              missing: false,
            },
          ],
        }),
      );
    });
    await appPage.reload();
    await gotoLibrary(appPage);

    await expect(appPage.getByTestId("imported-song-library")).toBeVisible();
    await expect(
      appPage.getByTestId("imported-song-title").filter({
        hasText: "Morning Scale",
      }),
    ).toBeVisible();

    await appPage.getByTestId("song-library-search").fill("legato");
    await expect(
      appPage.getByTestId("imported-song-title").filter({
        hasText: "Morning Scale",
      }),
    ).toBeVisible();
  });
});
