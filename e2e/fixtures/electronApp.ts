import {
  test as base,
  expect,
  type ElectronApplication,
  type Page,
} from "@playwright/test";
import { _electron as electron } from "playwright";
import { mkdirSync, rmSync } from "fs";
import { join } from "path";
import { createE2eUserDataPath } from "./e2eUserData";

interface ElectronFixtures {
  electronApp: ElectronApplication;
  appPage: Page;
}

const SETTINGS_KEY = "rexiano-settings";
const E2E_FIXTURES_KEY = "rexiano-e2e-fixtures";

export const test = base.extend<ElectronFixtures>({
  // eslint-disable-next-line no-empty-pattern
  electronApp: async ({}, runFixture, testInfo) => {
    const electronBinary = (await import("electron")).default as string;
    const userDataPath = createE2eUserDataPath({
      outputDir: testInfo.outputDir,
      projectName: testInfo.project.name,
      workerIndex: testInfo.workerIndex,
      testId: testInfo.testId,
    });
    rmSync(userDataPath, { recursive: true, force: true });
    mkdirSync(userDataPath, { recursive: true });

    const launchEnv: NodeJS.ProcessEnv = {
      ...process.env,
      REXIANO_USER_DATA_DIR: userDataPath,
      TZ: "UTC",
    };
    delete launchEnv.ELECTRON_RUN_AS_NODE;

    const app = await electron.launch({
      executablePath: electronBinary,
      cwd: process.cwd(),
      args: ["."],
      env: launchEnv,
    });

    const actualUserDataPath = await app.evaluate(({ app }) =>
      app.getPath("userData"),
    );
    rmSync(join(actualUserDataPath, "progress.json"), { force: true });
    rmSync(join(actualUserDataPath, "recents.json"), { force: true });

    try {
      await runFixture(app);
    } finally {
      await app.close();
      rmSync(userDataPath, { recursive: true, force: true });
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
  await page.evaluate(
    ({ settingsKey, fixturesKey }) => {
      localStorage.setItem(fixturesKey, "1");
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
    },
    { settingsKey: SETTINGS_KEY, fixturesKey: E2E_FIXTURES_KEY },
  );

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
