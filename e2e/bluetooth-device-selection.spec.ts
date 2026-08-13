import { test, expect } from "./fixtures/electronApp";
import { gotoLibrary } from "./helpers/appHarness";

test("BLE chooser accepts arbitrary and unnamed devices with keyboard-safe cancellation", async ({
  electronApp,
  appPage,
}) => {
  await gotoLibrary(appPage);

  const drawerLauncher = appPage.getByTestId("library-device-drawer-trigger");
  await drawerLauncher.click();
  const drawer = appPage.getByTestId("library-midi-drawer");
  await expect(drawer).toBeVisible();

  await appPage.evaluate(() => {
    Object.defineProperty(navigator, "bluetooth", {
      configurable: true,
      value: { requestDevice: () => new Promise(() => undefined) },
    });
  });

  const bluetoothButton = drawer.getByRole("button", { name: "Bluetooth" });
  await bluetoothButton.focus();
  await bluetoothButton.press("Enter");
  await expect(drawer).toBeHidden();

  const selectedDevice = electronApp.evaluate(async ({ BrowserWindow }) => {
    const webContents = BrowserWindow.getAllWindows()[0].webContents;
    return new Promise<string>((resolve) => {
      webContents.emit(
        "select-bluetooth-device",
        { preventDefault: () => undefined } as never,
        [
          { deviceId: "opaque-kawai", deviceName: "Kawai CA901" },
          { deviceId: "opaque-unnamed", deviceName: "" },
        ] as never,
        resolve,
      );
    });
  });

  const chooser = appPage.getByRole("dialog", {
    name: "Choose a Bluetooth MIDI device",
  });
  await expect(chooser).toBeVisible();
  await expect(chooser).toContainText("Kawai CA901");
  await expect(chooser).toContainText("Unnamed Bluetooth device");
  await expect(chooser).not.toContainText("opaque-kawai");
  await expect(chooser).not.toContainText("opaque-unnamed");

  const kawai = chooser.getByRole("button", { name: "Kawai CA901" });
  await kawai.focus();
  await kawai.press("Enter");
  await expect(chooser).toBeHidden();
  await expect(selectedDevice).resolves.toBe("opaque-kawai");
  await expect(drawerLauncher).toBeFocused();

  const cancelledDevice = electronApp.evaluate(async ({ BrowserWindow }) => {
    const webContents = BrowserWindow.getAllWindows()[0].webContents;
    return new Promise<string>((resolve) => {
      webContents.emit(
        "select-bluetooth-device",
        { preventDefault: () => undefined } as never,
        [{ deviceId: "private-id", deviceName: "" }] as never,
        resolve,
      );
    });
  });

  await expect(chooser).toBeVisible();
  await appPage.keyboard.press("Escape");
  await expect(chooser).toBeHidden();
  await expect(cancelledDevice).resolves.toBe("");
  await expect(drawerLauncher).toBeFocused();
});
