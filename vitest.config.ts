/**
 * Vitest configuration — mirrors electron-vite's alias structure.
 * Tests run in Node environment (default). Coverage uses v8 provider.
 * Entrypoints (App.tsx, main/index.ts) are excluded from coverage —
 * they are integration-tested via Playwright E2E, not unit tests.
 */
import { resolve } from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@renderer": resolve(__dirname, "src/renderer/src"),
      "@shared": resolve(__dirname, "src/shared"),
    },
  },
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.ts", "src/**/*.tsx"],
      exclude: [
        "src/**/*.test.ts",
        "src/**/*.test.tsx",
        "src/**/*.d.ts",
        "src/**/index.ts",
        "src/preload/**",
        "src/main/index.ts",
        "src/renderer/src/App.tsx",
        "src/renderer/src/main.tsx",
      ],
      thresholds: {
        statements: 70,
        lines: 70,
      },
    },
  },
});
