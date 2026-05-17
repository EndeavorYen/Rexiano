import { test, expect } from "./fixtures/electronApp";

test.describe("Post-session next action", () => {
  test("shows a concrete next action on the celebration overlay", async ({
    appPage,
  }) => {
    const result = await appPage.evaluate(() => {
      const e2eWindow = window as typeof window & {
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
      };

      if (!e2eWindow.__rexianoShowCelebrationFixture) {
        return { ok: false, reason: "missing celebration fixture loader" };
      }

      e2eWindow.__rexianoShowCelebrationFixture({
        score: {
          totalNotes: 20,
          hitNotes: 10,
          missedNotes: 10,
          accuracy: 50,
          currentStreak: 0,
          bestStreak: 4,
        },
        mode: "watch",
        speed: 1,
      });

      return { ok: true };
    });

    expect(result).toEqual({ ok: true });

    const nextAction = appPage.getByTestId("celebration-next-action");
    await expect(nextAction).toBeVisible();
    await expect(nextAction).toContainText("Next step");
    await expect(nextAction).toContainText("Slow down");
    await expect(nextAction).toContainText("0.75x");
  });
});
