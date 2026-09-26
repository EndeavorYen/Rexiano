import { test, expect, waitForUiSettled } from "./fixtures/electronApp";

test("fresh profiles open on the song list without an onboarding card", async ({
  electronApp,
}) => {
  const page = await electronApp.firstWindow();
  await page.waitForLoadState("domcontentloaded");
  await page.evaluate(() => {
    localStorage.removeItem("rexiano-onboarding-completed");
  });
  await page.reload();
  await page.waitForLoadState("domcontentloaded");
  await waitForUiSettled(page);

  await expect(page.getByTestId("onboarding-card")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /Start Practice|開始練習/ }),
  ).toBeVisible();
});
