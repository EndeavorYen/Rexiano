import { describe, expect, test } from "vitest";
import { configureTrustedRendererUrl } from "./midiPermissionPolicy";
import {
  isTrustedMainFrame,
  requireTrustedMainFrame,
  type TrustedIpcEvent,
} from "./trustedIpc";

function event(
  url: string,
  options: { subframe?: boolean; destroyed?: boolean } = {},
): TrustedIpcEvent {
  const mainFrame = { url };
  const senderFrame = options.subframe ? { url } : mainFrame;
  return {
    senderFrame,
    sender: {
      mainFrame,
      isDestroyed: () => options.destroyed ?? false,
      getURL: () => url,
    },
  };
}

describe("isTrustedMainFrame", () => {
  test("accepts only the configured live top-level renderer frame", () => {
    configureTrustedRendererUrl("file:///app/out/renderer/index.html");

    expect(
      isTrustedMainFrame(event("file:///app/out/renderer/index.html")),
    ).toBe(true);
    expect(
      isTrustedMainFrame(
        event("file:///app/out/renderer/index.html", { subframe: true }),
      ),
    ).toBe(false);
    expect(
      isTrustedMainFrame(
        event("file:///app/out/renderer/index.html", { destroyed: true }),
      ),
    ).toBe(false);
    expect(isTrustedMainFrame(event("https://attacker.invalid/"))).toBe(false);
    expect(() =>
      requireTrustedMainFrame(event("https://attacker.invalid/")),
    ).toThrow(/trusted Rexiano main frame/);
  });
});
