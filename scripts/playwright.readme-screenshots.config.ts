import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: ["capture-readme-screenshots.spec.ts"],
  timeout: 90_000,
  fullyParallel: false,
  reporter: [["list"]],
  use: {
    actionTimeout: 10_000,
  },
});
