import { test, expect, waitForUiSettled } from "./fixtures/electronApp";
import {
  closeTopDrawer,
  gotoLibrary,
  openPlaybackDrawer,
} from "./helpers/appHarness";

type SheetFixtureName = "dense-sparse" | "sharp-key" | "flat-key";

interface SheetSvgStats {
  glyphCount: number;
  visibleGlyphCount: number;
  invalidBoxCount: number;
  width: number;
  height: number;
  hostClientWidth: number;
  minX: number;
  maxX: number;
  distinctColumns: number;
  leftSystemGlyphCount: number;
}

async function loadSheetFixture(
  appPage: Parameters<typeof waitForUiSettled>[0],
  fixtureName: SheetFixtureName,
): Promise<void> {
  const result = await appPage.evaluate((name) => {
    const loader = (
      window as typeof window & {
        __rexianoLoadSheetMusicFixture?: (fixtureName: string) => void;
      }
    ).__rexianoLoadSheetMusicFixture;

    if (typeof loader !== "function") {
      return { ok: false, reason: "missing sheet fixture loader" };
    }

    loader(name);
    return { ok: true };
  }, fixtureName);

  expect(result).toEqual({ ok: true });
  await waitForUiSettled(appPage);
  await expect(appPage.getByTestId("sheet-music-panel")).toBeVisible();
  await expect(
    appPage.getByTestId("sheet-music-svg-host").locator("svg"),
  ).toBeVisible({ timeout: 20_000 });
}

async function loadBuiltInSongSheet(
  appPage: Parameters<typeof waitForUiSettled>[0],
  songId: string,
): Promise<void> {
  const playbackLibraryButton = appPage.getByRole("button", {
    name: /Library|曲庫/i,
  });
  if (
    (await playbackLibraryButton.count()) > 0 &&
    (await playbackLibraryButton.first().isVisible())
  ) {
    await playbackLibraryButton.first().click();
  }
  await gotoLibrary(appPage);

  const listToggle = appPage.getByTestId("song-library-view-list");
  if ((await listToggle.count()) > 0) {
    await listToggle.click();
  }

  const songButton = appPage.getByTestId(`song-select-${songId}`);
  await expect(songButton).toBeVisible({ timeout: 20_000 });
  await songButton.click();

  const modeSelectWait = appPage.getByTestId("mode-select-wait");
  await Promise.race([
    modeSelectWait.waitFor({ state: "visible", timeout: 20_000 }),
    appPage
      .getByTestId("playback-drawer-trigger")
      .waitFor({ state: "visible", timeout: 20_000 }),
  ]);
  const shouldPickMode = await modeSelectWait
    .waitFor({ state: "visible", timeout: 1_000 })
    .then(() => true)
    .catch(() => false);
  if (shouldPickMode) {
    await expect(modeSelectWait).toBeVisible({ timeout: 20_000 });
    await modeSelectWait.click();
  }

  await openPlaybackDrawer(appPage);
  await appPage.getByTestId("display-mode-sheet").click();
  await closeTopDrawer(appPage);

  await waitForUiSettled(appPage);
  await expect(appPage.getByTestId("sheet-music-panel")).toBeVisible();
  await expect(
    appPage.getByTestId("sheet-music-svg-host").locator("svg"),
  ).toBeVisible({ timeout: 20_000 });
}

async function readSheetSvgStats(
  appPage: Parameters<typeof waitForUiSettled>[0],
): Promise<SheetSvgStats | null> {
  return appPage.evaluate(() => {
    const host = document.querySelector("[data-testid='sheet-music-svg-host']");
    const svg = host?.querySelector("svg");
    if (!svg) return null;

    const width = Number(svg.getAttribute("width") ?? 0);
    const height = Number(svg.getAttribute("height") ?? 0);
    const hostClientWidth = host?.clientWidth ?? 0;
    const nodes = svg.querySelectorAll(
      "path,rect,ellipse,circle,line,polygon,polyline,text",
    );
    const visibleBoxes: {
      x: number;
      y: number;
      width: number;
      height: number;
    }[] = [];
    let invalidBoxCount = 0;

    for (const node of nodes) {
      if (!(node instanceof SVGGraphicsElement)) continue;
      try {
        const box = node.getBBox();
        if (
          !Number.isFinite(box.x) ||
          !Number.isFinite(box.y) ||
          !Number.isFinite(box.width) ||
          !Number.isFinite(box.height)
        ) {
          invalidBoxCount += 1;
          continue;
        }
        if (box.width > 0 && box.height > 0) {
          visibleBoxes.push({
            x: box.x,
            y: box.y,
            width: box.width,
            height: box.height,
          });
        }
      } catch {
        invalidBoxCount += 1;
      }
    }

    const minX = Math.min(...visibleBoxes.map((box) => box.x));
    const maxX = Math.max(...visibleBoxes.map((box) => box.x + box.width));
    const columns = new Set(visibleBoxes.map((box) => Math.round(box.x / 4)));
    const leftSystemGlyphCount = visibleBoxes.filter(
      (box) => box.x >= 20 && box.x <= 190,
    ).length;

    return {
      glyphCount: nodes.length,
      visibleGlyphCount: visibleBoxes.length,
      invalidBoxCount,
      width,
      height,
      hostClientWidth,
      minX,
      maxX,
      distinctColumns: columns.size,
      leftSystemGlyphCount,
    };
  });
}

async function readDiagnosticTitle(
  appPage: Parameters<typeof waitForUiSettled>[0],
): Promise<string | null> {
  const notice = appPage.getByTestId("midi-diagnostic-notice");
  if ((await notice.count()) === 0) return null;
  return notice.first().getAttribute("title");
}

