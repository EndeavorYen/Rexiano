import { test, expect, waitForUiSettled } from "./fixtures/electronApp";
import { gotoLibrary, loadFirstBuiltInSong } from "./helpers/appHarness";

async function expectNoPageHorizontalOverflow(
  appPage: Parameters<typeof waitForUiSettled>[0],
): Promise<void> {
  const metrics = await appPage.evaluate(() => {
    const root = document.scrollingElement ?? document.documentElement;
    return {
      innerWidth: window.innerWidth,
      rootScrollWidth: root.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
    };
  });

  expect(metrics.rootScrollWidth).toBeLessThanOrEqual(metrics.innerWidth + 1);
  expect(metrics.bodyScrollWidth).toBeLessThanOrEqual(metrics.innerWidth + 1);
}

async function expectSelectorsMeetHitTarget(
  appPage: Parameters<typeof waitForUiSettled>[0],
  selectors: string[],
  minSize = 36,
): Promise<void> {
  const failures = await appPage.evaluate(
    ({ selectors, minSize }) => {
      const isVisible = (element: Element): boolean => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          style.display !== "none" &&
          style.visibility !== "hidden"
        );
      };

      return selectors.flatMap((selector) => {
        const elements = Array.from(document.querySelectorAll(selector)).filter(
          isVisible,
        );
        if (elements.length === 0) {
          return [
            {
              selector,
              label: "missing visible control",
              width: 0,
              height: 0,
            },
          ];
        }

        return elements
          .map((element) => {
            const rect = element.getBoundingClientRect();
            const label =
              element.getAttribute("data-testid") ??
              element.getAttribute("aria-label") ??
              element.textContent?.trim() ??
              selector;
            return {
              selector,
              label,
              width: Math.round(rect.width),
              height: Math.round(rect.height),
            };
          })
          .filter(({ width, height }) => width < minSize || height < minSize);
      });
    },
    { selectors, minSize },
  );

  expect(failures).toEqual([]);
}

