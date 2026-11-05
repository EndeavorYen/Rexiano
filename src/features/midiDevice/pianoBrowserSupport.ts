// Can this browser talk to a Bluetooth piano, and if not, what should the
// person do instead? Rexiano only supports Bluetooth (BLE-MIDI) pianos.
//
//   ok          Web Bluetooth exists (Chrome / Edge, Android, or Bluefy on iPad)
//   ios         iPad / iPhone without Web Bluetooth → open Rexiano in Bluefy
//   mac-safari  Safari on a Mac → use Chrome or Edge
//   other       anything else (e.g. Firefox) → use Chrome or Edge

export type PianoBrowserSupport = "ok" | "ios" | "mac-safari" | "other";

export const BLUEFY_APP_STORE_URL = "https://apps.apple.com/app/id1492822055";

export interface NavigatorLike {
  userAgent: string;
  platform?: string;
  maxTouchPoints?: number;
  bluetooth?: unknown;
}

export function isAppleTouchDevice(nav: NavigatorLike): boolean {
  if (/iPad|iPhone|iPod/.test(nav.userAgent)) return true;
  // iPadOS reports itself as a Mac; touch support gives it away.
  return nav.platform === "MacIntel" && (nav.maxTouchPoints ?? 0) > 1;
}

export function detectPianoBrowserSupport(
  nav: NavigatorLike,
): PianoBrowserSupport {
  if ("bluetooth" in nav && nav.bluetooth) return "ok";
  if (isAppleTouchDevice(nav)) return "ios";
  const ua = nav.userAgent;
  if (
    /Macintosh/.test(ua) &&
    /Safari/.test(ua) &&
    !/Chrome|Chromium|Edg/.test(ua)
  ) {
    return "mac-safari";
  }
  return "other";
}

export function currentPianoBrowserSupport(): PianoBrowserSupport {
  if (typeof navigator === "undefined") return "other";
  return detectPianoBrowserSupport(navigator as unknown as NavigatorLike);
}
