import type {
  BluetoothDeviceCandidate,
  BluetoothDeviceSelectionUpdate,
} from "../../shared/types";

type NativeBluetoothSelectionCallback = (deviceId: string) => void;

interface ControllerOptions {
  onUpdate: (update: BluetoothDeviceSelectionUpdate | null) => void;
  timeoutMs?: number;
}

interface ActiveRequest {
  requestId: string;
  callback: NativeBluetoothSelectionCallback;
  devices: Map<string, BluetoothDeviceCandidate>;
  timeout: ReturnType<typeof setTimeout>;
}

const DEFAULT_TIMEOUT_MS = 30_000;
let requestSequence = 0;

function nextRequestId(): string {
  requestSequence += 1;
  return `ble-${Date.now().toString(36)}-${requestSequence.toString(36)}`;
}

function normalizeCandidate(
  candidate: BluetoothDeviceCandidate,
): BluetoothDeviceCandidate | null {
  if (
    typeof candidate.deviceId !== "string" ||
    candidate.deviceId.length === 0
  ) {
    return null;
  }
  return {
    deviceId: candidate.deviceId,
    deviceName:
      typeof candidate.deviceName === "string" ? candidate.deviceName : "",
  };
}

/**
 * Electron-free state machine for one window's native Bluetooth chooser.
 * A repeated discovery event updates the same logical request and its latest
 * native callback without extending the original deadline.
 */
export class BluetoothDeviceSelectionController {
  private readonly onUpdate: ControllerOptions["onUpdate"];
  private readonly timeoutMs: number;
  private active: ActiveRequest | null = null;

  constructor({ onUpdate, timeoutMs = DEFAULT_TIMEOUT_MS }: ControllerOptions) {
    this.onUpdate = onUpdate;
    this.timeoutMs = timeoutMs;
  }

  get currentRequest(): BluetoothDeviceSelectionUpdate | null {
    return this.active ? this.snapshot(this.active) : null;
  }

  beginOrUpdate(
    devices: BluetoothDeviceCandidate[],
    callback: NativeBluetoothSelectionCallback,
  ): string {
    if (!this.active) {
      const requestId = nextRequestId();
      this.active = {
        requestId,
        callback,
        devices: new Map(),
        timeout: setTimeout(() => this.finish(""), this.timeoutMs),
      };
    } else {
      this.active.callback = callback;
    }

    for (const candidate of devices) {
      const normalized = normalizeCandidate(candidate);
      if (normalized) {
        const existing = this.active.devices.get(normalized.deviceId);
        if (
          normalized.deviceName.trim().length === 0 &&
          existing?.deviceName.trim()
        ) {
          normalized.deviceName = existing.deviceName;
        }
        this.active.devices.set(normalized.deviceId, normalized);
      }
    }

    const update = this.snapshot(this.active);
    this.onUpdate(update);
    return update.requestId;
  }

  choose(requestId: string, deviceId: string): boolean {
    if (
      !this.active ||
      this.active.requestId !== requestId ||
      !this.active.devices.has(deviceId)
    ) {
      return false;
    }
    this.finish(deviceId);
    return true;
  }

  cancel(requestId: string): boolean {
    if (!this.active || this.active.requestId !== requestId) return false;
    this.finish("");
    return true;
  }

  cancelCurrent(): boolean {
    if (!this.active) return false;
    this.finish("");
    return true;
  }

  dispose(): void {
    this.cancelCurrent();
  }

  private snapshot(active: ActiveRequest): BluetoothDeviceSelectionUpdate {
    return {
      requestId: active.requestId,
      devices: [...active.devices.values()],
    };
  }

  private finish(deviceId: string): void {
    const active = this.active;
    if (!active) return;

    clearTimeout(active.timeout);
    this.active = null;

    try {
      this.onUpdate(null);
    } finally {
      active.callback(deviceId);
    }
  }
}