function parseCssRgb(input: string): [number, number, number] | null {
  const rgbMatch = input.match(
    /^rgba?\((\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?)/,
  );
  if (rgbMatch) {
    return [Number(rgbMatch[1]), Number(rgbMatch[2]), Number(rgbMatch[3])];
  }

  const srgbMatch = input.match(
    /^color\(srgb\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)/,
  );
  if (srgbMatch) {
    return [
      Number(srgbMatch[1]) * 255,
      Number(srgbMatch[2]) * 255,
      Number(srgbMatch[3]) * 255,
    ];
  }

  return null;
}

function contrastRatio(
  a: [number, number, number],
  b: [number, number, number],
): number {
  const luminance = (rgb: [number, number, number]): number => {
    const [r, g, b] = rgb.map((channel) => {
      const value = channel / 255;
      return value <= 0.03928
        ? value / 12.92
        : Math.pow((value + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

async function expectScrollbarContrast(
  appPage: Parameters<typeof waitForUiSettled>[0],
  themeId: "lavender" | "midnight",
): Promise<void> {
  await appPage.evaluate((id) => {
    localStorage.setItem("rexiano-theme", id);
  }, themeId);
  await appPage.reload();
  await gotoLibrary(appPage);

  const samples = await appPage.evaluate(() => {
    const shell = document.querySelector(".app-shell");
    if (!(shell instanceof HTMLElement)) return [];

    const track = getComputedStyle(
      shell,
      "::-webkit-scrollbar-track",
    ).backgroundColor;
    const thumb = getComputedStyle(
      shell,
      "::-webkit-scrollbar-thumb",
    ).backgroundColor;
    const corner = getComputedStyle(
      shell,
      "::-webkit-scrollbar-corner",
    ).backgroundColor;

    return [{ surface: "library-shell", track, thumb, corner }];
  });

  expect(samples).not.toEqual([]);
  const failures = samples.flatMap(({ surface, track, thumb, corner }) => {
    const trackRgb = parseCssRgb(track);
    const thumbRgb = parseCssRgb(thumb);
    const cornerRgb = parseCssRgb(corner);
    if (!trackRgb || !thumbRgb || !cornerRgb) {
      return [{ surface, reason: "unparseable", track, thumb, corner }];
    }

    const thumbContrast = contrastRatio(trackRgb, thumbRgb);
    const cornerContrast = contrastRatio(trackRgb, cornerRgb);
    return [
      thumbContrast >= 2.2
        ? null
        : { surface, reason: "thumb", ratio: thumbContrast, track, thumb },
      cornerContrast >= 2.2
        ? null
        : { surface, reason: "corner", ratio: cornerContrast, track, corner },
    ].filter(Boolean);
  });

  expect(failures).toEqual([]);
}

test.describe("Playback UI polish guardrails", () => {
  test("scrollbars keep thumb and corner contrast in light and dark themes", async ({
    appPage,
  }) => {
    await expectScrollbarContrast(appPage, "lavender");
    await expectScrollbarContrast(appPage, "midnight");
  });

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
    await appPage.getByTestId("display-mode-split").click();
    await waitForUiSettled(appPage);
    await appPage.keyboard.press("1");

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

    await appPage.getByTestId("display-mode-split").click();
    await waitForUiSettled(appPage);
    await expect(appPage.getByTestId("sheet-music-panel")).toBeVisible();
    await expect(appPage.getByTestId("falling-notes-panel")).toBeVisible();

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

  test("sheet music renders notation glyphs without VexFlow warnings", async ({
    appPage,
  }) => {
    const sheetWarnings: string[] = [];
    appPage.on("console", (msg) => {
      const text = msg.text();
      if (text.includes("SheetMusic:")) {
        sheetWarnings.push(`${msg.type()}: ${text}`);
      }
    });

    await appPage.setViewportSize({ width: 1600, height: 900 });
    await gotoLibrary(appPage);
    await loadFirstBuiltInSong(appPage);
    await waitForUiSettled(appPage);

    await appPage.getByTestId("playback-drawer-trigger").click();
    await appPage.getByTestId("display-mode-split").click();
    await waitForUiSettled(appPage);

    const host = appPage.getByTestId("sheet-music-svg-host");
    await expect(host.locator("svg")).toBeVisible();

    const glyphStats = await appPage.evaluate(() => {
      const host = document.querySelector(
        "[data-testid='sheet-music-svg-host']",
      );
      const svg = host?.querySelector("svg");
      if (!svg) return null;

      const glyphs = svg.querySelectorAll(
        "path,rect,ellipse,circle,line,polygon,polyline,text",
      );

      return {
        glyphCount: glyphs.length,
        width: svg.getAttribute("width"),
        height: svg.getAttribute("height"),
      };
    });

    expect(glyphStats).not.toBeNull();
    expect(glyphStats?.glyphCount).toBeGreaterThan(120);
    expect(glyphStats?.width).toBeTruthy();
    expect(glyphStats?.height).toBeTruthy();
    expect(sheetWarnings).toEqual([]);
  });

  test("split-layout-guard keeps keyboard + transport + toolbar visible on short viewports", async ({
    appPage,
  }) => {
    await appPage.setViewportSize({ width: 1600, height: 900 });
    await gotoLibrary(appPage);
    await loadFirstBuiltInSong(appPage);
    await waitForUiSettled(appPage);

    await appPage.getByTestId("playback-drawer-trigger").click();
    await appPage.getByTestId("display-mode-split").click();
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

  test("density-guard keeps BPM visible in only one place in split mode", async ({
    appPage,
  }) => {
    await appPage.setViewportSize({ width: 1600, height: 900 });
    await gotoLibrary(appPage);
    await loadFirstBuiltInSong(appPage);
    await waitForUiSettled(appPage);

    await appPage.getByTestId("playback-drawer-trigger").click();
    await appPage.getByTestId("display-mode-split").click();
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

  test("narrow-window guard keeps library and playback inside the viewport", async ({
    appPage,
  }) => {
    await appPage.setViewportSize({ width: 390, height: 844 });
    await gotoLibrary(appPage);
    await waitForUiSettled(appPage);
    await expectNoPageHorizontalOverflow(appPage);

    const advancedFilter = appPage.getByRole("button", {
      name: "Advanced",
      exact: true,
    });
    await expect(advancedFilter).toBeVisible();
    const advancedFilterBox = await advancedFilter.boundingBox();
    expect(advancedFilterBox).not.toBeNull();
    if (advancedFilterBox) {
      expect(advancedFilterBox.x + advancedFilterBox.width).toBeLessThanOrEqual(
        391,
      );
    }

    await loadFirstBuiltInSong(appPage);
    await appPage.getByTestId("playback-drawer-trigger").click();
    await appPage.getByTestId("display-mode-sheet").click();
    await waitForUiSettled(appPage);
    await appPage.keyboard.press("Escape");
    await waitForUiSettled(appPage);
    await expectNoPageHorizontalOverflow(appPage);

    const overflowingInteractiveControls = await appPage.evaluate(() =>
      Array.from(
        document.querySelectorAll(
          "button,input,select,[role='button'],[tabindex]:not([tabindex='-1'])",
        ),
      )
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          return (
            rect.width > 0 &&
            rect.height > 0 &&
            style.display !== "none" &&
            style.visibility !== "hidden"
          );
        })
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            label:
              element.getAttribute("data-testid") ??
              element.getAttribute("aria-label") ??
              element.textContent?.trim() ??
              element.tagName.toLowerCase(),
            right: Math.round(rect.right),
            left: Math.round(rect.left),
          };
        })
        .filter(
          ({ left, right }) => left < -1 || right > window.innerWidth + 1,
        ),
    );

    expect(overflowingInteractiveControls).toEqual([]);
  });

  test("narrow playback setup keeps expanded track controls above the keyboard", async ({
    appPage,
  }) => {
    await appPage.setViewportSize({ width: 390, height: 844 });
    await gotoLibrary(appPage);
    await loadFirstBuiltInSong(appPage);
    await appPage.getByTestId("playback-drawer-trigger").click();
    await appPage.getByTestId("display-mode-sheet").click();
    await waitForUiSettled(appPage);
    await appPage.keyboard.press("Escape");
    await waitForUiSettled(appPage);

    await appPage
      .getByTestId("practice-toolbar")
      .getByRole("button")
      .filter({ hasText: /More|更多/ })
      .click();
    await waitForUiSettled(appPage);

    const keyboard = appPage.getByTestId("piano-keyboard");
    await expect(keyboard).toBeVisible();

    const controlsCoveredByKeyboard = await appPage.evaluate(() => {
      const keyboardElement = document.querySelector(
        "[data-testid='piano-keyboard']",
      );
      const keyboardTop = keyboardElement?.getBoundingClientRect().top ?? 0;

      return Array.from(
        document.querySelectorAll(
          [
            "[data-testid='track-active-toggle']",
            "[data-testid='track-hand-select']",
            "[data-testid='track-sound-toggle']",
            "[data-testid='track-color-input']",
            "[data-testid='track-solo-toggle']",
          ].join(","),
        ),
      )
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          return (
            rect.width > 0 &&
            rect.height > 0 &&
            style.display !== "none" &&
            style.visibility !== "hidden"
          );
        })
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            label:
              element.getAttribute("data-testid") ??
              element.getAttribute("aria-label") ??
              element.textContent?.trim() ??
              element.tagName.toLowerCase(),
            bottom: Math.round(rect.bottom),
            keyboardTop: Math.round(keyboardTop),
          };
        })
        .filter(({ bottom, keyboardTop }) => bottom > keyboardTop - 1);
    });

    expect(controlsCoveredByKeyboard).toEqual([]);
  });

  test("compact controls keep a usable hit target", async ({ appPage }) => {
    await appPage.setViewportSize({ width: 1600, height: 900 });
    await gotoLibrary(appPage);
    await waitForUiSettled(appPage);

    await expectSelectorsMeetHitTarget(appPage, [
      "[data-testid='song-library-view-list']",
      "[data-testid='song-library-view-cards']",
      "[data-testid='song-favorite-toggle']",
    ]);

    await loadFirstBuiltInSong(appPage);
    await waitForUiSettled(appPage);

    await expectSelectorsMeetHitTarget(appPage, [
      "button[aria-label='Mute']",
      "input[aria-label='Seek position']",
      "[data-testid='metronome-toggle']",
      "[data-testid='volume-slider']",
      "[data-testid='speed-slider']",
      "[data-testid='track-active-toggle']",
      "[data-testid='track-hand-select']",
      "[data-testid='track-sound-toggle']",
      "[data-testid='track-color-input']",
      "[data-testid='track-solo-toggle']",
    ]);

    await appPage.getByTestId("playback-drawer-trigger").click();
    await expectSelectorsMeetHitTarget(appPage, [
      "button[aria-label='Bluetooth']",
    ]);
  });
});
