import { test, expect } from "./fixtures/electronApp";

interface PracticeFixtureSnapshot {
  mode: "watch" | "wait" | "free";
  isPlaying: boolean;
  currentTime: number;
  waitState: string | null;
  waitResultCount: number;
  waitTargetCount: number;
  engineScoreTotal: number;
  storeScoreTotal: number;
  storeResultCount: number;
}

interface PracticeFixtureWindow extends Window {
  __rexianoShowCelebrationFixture?: (fixture: {
    score: {
      totalNotes: number;
      hitNotes: number;
      missedNotes: number;
      accuracy: number;
      currentStreak: number;
      bestStreak: number;
    };
    mode: "watch" | "wait" | "free";
    speed: number;
  }) => void;
  __rexianoPrimePracticeSessionFixture?: () => boolean;
  __rexianoGetPracticeSessionFixtureSnapshot?: () => PracticeFixtureSnapshot | null;
}

const completedScore = {
  totalNotes: 20,
  hitNotes: 10,
  missedNotes: 10,
  accuracy: 50,
  currentStreak: 0,
  bestStreak: 4,
};

async function showWaitCelebration(
  appPage: import("@playwright/test").Page,
): Promise<PracticeFixtureSnapshot> {
  const shown = await appPage.evaluate((score) => {
    const e2eWindow = window as PracticeFixtureWindow;
    if (!e2eWindow.__rexianoShowCelebrationFixture) return false;
    e2eWindow.__rexianoShowCelebrationFixture({
      score,
      mode: "wait",
      speed: 0.75,
    });
    return true;
  }, completedScore);
  expect(shown).toBe(true);
  await expect(appPage.getByTestId("celebration-overlay")).toBeVisible();

  await expect
    .poll(() =>
      appPage.evaluate(
        () =>
          (
            window as PracticeFixtureWindow
          ).__rexianoPrimePracticeSessionFixture?.() ?? false,
      ),
    )
    .toBe(true);

  const before = await appPage.evaluate(
    () =>
      (
        window as PracticeFixtureWindow
      ).__rexianoGetPracticeSessionFixtureSnapshot?.() ?? null,
  );
  expect(before).not.toBeNull();
  expect(before?.waitResultCount).toBeGreaterThan(1);
  expect(before?.engineScoreTotal).toBeGreaterThan(0);
  expect(before?.storeScoreTotal).toBeGreaterThan(0);
  return before as PracticeFixtureSnapshot;
}

async function expectFreshWaitRetry(
  appPage: import("@playwright/test").Page,
  before: PracticeFixtureSnapshot,
): Promise<void> {
  await expect(
    appPage.getByRole("button", { name: "Pause (Space)" }),
  ).toBeVisible({ timeout: 20_000 });

  await expect
    .poll(() =>
      appPage.evaluate(
        () =>
          (
            window as PracticeFixtureWindow
          ).__rexianoGetPracticeSessionFixtureSnapshot?.() ?? null,
      ),
    )
    .toMatchObject({
      mode: "wait",
      isPlaying: true,
      engineScoreTotal: 0,
      storeScoreTotal: 0,
      storeResultCount: 0,
    });

  const after = await appPage.evaluate(
    () =>
      (
        window as PracticeFixtureWindow
      ).__rexianoGetPracticeSessionFixtureSnapshot?.() ?? null,
  );
  expect(after).not.toBeNull();
  expect(after?.currentTime ?? 1).toBeLessThan(0.5);
  expect(after?.waitResultCount ?? before.waitResultCount).toBeLessThan(
    before.waitResultCount,
  );
}

test.describe("Post-session next action", () => {
  test("shows a concrete next action on the celebration overlay", async ({
    appPage,
  }) => {
    await appPage.clock.install();
    await appPage.clock.pauseAt(new Date("2030-01-01T00:00:00Z"));

    const result = await appPage.evaluate((score) => {
      const e2eWindow = window as typeof window & {
        __rexianoShowCelebrationFixture?: (fixture: {
          score: typeof completedScore;
          mode: "watch" | "wait" | "free";
          speed: number;
        }) => void;
      };

      if (!e2eWindow.__rexianoShowCelebrationFixture) {
        return { ok: false, reason: "missing celebration fixture loader" };
      }

      e2eWindow.__rexianoShowCelebrationFixture({
        score,
        mode: "watch",
        speed: 1,
      });

      return { ok: true };
    }, completedScore);

    expect(result).toEqual({ ok: true });

    const nextAction = appPage.getByTestId("celebration-next-action");
    await expect(nextAction).toBeVisible();
    await expect(nextAction).toContainText("Next step");
    await expect(nextAction).toContainText("Slow down");
    await expect(nextAction).toContainText("0.75x");
  });

  test("celebration retry starts a fresh Wait session", async ({ appPage }) => {
    const before = await showWaitCelebration(appPage);

    await appPage.getByTestId("celebration-again").click();
    await expect(appPage.getByTestId("celebration-overlay")).toHaveCount(0);
    await expectFreshWaitRetry(appPage, before);
  });

  test("statistics retry uses the same fresh-session reset path", async ({
    appPage,
  }) => {
    const before = await showWaitCelebration(appPage);
    await appPage.getByTestId("celebration-choose-song").click();
    await expect(appPage.getByTestId("statistics-page")).toBeVisible();

    await appPage.getByTestId("stats-play-again").click();
    await expect(appPage.getByTestId("statistics-page")).toHaveCount(0);
    await expectFreshWaitRetry(appPage, before);
  });
});
