import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { BluetoothDeviceSelectionController } from "./BluetoothDeviceSelectionController";

describe("BluetoothDeviceSelectionController", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("keeps arbitrary, unnamed, duplicate-name, and distinct offered devices selectable", () => {
    const onUpdate = vi.fn();
    const callback = vi.fn();
    const controller = new BluetoothDeviceSelectionController({ onUpdate });

    const requestId = controller.beginOrUpdate(
      [
        { deviceId: "yamaha-1", deviceName: "Yamaha P-125" },
        { deviceId: "unnamed", deviceName: "" },
        { deviceId: "yamaha-2", deviceName: "Yamaha P-125" },
        { deviceId: "yamaha-1", deviceName: "Yamaha P-125 (updated)" },
        { deviceId: "yamaha-1", deviceName: "   " },
      ],
      callback,
    );

    expect(onUpdate).toHaveBeenLastCalledWith({
      requestId,
      devices: [
        { deviceId: "yamaha-1", deviceName: "Yamaha P-125 (updated)" },
        { deviceId: "unnamed", deviceName: "" },
        { deviceId: "yamaha-2", deviceName: "Yamaha P-125" },
      ],
    });
    expect(controller.choose(requestId, "unnamed")).toBe(true);
    expect(callback).toHaveBeenCalledOnce();
    expect(callback).toHaveBeenCalledWith("unnamed");
  });

  test("reuses one request, replaces the callback, and never resets the deadline", () => {
    const onUpdate = vi.fn();
    const firstCallback = vi.fn();
    const latestCallback = vi.fn();
    const controller = new BluetoothDeviceSelectionController({
      onUpdate,
      timeoutMs: 30_000,
    });

    const requestId = controller.beginOrUpdate(
      [{ deviceId: "first", deviceName: "First" }],
      firstCallback,
    );
    vi.advanceTimersByTime(20_000);
    const repeatedRequestId = controller.beginOrUpdate(
      [{ deviceId: "second", deviceName: "Second" }],
      latestCallback,
    );
    vi.advanceTimersByTime(9_999);

    expect(repeatedRequestId).toBe(requestId);
    expect(latestCallback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);

    expect(firstCallback).not.toHaveBeenCalled();
    expect(latestCallback).toHaveBeenCalledOnce();
    expect(latestCallback).toHaveBeenCalledWith("");
    expect(onUpdate).toHaveBeenLastCalledWith(null);
  });

  test("rejects stale, malformed, unknown, and duplicate terminal commands", () => {
    const callback = vi.fn();
    const controller = new BluetoothDeviceSelectionController({
      onUpdate: vi.fn(),
    });
    const requestId = controller.beginOrUpdate(
      [{ deviceId: "offered", deviceName: "Piano" }],
      callback,
    );

    expect(controller.choose("stale", "offered")).toBe(false);
    expect(controller.choose(requestId, "unknown")).toBe(false);
    expect(controller.choose(requestId, "")).toBe(false);
    expect(callback).not.toHaveBeenCalled();

    expect(controller.cancel(requestId)).toBe(true);
    expect(controller.cancel(requestId)).toBe(false);
    expect(controller.choose(requestId, "offered")).toBe(false);
    expect(callback).toHaveBeenCalledOnce();
    expect(callback).toHaveBeenCalledWith("");
  });

  test("clears terminal state before invoking a callback and teardown is idempotent", () => {
    const onUpdate = vi.fn();
    const controller = new BluetoothDeviceSelectionController({ onUpdate });
    const callback = vi.fn(() => {
      expect(controller.currentRequest).toBeNull();
    });
    controller.beginOrUpdate(
      [{ deviceId: "device", deviceName: "Piano" }],
      callback,
    );

    controller.dispose();
    controller.dispose();

    expect(callback).toHaveBeenCalledOnce();
    expect(callback).toHaveBeenCalledWith("");
    expect(onUpdate).toHaveBeenLastCalledWith(null);
  });
});
