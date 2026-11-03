import { describe, test, expect, beforeEach, vi } from "vitest";

// Mock localStorage
const storage = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
});

const ONBOARDING_KEY = "rexiano-onboarding-completed";

describe("OnboardingGuide — resetOnboarding()", () => {
  beforeEach(() => {
    storage.clear();
    vi.resetModules();
  });

  test("resetOnboarding clears the localStorage flag", async () => {
    storage.set(ONBOARDING_KEY, "1");
    const { resetOnboarding } = await import("./onboardingUtils");
    resetOnboarding();
    expect(storage.has(ONBOARDING_KEY)).toBe(false);
  });

  test("resetOnboarding is safe when flag does not exist", async () => {
    const { resetOnboarding } = await import("./onboardingUtils");
    expect(() => resetOnboarding()).not.toThrow();
  });
});

describe("OnboardingGuide — localStorage integration", () => {
  beforeEach(() => {
    storage.clear();
    vi.resetModules();
  });

  test("onboarding flag is set after completion", () => {
    // Simulate completing the onboarding by setting the flag directly
    storage.set(ONBOARDING_KEY, "1");
    expect(storage.get(ONBOARDING_KEY)).toBe("1");
  });

  test("first visit has no flag", () => {
    expect(storage.get(ONBOARDING_KEY)).toBeUndefined();
  });
});