test.describe("Sheet music visual fixtures", () => {
  test("dense and sparse fixtures render nonblank SVG with stable glyph spread", async ({
    appPage,
  }) => {
    await appPage.setViewportSize({ width: 1600, height: 900 });
    await loadSheetFixture(appPage, "dense-sparse");

    const stats = await readSheetSvgStats(appPage);

    expect(stats).not.toBeNull();
    expect(stats?.width).toBeGreaterThanOrEqual(1200);
    expect(stats?.height).toBeGreaterThanOrEqual(200);
    expect(stats?.glyphCount).toBeGreaterThan(220);
    expect(stats?.visibleGlyphCount).toBeGreaterThan(140);
    expect(stats?.distinctColumns).toBeGreaterThan(50);
    expect(stats?.invalidBoxCount).toBe(0);
    expect(stats?.minX).toBeGreaterThanOrEqual(-2);
    expect(stats?.maxX).toBeLessThanOrEqual((stats?.width ?? 0) + 2);
  });

  test("sharp and flat key-signature fixtures render stave-level signatures", async ({
    appPage,
  }) => {
    await appPage.setViewportSize({ width: 1600, height: 900 });

    for (const fixtureName of ["sharp-key", "flat-key"] as const) {
      await loadSheetFixture(appPage, fixtureName);

      const stats = await readSheetSvgStats(appPage);

      expect(stats).not.toBeNull();
      expect(stats?.glyphCount).toBeGreaterThan(80);
      expect(stats?.visibleGlyphCount).toBeGreaterThan(40);
      expect(stats?.leftSystemGlyphCount).toBeGreaterThanOrEqual(18);
      expect(stats?.invalidBoxCount).toBe(0);
      expect(stats?.minX).toBeGreaterThanOrEqual(-2);
      expect(stats?.maxX).toBeLessThanOrEqual((stats?.width ?? 0) + 2);
    }
  });

  test("tie-heavy built-in songs render nonblank sheet SVG without sheet errors", async ({
    appPage,
  }) => {
    await appPage.setViewportSize({ width: 1600, height: 900 });
    const sheetMessages: string[] = [];
    appPage.on("console", (message) => {
      if (message.text().includes("SheetMusic:")) {
        sheetMessages.push(`${message.type()}: ${message.text()}`);
      }
    });

    for (const songId of ["amazing-grace", "german-dance"]) {
      await loadBuiltInSongSheet(appPage, songId);

      const stats = await readSheetSvgStats(appPage);

      expect(stats).not.toBeNull();
      expect(stats?.glyphCount).toBeGreaterThan(50);
      expect(stats?.visibleGlyphCount).toBeGreaterThan(25);
      expect(stats?.invalidBoxCount).toBe(0);
      expect(stats?.maxX).toBeLessThanOrEqual((stats?.width ?? 0) + 2);
    }

    expect(sheetMessages).toEqual([]);
  });

  test("dense built-in sheet glyph bounds stay inside the SVG width", async ({
    appPage,
  }) => {
    await appPage.setViewportSize({ width: 1600, height: 900 });
    await loadBuiltInSongSheet(appPage, "moonlight-sonata");

    const stats = await readSheetSvgStats(appPage);

    expect(stats).not.toBeNull();
    expect(stats?.glyphCount).toBeGreaterThan(120);
    expect(stats?.visibleGlyphCount).toBeGreaterThan(80);
    expect(stats?.invalidBoxCount).toBe(0);
    expect(stats?.minX).toBeGreaterThanOrEqual(-2);
    expect(stats?.maxX).toBeLessThanOrEqual((stats?.width ?? 0) + 2);
  });

  test("built-in notation metadata suppresses missing meter diagnostics", async ({
    appPage,
  }) => {
    await appPage.setViewportSize({ width: 1600, height: 900 });

    for (const songId of ["hot-cross-buns", "minuet-in-g", "fur-elise"]) {
      await loadBuiltInSongSheet(appPage, songId);

      const diagnosticTitle = await readDiagnosticTitle(appPage);
      expect(diagnosticTitle ?? "").not.toContain(
        "No time signature metadata was found.",
      );

      const stats = await readSheetSvgStats(appPage);
      expect(stats).not.toBeNull();
      expect(stats?.leftSystemGlyphCount).toBeGreaterThanOrEqual(12);
    }
  });

  test("moonlight triplets render without notation approximation warnings and with expanded spacing", async ({
    appPage,
  }) => {
    await appPage.setViewportSize({ width: 1600, height: 900 });
    await loadBuiltInSongSheet(appPage, "moonlight-sonata");

    const diagnosticTitle = await readDiagnosticTitle(appPage);
    expect(diagnosticTitle ?? "").not.toContain("Sheet notation approximates");

    const stats = await readSheetSvgStats(appPage);
    expect(stats).not.toBeNull();
    expect(stats?.width).toBeGreaterThan((stats?.hostClientWidth ?? 0) + 900);
    expect(stats?.glyphCount).toBeGreaterThan(120);
    expect(stats?.visibleGlyphCount).toBeGreaterThan(80);
    expect(stats?.invalidBoxCount).toBe(0);
    expect(stats?.maxX).toBeLessThanOrEqual((stats?.width ?? 0) + 2);
  });

  test("simple built-in sheets stay compact after dense spacing changes", async ({
    appPage,
  }) => {
    await appPage.setViewportSize({ width: 1600, height: 900 });
    await loadBuiltInSongSheet(appPage, "hot-cross-buns");

    const stats = await readSheetSvgStats(appPage);
    expect(stats).not.toBeNull();
    expect(stats?.width).toBeLessThanOrEqual(
      (stats?.hostClientWidth ?? 0) + 300,
    );
  });
});
