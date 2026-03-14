import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { AudioEngine } from "./AudioEngine";

// ─── Mock SoundFontLoader ────────────────────────

vi.mock("./SoundFontLoader", () => {
  return {
    SoundFontLoader: class MockSoundFontLoader {
      isLoaded = false;
      load = vi.fn().mockResolvedValue(undefined);
      getSample = vi.fn().mockReturnValue(undefined);
      dispose = vi.fn();
    },
  };
});

// ─── Mock Web Audio API ──────────────────────────

function createMockGainNode() {
  return {
    gain: {
      value: 1.0,
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
      cancelScheduledValues: vi.fn(),
    },
    connect: vi.fn(),
    disconnect: vi.fn(),
  };
}

function createMockAudioBufferSourceNode() {
  return {
    buffer: null,
    playbackRate: { value: 1.0 },
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    onended: null as (() => void) | null,
  };
}

function createMockOscillatorNode() {
  return {
    type: "sine" as OscillatorType,
    frequency: {
      value: 440,
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    disconnect: vi.fn(),
    onended: null as (() => void) | null,
  };
}

function stubGlobalAudioContext() {
  const mockGainNode = createMockGainNode();
  const mockOscillator = createMockOscillatorNode();
  const mockCtx = {
    currentTime: 0,
    sampleRate: 44100,
    destination: {},
    state: "running",
    createGain: vi.fn().mockReturnValue(mockGainNode),
    createBufferSource: vi
      .fn()
      .mockReturnValue(createMockAudioBufferSourceNode()),
    createOscillator: vi.fn().mockReturnValue(mockOscillator),
    createBuffer: vi.fn(),
    resume: vi.fn().mockResolvedValue(undefined),
    suspend: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  };

  let constructCount = 0;
  let lastConstructorArg: unknown = undefined;
  class MockAudioContext {
    currentTime = mockCtx.currentTime;
    sampleRate = mockCtx.sampleRate;
    destination = mockCtx.destination;
    state = mockCtx.state;
    createGain = mockCtx.createGain;
    createBufferSource = mockCtx.createBufferSource;
    createBuffer = mockCtx.createBuffer;
    resume = mockCtx.resume;
    suspend = mockCtx.suspend;
    close = mockCtx.close;
    constructor(options?: unknown) {
      constructCount++;
      lastConstructorArg = options;
      // Return the shared mock object so tests can inspect it
      return mockCtx as unknown as MockAudioContext;
    }
  }
  vi.stubGlobal("AudioContext", MockAudioContext);

  return {
    mockCtx,
    mockGainNode,
    mockOscillator,
    MockAudioContext,
    get lastConstructorArg() {
      return lastConstructorArg;
    },
    get constructCount() {
      return constructCount;
    },
  };
}

// ─── Tests ───────────────────────────────────────

describe("AudioEngine", () => {
  let engine: AudioEngine;

  beforeEach(() => {
    engine = new AudioEngine();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("initial state", () => {
    test("status is uninitialized", () => {
      expect(engine.status).toBe("uninitialized");
    });

    test("audioContext is null", () => {
      expect(engine.audioContext).toBeNull();
    });
  });

  describe("init", () => {
    test("sets status to ready after successful init", async () => {
      stubGlobalAudioContext();
      await engine.init();
      expect(engine.status).toBe("ready");
    });

    test("creates an AudioContext", async () => {
      const stub = stubGlobalAudioContext();
      await engine.init();
      expect(stub.constructCount).toBe(1);
      expect(engine.audioContext).not.toBeNull();
    });

    test("passes latencyHint when configured", async () => {
      const stub = stubGlobalAudioContext();
      engine = new AudioEngine({ latencyHint: "playback" });
      await engine.init();
      expect(stub.lastConstructorArg).toEqual({ latencyHint: "playback" });
    });

    test("creates masterGain and connects to destination", async () => {
      const { mockCtx, mockGainNode } = stubGlobalAudioContext();
      await engine.init();
      expect(mockCtx.createGain).toHaveBeenCalled();
      expect(mockGainNode.connect).toHaveBeenCalledWith(mockCtx.destination);
    });

    test("does not re-initialize if already ready", async () => {
      const stub = stubGlobalAudioContext();
      await engine.init();
      await engine.init();
      expect(stub.constructCount).toBe(1);
    });

    test("sets status to error if AudioContext creation fails", async () => {
      vi.stubGlobal(
        "AudioContext",
        class FailingAudioContext {
          constructor() {
            throw new Error("AudioContext not supported");
          }
        },
      );
      await expect(engine.init()).rejects.toThrow("AudioContext not supported");
      expect(engine.status).toBe("error");
    });

    test("status transitions: uninitialized → loading → ready", async () => {
      stubGlobalAudioContext();
      const statuses: string[] = [];

      // Capture status during init by wrapping the method
      const origInit = engine.init.bind(engine);
      engine.init = async function () {
        // Record that it was 'uninitialized' before
        statuses.push(engine.status);
        const result = origInit();
        // After the first sync step, status should be 'loading'
        statuses.push(engine.status);
        await result;
        statuses.push(engine.status);
      };

      await engine.init();
      expect(statuses).toEqual(["uninitialized", "loading", "ready"]);
    });
  });

  describe("setVolume", () => {
    test("does not throw when masterGain is null (uninitialized)", () => {
      expect(() => engine.setVolume(0.5)).not.toThrow();
    });

    test("ramps to clamped value on masterGain when available", () => {
      let lastRampTarget = 0;
      const mockGainParam = {
        value: 0.5,
        cancelScheduledValues: vi.fn(),
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn((val: number) => {
          lastRampTarget = val;
        }),
      };
      const mockGain = { gain: mockGainParam } as unknown as GainNode;
      const mockCtx = { currentTime: 0 } as unknown as AudioContext;

      (engine as any)._masterGain = mockGain;
      (engine as any)._audioContext = mockCtx;

      engine.setVolume(0.7);
      expect(lastRampTarget).toBe(0.7);

      engine.setVolume(-0.5);
      expect(lastRampTarget).toBe(0); // clamped to 0

      engine.setVolume(1.5);
      expect(lastRampTarget).toBe(1); // clamped to 1

      engine.setVolume(0);
      expect(lastRampTarget).toBe(0);

      engine.setVolume(1);
      expect(lastRampTarget).toBe(1);

      // Verify smooth ramp is used (not direct assignment)
      expect(mockGainParam.cancelScheduledValues).toHaveBeenCalled();
      expect(mockGainParam.linearRampToValueAtTime).toHaveBeenCalledTimes(5);
    });
  });

  describe("noteOn / noteOff", () => {
    test("noteOn is a no-op when status is not ready", () => {
      expect(() => engine.noteOn(60, 100, 0)).not.toThrow();
    });

    test("noteOff is a no-op when audioContext is null", () => {
      expect(() => engine.noteOff(60, 0.5)).not.toThrow();
    });

    test("noteOn creates source and connects audio graph", async () => {
      const { mockCtx } = stubGlobalAudioContext();

      // Set up getSample to return a valid sample
      const mockBuffer = {} as AudioBuffer;
      const mockSample = {
        midi: 60,
        buffer: mockBuffer,
        sampleRate: 44100,
        basePitch: 60,
      };

      const loader = (engine as any)._soundFontLoader;
      loader.getSample.mockReturnValue(mockSample);

      await engine.init();

      const mockSource = createMockAudioBufferSourceNode();
      const mockVelocityGain = createMockGainNode();
      mockCtx.createBufferSource.mockReturnValue(mockSource);
      // First createGain is for masterGain in init, subsequent ones for velocity
      mockCtx.createGain.mockReturnValue(mockVelocityGain);

      engine.noteOn(60, 100, 1.5);

      expect(mockCtx.createBufferSource).toHaveBeenCalled();
      expect(mockSource.buffer).toBe(mockBuffer);
      expect(mockSource.start).toHaveBeenCalledWith(1.5);
      expect(mockSource.connect).toHaveBeenCalledWith(mockVelocityGain);
    });

    test("noteOff applies release envelope to the active note", async () => {
      const { mockCtx } = stubGlobalAudioContext();

      const mockSample = {
        midi: 60,
        buffer: {} as AudioBuffer,
        sampleRate: 44100,
        basePitch: 60,
      };

      const loader = (engine as any)._soundFontLoader;
      loader.getSample.mockReturnValue(mockSample);

      await engine.init();

      const mockSource = createMockAudioBufferSourceNode();
      const mockVelocityGain = createMockGainNode();
      mockCtx.createBufferSource.mockReturnValue(mockSource);
      mockCtx.createGain.mockReturnValue(mockVelocityGain);

      engine.noteOn(60, 100, 1.0);
      engine.noteOff(60, 2.0);

      // Release envelope should be applied
      expect(mockVelocityGain.gain.setValueAtTime).toHaveBeenCalled();
      expect(
        mockVelocityGain.gain.exponentialRampToValueAtTime,
      ).toHaveBeenCalled();
      expect(mockSource.stop).toHaveBeenCalled();
    });

    test("noteOn returns early if sample not found for midi", async () => {
      const { mockCtx } = stubGlobalAudioContext();

      const loader = (engine as any)._soundFontLoader;
      loader.getSample.mockReturnValue(undefined);

      await engine.init();

      engine.noteOn(60, 100, 0);
      // createBufferSource should NOT be called if no sample
      // (only the init call to createGain counts)
      expect(mockCtx.createBufferSource).not.toHaveBeenCalled();
    });

    test("noteOn with velocity=0 delegates to noteOff (MIDI spec R1-05)", async () => {
      const { mockCtx } = stubGlobalAudioContext();

      const mockSample = {
        midi: 60,
        buffer: {} as AudioBuffer,
        sampleRate: 44100,
        basePitch: 60,
      };

      const loader = (engine as any)._soundFontLoader;
      loader.getSample.mockReturnValue(mockSample);

      await engine.init();

      const mockSource = createMockAudioBufferSourceNode();
      const mockVelocityGain = createMockGainNode();
      mockCtx.createBufferSource.mockReturnValue(mockSource);
      mockCtx.createGain.mockReturnValue(mockVelocityGain);

      // First create a real note
      engine.noteOn(60, 100, 1.0);

      // Now send velocity=0 noteOn — should act as noteOff
      engine.noteOn(60, 0, 2.0);

      // The note should have been released (stop called via release envelope)
      expect(mockSource.stop).toHaveBeenCalled();
      // No additional source should have been created (only the first noteOn)
      expect(mockCtx.createBufferSource).toHaveBeenCalledTimes(1);
    });

    test("velocity=0 noteOn does not create a source node when no active note exists", async () => {
      const { mockCtx } = stubGlobalAudioContext();
      await engine.init();

      // velocity=0 with no active note — should be a no-op (noteOff on empty)
      engine.noteOn(60, 0, 0);
      expect(mockCtx.createBufferSource).not.toHaveBeenCalled();
    });

    test("per-key polyphony is capped at MAX_NOTES_PER_KEY (R1-08)", async () => {
      const { mockCtx } = stubGlobalAudioContext();

      const mockSample = {
        midi: 60,
        buffer: {} as AudioBuffer,
        sampleRate: 44100,
        basePitch: 60,
      };

      const loader = (engine as any)._soundFontLoader;
      loader.getSample.mockReturnValue(mockSample);

      await engine.init();

      const sources: ReturnType<typeof createMockAudioBufferSourceNode>[] = [];
      const gains: ReturnType<typeof createMockGainNode>[] = [];

      // Create fresh mock for each noteOn call
      mockCtx.createBufferSource.mockImplementation(() => {
        const s = createMockAudioBufferSourceNode();
        sources.push(s);
        return s;
      });
      mockCtx.createGain.mockImplementation(() => {
        const g = createMockGainNode();
        gains.push(g);
        return g;
      });

      // Fire 6 rapid noteOns on the same key (MAX_NOTES_PER_KEY = 4)
      for (let i = 0; i < 6; i++) {
        engine.noteOn(60, 100, 0);
      }

      // 6 sources should have been created
      expect(sources.length).toBe(6);

      // The oldest 2 should have been released (stop called)
      expect(sources[0].stop).toHaveBeenCalled();
      expect(sources[1].stop).toHaveBeenCalled();

      // The active notes map should have exactly 4 entries for this key
      const activeNotes = (engine as any)._activeNotes as Map<
        number,
        unknown[]
      >;
      expect(activeNotes.get(60)?.length).toBe(4);
    });

    test("release envelope uses stored velocityGain, not gain.gain.value (R1-02)", async () => {
      const { mockCtx } = stubGlobalAudioContext();

      const mockSample = {
        midi: 60,
        buffer: {} as AudioBuffer,
        sampleRate: 44100,
        basePitch: 60,
      };

      const loader = (engine as any)._soundFontLoader;
      loader.getSample.mockReturnValue(mockSample);

      await engine.init();

      const mockSource = createMockAudioBufferSourceNode();
      const mockVelocityGain = createMockGainNode();
      mockCtx.createBufferSource.mockReturnValue(mockSource);
      mockCtx.createGain.mockReturnValue(mockVelocityGain);

      // noteOn with velocity 100 → velGainValue = 100/127 ≈ 0.787
      engine.noteOn(60, 100, 1.0);

      // Simulate gain.gain.value going stale (e.g., mid-ramp snapshot)
      mockVelocityGain.gain.value = 0.0001;

      engine.noteOff(60, 2.0);

      // setValueAtTime should use the stored velocity (100/127), NOT the stale 0.0001
      const setValueCalls = mockVelocityGain.gain.setValueAtTime.mock.calls;
      const releaseCall = setValueCalls[setValueCalls.length - 1];
      const expectedVelocityGain = Math.max(100 / 127, 0.001);
      expect(releaseCall[0]).toBeCloseTo(expectedVelocityGain, 3);
    });

    test("onended handler does not throw when nodes are already disconnected (R1-03)", async () => {
      const { mockCtx } = stubGlobalAudioContext();

      const mockSample = {
        midi: 60,
        buffer: {} as AudioBuffer,
        sampleRate: 44100,
        basePitch: 60,
      };

      const loader = (engine as any)._soundFontLoader;
      loader.getSample.mockReturnValue(mockSample);

      await engine.init();

      const mockSource = createMockAudioBufferSourceNode();
      const mockVelocityGain = createMockGainNode();
      // Make disconnect throw (simulating already-disconnected state from allNotesOff)
      mockSource.disconnect = vi.fn(() => {
        throw new DOMException("InvalidStateError");
      });
      mockVelocityGain.disconnect = vi.fn(() => {
        throw new DOMException("InvalidStateError");
      });

      mockCtx.createBufferSource.mockReturnValue(mockSource);
      mockCtx.createGain.mockReturnValue(mockVelocityGain);

      engine.noteOn(60, 100, 0);

      // Simulate onended firing after allNotesOff has already disconnected nodes
      expect(mockSource.onended).toBeTypeOf("function");
      expect(() => mockSource.onended!()).not.toThrow();
    });

    test("noteOn reports recoverable runtime failures for auto-rebuild", async () => {
      const { mockCtx } = stubGlobalAudioContext();
      const runtimeError = new Error(
        "WASAPI rendering failed: device invalidated (0x88890004)",
      );
      const onRuntimeError = vi.fn();
      engine.setRuntimeErrorHandler(onRuntimeError);

      const mockSample = {
        midi: 60,
        buffer: {} as AudioBuffer,
        sampleRate: 44100,
        basePitch: 60,
      };

      const loader = (engine as any)._soundFontLoader;
      loader.getSample.mockReturnValue(mockSample);

      await engine.init();

      const failingSource = createMockAudioBufferSourceNode();
      failingSource.start = vi.fn(() => {
        throw runtimeError;
      });
      mockCtx.createBufferSource.mockReturnValue(failingSource);
      mockCtx.createGain.mockReturnValue(createMockGainNode());

      expect(() => engine.noteOn(60, 100, 0)).not.toThrow();
      expect(engine.status).toBe("error");
      expect(onRuntimeError).toHaveBeenCalledWith(runtimeError);
    });

    test("non-recoverable errors are logged but do not change status (R1-07)", async () => {
      const { mockCtx } = stubGlobalAudioContext();
      // A non-recoverable error (not WASAPI/InvalidState/etc.)
      const nonRecoverableError = new TypeError(
        "Cannot read properties of undefined",
      );
      const onRuntimeError = vi.fn();
      engine.setRuntimeErrorHandler(onRuntimeError);

      const mockSample = {
        midi: 60,
        buffer: {} as AudioBuffer,
        sampleRate: 44100,
        basePitch: 60,
      };

      const loader = (engine as any)._soundFontLoader;
      loader.getSample.mockReturnValue(mockSample);

      await engine.init();
      expect(engine.status).toBe("ready");

      const failingSource = createMockAudioBufferSourceNode();
      failingSource.start = vi.fn(() => {
        throw nonRecoverableError;
      });
      mockCtx.createBufferSource.mockReturnValue(failingSource);
      mockCtx.createGain.mockReturnValue(createMockGainNode());

      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      expect(() => engine.noteOn(60, 100, 0)).not.toThrow();

      // Status should NOT change for non-recoverable errors
      expect(engine.status).toBe("ready");
      // Callback should NOT fire for non-recoverable errors
      expect(onRuntimeError).not.toHaveBeenCalled();
      // But the error SHOULD be logged
      expect(consoleSpy).toHaveBeenCalledWith(
        "AudioEngine.noteOn runtime failure:",
        nonRecoverableError,
      );

      consoleSpy.mockRestore();
    });
  });

  describe("allNotesOff", () => {
    test("does not throw when no active notes", () => {
      expect(() => engine.allNotesOff()).not.toThrow();
    });

    test("stops all active sources", async () => {
      const { mockCtx } = stubGlobalAudioContext();

      const mockSample = {
        midi: 60,
        buffer: {} as AudioBuffer,
        sampleRate: 44100,
        basePitch: 60,
      };

      const loader = (engine as any)._soundFontLoader;
      loader.getSample.mockReturnValue(mockSample);

      await engine.init();

      const mockSource = createMockAudioBufferSourceNode();
      const mockVelocityGain = createMockGainNode();
      mockCtx.createBufferSource.mockReturnValue(mockSource);
      mockCtx.createGain.mockReturnValue(mockVelocityGain);

      engine.noteOn(60, 100, 0);
      engine.allNotesOff();

      expect(mockSource.stop).toHaveBeenCalled();
    });
  });

  describe("sustain pedal", () => {
    test("sustainOn prevents noteOff from releasing the note", async () => {
      const { mockCtx } = stubGlobalAudioContext();

      const mockSample = {
        midi: 60,
        buffer: {} as AudioBuffer,
        sampleRate: 44100,
        basePitch: 60,
      };

      const loader = (engine as any)._soundFontLoader;
      loader.getSample.mockReturnValue(mockSample);

      await engine.init();

      const mockSource = createMockAudioBufferSourceNode();
      const mockVelocityGain = createMockGainNode();
      mockCtx.createBufferSource.mockReturnValue(mockSource);
      mockCtx.createGain.mockReturnValue(mockVelocityGain);

      engine.sustainOn();
      engine.noteOn(60, 100, 0);
      engine.noteOff(60, 1.0);

      // Note should NOT have been released (no stop, no envelope ramp)
      expect(mockSource.stop).not.toHaveBeenCalled();
      expect(
        mockVelocityGain.gain.exponentialRampToValueAtTime,
      ).not.toHaveBeenCalled();

      // Note should be in the sustained notes map

      const sustainedNotes = (engine as any)._sustainedNotes as Map<
        number,
        unknown[]
      >;
      expect(sustainedNotes.size).toBe(1);
      expect(sustainedNotes.get(60)?.length).toBe(1);
    });

    test("sustainOff releases all sustained notes", async () => {
      const { mockCtx } = stubGlobalAudioContext();

      const mockSample = {
        midi: 60,
        buffer: {} as AudioBuffer,
        sampleRate: 44100,
        basePitch: 60,
      };

      const loader = (engine as any)._soundFontLoader;
      loader.getSample.mockReturnValue(mockSample);

      await engine.init();

      const mockSource = createMockAudioBufferSourceNode();
      const mockVelocityGain = createMockGainNode();
      mockCtx.createBufferSource.mockReturnValue(mockSource);
      mockCtx.createGain.mockReturnValue(mockVelocityGain);

      engine.sustainOn();
      engine.noteOn(60, 100, 0);
      engine.noteOff(60, 1.0);

      // Verify note is sustained, not released
      expect(mockSource.stop).not.toHaveBeenCalled();

      // Now release pedal
      engine.sustainOff();

      // Note should now be released with envelope
      expect(mockVelocityGain.gain.setValueAtTime).toHaveBeenCalled();
      expect(
        mockVelocityGain.gain.exponentialRampToValueAtTime,
      ).toHaveBeenCalled();
      expect(mockSource.stop).toHaveBeenCalled();

      // Sustained notes map should be cleared

      const sustainedNotes = (engine as any)._sustainedNotes as Map<
        number,
        unknown[]
      >;
      expect(sustainedNotes.size).toBe(0);
    });

    test("noteOff releases normally when sustain is not active", async () => {
      const { mockCtx } = stubGlobalAudioContext();

      const mockSample = {
        midi: 60,
        buffer: {} as AudioBuffer,
        sampleRate: 44100,
        basePitch: 60,
      };

      const loader = (engine as any)._soundFontLoader;
      loader.getSample.mockReturnValue(mockSample);

      await engine.init();

      const mockSource = createMockAudioBufferSourceNode();
      const mockVelocityGain = createMockGainNode();
      mockCtx.createBufferSource.mockReturnValue(mockSource);
      mockCtx.createGain.mockReturnValue(mockVelocityGain);

      // No sustainOn() — normal behavior
      engine.noteOn(60, 100, 0);
      engine.noteOff(60, 1.0);

      // Note should be released immediately
      expect(mockSource.stop).toHaveBeenCalled();
      expect(
        mockVelocityGain.gain.exponentialRampToValueAtTime,
      ).toHaveBeenCalled();
    });

    test("allNotesOff clears sustained notes too", async () => {
      const { mockCtx } = stubGlobalAudioContext();

      const mockSample = {
        midi: 60,
        buffer: {} as AudioBuffer,
        sampleRate: 44100,
        basePitch: 60,
      };

      const loader = (engine as any)._soundFontLoader;
      loader.getSample.mockReturnValue(mockSample);

      await engine.init();

      const mockSource = createMockAudioBufferSourceNode();
      const mockVelocityGain = createMockGainNode();
      mockCtx.createBufferSource.mockReturnValue(mockSource);
      mockCtx.createGain.mockReturnValue(mockVelocityGain);

      engine.sustainOn();
      engine.noteOn(60, 100, 0);
      engine.noteOff(60, 1.0);

      // Note is sustained

      const sustainedNotes = (engine as any)._sustainedNotes as Map<
        number,
        unknown[]
      >;
      expect(sustainedNotes.size).toBe(1);

      engine.allNotesOff();

      // Both active and sustained should be cleared
      expect(sustainedNotes.size).toBe(0);
      expect(mockSource.stop).toHaveBeenCalled();
    });
  });

  describe("resume / suspend", () => {
    test("resume does not throw when audioContext is null", async () => {
      await expect(engine.resume()).resolves.toBeUndefined();
    });

    test("suspend does not throw when audioContext is null", async () => {
      await expect(engine.suspend()).resolves.toBeUndefined();
    });

    test("resume calls audioContext.resume when available", async () => {
      const mockCtx = {
        resume: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
      } as unknown as AudioContext;

      (engine as any)._audioContext = mockCtx;

      await engine.resume();
      expect(mockCtx.resume).toHaveBeenCalledTimes(1);
    });

    test("resume reports recoverable runtime failures for auto-rebuild", async () => {
      const runtimeError = new Error(
        "IAudioClient::GetCurrentPadding failed (0x88890004)",
      );
      const onRuntimeError = vi.fn();
      engine.setRuntimeErrorHandler(onRuntimeError);

      const mockCtx = {
        resume: vi.fn().mockRejectedValue(runtimeError),
        close: vi.fn().mockResolvedValue(undefined),
      } as unknown as AudioContext;

      (engine as any)._audioContext = mockCtx;

      (engine as any)._status = "ready";

      await expect(engine.resume()).rejects.toThrow(runtimeError);
      expect(engine.status).toBe("error");
      expect(onRuntimeError).toHaveBeenCalledWith(runtimeError);
    });

    test("suspend calls audioContext.suspend when available", async () => {
      const mockCtx = {
        suspend: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
      } as unknown as AudioContext;

      (engine as any)._audioContext = mockCtx;

      await engine.suspend();
      expect(mockCtx.suspend).toHaveBeenCalledTimes(1);
    });
  });

  describe("dispose", () => {
    test("sets status to uninitialized", () => {
      engine.dispose();
      expect(engine.status).toBe("uninitialized");
    });

    test("nullifies audioContext and masterGain", () => {
      const mockCtx = {
        close: vi.fn().mockResolvedValue(undefined),
      } as unknown as AudioContext;

      (engine as any)._audioContext = mockCtx;

      (engine as any)._masterGain = {} as GainNode;

      engine.dispose();
      expect(engine.audioContext).toBeNull();
      expect(engine.status).toBe("uninitialized");
    });

    test("calls audioContext.close when available", () => {
      const closeFn = vi.fn().mockResolvedValue(undefined);
      const mockCtx = { close: closeFn } as unknown as AudioContext;

      (engine as any)._audioContext = mockCtx;

      engine.dispose();
      expect(closeFn).toHaveBeenCalledTimes(1);
    });

    test("disposes soundFontLoader", async () => {
      stubGlobalAudioContext();
      await engine.init();

      const loader = (engine as any)._soundFontLoader;
      engine.dispose();
      expect(loader.dispose).toHaveBeenCalled();
    });

    test("dispose is safe to call multiple times", () => {
      engine.dispose();
      engine.dispose();
      expect(engine.status).toBe("uninitialized");
    });

    test("dispose is safe when audioContext is already null", () => {
      expect(() => engine.dispose()).not.toThrow();
    });
  });

  describe("playErrorTone", () => {
    test("is a no-op when audioContext is null (uninitialized)", () => {
      expect(() => engine.playErrorTone()).not.toThrow();
    });

    test("is a no-op when status is not ready", () => {
      (engine as any)._audioContext = {} as AudioContext;

      (engine as any)._status = "loading";
      expect(() => engine.playErrorTone()).not.toThrow();
    });

    test("creates oscillator and gain nodes when engine is ready", async () => {
      const { mockCtx, mockOscillator } = stubGlobalAudioContext();
      await engine.init();

      // Reset createGain call count (init creates masterGain)
      mockCtx.createGain.mockClear();

      const errorGain = createMockGainNode();
      mockCtx.createGain.mockReturnValue(errorGain);
      mockCtx.createOscillator.mockReturnValue(mockOscillator);

      engine.playErrorTone();

      expect(mockCtx.createOscillator).toHaveBeenCalled();
      expect(mockCtx.createGain).toHaveBeenCalled();
      expect(mockOscillator.frequency.setValueAtTime).toHaveBeenCalledWith(
        400,
        0,
      );
      expect(
        mockOscillator.frequency.exponentialRampToValueAtTime,
      ).toHaveBeenCalledWith(200, 0.08);
      expect(errorGain.gain.setValueAtTime).toHaveBeenCalledWith(0.15, 0);
      expect(mockOscillator.connect).toHaveBeenCalledWith(errorGain);
      expect(mockOscillator.start).toHaveBeenCalledWith(0);
      expect(mockOscillator.stop).toHaveBeenCalledWith(0.1);
    });

    test("cleans up nodes via onended callback", async () => {
      const { mockCtx } = stubGlobalAudioContext();
      await engine.init();

      const osc = createMockOscillatorNode();
      const gain = createMockGainNode();
      mockCtx.createOscillator.mockReturnValue(osc);
      mockCtx.createGain.mockReturnValue(gain);

      engine.playErrorTone();

      // Simulate oscillator ending
      expect(osc.onended).toBeTypeOf("function");
      osc.onended!();

      expect(osc.disconnect).toHaveBeenCalled();
      expect(gain.disconnect).toHaveBeenCalled();
    });
  });

  describe("setReleaseTime", () => {
    test("clamps value to minimum 0.05", () => {
      engine.setReleaseTime(0);
      expect((engine as any)._releaseTime).toBe(0.05);

      engine.setReleaseTime(0.01);
      expect((engine as any)._releaseTime).toBe(0.05);

      engine.setReleaseTime(-1);
      expect((engine as any)._releaseTime).toBe(0.05);
    });

    test("clamps value to maximum 0.3", () => {
      engine.setReleaseTime(1);
      expect((engine as any)._releaseTime).toBe(0.3);

      engine.setReleaseTime(999);
      expect((engine as any)._releaseTime).toBe(0.3);
    });

    test("accepts values within valid range", () => {
      engine.setReleaseTime(0.05);
      expect((engine as any)._releaseTime).toBe(0.05);

      engine.setReleaseTime(0.15);
      expect((engine as any)._releaseTime).toBe(0.15);

      engine.setReleaseTime(0.3);
      expect((engine as any)._releaseTime).toBe(0.3);

      engine.setReleaseTime(0.2);
      expect((engine as any)._releaseTime).toBe(0.2);
    });
  });

  describe("concurrent init / dispose", () => {
    test("concurrent init() calls do not create multiple AudioContexts", async () => {
      const stub = stubGlobalAudioContext();
      const p1 = engine.init();
      const p2 = engine.init();
      await Promise.all([p1, p2]);
      expect(engine.status).toBe("ready");
      // Only one AudioContext should have been created despite two init() calls
      expect(stub.constructCount).toBe(1);
    });

    test("dispose() during in-flight init() leaves engine uninitialized", async () => {
      const stub = stubGlobalAudioContext();
      // Make SoundFontLoader.load() hang so we can dispose mid-init
      const loader = (engine as any)._soundFontLoader;
      let resolveLoad: () => void;
      loader.load = vi.fn(
        () =>
          new Promise<void>((res) => {
            resolveLoad = res;
          }),
      );

      const initPromise = engine.init();
      expect(engine.status).toBe("loading");

      // Dispose while init is in-flight
      engine.dispose();

      // Now let the load complete — _doInit should see _disposed=true and bail
      resolveLoad!();
      await initPromise;

      expect(engine.status).toBe("uninitialized");
      expect(engine.audioContext).toBeNull();
      // The AudioContext created during _doInit should be closed
      expect(stub.mockCtx.close).toHaveBeenCalled();
    });

    test("init() after dispose() starts a fresh initialization", async () => {
      const stub = stubGlobalAudioContext();
      await engine.init();
      expect(engine.status).toBe("ready");

      engine.dispose();
      expect(engine.status).toBe("uninitialized");

      // Re-init should succeed
      await engine.init();
      expect(engine.status).toBe("ready");
      // Two AudioContext constructions: original + re-init
      expect(stub.constructCount).toBe(2);
    });
  });
});
