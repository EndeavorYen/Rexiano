const ALLOWED_PERMISSIONS = new Set(["midi", "midiSysex", "bluetooth"]);
const TRUSTED_LOCALHOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

interface MidiPermissionRequest {
  permission: string;
  url: string;
}

interface DevicePermissionRequest {
  deviceType: string;
  origin?: string;
}

function isTrustedRendererUrl(candidate: string | undefined): boolean {
  if (!candidate) return false;

  try {
    const url = new URL(candidate);
    if (url.protocol === "file:") return true;
    return url.protocol === "http:" && TRUSTED_LOCALHOSTS.has(url.hostname);
  } catch {
    return candidate === "file://";
  }
}

export function isAllowedMidiPermissionRequest({
  permission,
  url,
}: MidiPermissionRequest): boolean {
  return ALLOWED_PERMISSIONS.has(permission) && isTrustedRendererUrl(url);
}

export function isAllowedBluetoothDevicePermission({
  deviceType,
  origin,
}: DevicePermissionRequest): boolean {
  return deviceType === "bluetooth" && isTrustedRendererUrl(origin);
}
