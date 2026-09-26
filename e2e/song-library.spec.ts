import { readFileSync } from "fs";
import { resolve } from "path";
import { test, expect } from "./fixtures/electronApp";
import { gotoLibrary, loadFirstBuiltInSong } from "./helpers/appHarness";

async function dropMidiBytes(page: {
  evaluate: (fn: (midiBytes: number[]) => void, arg: number[]) => Promise<void>;
}): Promise<void> {
  const midiBytes = Array.from(
    readFileSync(resolve("resources/midi/c-major-scale.mid")),
  );
  await page.evaluate((bytes) => {
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(
      new File([new Uint8Array(bytes)], "c-major-scale.mid", {
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
  }, midiBytes);
}

test.describe("Song library live path", () => {
  test("shows MIDI import and built-in songs", async ({ appPage }) => {
    await gotoLibrary(appPage);

    await expect(
      appPage.getByRole("button", { name: "Import your own MIDI file" }),
    ).toBeVisible();
    await expect(
      appPage.getByTestId("song-select-hot-cross-buns"),
    ).toBeVisible();
  });

  test("loads a built-in song into Watch/Wait with falling notes and keyboard", async ({
    appPage,
  }) => {
    await gotoLibrary(appPage);
    await loadFirstBuiltInSong(appPage);

    await expect(appPage.getByTestId("mode-select-watch")).toHaveCount(0);
    await expect(appPage.getByTestId("practice-mode-watch")).toBeVisible();
    await expect(appPage.getByTestId("practice-mode-wait")).toBeVisible();
    await expect(appPage.getByTestId("practice-mode-free")).toHaveCount(0);
    await expect(appPage.getByTestId("falling-notes-panel")).toBeVisible();
    await expect(appPage.getByTestId("piano-keyboard")).toBeVisible();
  });

  test("imports a dropped MIDI file into Watch/Wait practice", async ({
    appPage,
  }) => {
    await gotoLibrary(appPage);
    await dropMidiBytes(appPage);

    await expect(appPage.getByTestId("mode-select-watch")).toBeVisible({
      timeout: 20_000,
    });
    await appPage.getByTestId("mode-select-watch").click();

    await expect(appPage.getByTestId("practice-mode-watch")).toBeVisible({
      timeout: 20_000,
    });
    await expect(appPage.getByTestId("practice-mode-wait")).toBeVisible();
    await expect(appPage.getByTestId("falling-notes-panel")).toBeVisible();
    await expect(appPage.getByTestId("piano-keyboard")).toBeVisible();
  });
});
