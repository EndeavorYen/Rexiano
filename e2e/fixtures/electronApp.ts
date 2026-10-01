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

const RM_RETRY = {
  recursive: true,
  force: true,
  maxRetries: 10,
  retryDelay: 200,
} as const;

const SETTINGS_KEY = "rexiano-settings";
const ONBOARDING_KEY = "rexiano-onboarding-completed";

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
    rmSync(userDataPath, RM_RETRY);
    mkdirSync(userDataPath, { recursive: true });

    const launchEnv: NodeJS.ProcessEnv = {
      ...process.env,
      REXIANO_E2E: "1",
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
      // Electron's helper processes can hold the profile for a moment after
      // close; retry instead of failing the test on EPERM.
      rmSync(userDataPath, RM_RETRY);
    }
  },

  appPage: async ({ electronApp }, runFixture) => {
    const page = await electronApp.firstWindow();
    await waitForAppDocument(page);
    // Keyboard-focus assertions need the window itself to be active. The
    // window stays hidden until ready-to-show, and focusing it before then
    // does nothing.
    await expect
      .poll(() =>
        electronApp.evaluate(({ BrowserWindow }) => {
          const win = BrowserWindow.getAllWindows()[0];
          if (!win?.isVisible()) return false;
          win.focus();
          return true;
        }),
      )
      .toBe(true);
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
    ({ settingsKey, onboardingKey }) => {
      localStorage.setItem(
        settingsKey,
        JSON.stringify({
          language: "en",
          defaultMode: "watch",
          metronomeEnabled: false,
          countInBeats: 0,
          showNoteLabels: true,
          showFallingNoteLabels: true,
        }),
      );
      localStorage.setItem(onboardingKey, "1");
    },
    { settingsKey: SETTINGS_KEY, onboardingKey: ONBOARDING_KEY },
  );

  await page.reload();
  await waitForAppDocument(page);
}

/**
 * The first window can report about:blank before it navigates to the app.
 * Wait for the real document so evaluate() never runs on an opaque origin
 * or in a context that is about to be destroyed by that navigation.
 */
export async function waitForAppDocument(page: Page): Promise<void> {
  await page.waitForURL(
    (url) => url.protocol === "file:" || url.hostname === "localhost",
  );
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
