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
    include: [
      "src/**/*.test.ts",
      "scripts/**/*.test.ts",
      "e2e/fixtures/**/*.test.ts",
    ],
  },
});
