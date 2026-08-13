import { describe, expect, test, vi } from "vitest";
import { configureTrustedRendererUrl } from "./ipc/midiPermissionPolicy";
import {
  createSecureRendererPreferences,
  installRendererNavigationGuard,
} from "./rendererWindowSecurity";

describe("renderer window security", () => {
  test("uses explicit secure renderer preferences", () => {
    expect(createSecureRendererPreferences("/app/preload.js")).toEqual({
      preload: "/app/preload.js",
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    });
  });

  test("prevents navigation and redirects outside the configured renderer", () => {
    configureTrustedRendererUrl("file:///app/out/renderer/index.html");
    const listeners = new Map<string, (...args: unknown[]) => void>();
    installRendererNavigationGuard({
      on: vi.fn((name: string, listener: (...args: unknown[]) => void) => {
        listeners.set(name, listener);
        return undefined as never;
      }),
    } as never);

    for (const eventName of ["will-navigate", "will-redirect"]) {
      const trusted = { preventDefault: vi.fn() };
      listeners.get(eventName)?.(
        trusted,
        "file:///app/out/renderer/index.html#library",
      );
      expect(trusted.preventDefault).not.toHaveBeenCalled();

      const attacker = { preventDefault: vi.fn() };
      listeners.get(eventName)?.(attacker, "https://attacker.invalid/");
      expect(attacker.preventDefault).toHaveBeenCalledOnce();
    }
  });
});
