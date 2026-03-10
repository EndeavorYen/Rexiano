import { describe, it, expect, vi, beforeEach } from "vitest";

// Track all created instances for assertions
const createdInstances: Array<{ dispose: ReturnType<typeof vi.fn> }> = [];

// Mock MetronomeEngine as a real class so `new MetronomeEngine(...)` works
vi.mock("./MetronomeEngine", () => ({
  MetronomeEngine: class MockMetronomeEngine {
    audioContext: AudioContext;
    dispose = vi.fn();
    constructor(audioContext: AudioContext) {
      this.audioContext = audioContext;
      createdInstances.push(this);
    }
  },
}));

import {
  initMetronome,
  getMetronome,
  disposeMetronome,
} from "./metronomeManager";

describe("metronomeManager", () => {
  beforeEach(() => {
    // Clean up singleton state between tests
    disposeMetronome();
    createdInstances.length = 0;
  });

  it("getMetronome returns null before init", () => {
    expect(getMetronome()).toBeNull();
  });

  it("initMetronome creates an engine instance", () => {
    const audioContext = {} as AudioContext;

    initMetronome(audioContext);

    expect(createdInstances).toHaveLength(1);
  });

  it("getMetronome returns the engine after init", () => {
    const audioContext = {} as AudioContext;

    const engine = initMetronome(audioContext);

    expect(getMetronome()).toBe(engine);
    expect(getMetronome()).not.toBeNull();
  });

  it("initMetronome is idempotent — second call with same context returns same instance", () => {
    const ctx = {} as AudioContext;

    const first = initMetronome(ctx);
    const second = initMetronome(ctx);

    expect(first).toBe(second);
    // Constructor should only have been called once
    expect(createdInstances).toHaveLength(1);
  });

  it("initMetronome recreates engine when AudioContext changes", () => {
    const ctx1 = {} as AudioContext;
    const ctx2 = {} as AudioContext;

    const first = initMetronome(ctx1);
    const second = initMetronome(ctx2);

    expect(first).not.toBe(second);
    expect(createdInstances).toHaveLength(2);
    // Old engine should have been disposed
    expect(createdInstances[0].dispose).toHaveBeenCalledTimes(1);
  });

  it("initMetronome returns the engine instance", () => {
    const audioContext = {} as AudioContext;

    const engine = initMetronome(audioContext);

    expect(engine).toBeDefined();
    expect(engine).toBe(getMetronome());
  });

  it("disposeMetronome calls engine.dispose()", () => {
    const audioContext = {} as AudioContext;

    initMetronome(audioContext);
    const instance = createdInstances[0];

    disposeMetronome();

    expect(instance.dispose).toHaveBeenCalledTimes(1);
  });

  it("getMetronome returns null after dispose", () => {
    const audioContext = {} as AudioContext;

    initMetronome(audioContext);
    expect(getMetronome()).not.toBeNull();

    disposeMetronome();
    expect(getMetronome()).toBeNull();
  });

  it("can re-init after dispose", () => {
    const ctx1 = {} as AudioContext;
    const ctx2 = {} as AudioContext;

    initMetronome(ctx1);
    disposeMetronome();

    const newEngine = initMetronome(ctx2);

    expect(getMetronome()).toBe(newEngine);
    expect(getMetronome()).not.toBeNull();
    // Two instances created total
    expect(createdInstances).toHaveLength(2);
  });

  it("disposeMetronome is safe to call when no engine exists", () => {
    expect(() => disposeMetronome()).not.toThrow();
  });

  it("disposeMetronome is safe to call multiple times", () => {
    const audioContext = {} as AudioContext;
    initMetronome(audioContext);
    const instance = createdInstances[0];

    disposeMetronome();
    disposeMetronome();

    // dispose only called once (second call has no engine)
    expect(instance.dispose).toHaveBeenCalledTimes(1);
    expect(getMetronome()).toBeNull();
  });
});
