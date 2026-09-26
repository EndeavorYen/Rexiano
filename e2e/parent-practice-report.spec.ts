import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { test, expect } from "./fixtures/electronApp";
import type { SessionRecord } from "../src/shared/types";

function makeSession(
  id: string,
  now: number,
  daysAgo: number,
  overrides: Partial<SessionRecord> = {},
): SessionRecord {
  return {
    id,
    songId: "scale",
    songTitle: "C Major Scale",
    timestamp: now - daysAgo * 86_400_000,
    mode: "wait",
    speed: 1,
    score: {
      totalNotes: 10,
      hitNotes: 8,
      missedNotes: 2,
      accuracy: 80,
      currentStreak: 0,
      bestStreak: 5,
    },
    durationSeconds: 600,
    tracksPlayed: [0],
    ...overrides,
  };
}

test.describe("Parent practice report", () => {
  test("main menu summarizes weekly and monthly progress from saved sessions", async ({
    electronApp,
    appPage,
  }) => {
    const userDataPath = await electronApp.evaluate(({ app }) =>
      app.getPath("userData"),
    );
    const now = await appPage.evaluate(() => Date.now());
    const sessions: SessionRecord[] = [
      makeSession("scale-1", now, 4, {
        score: {
          totalNotes: 10,
          hitNotes: 6,
          missedNotes: 4,
          accuracy: 60,
          currentStreak: 0,
          bestStreak: 3,
        },
      }),
      makeSession("scale-2", now, 3, {
        score: {
          totalNotes: 10,
          hitNotes: 9,
          missedNotes: 1,
          accuracy: 90,
          currentStreak: 0,
          bestStreak: 8,
        },
      }),
      makeSession("minuet-1", now, 2, {
        songId: "minuet",
        songTitle: "Minuet",
        score: {
          totalNotes: 10,
          hitNotes: 7,
          missedNotes: 3,
          accuracy: 70,
          currentStreak: 0,
          bestStreak: 4,
        },
        durationSeconds: 900,
      }),
      makeSession("minuet-2", now, 1, {
        songId: "minuet",
        songTitle: "Minuet",
        score: {
          totalNotes: 10,
          hitNotes: 7,
          missedNotes: 3,
          accuracy: 72,
          currentStreak: 0,
          bestStreak: 5,
        },
        durationSeconds: 300,
      }),
    ];

    mkdirSync(userDataPath, { recursive: true });
    writeFileSync(
      join(userDataPath, "progress.json"),
      JSON.stringify(sessions, null, 2),
      "utf-8",
    );

    await appPage.reload();
    await appPage.waitForLoadState("domcontentloaded");

    await expect(appPage.getByTestId("parent-practice-report")).toHaveCount(0);
    await expect(
      appPage.getByRole("button", { name: "Start Practice" }),
    ).toBeVisible();
    await expect(appPage.getByTestId("parent-report-monthly")).toContainText(
      "40 min",
    );
  });
});
