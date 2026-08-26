import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import type {
  ElectronApplication,
  Locator,
  Page,
  TestInfo,
} from "@playwright/test";
import type { SessionRecord } from "../src/shared/types";
import { test, expect, waitForUiSettled } from "./fixtures/electronApp";
import {
  choosePracticeMode,
  closeTopDrawer,
  gotoLibrary,
  loadFirstBuiltInSong,
  openPlaybackDrawer,
  setDisplayMode,
  startBuiltInSongFromLibrary,
} from "./helpers/appHarness";

const MINIMUM_TEXT_CONTRAST = 4.5;
const MINIMUM_CONTROL_CONTRAST = 3;

function makeSessions(accuracies: number[]): SessionRecord[] {
  const now = Date.now();
  return accuracies.map((accuracy, index) => ({
    id: `contrast-${index}-${accuracy}`,
    songId: "Hot Cross Buns",
    songTitle: "Hot Cross Buns",
    timestamp: now - (accuracies.length - index) * 60_000,
    mode: "wait",
    speed: 1,
    score: {
      totalNotes: 10,
      hitNotes: Math.round(accuracy / 10),
      missedNotes: 10 - Math.round(accuracy / 10),
      accuracy,
      currentStreak: 0,
      bestStreak: 4,
    },
    durationSeconds: 60,
    tracksPlayed: [0],
  }));
}

async function writeProgressFixture(
  electronApp: ElectronApplication,
  accuracies: number[],
): Promise<void> {
  const userDataPath = await electronApp.evaluate(({ app }) =>
    app.getPath("userData"),
  );
  mkdirSync(userDataPath, { recursive: true });
  writeFileSync(
    join(userDataPath, "progress.json"),
    JSON.stringify(makeSessions(accuracies), null, 2),
    "utf-8",
  );
}

async function applyTheme(
  page: Page,
  themeId: "lavender" | "ocean" | "peach" | "midnight",
): Promise<void> {
  await page.evaluate((id) => {
    localStorage.setItem("rexiano-theme", id);
  }, themeId);
  await page.reload();
  await page.waitForLoadState("domcontentloaded");
  await waitForUiSettled(page);
}

async function computedContrast(
  locator: Locator,
  options: {
    primaryGradient?: boolean;
    backgroundFromParent?: boolean;
    backgroundAncestor?: string;
  } = {},
): Promise<{ ratios: number[]; foreground: string; backgrounds: string[] }> {
  return locator.evaluate(
    (
      element,
      { primaryGradient, backgroundFromParent, backgroundAncestor },
    ) => {
      const parseColor = (cssColor: string): [number, number, number] => {
        const canvas = document.createElement("canvas");
        canvas.width = 1;
        canvas.height = 1;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas 2D is unavailable");
        context.fillStyle = cssColor;
        context.fillRect(0, 0, 1, 1);
        const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
        return [r, g, b];
      };

      const luminance = (cssColor: string): number => {
        const channels = parseColor(cssColor).map((channel) => {
          const normalized = channel / 255;
          return normalized <= 0.03928
            ? normalized / 12.92
            : ((normalized + 0.055) / 1.055) ** 2.4;
        });
        return (
          0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
        );
      };

      const contrast = (foreground: string, background: string): number => {
        const values = [luminance(foreground), luminance(background)].sort(
          (a, b) => b - a,
        );
        return (values[0] + 0.05) / (values[1] + 0.05);
      };

      const style = getComputedStyle(element);
      const foreground = style.color;
      const ancestor = backgroundAncestor
        ? element.closest(backgroundAncestor)
        : null;
      let backgrounds = [
        getComputedStyle(
          ancestor ??
            (backgroundFromParent
              ? (element.parentElement ?? element)
              : element),
        ).backgroundColor,
      ];

      if (primaryGradient) {
        const rootStyle = getComputedStyle(document.documentElement);
        const accent = rootStyle.getPropertyValue("--color-accent").trim();
        const note3 = rootStyle.getPropertyValue("--color-note3").trim();
        const probe = document.createElement("span");
        probe.style.position = "fixed";
        probe.style.pointerEvents = "none";
        document.body.append(probe);

        probe.style.backgroundColor = accent;
        const first = getComputedStyle(probe).backgroundColor;
        probe.style.backgroundColor = `color-mix(in srgb, ${accent} 70%, ${note3})`;
        const second = getComputedStyle(probe).backgroundColor;
        probe.remove();
        backgrounds = [first, second];
      }

      return {
        foreground,
        backgrounds,
        ratios: backgrounds.map((background) =>
          contrast(foreground, background),
        ),
      };
    },
    options,
  );
}

