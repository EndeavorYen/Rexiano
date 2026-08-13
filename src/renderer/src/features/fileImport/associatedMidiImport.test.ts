import { describe, expect, test, vi } from "vitest";
import {
  drainPendingAssociatedMidiFile,
  subscribeToAssociatedMidiImports,
} from "./associatedMidiImport";

describe("associated MIDI renderer bridge", () => {
  test("pulls one queued path and prepares intentional practice before import", async () => {
    const calls: string[] = [];
    const take = vi.fn(async () => "/music/lesson.mid");

    await expect(
      drainPendingAssociatedMidiFile(
        take,
        () => calls.push("prepare"),
        async (path) => {
          calls.push(`load:${path}`);
        },
      ),
    ).resolves.toBe(true);
    expect(calls).toEqual(["prepare", "load:/music/lesson.mid"]);
  });

  test("is a no-op when main has no pending file", async () => {
    const prepare = vi.fn();
    const load = vi.fn();

    await expect(
      drainPendingAssociatedMidiFile(async () => null, prepare, load),
    ).resolves.toBe(false);
    expect(prepare).not.toHaveBeenCalled();
    expect(load).not.toHaveBeenCalled();
  });

  test("subscribes before the initial pull and drains a signal received mid-pull", async () => {
    let notifyPending: (() => void) | undefined;
    let releaseInitialPull: ((path: string | null) => void) | undefined;
    const take = vi
      .fn<() => Promise<string | null>>()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            releaseInitialPull = resolve;
          }),
      )
      .mockResolvedValueOnce("/music/latest.mid");
    const load = vi.fn(async () => undefined);

    const unsubscribe = subscribeToAssociatedMidiImports({
      takePending: take,
      subscribe: (callback) => {
        notifyPending = callback;
        return vi.fn();
      },
      preparePractice: vi.fn(),
      loadMidiPath: load,
      onError: vi.fn(),
    });

    expect(notifyPending).toBeTypeOf("function");
    notifyPending?.();
    releaseInitialPull?.(null);
    await vi.waitFor(() =>
      expect(load).toHaveBeenCalledWith("/music/latest.mid"),
    );
    expect(take).toHaveBeenCalledTimes(2);

    unsubscribe();
  });

  test("unsubscribes and ignores later notifications", async () => {
    let notifyPending: (() => void) | undefined;
    const removeListener = vi.fn();
    const take = vi.fn(async () => null);

    const unsubscribe = subscribeToAssociatedMidiImports({
      takePending: take,
      subscribe: (callback) => {
        notifyPending = callback;
        return removeListener;
      },
      preparePractice: vi.fn(),
      loadMidiPath: vi.fn(),
      onError: vi.fn(),
    });
    await vi.waitFor(() => expect(take).toHaveBeenCalledTimes(1));

    unsubscribe();
    notifyPending?.();
    await Promise.resolve();

    expect(removeListener).toHaveBeenCalledTimes(1);
    expect(take).toHaveBeenCalledTimes(1);
  });
});
