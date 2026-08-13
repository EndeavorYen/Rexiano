import { describe, expect, test, vi } from "vitest";
import {
  AudioInitializationOwner,
  runOwnedAudioInitialization,
  type AudioInitializationOutcome,
} from "./audioInitializationOwnership";

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

interface FakeStack {
  name: string;
  engine: { dispose: () => void };
  scheduler: { dispose: () => void };
}

function fakeStack(name: string): FakeStack {
  return {
    name,
    engine: { dispose: vi.fn() },
    scheduler: { dispose: vi.fn() },
  };
}

describe("audio initialization ownership", () => {
  test("a late A cannot bind or publish ready after B completes first", async () => {
    const owner = new AudioInitializationOwner();
    const gateA = deferred<void>();
    const gateB = deferred<void>();
    const stackA = fakeStack("A");
    const stackB = fakeStack("B");
    const binds: string[] = [];
    const statuses: string[] = [];
    let activeStack: FakeStack | null = null;

    const start = (
      stack: FakeStack,
      gate: Deferred<void>,
    ): Promise<AudioInitializationOutcome> =>
      runOwnedAudioInitialization(owner, {
        activate: () => {
          activeStack?.scheduler.dispose();
          activeStack?.engine.dispose();
          activeStack = stack;
          statuses.push(`${stack.name}:loading`);
        },
        initialize: () => gate.promise,
        commit: () => {
          binds.push(stack.name);
          statuses.push(`${stack.name}:ready`);
        },
        cleanupStale: () => {
          stack.scheduler.dispose();
          stack.engine.dispose();
          if (activeStack === stack) activeStack = null;
        },
      });

    const runA = start(stackA, gateA);
    const runB = start(stackB, gateB);

    gateB.resolve();
    await expect(runB).resolves.toBe("committed");
    gateA.resolve();
    await expect(runA).resolves.toBe("stale");

    expect(binds).toEqual(["B"]);
    expect(statuses).toEqual(["A:loading", "B:loading", "B:ready"]);
    expect(activeStack).toBe(stackB);
    expect(stackB.engine.dispose).not.toHaveBeenCalled();
    expect(stackB.scheduler.dispose).not.toHaveBeenCalled();
  });

  test.each(["song change", "dismiss", "unmount"])(
    "%s invalidates an in-flight initialization",
    async () => {
      const owner = new AudioInitializationOwner();
      const gate = deferred<void>();
      const commit = vi.fn();
      const cleanupStale = vi.fn();
      const run = runOwnedAudioInitialization(owner, {
        activate: vi.fn(),
        initialize: () => gate.promise,
        commit,
        cleanupStale,
      });

      owner.invalidate();
      gate.resolve();

      await expect(run).resolves.toBe("stale");
      expect(commit).not.toHaveBeenCalled();
      expect(cleanupStale).toHaveBeenCalledOnce();
    },
  );

  test("the active generation binds and publishes normally", async () => {
    const owner = new AudioInitializationOwner();
    const gate = deferred<void>();
    const activate = vi.fn();
    const commit = vi.fn();
    const cleanupStale = vi.fn();
    const run = runOwnedAudioInitialization(owner, {
      activate,
      initialize: () => gate.promise,
      commit,
      cleanupStale,
    });

    expect(activate).toHaveBeenCalledOnce();
    gate.resolve();

    await expect(run).resolves.toBe("committed");
    expect(commit).toHaveBeenCalledOnce();
    expect(cleanupStale).not.toHaveBeenCalled();
  });

  test("a stale rejection cleans up without surfacing an obsolete error", async () => {
    const owner = new AudioInitializationOwner();
    const gate = deferred<void>();
    const cleanupStale = vi.fn();
    const run = runOwnedAudioInitialization(owner, {
      activate: vi.fn(),
      initialize: () => gate.promise,
      commit: vi.fn(),
      cleanupStale,
    });

    owner.invalidate();
    gate.reject(new Error("obsolete initialization failed"));

    await expect(run).resolves.toBe("stale");
    expect(cleanupStale).toHaveBeenCalledOnce();
  });
});
