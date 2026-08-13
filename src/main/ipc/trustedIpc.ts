import { isTrustedRendererUrl } from "./midiPermissionPolicy";

interface TrustedIpcFrame {
  url: string;
}

export interface TrustedIpcEvent {
  senderFrame: TrustedIpcFrame | null;
  sender: {
    mainFrame: TrustedIpcFrame;
    isDestroyed(): boolean;
    getURL(): string;
  };
}

export function requireTrustedMainFrame(event: TrustedIpcEvent): void {
  if (!isTrustedMainFrame(event)) {
    throw new Error("Privileged IPC requires the trusted Rexiano main frame.");
  }
}

/** True only for the configured, live top-level Rexiano renderer frame. */
export function isTrustedMainFrame(event: TrustedIpcEvent): boolean {
  const { sender, senderFrame } = event;
  if (
    !senderFrame ||
    sender.isDestroyed() ||
    senderFrame !== sender.mainFrame
  ) {
    return false;
  }
  return isTrustedRendererUrl(senderFrame.url || sender.getURL());
}
