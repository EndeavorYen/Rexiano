import type { Locator, Page } from "@playwright/test";
import { expect } from "../fixtures/electronApp";

export async function gotoLibrary(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.location.hash = "#/library";
  });
  await expect(page.getByTestId("library-device-drawer-trigger")).toBeVisible({
    timeout: 20_000,
  });
}

export async function openLibraryDrawer(page: Page): Promise<Locator> {
  await page.getByTestId("library-device-drawer-trigger").click();
  const drawer = page.locator(".app-side-drawer");
  await expect(drawer).toBeVisible();
  return drawer;
}

export async function openPlaybackDrawer(page: Page): Promise<Locator> {
  await page.getByTestId("playback-drawer-trigger").click();
  const drawer = page.locator(".app-side-drawer");
  await expect(drawer).toBeVisible();
  return drawer;
}

export async function closeTopDrawer(page: Page): Promise<void> {
  const closeButton = page.locator(".app-side-drawer-header button").first();
  await expect(closeButton).toBeVisible();
  await closeButton.click();
  await expect(page.locator(".app-side-drawer")).toBeHidden();
}

export async function loadFirstBuiltInSong(page: Page): Promise<void> {
  const firstSongCard = page.locator("button:has(h3)").first();
  await expect(firstSongCard).toBeVisible({ timeout: 20_000 });
  await firstSongCard.click();

  await expect(page.getByTestId("mode-select-wait")).toBeVisible({
    timeout: 20_000,
  });
  await page.getByTestId("mode-select-wait").click();

  await expect(page.locator(".workspace-frame")).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByTestId("playback-drawer-trigger")).toBeVisible();
}
