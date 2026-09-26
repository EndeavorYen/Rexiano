import { test, expect } from "./fixtures/electronApp";
import {
  gotoLibrary,
  loadFirstBuiltInSong,
  openPlaybackDrawer,
} from "./helpers/appHarness";

test.skip(true, "Metronome and count-in UI left the live path (#247)");

test("live playback does not offer a metronome or count-in control", async ({
  appPage,
}) => {
  await gotoLibrary(appPage);
  await loadFirstBuiltInSong(appPage);

  await expect(appPage.getByTestId("metronome-toggle")).toHaveCount(0);

  await openPlaybackDrawer(appPage);
  await appPage.getByRole("button", { name: "Settings" }).click();
  await expect(appPage.getByTestId("toggle-metronome")).toHaveCount(0);
  await expect(appPage.getByTestId("count-in-beats-4")).toHaveCount(0);
  await expect(appPage.getByTestId("toggle-fingering")).toHaveCount(0);
  await expect(appPage.getByTestId("toggle-child-focus-mode")).toHaveCount(0);
});
