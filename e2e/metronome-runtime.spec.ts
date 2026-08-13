import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures/electronApp";
import {
  choosePracticeMode,
  gotoLibrary,
  openPlaybackDrawer,
  startBuiltInSongFromLibrary,
} from "./helpers/appHarness";

interface MetronomeFixtureSnapshot {
  isPlaying: boolean;
  currentTime: number;
  countInActive: boolean;
  metronomeEnabled: boolean;
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
        return snapshot?.scheduledClickCount ?? 0;
      },
      { timeout: 15_000 },
    )
    .toBeGreaterThan(0);

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

  await gotoLibrary(appPage);
  await startBuiltInSongFromLibrary(appPage, "hot-cross-buns");
  await choosePracticeMode(appPage, "watch");

  await expect
    .poll(
      async () => {
        const snapshot = await readMetronomeSnapshot(appPage);
        return snapshot?.countInActive === true &&
          (snapshot.scheduledClickCount ?? 0) > 0
          ? snapshot
          : null;
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
