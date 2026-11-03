import type { PlaywrightTestConfig } from "@playwright/test";

export const E2E_PORT = 4317;

/**
 * Playwright drives a production build with the e2e fixture surface compiled
 * in (VITE_REXIANO_E2E=1), served by `vite preview`.
 */
export const e2eWebServer: PlaywrightTestConfig["webServer"] = {
  command: `pnpm build:e2e && pnpm exec vite preview --outDir dist-e2e --port ${E2E_PORT} --strictPort`,
  url: `http://localhost:${E2E_PORT}`,
  reuseExistingServer: !process.env.CI,
  timeout: 180_000,
};

export const e2eUse: PlaywrightTestConfig["use"] = {
  baseURL: `http://localhost:${E2E_PORT}`,
  browserName: "chromium",
  viewport: { width: 1280, height: 800 },
  timezoneId: "UTC",
  locale: "en-US",
  permissions: ["midi"],
  actionTimeout: 10_000,
};
