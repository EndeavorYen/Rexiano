import { describe, expect, test } from "vitest";
import {
  mapSessionIntentToMode,
  shouldPromptForPracticeMode,
} from "./sessionIntent";

describe("session intent", () => {
  test("practice keeps Watch/Wait and maps leftover Free to Watch", () => {
    expect(mapSessionIntentToMode("practice", "wait")).toBe("wait");
    expect(mapSessionIntentToMode("practice", "watch")).toBe("watch");
    expect(mapSessionIntentToMode("practice", "free")).toBe("watch");
    expect(shouldPromptForPracticeMode("practice")).toBe(true);
  });

  test("play along stays on the live Watch/Wait surface and skips the mode prompt", () => {
    expect(mapSessionIntentToMode("play-along", "wait")).toBe("wait");
    expect(mapSessionIntentToMode("play-along", "watch")).toBe("watch");
    expect(mapSessionIntentToMode("play-along", "free")).toBe("watch");
    expect(shouldPromptForPracticeMode("play-along")).toBe(false);
  });
});
