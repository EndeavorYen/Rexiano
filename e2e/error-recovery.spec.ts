import {
  test,
  expect,
  readStoredRecord,
  seedStoredRecord,
} from "./fixtures/app";
import {
  gotoLibrary,
  loadFirstBuiltInSong,
  openLibraryDrawer,
} from "./helpers/appHarness";
import { readFileSync } from "fs";
import { resolve } from "path";
import type { Page } from "@playwright/test";

async function enterAndLeaveDrag(page: Page): Promise<void> {
  await page.evaluate(() => {
    const target = document.querySelector(".app-shell") ?? document.body;
    const dataTransfer = new DataTransfer();
    target.dispatchEvent(
      new DragEvent("dragenter", {
        bubbles: true,
        cancelable: true,
        dataTransfer,
      }),
    );
    target.dispatchEvent(
      new DragEvent("dragleave", {
        bubbles: true,
        cancelable: true,
        dataTransfer,
      }),
    );
  });
}

async function dropMidiBytes(page: Page, bytes: number[]): Promise<void> {
  await page.evaluate((midiBytes) => {
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(
      new File([new Uint8Array(midiBytes)], "recovered.mid", {
        type: "audio/midi",
      }),
    );
    const target = document.querySelector(".app-shell") ?? document.body;
    target.dispatchEvent(
      new DragEvent("drop", {
        bubbles: true,
        cancelable: true,
        dataTransfer,
      }),
    );
  }, bytes);
}

async function dropUnsupportedFile(page: Page): Promise<void> {
  await page.evaluate(() => {
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(
      new File(["not a midi"], "score.pdf", { type: "application/pdf" }),
    );

    const target = document.querySelector(".app-shell") ?? document.body;
    target.dispatchEvent(
      new DragEvent("dragenter", {
        bubbles: true,
        cancelable: true,
        dataTransfer,
      }),
    );
    target.dispatchEvent(
      new DragEvent("drop", {
        bubbles: true,
        cancelable: true,
        dataTransfer,
      }),
    );
  });
}

async function triggerMissingImport(page: Page, path: string): Promise<void> {
  const triggered = await page.evaluate(async (missingPath) => {
    const e2eWindow = window as typeof window & {
      __rexianoTriggerMissingMidiImport?: (path: string) => Promise<void>;
    };
    if (!e2eWindow.__rexianoTriggerMissingMidiImport) return false;
    await e2eWindow.__rexianoTriggerMissingMidiImport(missingPath);
    return true;
  }, path);
  expect(triggered).toBe(true);
}

