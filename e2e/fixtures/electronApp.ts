import {
  test as base,
  expect,
  type ElectronApplication,
  type Page,
} from "@playwright/test";
import { _electron as electron } from "playwright";
import { rmSync } from "fs";
import { join } from "path";

interface ElectronFixtures {
  electronApp: ElectronApplication;
  appPage: Page;
}

const SETTINGS_KEY = "rexiano-settings";

export const test = base.extend<ElectronFixtures>({
  // eslint-disable-next-line no-empty-pattern
  electronApp: async ({}, runFixture) => {
    const electronBinary = (await import("electron")).default as string;
    const launchEnv: NodeJS.ProcessEnv = {
      ...process.env,
      TZ: "UTC",
    };
    delete launchEnv.ELECTRON_RUN_AS_NODE;

    const app = await electron.launch({
      executablePath: electronBinary,
      cwd: process.cwd(),
      args: ["."],
      env: launchEnv,
    });

    const userDataPath = await app.evaluate(({ app }) =>
      app.getPath("userData"),
    );
    rmSync(join(userDataPath, "progress.json"), { force: true });
    rmSync(join(userDataPath, "recents.json"), { force: true });

    try {
      await runFixture(app);
    } finally {
      await app.close();
    }
  },

  appPage: async ({ electronApp }, runFixture) => {
    const page = await electronApp.firstWindow();
    await page.waitForLoadState("domcontentloaded");
    await applyStableSettings(page);
    await applyStableRendering(page);
    await waitForUiSettled(page);
    await runFixture(page);
  },
});

export { expect };

export async function waitForUiSettled(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await page.waitForTimeout(150);
}

async function applyStableSettings(page: Page): Promise<void> {
  await page.evaluate((settingsKey: string) => {
    localStorage.setItem(
      settingsKey,
      JSON.stringify({
        language: "en",
        defaultMode: "watch",
        metronomeEnabled: false,
        showNoteLabels: true,
        showFallingNoteLabels: true,
      }),
    );
  }, SETTINGS_KEY);

  await page.reload();
  await page.waitForLoadState("domcontentloaded");
}

async function applyStableRendering(page: Page): Promise<void> {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0ms !important;
        animation-delay: 0ms !important;
        transition-duration: 0ms !important;
        caret-color: transparent !important;
      }
    `,
  });
}
