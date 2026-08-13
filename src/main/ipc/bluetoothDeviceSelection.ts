import { IpcChannels } from "../../shared/types";
import type {
  BluetoothDeviceCandidate,
  BluetoothDeviceSelectionCancelCommand,
  BluetoothDeviceSelectionChooseCommand,
  BluetoothDeviceSelectionUpdate,
} from "../../shared/types";
import { BluetoothDeviceSelectionController } from "./BluetoothDeviceSelectionController";
import { isTrustedRendererUrl } from "./midiPermissionPolicy";

type EventListener = (...args: unknown[]) => void;

interface EventSource {
  on(eventName: string, listener: EventListener): unknown;
  removeListener(eventName: string, listener: EventListener): unknown;
}

interface BluetoothSelectionFrame {
  url: string;
}

interface BluetoothSelectionWebContents extends EventSource {
  id: number;
  mainFrame: BluetoothSelectionFrame;
  getURL(): string;
  send(channel: string, payload: BluetoothDeviceSelectionUpdate | null): void;
  isDestroyed(): boolean;
}

interface BluetoothSelectionWindow extends EventSource {
  webContents: BluetoothSelectionWebContents;
}

export interface BluetoothSelectionCommandEvent {
  sender: BluetoothSelectionWebContents;
  senderFrame: BluetoothSelectionFrame | null;
}

interface WindowAdapter {
  webContents: BluetoothSelectionWebContents;
  controller: BluetoothDeviceSelectionController;
  dispose: () => void;
}

function isChooseCommand(
  candidate: unknown,
): candidate is BluetoothDeviceSelectionChooseCommand {
  if (!candidate || typeof candidate !== "object") return false;
  const command = candidate as Record<string, unknown>;
  return (
    typeof command.requestId === "string" &&
    command.requestId.length > 0 &&
    typeof command.deviceId === "string" &&
    command.deviceId.length > 0
  );
}

function isCancelCommand(
  candidate: unknown,
): candidate is BluetoothDeviceSelectionCancelCommand {
  if (!candidate || typeof candidate !== "object") return false;
  const command = candidate as Record<string, unknown>;
  return typeof command.requestId === "string" && command.requestId.length > 0;
}

function toCandidates(candidate: unknown): BluetoothDeviceCandidate[] {
  if (!Array.isArray(candidate)) return [];
  const devices: BluetoothDeviceCandidate[] = [];
  for (const entry of candidate) {
    if (!entry || typeof entry !== "object") continue;
    const device = entry as Record<string, unknown>;
    if (typeof device.deviceId !== "string" || device.deviceId.length === 0) {
      continue;
    }
    devices.push({
      deviceId: device.deviceId,
      deviceName:
        typeof device.deviceName === "string" ? device.deviceName : "",
    });
  }
  return devices;
}

function isTrustedBluetoothSelectionUrl(candidate: string): boolean {
  return isTrustedRendererUrl(candidate);
}

/** Per-window registry and trust boundary for the native Bluetooth chooser. */
export class BluetoothDeviceSelectionRegistry {
  private readonly adapters = new Map<number, WindowAdapter>();

  attachWindow(window: BluetoothSelectionWindow): void {
    const webContents = window.webContents;
    this.disposeWindow(webContents.id);

    const controller = new BluetoothDeviceSelectionController({
      onUpdate: (update) => {
        if (!webContents.isDestroyed()) {
          webContents.send(IpcChannels.BLUETOOTH_SELECTION_UPDATE, update);
        }
      },
    });

    const onSelectBluetoothDevice = ((
      event: { preventDefault: () => void },
      devices: unknown,
      callback: (deviceId: string) => void,
    ): void => {
      event.preventDefault();
      if (typeof callback !== "function") return;
      controller.beginOrUpdate(toCandidates(devices), callback);
    }) as unknown as EventListener;
    const onNavigation = ((
      _event: unknown,
      _url: string,
      _isInPlace: boolean,
      isMainFrame: boolean,
    ): void => {
      if (isMainFrame) controller.cancelCurrent();
    }) as unknown as EventListener;
    const onRendererGone = (() =>
      controller.cancelCurrent()) as unknown as EventListener;
    const onDestroyed = (() =>
      this.disposeWindow(webContents.id)) as unknown as EventListener;
    const onClosed = (() =>
      this.disposeWindow(webContents.id)) as unknown as EventListener;

    webContents.on("select-bluetooth-device", onSelectBluetoothDevice);
    webContents.on("did-start-navigation", onNavigation);
    webContents.on("render-process-gone", onRendererGone);
    webContents.on("destroyed", onDestroyed);
    window.on("closed", onClosed);

    const dispose = (): void => {
      controller.dispose();
      webContents.removeListener(
        "select-bluetooth-device",
        onSelectBluetoothDevice,
      );
      webContents.removeListener("did-start-navigation", onNavigation);
      webContents.removeListener("render-process-gone", onRendererGone);
      webContents.removeListener("destroyed", onDestroyed);
      window.removeListener("closed", onClosed);
    };

    this.adapters.set(webContents.id, { webContents, controller, dispose });
  }

  choose(event: BluetoothSelectionCommandEvent, command: unknown): boolean {
    if (!isChooseCommand(command)) return false;
    const adapter = this.trustedAdapter(event);
    return (
      adapter?.controller.choose(command.requestId, command.deviceId) ?? false
    );
  }

  cancel(event: BluetoothSelectionCommandEvent, command: unknown): boolean {
    if (!isCancelCommand(command)) return false;
    const adapter = this.trustedAdapter(event);
    return adapter?.controller.cancel(command.requestId) ?? false;
  }

  disposeWindow(webContentsId: number): void {
    const adapter = this.adapters.get(webContentsId);
    if (!adapter) return;
    this.adapters.delete(webContentsId);
    adapter.dispose();
  }

  private trustedAdapter(
    event: BluetoothSelectionCommandEvent,
  ): WindowAdapter | null {
    const adapter = this.adapters.get(event.sender.id);
    if (
      !adapter ||
      adapter.webContents !== event.sender ||
      event.senderFrame !== adapter.webContents.mainFrame ||
      adapter.webContents.isDestroyed()
    ) {
      return null;
    }

    const rendererUrl = event.senderFrame.url || adapter.webContents.getURL();
    return isTrustedBluetoothSelectionUrl(rendererUrl) ? adapter : null;
  }
}

export const bluetoothDeviceSelectionRegistry =
  new BluetoothDeviceSelectionRegistry();
