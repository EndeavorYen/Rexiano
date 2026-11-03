export function getBluetoothConnectedLabel(
  isConnected: boolean,
  deviceName: string | null,
  fallbackLabel: string,
): string | null {
  if (!isConnected) return null;
  return deviceName?.trim() || fallbackLabel;
}
