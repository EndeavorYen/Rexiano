const STORAGE_KEY = "rexiano-onboarding-completed";

/** Reset onboarding state (for testing or re-showing). */
export function resetOnboarding(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* noop */
  }
}
