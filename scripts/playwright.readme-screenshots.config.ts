import { defineConfig } from "@playwright/test";
import { e2eUse, e2eWebServer } from "../e2e/webServer";

export default defineConfig({
  testDir: ".",
  testMatch: ["capture-readme-screenshots.spec.ts"],
  timeout: 90_000,
  fullyParallel: false,
  reporter: [["list"]],
  use: e2eUse,
  webServer: e2eWebServer,
});
