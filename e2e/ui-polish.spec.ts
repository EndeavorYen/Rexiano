import { test, expect, waitForUiSettled } from "./fixtures/electronApp";
import { gotoLibrary, loadFirstBuiltInSong } from "./helpers/appHarness";

test.describe("Playback UI polish guardrails", () => {
  test("header is compact and keeps title + metrics on the same row", async ({
    appPage,
  }) => {
    await appPage.setViewportSize({ width: 1600, height: 900 });
    await gotoLibrary(appPage);
    await loadFirstBuiltInSong(appPage);
    await waitForUiSettled(appPage);

    const headerPanel = appPage.getByTestId("playback-header-panel");
    const title = appPage.getByTestId("playback-song-title");
    const chips = appPage.getByTestId("playback-header-chips");

    await expect(headerPanel).toBeVisible();
    await expect(title).toBeVisible();
    await expect(chips).toBeVisible();

    const [headerBox, titleBox, chipsBox] = await Promise.all([
      headerPanel.boundingBox(),
      title.boundingBox(),
      chips.boundingBox(),
    ]);

    expect(headerBox).not.toBeNull();
    expect(titleBox).not.toBeNull();
    expect(chipsBox).not.toBeNull();
    if (!headerBox || !titleBox || !chipsBox) return;

    const titleCenterY = titleBox.y + titleBox.height / 2;
    const chipsCenterY = chipsBox.y + chipsBox.height / 2;

    expect(Math.abs(titleCenterY - chipsCenterY)).toBeLessThan(14);
    expect(headerBox.height).toBeLessThan(116);

    await expect(headerPanel.locator(".progress-rail")).toHaveCount(0);
    await expect(
      headerPanel.locator("svg.lucide-play, svg.lucide-pause"),
    ).toHaveCount(0);
  });

  test("transport uses volume ratio label and keeps volume slider visible", async ({
    appPage,
  }) => {
    await appPage.setViewportSize({ width: 1600, height: 900 });
    await gotoLibrary(appPage);
    await loadFirstBuiltInSong(appPage);
    await waitForUiSettled(appPage);

    const transport = appPage.getByTestId("transport-strip");
    const practiceToolbar = appPage.getByTestId("practice-toolbar");
    const volumePercent = appPage.getByTestId("transport-volume-percent");
    const volumeControl = appPage.getByTestId("volume-control");
    const volumeSlider = appPage.getByTestId("volume-slider");

    await expect(transport).toBeVisible();
    await expect(volumePercent).toHaveText(/\d+%/);
    await expect(transport).not.toContainText("BPM");
    await expect(practiceToolbar).not.toContainText("BPM");

    const [controlBox, sliderBox] = await Promise.all([
      volumeControl.boundingBox(),
      volumeSlider.boundingBox(),
    ]);

    expect(controlBox).not.toBeNull();
    expect(sliderBox).not.toBeNull();
    if (!controlBox || !sliderBox) return;

    expect(sliderBox.height).toBeGreaterThanOrEqual(18);
    expect(sliderBox.y).toBeGreaterThanOrEqual(controlBox.y - 1);
    expect(sliderBox.y + sliderBox.height).toBeLessThanOrEqual(
      controlBox.y + controlBox.height + 1,
    );
  });

  test("sheet music does not rebuild DOM every frame while playing", async ({
    appPage,
  }) => {
    await appPage.setViewportSize({ width: 1600, height: 900 });
    await gotoLibrary(appPage);
    await loadFirstBuiltInSong(appPage);
    await waitForUiSettled(appPage);

    await appPage.getByTestId("playback-drawer-trigger").click();
    await appPage.getByTestId("display-mode-sheet").click();
    await appPage.keyboard.press("Escape");
    await expect(
      appPage.getByTestId("playback-settings-drawer"),
    ).not.toBeVisible();
    await waitForUiSettled(appPage);

    const host = appPage.getByTestId("sheet-music-svg-host");
    await expect(host).toBeVisible();

    const playButton = appPage
      .getByTestId("transport-strip")
      .locator("button")
      .first();
    const hasPauseIcon =
      (await playButton.locator("svg.lucide-pause").count()) > 0;
    if (!hasPauseIcon) {
      await playButton.click();
    }

    const domChurn = await appPage.evaluate(async () => {
      const host = document.querySelector(
        "[data-testid='sheet-music-svg-host']",
      ) as HTMLElement | null;
      if (!host) return -1;

      let childListChangeCount = 0;
      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.type !== "childList") continue;
          childListChangeCount +=
            mutation.addedNodes.length + mutation.removedNodes.length;
        }
      });
      observer.observe(host, { childList: true, subtree: true });

      await new Promise((resolve) => setTimeout(resolve, 1800));
      observer.disconnect();
      return childListChangeCount;
    });

    expect(domChurn).toBeGreaterThanOrEqual(0);
    expect(domChurn).toBeLessThan(8);
  });

  test("display mode switches keep sheet and falling panels coherent", async ({
    appPage,
  }) => {
    await appPage.setViewportSize({ width: 1600, height: 900 });
    await gotoLibrary(appPage);
    await loadFirstBuiltInSong(appPage);
    await waitForUiSettled(appPage);

    await appPage.getByTestId("playback-drawer-trigger").click();

    await appPage.getByTestId("display-mode-sheet").click();
    await waitForUiSettled(appPage);
    await expect(appPage.getByTestId("sheet-music-panel")).toBeVisible();
    await expect(appPage.getByTestId("falling-notes-panel")).toBeHidden();

    await appPage.getByTestId("display-mode-falling").click();
    await waitForUiSettled(appPage);
    await expect(appPage.getByTestId("sheet-music-panel")).toBeHidden();
    await expect(appPage.getByTestId("falling-notes-panel")).toBeVisible();

    await appPage.getByTestId("display-mode-sheet").click();
    await waitForUiSettled(appPage);
    await expect(appPage.getByTestId("sheet-music-panel")).toBeVisible();

    const minGlyphX = await appPage.evaluate(() => {
      const host = document.querySelector(
        "[data-testid='sheet-music-svg-host']",
      ) as HTMLElement | null;
      const svg = host?.querySelector("svg");
      if (!svg) return null;

      const nodes = svg.querySelectorAll(
        "path,rect,ellipse,circle,line,polygon,polyline,text",
      );
      let minX = Number.POSITIVE_INFINITY;

      for (const node of nodes) {
        if (!(node instanceof SVGGraphicsElement)) continue;
        try {
          const bbox = node.getBBox();
          if (Number.isFinite(bbox.x)) {
            minX = Math.min(minX, bbox.x);
          }
        } catch {
          // Ignore elements that do not expose a stable bounding box.
        }
      }

      return Number.isFinite(minX) ? minX : null;
    });

    expect(minGlyphX).not.toBeNull();
    if (minGlyphX !== null) {
      expect(minGlyphX).toBeGreaterThanOrEqual(-1);
    }
  });

  test("sheet beat highlight stays on noteheads (not left gutter)", async ({
    appPage,
  }) => {
    await appPage.setViewportSize({ width: 1600, height: 900 });
    await gotoLibrary(appPage);
    await loadFirstBuiltInSong(appPage);
    await waitForUiSettled(appPage);

    await appPage.getByTestId("playback-drawer-trigger").click();
    await appPage.getByTestId("display-mode-sheet").click();
    await appPage.keyboard.press("Escape");
    await waitForUiSettled(appPage);

    const playButton = appPage
      .getByTestId("transport-strip")
      .locator("button")
      .first();
    const hasPauseIcon =
      (await playButton.locator("svg.lucide-pause").count()) > 0;
    if (!hasPauseIcon) {
      await playButton.click();
    }

    const sampleHighlightAlignment = async (): Promise<{
      ringCount: number;
      minDxToNoteheadCenter: number | null;
      minNoteheadCenterX: number | null;
      minRingCenterX: number | null;
    }> =>
      appPage.evaluate(() => {
        const host = document.querySelector(
          "[data-testid='sheet-music-svg-host']",
        ) as HTMLElement | null;
        const svg = host?.querySelector("svg");
        if (!svg) {
          return {
            ringCount: 0,
            minDxToNoteheadCenter: null,
            minNoteheadCenterX: null,
            minRingCenterX: null,
          };
        }

        const ringCenters = Array.from(
          svg.querySelectorAll("[data-rx-notehead-highlight-layer] ellipse"),
        )
          .map((el) => {
            const box = (el as SVGGraphicsElement).getBBox();
            return box.x + box.width / 2;
          })
          .filter((x) => Number.isFinite(x));

        const noteheadCenters = Array.from(
          svg.querySelectorAll("g.vf-notehead"),
        )
          .map((el) => {
            const box = (el as SVGGraphicsElement).getBBox();
            return box.x + box.width / 2;
          })
          .filter((x) => Number.isFinite(x));

        let minDxToNoteheadCenter: number | null = null;
        for (const ringX of ringCenters) {
          for (const headX of noteheadCenters) {
            const dx = Math.abs(ringX - headX);
            if (minDxToNoteheadCenter === null || dx < minDxToNoteheadCenter) {
              minDxToNoteheadCenter = dx;
            }
          }
        }

        return {
          ringCount: ringCenters.length,
          minDxToNoteheadCenter,
          minNoteheadCenterX:
            noteheadCenters.length > 0 ? Math.min(...noteheadCenters) : null,
          minRingCenterX:
            ringCenters.length > 0 ? Math.min(...ringCenters) : null,
        };
      });

    let sample = await sampleHighlightAlignment();
    for (let i = 0; i < 30 && sample.ringCount === 0; i++) {
      await appPage.waitForTimeout(120);
      sample = await sampleHighlightAlignment();
    }

    expect(sample.ringCount).toBeGreaterThan(0);
    expect(sample.minDxToNoteheadCenter).not.toBeNull();
    if (sample.minDxToNoteheadCenter !== null) {
      expect(sample.minDxToNoteheadCenter).toBeLessThan(26);
    }
    expect(sample.minRingCenterX).not.toBeNull();
    expect(sample.minNoteheadCenterX).not.toBeNull();
    if (sample.minRingCenterX !== null && sample.minNoteheadCenterX !== null) {
      expect(sample.minRingCenterX).toBeGreaterThan(
        sample.minNoteheadCenterX - 45,
      );
    }
  });

  test("layout-guard keeps keyboard + transport + toolbar visible on short viewports", async ({
    appPage,
  }) => {
    await appPage.setViewportSize({ width: 1600, height: 900 });
    await gotoLibrary(appPage);
    await loadFirstBuiltInSong(appPage);
    await waitForUiSettled(appPage);

    const transport = appPage.getByTestId("transport-strip");
    const toolbar = appPage.getByTestId("practice-toolbar");
    const keyboard = appPage.getByTestId("piano-keyboard");

    for (const height of [900, 768, 700]) {
      await appPage.setViewportSize({ width: 1600, height });
      await waitForUiSettled(appPage);

      const [transportBox, toolbarBox, keyboardBox] = await Promise.all([
        transport.boundingBox(),
        toolbar.boundingBox(),
        keyboard.boundingBox(),
      ]);

      expect(transportBox).not.toBeNull();
      expect(toolbarBox).not.toBeNull();
      expect(keyboardBox).not.toBeNull();
      if (!transportBox || !toolbarBox || !keyboardBox) continue;

      expect(transportBox.height).toBeGreaterThanOrEqual(58);
      expect(toolbarBox.height).toBeGreaterThanOrEqual(42);
      expect(keyboardBox.height).toBeGreaterThanOrEqual(70);
      expect(transportBox.y + transportBox.height).toBeLessThanOrEqual(height);
      expect(toolbarBox.y + toolbarBox.height).toBeLessThanOrEqual(height);
      expect(keyboardBox.y + keyboardBox.height).toBeLessThanOrEqual(height);
    }
  });

  test("header-overflow-guard keeps actions visible with very long title", async ({
    appPage,
  }) => {
    await appPage.setViewportSize({ width: 1180, height: 860 });
    await gotoLibrary(appPage);
    await loadFirstBuiltInSong(appPage);
    await waitForUiSettled(appPage);

    await appPage.evaluate(() => {
      const title = document.querySelector(
        "[data-testid='playback-song-title']",
      );
      if (title) {
        title.textContent =
          "A Very Very Very Long Song Title For Overflow Guardrail Validation 0123456789";
      }
    });

    const header = appPage.getByTestId("playback-header-panel");
    const chips = appPage.getByTestId("playback-header-chips");
    const actions = appPage.getByTestId("playback-header-actions");
    const drawerButton = appPage.getByTestId("playback-drawer-trigger");

    await expect(header).toBeVisible();
    await expect(chips).toBeVisible();
    await expect(actions).toBeVisible();
    await expect(drawerButton).toBeVisible();

    const [headerBox, chipsBox, actionsBox] = await Promise.all([
      header.boundingBox(),
      chips.boundingBox(),
      actions.boundingBox(),
    ]);
    expect(headerBox).not.toBeNull();
    expect(chipsBox).not.toBeNull();
    expect(actionsBox).not.toBeNull();
    if (!headerBox || !chipsBox || !actionsBox) return;

    expect(actionsBox.x + actionsBox.width).toBeLessThanOrEqual(
      headerBox.x + headerBox.width + 1,
    );
    expect(chipsBox.x + chipsBox.width).toBeLessThanOrEqual(actionsBox.x + 4);
    expect(Math.abs(chipsBox.y - actionsBox.y)).toBeLessThan(30);
  });

  test("density-guard keeps BPM visible in only one place", async ({
    appPage,
  }) => {
    await appPage.setViewportSize({ width: 1600, height: 900 });
    await gotoLibrary(appPage);
    await loadFirstBuiltInSong(appPage);
    await waitForUiSettled(appPage);

    const bpmTextCount = await appPage.getByText(/BPM/i).count();
    expect(bpmTextCount).toBe(1);
    await expect(appPage.getByTestId("transport-strip")).not.toContainText(
      "BPM",
    );
    await expect(appPage.getByTestId("practice-toolbar")).not.toContainText(
      "BPM",
    );
  });
});
