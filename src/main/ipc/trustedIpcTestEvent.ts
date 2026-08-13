import type { TrustedIpcEvent } from "./trustedIpc";

export function createTrustedIpcTestEvent(
  url = "file:///mock/renderer/index.html",
): TrustedIpcEvent {
  const mainFrame = { url };
  return {
    senderFrame: mainFrame,
    sender: {
      mainFrame,
      isDestroyed: () => false,
      getURL: () => url,
    },
  };
}
