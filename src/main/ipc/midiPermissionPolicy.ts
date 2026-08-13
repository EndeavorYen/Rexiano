const ALLOWED_PERMISSIONS = new Set(["midi", "midiSysex", "bluetooth"]);
const TRUSTED_RENDERER_PROTOCOLS = new Set(["file:", "http:", "https:"]);

let trustedRendererUrl: URL | null = null;

interface MidiPermissionRequest {
  permission: string;
  url: string;
}

interface DevicePermissionRequest {
  deviceType: string;
  origin?: string;
}

/** Configure the exact renderer entry that the main window will load. */
export function configureTrustedRendererUrl(candidate: string): void {
  const url = new URL(candidate);
  if (!TRUSTED_RENDERER_PROTOCOLS.has(url.protocol)) {
    throw new Error(`Unsupported renderer URL protocol: ${url.protocol}`);
  }
  trustedRendererUrl = url;
}

function withoutDocumentLocation(url: URL): string {
  const normalized = new URL(url.href);
  normalized.search = "";
  normalized.hash = "";
  return normalized.href;
}

export function isTrustedRendererUrl(candidate: string | undefined): boolean {
  if (!candidate || !trustedRendererUrl) return false;

  try {
    const url = new URL(candidate);
    if (trustedRendererUrl.protocol === "file:") {
      return (
        url.protocol === "file:" &&
        withoutDocumentLocation(url) ===
          withoutDocumentLocation(trustedRendererUrl)
      );
    }
    return url.origin === trustedRendererUrl.origin;
  } catch {
    return false;
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
  if (deviceType !== "bluetooth" || !origin || !trustedRendererUrl) {
    return false;
  }

  if (trustedRendererUrl.protocol === "file:" && origin === "file://") {
    return true;
  }
  return isTrustedRendererUrl(origin);
}
