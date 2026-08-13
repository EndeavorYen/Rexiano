import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures/electronApp";
import { gotoLibrary, loadFirstBuiltInSong } from "./helpers/appHarness";

interface PracticeLifecycleSnapshot {
  mode: "watch" | "wait" | "free";
  isPlaying: boolean;
  currentTime: number;
  waitState: string | null;
  waitResultCount: number;
  waitTargetCount: number;
  waitTargets: number[];
  engineScoreTotal: number;
  storeScoreTotal: number;
  storeResultCount: number;
}

interface PracticeLifecycleWindow extends Window {
  __rexianoPrepareWaitTargetFixture?: () => Promise<number[] | null>;
  __rexianoSendMidiNoteFixture?: (midi: number) => void;
  __rexianoSetPracticeLifecycleFixtureState?: (state: {
    isPlaying?: boolean;
    mode?: "watch" | "wait" | "free";
    activeTracks?: number[];
  }) => void;
  __rexianoGetPracticeSessionFixtureSnapshot?: () => PracticeLifecycleSnapshot | null;
}

async function loadWaitSession(page: Page): Promise<number[]> {
  await gotoLibrary(page);
  await loadFirstBuiltInSong(page);
  const targets = await page.evaluate(
    () =>
      (
        window as PracticeLifecycleWindow
      ).__rexianoPrepareWaitTargetFixture?.() ?? null,
  );
  expect(targets).not.toBeNull();
  expect(targets?.length).toBeGreaterThan(0);
  return targets as number[];
}

async function readSnapshot(
  page: Page,
): Promise<PracticeLifecycleSnapshot | null> {
  return page.evaluate(
    () =>
      (
        window as PracticeLifecycleWindow
      ).__rexianoGetPracticeSessionFixtureSnapshot?.() ?? null,
  );
}

test.describe("Wait practice lifecycle", () => {
  test("pause and resume preserve the target until mocked MIDI satisfies it", async ({
    appPage,
  }) => {
    const targets = await loadWaitSession(appPage);
    const before = await readSnapshot(appPage);
    expect(before).toMatchObject({
      mode: "wait",
      isPlaying: true,
      waitState: "waiting",
      waitTargets: targets,
      waitResultCount: 0,
      storeScoreTotal: 0,
    });

    await appPage.evaluate(() => {
      (
        window as PracticeLifecycleWindow
      ).__rexianoSetPracticeLifecycleFixtureState?.({ isPlaying: false });
    });
    expect(await readSnapshot(appPage)).toMatchObject({
      isPlaying: false,
      waitState: "waiting",
      waitTargets: targets,
    });

    await appPage.evaluate(() => {
      (
        window as PracticeLifecycleWindow
      ).__rexianoSetPracticeLifecycleFixtureState?.({ isPlaying: true });
    });
    expect(await readSnapshot(appPage)).toMatchObject({
      isPlaying: true,
      waitState: "waiting",
      waitTargets: targets,
      waitResultCount: 0,
    });

    await appPage.evaluate((midi) => {
      (window as PracticeLifecycleWindow).__rexianoSendMidiNoteFixture?.(midi);
    }, targets[0]);
    await expect
      .poll(() => readSnapshot(appPage))
      .toMatchObject({
        waitResultCount: targets.length,
        storeScoreTotal: targets.length,
      });
  });

  test("mode and active-track changes release a frozen Wait scheduler", async ({
    appPage,
  }) => {
    await loadWaitSession(appPage);
    const frozenTime = (await readSnapshot(appPage))?.currentTime ?? 0;

    await appPage.evaluate(() => {
      (
        window as PracticeLifecycleWindow
      ).__rexianoSetPracticeLifecycleFixtureState?.({ mode: "watch" });
    });
    await expect
      .poll(() => readSnapshot(appPage))
      .toMatchObject({
        mode: "watch",
        isPlaying: true,
        waitState: "idle",
        waitTargetCount: 0,
      });
    await expect
      .poll(async () => (await readSnapshot(appPage))?.currentTime ?? 0)
      .toBeGreaterThan(frozenTime);

    await appPage.evaluate(
      () =>
        (
          window as PracticeLifecycleWindow
        ).__rexianoPrepareWaitTargetFixture?.() ?? null,
    );
    await appPage.evaluate(() => {
      (
        window as PracticeLifecycleWindow
      ).__rexianoSetPracticeLifecycleFixtureState?.({ activeTracks: [0] });
    });
    await expect
      .poll(() => readSnapshot(appPage))
      .toMatchObject({
        mode: "wait",
        isPlaying: true,
        waitState: "playing",
        waitTargetCount: 0,
      });
  });

  test("manual reset atomically clears transport and practice accumulators", async ({
    appPage,
  }) => {
    const targets = await loadWaitSession(appPage);
    await appPage.evaluate((midi) => {
      (window as PracticeLifecycleWindow).__rexianoSendMidiNoteFixture?.(midi);
    }, targets[0]);
    await expect
      .poll(async () => (await readSnapshot(appPage))?.storeScoreTotal ?? 0)
      .toBeGreaterThan(0);

    await appPage.getByRole("button", { name: "Reset to beginning" }).click();
    await expect
      .poll(() => readSnapshot(appPage))
      .toMatchObject({
        isPlaying: false,
        currentTime: 0,
        waitState: "idle",
        waitResultCount: 0,
        waitTargetCount: 0,
        engineScoreTotal: 0,
        storeScoreTotal: 0,
        storeResultCount: 0,
      });
  });
});
