import { test, expect } from "./fixtures/electronApp";
import {
  gotoLibrary,
  loadFirstBuiltInSong,
  openPlaybackDrawer,
} from "./helpers/appHarness";

test.describe("Piano roll editor flow", () => {
  test("opens an editor for a loaded song and draws a note", async ({
    appPage,
  }) => {
    await gotoLibrary(appPage);
    await loadFirstBuiltInSong(appPage);
    await openPlaybackDrawer(appPage);
    await appPage.getByTestId("open-editor").click();

    const editor = appPage.getByTestId("piano-roll-editor");
    await expect(editor).toBeVisible();
    const notes = appPage.getByTestId("piano-roll-note");
    const initialCount = await notes.count();
    expect(initialCount).toBeGreaterThan(0);

    await appPage.getByTestId("editor-tool-draw").click();
    await appPage.getByTestId("piano-roll-grid").click({
      position: { x: 140, y: 180 },
    });

    await expect(notes).toHaveCount(initialCount + 1);
    await expect(appPage.getByTestId("note-inspector-selection")).toContainText(
      "1 selected",
    );
    await appPage.getByTestId("note-property-velocity").fill("300");
    await appPage.getByTestId("note-property-velocity").press("Enter");
    await expect(appPage.getByTestId("note-inspector-warning")).toContainText(
      "Velocity was clamped",
    );
  });
});
