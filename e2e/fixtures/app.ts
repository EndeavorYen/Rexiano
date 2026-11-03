import { test as base, expect, type Page } from "@playwright/test";

interface AppFixtures {
  /** App page with stable settings, onboarding dismissed and motion disabled */
  appPage: Page;
  /** App page exactly as a first-time visitor sees it */
  freshPage: Page;
}

const SETTINGS_KEY = "rexiano-settings";
const ONBOARDING_KEY = "rexiano-onboarding-completed";

export const test = base.extend<AppFixtures>({
  // Every test runs in a new browser context, so localStorage and
  // IndexedDB start empty — the web equivalent of a fresh user-data folder.
  freshPage: async ({ page }, runFixture) => {
    await page.goto("/");
    await waitForAppDocument(page);
    await runFixture(page);
  },

  appPage: async ({ page }, runFixture) => {
    await page.goto("/");
    await waitForAppDocument(page);
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

export async function waitForAppDocument(page: Page): Promise<void> {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForFunction(() => typeof window.api === "object");
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

// ─── Browser storage helpers (IndexedDB "rexiano" / "records") ──────

async function withRecords<T>(
  page: Page,
  action: { op: "get" | "set"; key: string; value?: unknown },
): Promise<T> {
  return page.evaluate(
    ({ op, key, value }) =>
      new Promise<T>((resolve, reject) => {
        const open = indexedDB.open("rexiano", 1);
        open.onupgradeneeded = () => {
          for (const name of ["records", "files"]) {
            if (!open.result.objectStoreNames.contains(name)) {
              open.result.createObjectStore(name);
            }
          }
        };
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction(
            "records",
            op === "get" ? "readonly" : "readwrite",
          );
          const store = tx.objectStore("records");
          const request = op === "get" ? store.get(key) : store.put(value, key);
          request.onerror = () => reject(request.error);
          tx.oncomplete = () => {
            db.close();
            resolve((op === "get" ? request.result : undefined) as T);
          };
        };
      }),
    action,
  );
}

/** Read a persisted record ("progress" or "recents"). */
export function readStoredRecord<T = unknown>(
  page: Page,
  key: "progress" | "recents",
): Promise<T | undefined> {
  return withRecords<T | undefined>(page, { op: "get", key });
}

/** Seed a persisted record, then reload so the app picks it up. */
export async function seedStoredRecord(
  page: Page,
  key: "progress" | "recents",
  value: unknown,
): Promise<void> {
  await withRecords<void>(page, { op: "set", key, value });
  await page.reload();
  await waitForAppDocument(page);
}
