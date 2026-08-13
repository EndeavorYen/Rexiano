import { test, expect } from "./fixtures/electronApp";
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
      readFileSync(resolve("resources/midi/hot-cross-buns.mid")),
    );
    await dropMidiBytes(appPage, midiBytes);
    await expect(toast).toBeHidden();
    await expect(appPage.getByTestId("mode-select-watch")).toBeVisible();
  });

  test("real missing-path failure persists and restores focus after keyboard recovery", async ({
    appPage,
  }) => {
    await gotoLibrary(appPage);
    const importLauncher = appPage.getByRole("button", {
      name: "Import your own MIDI file",
    });
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

  test("Space activates import recovery without toggling background playback", async ({
    appPage,
  }) => {
    await gotoLibrary(appPage);
    await loadFirstBuiltInSong(appPage);

    const launcher = appPage.getByTestId("insights-trigger");
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
    await expect(playbackControl).toHaveAttribute(
      "aria-label",
      playbackNameBeforeSpace ?? "",
    );
  });

  test("MIDI drawer shows actionable guidance when Web MIDI is unavailable", async ({
    appPage,
  }) => {
    await appPage.addInitScript(() => {
      Object.defineProperty(navigator, "requestMIDIAccess", {
        configurable: true,
        value: undefined,
      });
    });
    await appPage.reload();
    await appPage.waitForLoadState("domcontentloaded");

    await gotoLibrary(appPage);
    const drawer = await openLibraryDrawer(appPage);

    const guidance = drawer.getByTestId("midi-error-guidance");
    await expect(guidance).toBeVisible();
    await expect(guidance).toContainText("MIDI is not supported here");
  });
});