test.describe("Error recovery", () => {
  test("unsupported import is announced with labelled keyboard recovery", async ({
    appPage,
  }) => {
    await dropUnsupportedFile(appPage);

    const toast = appPage.getByTestId("file-import-error-toast");
    await expect(toast).toBeVisible();
    await expect(toast).toHaveAttribute("role", "alert");
    await expect(toast).toHaveAttribute("aria-live", "assertive");
    await expect(toast).toHaveAttribute("aria-atomic", "true");
    await expect(toast).toContainText("Unsupported file type");
    await expect(
      toast.getByRole("group", { name: "Import recovery actions" }),
    ).toBeVisible();
    await expect(
      toast.locator("[data-import-recovery-action='choose-midi-file']"),
    ).toBeVisible();
    await expect(toast.getByRole("button", { name: "Close" })).toBeVisible();

    await enterAndLeaveDrag(appPage);
    await expect(toast).toBeVisible();

    const midiBytes = Array.from(
      readFileSync(resolve("public/midi/hot-cross-buns.mid")),
    );
    await dropMidiBytes(appPage, midiBytes);
    await expect(toast).toBeHidden();
    await expect(appPage.getByTestId("mode-select-watch")).toBeVisible();
  });

  test("real missing-path failure persists and restores focus after keyboard recovery", async ({
    appPage,
  }) => {
    await gotoLibrary(appPage);
    const importLauncher = appPage.getByTestId("library-import-file");
    await importLauncher.focus();
    await expect(importLauncher).toBeFocused();

    await triggerMissingImport(appPage, "/__rexiano_e2e__/first-missing.mid");
    const alert = appPage.getByRole("alert");
    await expect(alert).toContainText("Recent file is no longer available");
    await expect(alert).toContainText("first-missing.mid");
    await expect(importLauncher).toBeFocused();

    await enterAndLeaveDrag(appPage);
    await expect(alert).toBeVisible();
    await expect(alert).toContainText("first-missing.mid");

    // Recovery controls must not disappear before keyboard users can reach them.
    await appPage.waitForTimeout(4_200);
    await expect(alert).toBeVisible();

    const close = alert.getByRole("button", { name: "Close" });
    await close.focus();
    await expect(close).toBeFocused();
    await appPage.keyboard.press("Enter");
    await expect(alert).toBeHidden();
    await expect(importLauncher).toBeFocused();

    await triggerMissingImport(appPage, "/__rexiano_e2e__/second-missing.mid");
    await expect(alert).toContainText("second-missing.mid");
    const remove = alert.getByRole("button", { name: "Remove from recents" });
    await remove.focus();
    await appPage.keyboard.press("Enter");
    await expect(alert).toBeHidden();
    await expect(importLauncher).toBeFocused();
  });

  test("confirmed removal immediately clears a real stale main-menu recent", async ({
    appPage,
  }) => {
    await seedStoredRecord(appPage, "recents", [
      {
        path: "local:0000dead/moved-away.mid",
        name: "moved-away.mid",
        timestamp: Date.now(),
      },
    ]);

    const staleCard = appPage.getByTitle("moved-away.mid");
    await expect(staleCard).toBeVisible();
    await staleCard.click();

    const alert = appPage.getByRole("alert");
    await expect(alert).toContainText("Recent file is no longer available");
    const remove = alert.getByRole("button", { name: "Remove from recents" });
    await remove.focus();
    await appPage.keyboard.press("Enter");

    await expect(alert).toBeHidden();
    await expect(staleCard).toBeHidden();
    await expect(
      appPage.getByRole("button", { name: "Start Playing" }),
    ).toBeFocused();
    await expect.poll(() => readStoredRecord(appPage, "recents")).toEqual([]);
  });

  test("library recovery removes the stale recent from the main menu too", async ({
    appPage,
  }) => {
    await seedStoredRecord(appPage, "recents", [
      {
        path: "local:0000dead/library-moved-away.mid",
        name: "library-moved-away.mid",
        timestamp: Date.now(),
      },
    ]);
    await gotoLibrary(appPage);

    const continueRecent = appPage.getByTestId("song-library-continue");
    await expect(continueRecent).toContainText("library-moved-away.mid");
    await continueRecent.getByRole("button").click();
    const recovery = appPage.getByTestId("recent-file-recovery");
    await expect(recovery).toBeVisible();
    await recovery.getByTestId("recent-file-remove-stale").click();

    await expect(continueRecent).toBeHidden();
    await appPage.getByRole("button", { name: "Close / Back" }).click();
    await expect(appPage.getByTitle("library-moved-away.mid")).toBeHidden();
    await expect.poll(() => readStoredRecord(appPage, "recents")).toEqual([]);
  });

  test("failed removal keeps recovery and stale cards available in both views", async ({
    appPage,
  }) => {
    await seedStoredRecord(appPage, "recents", [
      {
        path: "local:0000dead/read-only-recent.mid",
        name: "read-only-recent.mid",
        timestamp: Date.now(),
      },
    ]);
    await gotoLibrary(appPage);

    const continueRecent = appPage.getByTestId("song-library-continue");
    await continueRecent.getByRole("button").click();
    const libraryRecovery = appPage.getByTestId("recent-file-recovery");
    await expect(libraryRecovery).toBeVisible();

    // Simulate browser storage refusing the write.
    await appPage.evaluate(() => {
      window.api.removeRecentFile = async () => {
        throw new Error("storage is read-only");
      };
    });
    const libraryFailure = appPage.waitForEvent(
      "console",
      (message) =>
        message.type() === "error" &&
        message.text().includes("Failed to remove recent MIDI file"),
    );
    await libraryRecovery.getByTestId("recent-file-remove-stale").click();
    await libraryFailure;
    await expect(libraryRecovery).toBeVisible();
    await expect(continueRecent).toContainText("read-only-recent.mid");

    await appPage.getByRole("button", { name: "Close / Back" }).click();
    const mainMenuCard = appPage.getByRole("button", {
      name: /^read-only-recent\.mid/,
    });
    await expect(mainMenuCard).toBeVisible();
    await mainMenuCard.click();
    const mainMenuRecovery = appPage.getByRole("alert");
    await expect(mainMenuRecovery).toBeVisible();
    const mainMenuFailure = appPage.waitForEvent(
      "console",
      (message) =>
        message.type() === "error" &&
        message.text().includes("Failed to remove recent MIDI file"),
    );
    await mainMenuRecovery
      .getByRole("button", { name: "Remove from recents" })
      .click();
    await mainMenuFailure;

    await expect(mainMenuRecovery).toBeVisible();
    await expect(mainMenuCard).toBeVisible();
  });

  test("Space activates import recovery without toggling background playback", async ({
    appPage,
  }) => {
    await gotoLibrary(appPage);
    await loadFirstBuiltInSong(appPage);

    const launcher = appPage.getByTestId("playback-drawer-trigger");
    const playbackControl = appPage
      .getByTestId("transport-strip")
      .getByRole("button", { name: /Play \(Space\)|Pause \(Space\)/ });
    const playbackNameBeforeSpace =
      await playbackControl.getAttribute("aria-label");
    await launcher.focus();
    await triggerMissingImport(appPage, "/__rexiano_e2e__/space-recovery.mid");

    const alert = appPage.getByRole("alert");
    const close = alert.getByRole("button", { name: "Close" });
    await close.focus();
    await appPage.keyboard.press("Space");

    await expect(alert).toBeHidden();
    await expect(launcher).toBeFocused();
    await expect(appPage.getByTestId("insights-trigger")).toHaveCount(0);
    await expect(playbackControl).toHaveAttribute(
      "aria-label",
      playbackNameBeforeSpace ?? "",
    );
  });

  test("piano drawer sends browsers without Web Bluetooth to a browser that works", async ({
    appPage,
  }) => {
    await appPage.addInitScript(() => {
      Object.defineProperty(navigator, "bluetooth", {
        configurable: true,
        value: undefined,
      });
      delete (navigator as { bluetooth?: unknown }).bluetooth;
    });
    await appPage.reload();
    await appPage.waitForLoadState("domcontentloaded");

    await gotoLibrary(appPage);
    const drawer = await openLibraryDrawer(appPage);

    const guide = drawer.getByTestId("piano-browser-guide");
    await expect(guide).toBeVisible();
    await expect(guide).toContainText("Chrome or Edge");
    await expect(drawer.getByTestId("piano-connect-bluetooth")).toHaveCount(0);
  });

  test("iPad Safari is pointed to Bluefy", async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 1024, height: 768 },
      userAgent:
        "Mozilla/5.0 (iPad; CPU OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1",
    });
    const page = await context.newPage();
    await page.addInitScript(() => {
      localStorage.setItem("rexiano-onboarding-completed", "1");
      localStorage.setItem(
        "rexiano-settings",
        JSON.stringify({ language: "en" }),
      );
      delete (navigator as { bluetooth?: unknown }).bluetooth;
    });
    await page.goto("/");
    await page.getByTestId("main-menu-settings").click();
    const guide = page.getByTestId("piano-browser-guide-ios");
    await expect(guide).toBeVisible();
    await expect(
      guide.getByRole("link", { name: "Get Bluefy" }),
    ).toHaveAttribute("href", "https://apps.apple.com/app/id1492822055");
    await context.close();
  });
});
