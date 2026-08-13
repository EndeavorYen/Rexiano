import { describe, expect, test, vi } from "vitest";
import { recoverLatestPlaybackIntent } from "./audioRecoveryIntent";

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

interface RecoveryHarness {
  songB: { id: string };
  rebuildGate: Deferred<"committed" | "stale">;
  resumeGate: Deferred<void>;
  scheduler: {
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    seek: ReturnType<typeof vi.fn>;
  };
  engine: { resume: ReturnType<typeof vi.fn> };
  run: Promise<"applied" | "stale">;
  setSong: (song: { id: string } | null) => void;
  setPlayback: (next: { isPlaying: boolean; currentTime: number }) => void;
}

function createHarness(): RecoveryHarness {
  const songA = { id: "a" };
  const songB = { id: "b" };
  const rebuildGate = deferred<"committed" | "stale">();
  const resumeGate = deferred<void>();
  let currentSong: typeof songA | typeof songB | null = songA;
  let playback = { isPlaying: true, currentTime: 1 };
  const scheduler = {
    start: vi.fn(),
    stop: vi.fn(),
    seek: vi.fn(),
  };
  const engine = { resume: vi.fn(() => resumeGate.promise) };

  const run = recoverLatestPlaybackIntent({
    targetSong: songA,
    rebuild: () => rebuildGate.promise,
    getCurrentSong: () => currentSong,
    getPlaybackIntent: () => playback,
    getRuntime: () => ({ engine, scheduler }),
  });

  return {
    songB,
    rebuildGate,
    resumeGate,
    scheduler,
    engine,
    run,
    setSong: (song: typeof songA | typeof songB | null) => {
      currentSong = song;
    },
    setPlayback: (next: typeof playback) => {
      playback = next;
    },
  };
}

describe("recoverLatestPlaybackIntent", () => {
  test("commits the latest monotonic position after delayed rebuild", async () => {
    const harness = createHarness();
    harness.setPlayback({ isPlaying: true, currentTime: 2.75 });
    harness.rebuildGate.resolve("committed");
    await Promise.resolve();

    expect(harness.scheduler.start).toHaveBeenCalledWith(2.75);
    expect(harness.engine.resume).toHaveBeenCalledOnce();

    harness.setPlayback({ isPlaying: true, currentTime: 2.9 });
    harness.resumeGate.resolve();
    await expect(harness.run).resolves.toBe("applied");
    expect(harness.scheduler.seek).toHaveBeenLastCalledWith(2.9);
    expect(harness.scheduler.start).not.toHaveBeenCalledWith(1);
  });

  test("pause during rebuild leaves the new scheduler stopped at the latest position", async () => {
    const harness = createHarness();
    harness.setPlayback({ isPlaying: false, currentTime: 2.25 });
    harness.rebuildGate.resolve("committed");

    await expect(harness.run).resolves.toBe("applied");
    expect(harness.scheduler.seek).toHaveBeenCalledWith(2.25);
    expect(harness.scheduler.start).not.toHaveBeenCalled();
    expect(harness.engine.resume).not.toHaveBeenCalled();
  });

  test("seek during rebuild becomes the new scheduler start position", async () => {
    const harness = createHarness();
    harness.setPlayback({ isPlaying: true, currentTime: 8.5 });
    harness.rebuildGate.resolve("committed");
    await Promise.resolve();
    expect(harness.scheduler.start).toHaveBeenCalledWith(8.5);

    harness.resumeGate.resolve();
    await expect(harness.run).resolves.toBe("applied");
  });

  test("pause while resume is pending wins and silences the new scheduler", async () => {
    const harness = createHarness();
    harness.rebuildGate.resolve("committed");
    await Promise.resolve();
    expect(harness.scheduler.start).toHaveBeenCalledWith(1);

    harness.setPlayback({ isPlaying: false, currentTime: 1.4 });
    harness.resumeGate.resolve();
    await expect(harness.run).resolves.toBe("applied");
    expect(harness.scheduler.stop).toHaveBeenCalledOnce();
    expect(harness.scheduler.seek).toHaveBeenLastCalledWith(1.4);
  });

  test("song switch makes a completed rebuild stale before it can emit audio", async () => {
    const harness = createHarness();
    harness.setSong(harness.songB);
    harness.rebuildGate.resolve("committed");

    await expect(harness.run).resolves.toBe("stale");
    expect(harness.scheduler.stop).toHaveBeenCalledOnce();
    expect(harness.scheduler.start).not.toHaveBeenCalled();
    expect(harness.engine.resume).not.toHaveBeenCalled();
  });

  test("ownership-stale completion never touches the active runtime", async () => {
    const harness = createHarness();
    harness.rebuildGate.resolve("stale");

    await expect(harness.run).resolves.toBe("stale");
    expect(harness.scheduler.start).not.toHaveBeenCalled();
    expect(harness.scheduler.stop).not.toHaveBeenCalled();
    expect(harness.scheduler.seek).not.toHaveBeenCalled();
  });
});
