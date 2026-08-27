import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures/electronApp";
import {
  choosePracticeMode,
  gotoLibrary,
  openPlaybackDrawer,
  startBuiltInSongFromLibrary,
} from "./helpers/appHarness";

test.skip(true, "Metronome and count-in UI left the live path (#247)");

interface MetronomeFixtureSnapshot {
  isPlaying: boolean;
  currentTime: number;
  countInActive: boolean;
  metronomeEnabled: boolean;
  countInBeats: number;
  isRunning: boolean;
  enabled: boolean;
  countInRemaining: number;
  scheduledClickCount: number;
}

interface MetronomeFixtureWindow extends Window {
  __rexianoGetMetronomeFixtureSnapshot?: () => MetronomeFixtureSnapshot | null;
}

async function readMetronomeSnapshot(
  page: Page,
): Promise<MetronomeFixtureSnapshot | null> {
  return page.evaluate(
    () =>
      (
        window as MetronomeFixtureWindow
      ).__rexianoGetMetronomeFixtureSnapshot?.() ?? null,
  );
}

async function openPracticeSettings(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByTestId("settings-mode-toggle").click();
  await page.getByTestId("settings-tab-practice").click();
}

test("metronome toggle schedules oscillators and stops them when disabled", async ({
  appPage,
}) => {
  await openPracticeSettings(appPage);
  await appPage.getByTestId("toggle-metronome").click();
  await appPage.getByTestId("count-in-beats-0").click();
  await appPage.getByTestId("settings-close").click();

  await gotoLibrary(appPage);
  await startBuiltInSongFromLibrary(appPage, "hot-cross-buns");
  await choosePracticeMode(appPage, "watch");

  await expect
    .poll(
      async () => {
        const snapshot = await readMetronomeSnapshot(appPage);
        return snapshot?.isRunning === true && snapshot.enabled === true;
      },
      { timeout: 15_000 },
    )
    .toBe(true);

  const running = await readMetronomeSnapshot(appPage);
  expect(running).toMatchObject({
    isPlaying: true,
    countInActive: false,
    metronomeEnabled: true,
    isRunning: true,
    enabled: true,
  });

  await openPlaybackDrawer(appPage);
  await appPage.getByTestId("settings-trigger").click();
  await appPage.getByTestId("settings-mode-toggle").click();
  await appPage.getByTestId("settings-tab-practice").click();
  await appPage.getByTestId("toggle-metronome").click();
  await appPage.getByTestId("settings-close").click();

  await expect
    .poll(
      async () => {
        const snapshot = await readMetronomeSnapshot(appPage);
        return (
          snapshot?.isRunning === false && snapshot.scheduledClickCount === 0
        );
      },
      { timeout: 10_000 },
    )
    .toBe(true);
});

test("count-in gates transport until the configured beats have clicked", async ({
  appPage,
}) => {
  await openPracticeSettings(appPage);
  await appPage.getByTestId("toggle-metronome").click();
  await appPage.getByTestId("count-in-beats-4").click();
  await appPage.getByTestId("settings-close").click();
  await expect
    .poll(async () =>
      appPage.evaluate(() => {
        const raw = window.localStorage.getItem("rexiano-settings");
        return raw
          ? (JSON.parse(raw) as { countInBeats?: number }).countInBeats
          : null;
      }),
    )
    .toBe(4);

  await gotoLibrary(appPage);
  await startBuiltInSongFromLibrary(appPage, "hot-cross-buns");
  await choosePracticeMode(appPage, "watch");
  await expect(appPage.getByRole("button", { name: /Pause/ })).toBeVisible();

  await appPage.getByRole("button", { name: "Reset to beginning" }).click();
  const playButton = appPage.getByRole("button", { name: /Play \(/ });
  await expect(playButton).toBeVisible();
  await expect
    .poll(async () => readMetronomeSnapshot(appPage), { timeout: 5_000 })
    .toMatchObject({
      isPlaying: false,
      currentTime: 0,
      countInActive: false,
      metronomeEnabled: true,
      countInBeats: 4,
    });
  await appPage.getByRole("button", { name: /Play \(/ }).click();
  await expect
    .poll(
      async () =>
        appPage.evaluate(
          () =>
            (
              window as Window & {
                __rexianoLastPlaybackStart?: {
                  outcome: string;
                  currentTime: number;
                  countInBeats: number;
                };
              }
            ).__rexianoLastPlaybackStart ?? null,
        ),
      { timeout: 5_000 },
    )
    .toMatchObject({
      outcome: "count-in",
      currentTime: 0,
      countInBeats: 4,
    });

  await expect
    .poll(
      async () => {
        const snapshot = await readMetronomeSnapshot(appPage);
        return snapshot?.countInActive === true ? snapshot : null;
      },
      { timeout: 15_000 },
    )
    .toMatchObject({
      isPlaying: true,
      countInActive: true,
      isRunning: true,
    });

  const gated = await readMetronomeSnapshot(appPage);
  expect(gated?.currentTime ?? 1).toBeLessThan(0.05);

  await expect
    .poll(
      async () => {
        const snapshot = await readMetronomeSnapshot(appPage);
        return snapshot?.countInActive === false &&
          (snapshot.currentTime ?? 0) > 0.2
          ? snapshot.currentTime
          : 0;
      },
      { timeout: 15_000 },
    )
    .toBeGreaterThan(0.2);
});
