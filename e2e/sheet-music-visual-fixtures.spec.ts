import { test, expect, waitForUiSettled } from "./fixtures/electronApp";

type SheetFixtureName = "dense-sparse" | "sharp-key" | "flat-key";

interface SheetSvgStats {
  glyphCount: number;
  visibleGlyphCount: number;
  invalidBoxCount: number;
  width: number;
  height: number;
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

async function readSheetSvgStats(
  appPage: Parameters<typeof waitForUiSettled>[0],
): Promise<SheetSvgStats | null> {
  return appPage.evaluate(() => {
    const host = document.querySelector("[data-testid='sheet-music-svg-host']");
    const svg = host?.querySelector("svg");
    if (!svg) return null;

    const width = Number(svg.getAttribute("width") ?? 0);
    const height = Number(svg.getAttribute("height") ?? 0);
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
      minX,
      maxX,
      distinctColumns: columns.size,
      leftSystemGlyphCount,
    };
  });
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
});
