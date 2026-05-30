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
    await appPage.setViewportSize({ width: 1600, height: 900 });

    await gotoLibrary(appPage);
    await loadFirstBuiltInSong(appPage);
    await openPlaybackDrawer(appPage);
    await appPage.getByTestId("open-editor").click();

    const editor = appPage.getByTestId("piano-roll-editor");
    await expect(editor).toBeVisible();
    const notes = appPage.getByTestId("piano-roll-note");
    const initialCount = await notes.count();
    expect(initialCount).toBeGreaterThan(0);

    const initialTrackCount = await appPage.getByTestId("track-select").count();
    await appPage.getByTestId("track-add").click();
    await expect(appPage.getByTestId("track-select")).toHaveCount(
      initialTrackCount + 1,
    );
    await expect(appPage.getByTestId("track-impact-message")).toContainText(
      "Track topology changed",
    );

    await appPage.getByTestId("editor-tool-draw").click();

    const grid = appPage.getByTestId("piano-roll-grid");
    await expect(grid).toBeVisible();
    const drawPoint = await grid.evaluate((svg) => {
      const rect = svg.getBoundingClientRect();
      const xCandidates = [0.14, 0.28, 0.42, 0.56, 0.7];
      const yCandidates = [0.2, 0.34, 0.48, 0.62, 0.76, 0.9];

      for (const yRatio of yCandidates) {
        for (const xRatio of xCandidates) {
          const x = rect.left + rect.width * xRatio;
          const y = rect.top + rect.height * yRatio;
          const hit = document.elementFromPoint(x, y);
          if (
            hit &&
            svg.contains(hit) &&
            !hit.closest('[data-testid="piano-roll-note"]')
          ) {
            return { x, y };
          }
        }
      }

      throw new Error("No visible empty piano-roll grid point found");
    });
    await appPage.mouse.click(drawPoint.x, drawPoint.y);

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
