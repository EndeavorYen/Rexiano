import type { BluetoothDeviceCandidate } from "@shared/types";

export interface BluetoothDeviceDisplayItem {
  deviceId: string;
  label: string;
}

export function getBluetoothConnectedLabel(
  isConnected: boolean,
  deviceName: string | null,
  fallbackLabel: string,
): string | null {
  if (!isConnected) return null;
  return deviceName?.trim() || fallbackLabel;
}

/** Build unique human labels while keeping device IDs out of rendered text. */
export function buildBluetoothDeviceDisplayItems(
  devices: BluetoothDeviceCandidate[],
  unnamedLabel: string,
): BluetoothDeviceDisplayItem[] {
  const baseLabels = devices.map((device) => {
    const name = device.deviceName.trim();
    return name || unnamedLabel;
  });
  const totals = new Map<string, number>();
  for (const label of baseLabels) {
    totals.set(label, (totals.get(label) ?? 0) + 1);
  }
  const occurrences = new Map<string, number>();

  return devices.map((device, index) => {
    const baseLabel = baseLabels[index];
    const occurrence = (occurrences.get(baseLabel) ?? 0) + 1;
    occurrences.set(baseLabel, occurrence);
    return {
      deviceId: device.deviceId,
      label:
        (totals.get(baseLabel) ?? 0) > 1
          ? `${baseLabel} (${occurrence})`
          : baseLabel,
    };
  });
}
