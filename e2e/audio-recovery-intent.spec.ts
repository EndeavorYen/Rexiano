import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures/electronApp";
import {
  choosePracticeMode,
  gotoLibrary,
  openPlaybackDrawer,
  startBuiltInSongFromLibrary,
} from "./helpers/appHarness";

interface AudioRecoveryFixtureWindow extends Window {
  __rexianoSetAudioRecoveryDelayFixture?: (delayMs: number) => void;
}

async function readTransportTime(page: Page): Promise<number> {
  return Number(
    await page.getByRole("slider", { name: "Seek position" }).inputValue(),
  );
}

test("delayed audio recovery keeps active playback monotonic", async ({
  appPage,
}) => {
  await gotoLibrary(appPage);
  await startBuiltInSongFromLibrary(appPage, "chopsticks");
  await choosePracticeMode(appPage, "watch");

  await expect
    .poll(() => readTransportTime(appPage), { timeout: 20_000 })
    .toBeGreaterThan(0.4);

  const fixtureReady = await appPage.evaluate(() => {
    const e2eWindow = window as AudioRecoveryFixtureWindow;
    e2eWindow.__rexianoSetAudioRecoveryDelayFixture?.(700);
    return Boolean(e2eWindow.__rexianoSetAudioRecoveryDelayFixture);
  });
  expect(fixtureReady).toBe(true);

  await openPlaybackDrawer(appPage);
  await appPage.getByTestId("settings-trigger").click();
  await appPage.getByTestId("settings-mode-toggle").click();
  await appPage.getByTestId("settings-tab-audio").click();
  await appPage.getByTestId("toggle-audio-compatibility").click();

  const samples: number[] = [];
  for (let sample = 0; sample < 24; sample++) {
    samples.push(await readTransportTime(appPage));
    await appPage.waitForTimeout(75);
  }

  for (let index = 1; index < samples.length; index++) {
    expect(samples[index]).toBeGreaterThanOrEqual(samples[index - 1] - 0.08);
  }
  expect(samples.at(-1) ?? 0).toBeGreaterThan(samples[0] + 0.5);
});
