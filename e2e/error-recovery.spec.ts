import { test, expect } from "./fixtures/electronApp";
import { gotoLibrary, openLibraryDrawer } from "./helpers/appHarness";

async function dropUnsupportedFile(page: {
  evaluate: (fn: () => void) => Promise<void>;
}): Promise<void> {
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

test.describe("Error recovery", () => {
  test("unsupported import shows a localized recovery action", async ({
    appPage,
  }) => {
    await dropUnsupportedFile(appPage);

    const toast = appPage.getByTestId("file-import-error-toast");
    await expect(toast).toBeVisible();
    await expect(toast).toContainText("Unsupported file type");
    await expect(
      toast.locator("[data-import-recovery-action='choose-midi-file']"),
    ).toBeVisible();
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
