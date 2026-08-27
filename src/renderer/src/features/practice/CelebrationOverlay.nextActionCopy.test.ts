import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { translate } from "@renderer/i18n";
import { en } from "@renderer/locales/en";
import { zhTW } from "@renderer/locales/zh-TW";
import type { TranslationKey } from "@renderer/i18n/types";
import type { PracticeScore } from "@shared/types";
import {
  selectNextPracticeAction,
  type NextPracticeAction,
} from "./nextPracticeAction";

const NEXT_ACTION_TITLE_KEYS: Record<
  NextPracticeAction["kind"],
  TranslationKey
> = {
  "slow-down": "celebration.nextAction.slowDown.title",
  "raise-speed": "celebration.nextAction.raiseSpeed.title",
  "repeat-once": "celebration.nextAction.repeatOnce.title",
  "next-song": "celebration.nextAction.nextSong.title",
};

const NEXT_ACTION_BODY_KEYS: Record<
  NextPracticeAction["kind"],
  TranslationKey
> = {
  "slow-down": "celebration.nextAction.slowDown.body",
  "raise-speed": "celebration.nextAction.raiseSpeed.body",
  "repeat-once": "celebration.nextAction.repeatOnce.body",
  "next-song": "celebration.nextAction.nextSong.body",
};

const LIVE_NEXT_ACTION_KINDS = [
  "slow-down",
  "raise-speed",
  "repeat-once",
  "next-song",
] as const;

const DROPPED_DRILL_COPY = [
  /A-B/i,
  /other hand/i,
  /MIDI note/i,
  /換另一隻手/,
  /專心練一個音/,
  /MIDI 音/,
];

function score(overrides: Partial<PracticeScore> = {}): PracticeScore {
  return {
    totalNotes: 40,
    hitNotes: 32,
    missedNotes: 8,
    accuracy: 80,
    currentStreak: 0,
    bestStreak: 12,
    ...overrides,
  };
}

function formatSpeed(speed: number | undefined): string {
  if (speed === undefined) return "";
  return `${speed.toFixed(2).replace(/\.?0+$/, "")}x`;
}

function playerFacingNextActionCopy(
  lang: "en" | "zh-TW",
  action: NextPracticeAction,
): { title: string; body: string } {
  return {
    title: translate(lang, NEXT_ACTION_TITLE_KEYS[action.kind]),
    body: translate(lang, NEXT_ACTION_BODY_KEYS[action.kind], {
      speed: formatSpeed(action.targetSpeed),
    }),
  };
}

function expectLiveNextActionCopy(action: NextPracticeAction): void {
  expect(LIVE_NEXT_ACTION_KINDS).toContain(action.kind);

  for (const lang of ["en", "zh-TW"] as const) {
    const copy = playerFacingNextActionCopy(lang, action);
    const visible = `${copy.title}\n${copy.body}`;
    for (const pattern of DROPPED_DRILL_COPY) {
      expect(visible).not.toMatch(pattern);
    }
  }
}

describe("CelebrationOverlay next-action player copy", () => {
  test("Wait 85% with a weak measure does not name A-B practice", () => {
    const action = selectNextPracticeAction({
      score: score({ accuracy: 88, missedNotes: 4 }),
      mode: "wait",
      speed: 1,
    });

    expectLiveNextActionCopy(action);
    expect(playerFacingNextActionCopy("en", action).body).not.toContain(
      "Use A-B practice on measure 4",
    );
    expect(playerFacingNextActionCopy("zh-TW", action).body).not.toContain(
      "用 A-B 練習鎖定第 4 小節",
    );
  });

  test("solid one-hand Wait does not coach switching hands", () => {
    const action = selectNextPracticeAction({
      score: score({ accuracy: 90, missedNotes: 4 }),
      mode: "wait",
      speed: 1,
    });

    expectLiveNextActionCopy(action);
    expect(playerFacingNextActionCopy("en", action).title).not.toBe(
      "Try the other hand",
    );
    expect(playerFacingNextActionCopy("zh-TW", action).title).not.toBe(
      "換另一隻手",
    );
  });

  test("overlay-referenced next-action locale strings stay on live steps", () => {
    const overlay = readFileSync(
      resolve(__dirname, "CelebrationOverlay.tsx"),
      "utf8",
    );
    const keys = [
      ...overlay.matchAll(/"(celebration\.nextAction\.[^"]+)"/g),
    ].map((match) => match[1] as TranslationKey);

    expect(keys.length).toBeGreaterThan(0);

    const visible = keys.flatMap((key) => [en[key], zhTW[key]]);
    for (const text of visible) {
      for (const pattern of DROPPED_DRILL_COPY) {
        expect(text).not.toMatch(pattern);
      }
    }
  });
});
