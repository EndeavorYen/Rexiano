import { describe, expect, test, vi } from "vitest";
import type { IAudioEngine } from "../../engines/audio/types";
import type { ParsedNote, ParsedSong } from "../../engines/midi/types";
import {
  DEFAULT_SONG_AUDIO_PREVIEW_SECONDS,
  SongAudioPreviewPlayer,
  buildSongAudioPreviewPlan,
  startSongAudioPreview,
} from "./songPreviewPlayback";

function makeNote(
  midi: number,
  time: number,
  duration: number,
  velocity = 96,
): ParsedNote {
  return {
    midi,
    name: `n${midi}`,
    time,
    duration,
    velocity,
  };
}

function makeSong(tracks: ParsedNote[][]): ParsedSong {
  return {
    fileName: "preview.mid",
    duration: 48,
    tracks: tracks.map((notes, index) => ({
      name: `Track ${index + 1}`,
      instrument: "piano",
      channel: index,
      notes,
    })),
    tempos: [{ time: 0, bpm: 120 }],
    timeSignatures: [{ time: 0, numerator: 4, denominator: 4 }],
    noteCount: tracks.reduce((sum, notes) => sum + notes.length, 0),
  };
}

function makeEngine(callOrder: string[] = []): IAudioEngine {
  return {
    status: "ready",
    audioContext: { currentTime: 100 } as AudioContext,
    init: vi.fn(async () => {
      callOrder.push("init");
    }),
    resume: vi.fn(async () => {
      callOrder.push("resume");
    }),
    suspend: vi.fn(async () => undefined),
    setVolume: vi.fn((volume: number) => {
      callOrder.push(`volume:${volume}`);
    }),
    noteOn: vi.fn((midi: number) => {
      callOrder.push(`on:${midi}`);
    }),
    noteOff: vi.fn((midi: number) => {
      callOrder.push(`off:${midi}`);
    }),
    allNotesOff: vi.fn(() => {
      callOrder.push("stop");
    }),
    dispose: vi.fn(() => {
      callOrder.push("dispose");
    }),
  };
}

describe("buildSongAudioPreviewPlan", () => {
  test("starts at the first note and keeps the excerpt bounded", () => {
    const song = makeSong([
      [makeNote(60, 12, 1.5), makeNote(64, 20.25, 1)],
      [makeNote(67, 13, 0.5), makeNote(72, 21, 1)],
    ]);

    expect(buildSongAudioPreviewPlan(song)).toEqual({
      startTimeSeconds: 12,
      durationSeconds: DEFAULT_SONG_AUDIO_PREVIEW_SECONDS,
      notes: [
        {
          midi: 60,
          velocity: 96,
          startOffsetSeconds: 0,
          durationSeconds: 1.5,
          trackIndex: 0,
        },
        {
          midi: 67,
          velocity: 96,
          startOffsetSeconds: 1,
          durationSeconds: 0.5,
          trackIndex: 1,
        },
      ],
    });
  });

  test("clamps notes that overlap an explicit preview window", () => {
    const song = makeSong([[makeNote(60, 9.5, 1), makeNote(64, 10.5, 4)]]);

    expect(
      buildSongAudioPreviewPlan(song, {
        startTimeSeconds: 10,
        durationSeconds: 2,
      }).notes,
    ).toEqual([
      {
        midi: 60,
        velocity: 96,
        startOffsetSeconds: 0,
        durationSeconds: 0.5,
        trackIndex: 0,
      },
      {
        midi: 64,
        velocity: 96,
        startOffsetSeconds: 0.5,
        durationSeconds: 1.5,
        trackIndex: 0,
      },
    ]);
  });
});

describe("startSongAudioPreview", () => {
  test("schedules preview notes against AudioContext time and stops automatically", async () => {
    vi.useFakeTimers();
    const onEnded = vi.fn();
    const engine = makeEngine();
    const song = makeSong([[makeNote(60, 2, 1), makeNote(64, 3, 0.5)]]);

    await startSongAudioPreview(engine, song, {
      leadInSeconds: 0.05,
      releasePaddingSeconds: 0.25,
      onEnded,
      volume: 0.4,
    });

    expect(engine.init).toHaveBeenCalledOnce();
    expect(engine.resume).toHaveBeenCalledOnce();
    expect(engine.setVolume).toHaveBeenCalledWith(0.4);
    expect(engine.noteOn).toHaveBeenNthCalledWith(1, 60, 96, 100.05);
    expect(engine.noteOff).toHaveBeenNthCalledWith(1, 60, 101.05);
    expect(engine.noteOn).toHaveBeenNthCalledWith(2, 64, 96, 101.05);
    expect(engine.noteOff).toHaveBeenNthCalledWith(2, 64, 101.55);

    await vi.advanceTimersByTimeAsync(8299);
    expect(onEnded).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(engine.allNotesOff).toHaveBeenCalledTimes(2);
    expect(onEnded).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  test("returns a manual stop handle that does not fire the ended callback", async () => {
    vi.useFakeTimers();
    const onEnded = vi.fn();
    const engine = makeEngine();
    const song = makeSong([[makeNote(60, 0, 1)]]);

    const handle = await startSongAudioPreview(engine, song, { onEnded });
    handle.stop();

    await vi.runOnlyPendingTimersAsync();
    expect(onEnded).not.toHaveBeenCalled();
    expect(engine.allNotesOff).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});

describe("SongAudioPreviewPlayer", () => {
  test("stops the current preview before starting the next one", async () => {
    vi.useFakeTimers();
    const callOrder: string[] = [];
    const engine = makeEngine(callOrder);
    const player = new SongAudioPreviewPlayer(engine);

    await player.play(makeSong([[makeNote(60, 0, 1)]]));
    await player.play(makeSong([[makeNote(67, 0, 1)]]));

    expect(callOrder).toEqual([
      "stop",
      "init",
      "resume",
      "on:60",
      "off:60",
      "stop",
      "stop",
      "init",
      "resume",
      "on:67",
      "off:67",
    ]);

    player.dispose();
    expect(callOrder.at(-2)).toBe("stop");
    expect(callOrder.at(-1)).toBe("dispose");
    vi.useRealTimers();
  });
});
