import { defineConfig } from "@playwright/test";
import { e2eUse, e2eWebServer } from "../e2e/webServer";
import { resolve } from "node:path";
import { chdir } from "node:process";

chdir(resolve(__dirname, ".."));

export default defineConfig({
  testDir: ".",
  testMatch: ["paid-customer-audit.spec.ts"],
  timeout: 90_000,
  fullyParallel: false,
  reporter: [["list"]],
  expect: {
    timeout: 10_000,
  },
  use: e2eUse,
  webServer: e2eWebServer,
});
