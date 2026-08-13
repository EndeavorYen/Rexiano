import { test as base, expect } from "@playwright/test";
import { _electron as electron } from "playwright";
import { execFile } from "child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { basename, join, resolve } from "path";
import { promisify } from "util";

const sourceMidiPath = resolve("resources/midi/hot-cross-buns.mid");
const execFileAsync = promisify(execFile);

function createLaunchEnv(userDataPath: string): NodeJS.ProcessEnv {
  const env = {
    ...process.env,
    REXIANO_E2E: "1",
    REXIANO_USER_DATA_DIR: userDataPath,
    TZ: "UTC",
  };
  delete env.ELECTRON_RUN_AS_NODE;
  return env;
}

base("routes cold-start and warm-instance file associations", async () => {
  const electronBinary = (await import("electron")).default as string;
  const testRoot = mkdtempSync(join(tmpdir(), "rexiano-file-association-"));
  const userDataPath = join(testRoot, "user-data");
  const coldMidiPath = join(testRoot, "cold lesson.mid");
  const warmMidiPath = join(testRoot, "warm lesson.midi");
  mkdirSync(userDataPath, { recursive: true });
  copyFileSync(sourceMidiPath, coldMidiPath);
  copyFileSync(sourceMidiPath, warmMidiPath);

  const primary = await electron.launch({
    executablePath: electronBinary,
    cwd: process.cwd(),
    args: [".", coldMidiPath],
    env: createLaunchEnv(userDataPath),
  });

  try {
    const page = await primary.firstWindow();
    await page.waitForLoadState("domcontentloaded");
    await expect(page.getByTestId("playback-song-title")).toHaveText(
      basename(coldMidiPath),
    );
    await expect(page.getByTestId("mode-selection-backdrop")).toBeVisible();

    await execFileAsync(electronBinary, [".", warmMidiPath], {
      cwd: process.cwd(),
      env: createLaunchEnv(userDataPath),
    });

    await expect(page.getByTestId("playback-song-title")).toHaveText(
      basename(warmMidiPath),
    );
  } finally {
    await primary.close();
    rmSync(testRoot, { recursive: true, force: true });
  }
});
