import { describe, expect, test } from "vitest";
import {
  mapSessionIntentToMode,
  shouldPromptForPracticeMode,
} from "./sessionIntent";

describe("session intent", () => {
  test("practice keeps the saved mode and prompts for detailed mode choice", () => {
    expect(mapSessionIntentToMode("practice", "wait")).toBe("wait");
    expect(mapSessionIntentToMode("practice", "free")).toBe("wait");
    expect(shouldPromptForPracticeMode("practice")).toBe(true);
  });

  test("play along maps to Wait and skips the mode prompt", () => {
    expect(mapSessionIntentToMode("play-along", "wait")).toBe("wait");
    expect(mapSessionIntentToMode("play-along", "watch")).toBe("wait");
    expect(shouldPromptForPracticeMode("play-along")).toBe(false);
  });
});
