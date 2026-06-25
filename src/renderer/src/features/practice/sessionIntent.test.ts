import { describe, expect, test } from "vitest";
import {
  mapSessionIntentToMode,
  shouldPromptForPracticeMode,
} from "./sessionIntent";

describe("session intent", () => {
  test("practice keeps the saved mode and prompts for detailed mode choice", () => {
    expect(mapSessionIntentToMode("practice", "wait")).toBe("wait");
    expect(mapSessionIntentToMode("practice", "free")).toBe("free");
    expect(shouldPromptForPracticeMode("practice")).toBe(true);
  });

  test("play along maps to free mode and skips the mode prompt", () => {
    expect(mapSessionIntentToMode("play-along", "wait")).toBe("free");
    expect(mapSessionIntentToMode("play-along", "watch")).toBe("free");
    expect(shouldPromptForPracticeMode("play-along")).toBe(false);
  });
});