async function saveScreenshot(
  page: Page,
  testInfo: TestInfo,
  name: string,
): Promise<void> {
  const evidenceDir = process.env.REXIANO_VISUAL_EVIDENCE_DIR;
  if (evidenceDir) mkdirSync(evidenceDir, { recursive: true });
  const path = evidenceDir
    ? join(evidenceDir, `${name}.png`)
    : testInfo.outputPath(`${name}.png`);
  await page.screenshot({ path, animations: "disabled" });
  await testInfo.attach(name, { path, contentType: "image/png" });
}

async function computedCssVariable(
  page: Page,
  variable: string,
): Promise<string> {
  return page.evaluate((cssVariable) => {
    const rootStyle = getComputedStyle(document.documentElement);
    const probe = document.createElement("span");
    probe.style.color = rootStyle.getPropertyValue(cssVariable);
    document.body.append(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
  }, variable);
}

async function computedStylePairContrast(
  locator: Locator,
  pair: "border-background" | "outline-background",
): Promise<{ foreground: string; background: string; ratio: number }> {
  return locator.evaluate((element, stylePair) => {
    const parseColor = (cssColor: string): [number, number, number] => {
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas 2D is unavailable");
      context.fillStyle = cssColor;
      context.fillRect(0, 0, 1, 1);
      const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
      return [r, g, b];
    };
    const luminance = (cssColor: string): number => {
      const channels = parseColor(cssColor).map((channel) => {
        const normalized = channel / 255;
        return normalized <= 0.03928
          ? normalized / 12.92
          : ((normalized + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
    };
    const style = getComputedStyle(element);
    const foreground =
      stylePair === "border-background"
        ? style.borderTopColor
        : style.outlineColor;
    const background = style.backgroundColor;
    const values = [luminance(foreground), luminance(background)].sort(
      (a, b) => b - a,
    );
    return {
      foreground,
      background,
      ratio: (values[0] + 0.05) / (values[1] + 0.05),
    };
  }, pair);
}

async function expectSemanticFilledControl(
  page: Page,
  locator: Locator,
  label: string,
): Promise<void> {
  await expect(locator, label).toBeVisible();
  const expectedForeground = await computedCssVariable(
    page,
    "--color-on-accent",
  );
  await expect
    .poll(async () => (await computedContrast(locator)).foreground)
    .toBe(expectedForeground);

  for (const interaction of ["default", "hover"] as const) {
    if (interaction === "hover") await locator.hover();
    const result = await computedContrast(locator);
    expect
      .soft(result.foreground, `${label} ${interaction} role`)
      .toBe(expectedForeground);
    expect
      .soft(result.ratios[0], `${label} ${interaction} contrast`)
      .toBeGreaterThanOrEqual(MINIMUM_TEXT_CONTRAST);
  }

  await locator.focus();
  const focus = await computedStylePairContrast(locator, "outline-background");
  expect.soft(focus.foreground, `${label} focus role`).toBe(expectedForeground);
  expect
    .soft(focus.ratio, `${label} focus contrast`)
    .toBeGreaterThanOrEqual(MINIMUM_CONTROL_CONTRAST);
}

test("all themes render semantic selected, danger, boundary, and focus colors", async ({
  appPage,
}, testInfo) => {
  await appPage.setViewportSize({ width: 1440, height: 900 });

  for (const themeId of ["lavender", "ocean", "peach", "midnight"] as const) {
    await appPage.evaluate((id) => {
      localStorage.setItem("rexiano-theme", id);
      localStorage.removeItem("rexiano-onboarding-completed");
      window.location.hash = "#/menu";
    }, themeId);
    await appPage.reload();
    await waitForUiSettled(appPage);

    await expectSemanticFilledControl(
      appPage,
      appPage.getByTestId("onboarding-next"),
      `${themeId} onboarding next`,
    );
    if (themeId === "ocean" || themeId === "midnight") {
      await saveScreenshot(appPage, testInfo, `${themeId}-onboarding-contrast`);
    }
    await appPage.getByTestId("onboarding-skip").click();

    await appPage.getByRole("button", { name: "Settings" }).click();
    await appPage.getByTestId("settings-mode-toggle").click();
    await appPage.getByTestId("settings-tab-practice").click();
    await appPage.getByTestId("mode-btn-watch").click();
    await expectSemanticFilledControl(
      appPage,
      appPage.getByTestId("mode-btn-watch"),
      `${themeId} settings mode`,
    );

    await appPage.getByTestId("settings-tab-backup").click();
    const dangerLabel = appPage
      .getByTestId("user-data-reset-settings")
      .getByText("Reset Settings", { exact: true });
    const dangerContrast = await computedContrast(dangerLabel, {
      backgroundAncestor: "button",
    });
    const expectedDanger = await computedCssVariable(
      appPage,
      "--color-danger-text",
    );
    expect
      .soft(dangerContrast.foreground, `${themeId} backup danger role`)
      .toBe(expectedDanger);
    expect
      .soft(dangerContrast.ratios[0], `${themeId} backup danger contrast`)
      .toBeGreaterThanOrEqual(MINIMUM_TEXT_CONTRAST);
    if (themeId === "ocean" || themeId === "midnight") {
      await saveScreenshot(appPage, testInfo, `${themeId}-backup-contrast`);
    }
    await appPage.getByTestId("settings-close").click();

    await gotoLibrary(appPage);
    const difficultyAll = appPage
      .getByRole("button", { name: "All", exact: true })
      .first();
    await difficultyAll.click();
    await expectSemanticFilledControl(
      appPage,
      difficultyAll,
      `${themeId} library difficulty`,
    );
    const listView = appPage.getByTestId("song-library-view-list");
    await listView.click();
    await expectSemanticFilledControl(
      appPage,
      listView,
      `${themeId} library view`,
    );

    const search = appPage.getByTestId("song-library-search");
    const boundary = await computedStylePairContrast(
      search,
      "border-background",
    );
    expect
      .soft(boundary.ratio, `${themeId} input boundary`)
      .toBeGreaterThanOrEqual(MINIMUM_CONTROL_CONTRAST);
    if (themeId === "ocean" || themeId === "midnight") {
      await saveScreenshot(appPage, testInfo, `${themeId}-library-contrast`);
    }

    await loadFirstBuiltInSong(appPage);
    const waitMode = appPage.getByTestId("practice-mode-wait");
    await waitMode.click();
    await expectSemanticFilledControl(
      appPage,
      waitMode,
      `${themeId} practice mode`,
    );
    const fullSpeed = appPage.getByRole("button", {
      name: "Set speed to 100%",
    });
    await fullSpeed.click();
    await expectSemanticFilledControl(
      appPage,
      fullSpeed,
      `${themeId} practice speed`,
    );
    await setDisplayMode(appPage, "falling");
    await expectSemanticFilledControl(
      appPage,
      appPage.getByTestId("display-mode-falling"),
      `${themeId} display mode`,
    );

    if (themeId === "ocean" || themeId === "midnight") {
      await saveScreenshot(appPage, testInfo, `${themeId}-semantic-controls`);
    }
  }
});

test("all themes keep the current-default badge readable on its actual tint", async ({
  appPage,
}) => {
  await appPage.setViewportSize({ width: 1440, height: 900 });

  for (const themeId of ["lavender", "ocean", "peach", "midnight"] as const) {
    await applyTheme(appPage, themeId);
    await gotoLibrary(appPage);
    await startBuiltInSongFromLibrary(appPage, "hot-cross-buns");

    const badge = appPage.getByTestId("mode-select-current-default");
    await expect(badge).toBeVisible();
    const badgeContrast = await computedContrast(badge);
    const accentTextColor = await computedCssVariable(
      appPage,
      "--color-accent-text",
    );

    expect(badgeContrast.foreground, themeId).toBe(accentTextColor);
    expect(badgeContrast.ratios[0], themeId).toBeGreaterThanOrEqual(
      MINIMUM_TEXT_CONTRAST,
    );

    await appPage.getByTestId("mode-select-back").click();
    await expect(
      appPage.getByTestId("library-device-drawer-trigger"),
    ).toBeVisible();
  }
});

test("Ocean and Midnight keep primary actions and status text readable", async ({
  electronApp,
  appPage,
}, testInfo) => {
  await appPage.setViewportSize({ width: 1440, height: 900 });

  const cases = [
    {
      themeId: "ocean" as const,
      accuracies: [50, 55, 80, 85],
      improvement: /\+30\.0%/,
      semanticVariable: "--color-success-text",
    },
    {
      themeId: "midnight" as const,
      accuracies: [85, 80, 55, 50],
      improvement: /-30\.0%/,
      semanticVariable: "--color-danger-text",
    },
  ];

  for (const fixture of cases) {
    await writeProgressFixture(electronApp, fixture.accuracies);
    await applyTheme(appPage, fixture.themeId);

    const primaryAction = appPage.getByRole("button", {
      name: "Start Playing",
    });
    await expect(primaryAction).toBeVisible();
    const primaryContrast = await computedContrast(primaryAction, {
      primaryGradient: true,
    });
    expect(primaryContrast.ratios).toHaveLength(2);
    for (const ratio of primaryContrast.ratios) {
      expect(ratio).toBeGreaterThanOrEqual(MINIMUM_TEXT_CONTRAST);
    }

    await saveScreenshot(
      appPage,
      testInfo,
      `${fixture.themeId}-primary-action`,
    );

    await gotoLibrary(appPage);
    await loadFirstBuiltInSong(appPage);
    await appPage.getByTestId("insights-trigger").click();

    const dialog = appPage.getByRole("dialog", { name: "Practice Insights" });
    const bestAccuracyValue = dialog.getByText("85.0%", { exact: true });
    const improvementValue = dialog.getByText(fixture.improvement);
    await expect(bestAccuracyValue).toBeVisible();
    await expect(improvementValue).toBeVisible();
    const accentContrast = await computedContrast(bestAccuracyValue, {
      backgroundFromParent: true,
    });
    const accentTextColor = await computedCssVariable(
      appPage,
      "--color-accent-text",
    );
    expect(accentContrast.foreground).toBe(accentTextColor);
    expect(accentContrast.ratios[0]).toBeGreaterThanOrEqual(
      MINIMUM_TEXT_CONTRAST,
    );

    const statusCard = improvementValue.locator("..");
    const statusContrast = await computedContrast(improvementValue, {
      backgroundFromParent: true,
    });
    const semanticColor = await computedCssVariable(
      appPage,
      fixture.semanticVariable,
    );

    expect(statusContrast.foreground).toBe(semanticColor);
    expect(statusContrast.ratios[0]).toBeGreaterThanOrEqual(
      MINIMUM_TEXT_CONTRAST,
    );
    await expect(statusCard).toHaveCSS(
      "background-color",
      fixture.themeId === "ocean" ? "rgb(234, 241, 234)" : "rgb(35, 42, 51)",
    );

    await saveScreenshot(appPage, testInfo, `${fixture.themeId}-insights`);
  }
});

test("settings and practice controls honor authored typography utilities", async ({
  appPage,
}) => {
  for (const viewport of [
    { width: 1280, height: 800 },
    { width: 960, height: 600 },
  ]) {
    await appPage.setViewportSize(viewport);
    await waitForUiSettled(appPage);
    await gotoLibrary(appPage);
    await startBuiltInSongFromLibrary(appPage, "hot-cross-buns");

    const fullSpeed = appPage.getByRole("button", {
      name: "Set speed to 100%",
    });
    await expect(fullSpeed).toBeVisible();
    const speedStyle = await fullSpeed.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        fontFamily: style.fontFamily,
      };
    });
    expect(speedStyle.fontSize, `${viewport.width} practice speed`).toBe(
      "11px",
    );
    expect(
      Number(speedStyle.fontWeight),
      `${viewport.width} practice weight`,
    ).toBeGreaterThanOrEqual(600);
    expect(speedStyle.fontFamily.toLowerCase()).toMatch(/dm sans/);

    await choosePracticeMode(appPage, "watch");
    await openPlaybackDrawer(appPage);
    await appPage.getByTestId("settings-trigger").click();
    await appPage.getByTestId("settings-mode-toggle").click();

    const quickButton = appPage
      .getByTestId("settings-common-quick")
      .locator("button")
      .first();
    await expect(quickButton).toBeVisible();
    const quickStyle = await quickButton.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        fontFamily: style.fontFamily,
      };
    });
    expect(quickStyle.fontSize, `${viewport.width} settings quick`).toBe(
      "11px",
    );
    expect(
      Number(quickStyle.fontWeight),
      `${viewport.width} settings weight`,
    ).toBeGreaterThanOrEqual(500);
    expect(quickStyle.fontFamily.toLowerCase()).toMatch(/dm sans/);

    await appPage.getByTestId("settings-close").click();
    await closeTopDrawer(appPage);
    await appPage.getByRole("button", { name: "Library" }).click();
    await expect(
      appPage.getByTestId("library-device-drawer-trigger"),
    ).toBeVisible();
  }
});
