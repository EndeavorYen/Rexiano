import { describe, it, expect, vi, beforeEach } from "vitest";

// We store the mock data that the MockMidi constructor will use
let nextMockData: ReturnType<typeof buildMockMidi>;

// Mock @tonejs/midi with a real class so `new Midi(...)` works as a constructor
vi.mock("@tonejs/midi", () => ({
  Midi: class MockMidi {
    tracks: unknown[];
    duration: number;
    header: unknown;
    constructor(_data: Uint8Array) {
      this.tracks = nextMockData.tracks;
      this.duration = nextMockData.duration;
      this.header = nextMockData.header;
    }
  },
}));

import { parseMidiFile } from "./MidiFileParser";

/** Build a mock Midi-shaped object with sensible defaults */
function buildMockMidi(overrides: {
  tracks?: Array<{
    name?: string;
    channel?: number;
    instrument?: { name: string };
    notes?: Array<{
      midi: number;
      name: string;
      octave: number;
      time: number;
      duration: number;
      velocity: number;
    }>;
  }>;
  duration?: number;
  tempos?: Array<{ ticks: number; bpm: number }>;
  timeSignatures?: Array<{
    ticks: number;
    timeSignature: [number, number];
  }>;
  keySignatures?: Array<{
    ticks: number;
    key: string;
    scale: string;
  }>;
}) {
  const tracks = (overrides.tracks ?? []).map((t) => ({
    name: t.name ?? "",
    channel: t.channel ?? 0,
    instrument: t.instrument ?? { name: "" },
    notes: t.notes ?? [],
  }));

  const tempos = overrides.tempos ?? [];
  const timeSignatures = overrides.timeSignatures ?? [];
  const keySignatures = overrides.keySignatures ?? [];

  return {
    tracks,
    duration: overrides.duration ?? 10,
    header: {
      tempos,
      timeSignatures,
      keySignatures,
      ticksToSeconds: vi.fn((ticks: number) => ticks / 480),
    },
  };
}

/** Prepare mock data for the next `new Midi(...)` call */
function prepareMidi(overrides: Parameters<typeof buildMockMidi>[0]) {
  const mock = buildMockMidi(overrides);
  nextMockData = mock;
  return mock;
}

describe("MidiFileParser — parseMidiFile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("parses a basic MIDI file with one track", () => {
    prepareMidi({
      tracks: [
        {
          name: "Piano",
          channel: 0,
          instrument: { name: "Acoustic Grand Piano" },
          notes: [
            {
              midi: 60,
              name: "C",
              octave: 4,
              time: 0,
              duration: 0.5,
              velocity: 0.8,
            },
            {
              midi: 64,
              name: "E",
              octave: 4,
              time: 0.5,
              duration: 0.5,
              velocity: 0.6,
            },
          ],
        },
      ],
      tempos: [{ ticks: 0, bpm: 120 }],
      timeSignatures: [{ ticks: 0, timeSignature: [4, 4] }],
    });

    const result = parseMidiFile("test.mid", [0x4d, 0x54, 0x68, 0x64]);

    expect(result.fileName).toBe("test.mid");
    expect(result.tracks).toHaveLength(1);
    expect(result.tracks[0].name).toBe("Piano");
    expect(result.tracks[0].instrument).toBe("Acoustic Grand Piano");
    expect(result.tracks[0].channel).toBe(0);
    expect(result.tracks[0].notes).toHaveLength(2);
    expect(result.noteCount).toBe(2);
  });

  it("filters out empty tracks (no notes)", () => {
    prepareMidi({
      tracks: [
        { name: "Empty Track", channel: 0, notes: [] },
        {
          name: "Has Notes",
          channel: 1,
          notes: [
            {
              midi: 60,
              name: "C",
              octave: 4,
              time: 0,
              duration: 1,
              velocity: 0.5,
            },
          ],
        },
        { name: "Also Empty", channel: 2, notes: [] },
      ],
    });

    const result = parseMidiFile("filter.mid", []);

    expect(result.tracks).toHaveLength(1);
    expect(result.tracks[0].name).toBe("Has Notes");
  });

  it("sorts notes by time then by pitch", () => {
    prepareMidi({
      tracks: [
        {
          name: "Unsorted",
          channel: 0,
          notes: [
            {
              midi: 72,
              name: "C",
              octave: 5,
              time: 1.0,
              duration: 0.5,
              velocity: 0.5,
            },
            {
              midi: 60,
              name: "C",
              octave: 4,
              time: 0.0,
              duration: 0.5,
              velocity: 0.5,
            },
            {
              midi: 67,
              name: "G",
              octave: 4,
              time: 0.0,
              duration: 0.5,
              velocity: 0.5,
            },
            {
              midi: 64,
              name: "E",
              octave: 4,
              time: 0.0,
              duration: 0.5,
              velocity: 0.5,
            },
          ],
        },
      ],
    });

    const result = parseMidiFile("sort.mid", []);
    const notes = result.tracks[0].notes;

    // Notes at time 0 sorted by pitch (60, 64, 67), then time 1.0 note
    expect(notes[0].midi).toBe(60);
    expect(notes[1].midi).toBe(64);
    expect(notes[2].midi).toBe(67);
    expect(notes[3].midi).toBe(72);
    expect(notes[3].time).toBe(1.0);
  });

  it("extracts tempo events with correct time conversion", () => {
    const mock = prepareMidi({
      tracks: [
        {
          notes: [
            {
              midi: 60,
              name: "C",
              octave: 4,
              time: 0,
              duration: 1,
              velocity: 0.5,
            },
          ],
        },
      ],
      tempos: [
        { ticks: 0, bpm: 120 },
        { ticks: 960, bpm: 140 },
      ],
    });

    const result = parseMidiFile("tempo.mid", []);

    expect(result.tempos).toHaveLength(2);
    expect(result.tempos[0]).toEqual({ time: 0, bpm: 120 });
    expect(result.tempos[1]).toEqual({ time: 2, bpm: 140 }); // 960/480 = 2s
    expect(mock.header.ticksToSeconds).toHaveBeenCalledWith(0);
    expect(mock.header.ticksToSeconds).toHaveBeenCalledWith(960);
  });

  it("extracts time signature events", () => {
    prepareMidi({
      tracks: [
        {
          notes: [
            {
              midi: 60,
              name: "C",
              octave: 4,
              time: 0,
              duration: 1,
              velocity: 0.5,
            },
          ],
        },
      ],
      timeSignatures: [
        { ticks: 0, timeSignature: [4, 4] },
        { ticks: 1920, timeSignature: [3, 4] },
      ],
    });

    const result = parseMidiFile("timesig.mid", []);

    expect(result.timeSignatures).toHaveLength(2);
    expect(result.timeSignatures[0]).toEqual({
      time: 0,
      numerator: 4,
      denominator: 4,
    });
    expect(result.timeSignatures[1]).toEqual({
      time: 4, // 1920/480 = 4s
      numerator: 3,
      denominator: 4,
    });
  });

  it("calculates duration from last note end, not midi.duration", () => {
    prepareMidi({
      tracks: [
        {
          notes: [
            {
              midi: 60,
              name: "C",
              octave: 4,
              time: 0,
              duration: 0.5,
              velocity: 0.5,
            },
            {
              midi: 64,
              name: "E",
              octave: 4,
              time: 2.0,
              duration: 1.5,
              velocity: 0.5,
            },
          ],
        },
      ],
      duration: 100,
    });

    const result = parseMidiFile("duration.mid", []);

    // Last note ends at 2.0 + 1.5 = 3.5
    expect(result.duration).toBe(3.5);
  });

  it("uses midi.duration as fallback when no notes exist", () => {
    prepareMidi({
      tracks: [],
      duration: 42,
    });

    const result = parseMidiFile("empty.mid", []);

    expect(result.duration).toBe(42);
    expect(result.tracks).toHaveLength(0);
    expect(result.noteCount).toBe(0);
  });

  it("sets default track name when track.name is empty", () => {
    prepareMidi({
      tracks: [
        {
          name: "",
          channel: 3,
          notes: [
            {
              midi: 60,
              name: "C",
              octave: 4,
              time: 0,
              duration: 1,
              velocity: 0.5,
            },
          ],
        },
      ],
    });

    const result = parseMidiFile("noname.mid", []);

    // Should default to "Track {channel + 1}"
    expect(result.tracks[0].name).toBe("Track 4");
  });

  it("sets default instrument name when instrument.name is empty", () => {
    prepareMidi({
      tracks: [
        {
          name: "Track",
          instrument: { name: "" },
          notes: [
            {
              midi: 60,
              name: "C",
              octave: 4,
              time: 0,
              duration: 1,
              velocity: 0.5,
            },
          ],
        },
      ],
    });

    const result = parseMidiFile("noinst.mid", []);

    expect(result.tracks[0].instrument).toBe("Piano");
  });

  it("converts velocity from 0-1 float to 0-127 integer", () => {
    prepareMidi({
      tracks: [
        {
          notes: [
            {
              midi: 60,
              name: "C",
              octave: 4,
              time: 0,
              duration: 1,
              velocity: 1.0,
            },
            {
              midi: 62,
              name: "D",
              octave: 4,
              time: 1,
              duration: 1,
              velocity: 0.5,
            },
            {
              midi: 64,
              name: "E",
              octave: 4,
              time: 2,
              duration: 1,
              velocity: 0.0,
            },
          ],
        },
      ],
    });

    const result = parseMidiFile("velocity.mid", []);
    const notes = result.tracks[0].notes;

    expect(notes[0].velocity).toBe(127); // 1.0 * 127 = 127
    expect(notes[1].velocity).toBe(64); // 0.5 * 127 = 63.5 -> rounded to 64
    expect(notes[2].velocity).toBe(0); // 0.0 * 127 = 0
  });

  it("concatenates note name and octave correctly", () => {
    prepareMidi({
      tracks: [
        {
          notes: [
            {
              midi: 60,
              name: "C4",
              octave: 4,
              time: 0,
              duration: 1,
              velocity: 0.5,
            },
            {
              midi: 61,
              name: "C#4",
              octave: 4,
              time: 1,
              duration: 1,
              velocity: 0.5,
            },
            {
              midi: 69,
              name: "A4",
              octave: 4,
              time: 2,
              duration: 1,
              velocity: 0.5,
            },
          ],
        },
      ],
    });

    const result = parseMidiFile("names.mid", []);
    const notes = result.tracks[0].notes;

    expect(notes[0].name).toBe("C4");
    expect(notes[1].name).toBe("C#4");
    expect(notes[2].name).toBe("A4");
  });

  it("handles multiple tracks with correct note count", () => {
    prepareMidi({
      tracks: [
        {
          name: "Right Hand",
          channel: 0,
          notes: [
            {
              midi: 60,
              name: "C",
              octave: 4,
              time: 0,
              duration: 1,
              velocity: 0.5,
            },
            {
              midi: 64,
              name: "E",
              octave: 4,
              time: 0,
              duration: 1,
              velocity: 0.5,
            },
          ],
        },
        {
          name: "Left Hand",
          channel: 1,
          notes: [
            {
              midi: 48,
              name: "C",
              octave: 3,
              time: 0,
              duration: 2,
              velocity: 0.4,
            },
          ],
        },
      ],
    });

    const result = parseMidiFile("multi.mid", []);

    expect(result.tracks).toHaveLength(2);
    expect(result.noteCount).toBe(3);
  });

  it("calculates duration across multiple tracks correctly", () => {
    prepareMidi({
      tracks: [
        {
          notes: [
            {
              midi: 60,
              name: "C",
              octave: 4,
              time: 0,
              duration: 1,
              velocity: 0.5,
            },
          ],
        },
        {
          notes: [
            {
              midi: 48,
              name: "C",
              octave: 3,
              time: 5.0,
              duration: 2.0,
              velocity: 0.5,
            },
          ],
        },
      ],
      duration: 50,
    });

    const result = parseMidiFile("multitrack-dur.mid", []);

    // Should use the max end time across all tracks (5.0 + 2.0 = 7.0)
    expect(result.duration).toBe(7.0);
  });

  it("returns empty arrays when no tempos or time signatures exist", () => {
    prepareMidi({
      tracks: [
        {
          notes: [
            {
              midi: 60,
              name: "C",
              octave: 4,
              time: 0,
              duration: 1,
              velocity: 0.5,
            },
          ],
        },
      ],
      tempos: [],
      timeSignatures: [],
    });

    const result = parseMidiFile("minimal.mid", []);

    expect(result.tempos).toEqual([]);
    expect(result.timeSignatures).toEqual([]);
  });

  it("rounds BPM values to one decimal place", () => {
    prepareMidi({
      tracks: [
        {
          notes: [
            {
              midi: 60,
              name: "C",
              octave: 4,
              time: 0,
              duration: 1,
              velocity: 0.5,
            },
          ],
        },
      ],
      tempos: [{ ticks: 0, bpm: 119.94 }],
    });

    const result = parseMidiFile("bpm-round.mid", []);

    // Math.round(119.94 * 10) / 10 = 119.9 (one decimal place, not integer)
    expect(result.tempos[0].bpm).toBe(119.9);
  });

  describe("key signature parsing", () => {
    it("includes keySignatures array in ParsedSong", () => {
      prepareMidi({
        tracks: [
          {
            notes: [
              {
                midi: 60,
                name: "C",
                octave: 4,
                time: 0,
                duration: 1,
                velocity: 0.5,
              },
            ],
          },
        ],
      });

      const result = parseMidiFile("test.mid", []);
      expect(result.keySignatures).toBeDefined();
      expect(Array.isArray(result.keySignatures)).toBe(true);
    });

    it("defaults keySignatures to empty array for files without key events", () => {
      prepareMidi({
        tracks: [
          {
            notes: [
              {
                midi: 60,
                name: "C",
                octave: 4,
                time: 0,
                duration: 1,
                velocity: 0.5,
              },
            ],
          },
        ],
      });

      const result = parseMidiFile("test.mid", []);
      expect(result.keySignatures).toEqual([]);
    });

    it("extracts key signature events with correct time conversion", () => {
      const mock = prepareMidi({
        tracks: [
          {
            notes: [
              {
                midi: 60,
                name: "C",
                octave: 4,
                time: 0,
                duration: 1,
                velocity: 0.5,
              },
            ],
          },
        ],
        keySignatures: [
          { ticks: 0, key: "F", scale: "major" },
          { ticks: 1920, key: "D", scale: "minor" },
        ],
      });

      const result = parseMidiFile("keysig.mid", []);

      expect(result.keySignatures).toHaveLength(2);
      expect(result.keySignatures[0]).toEqual({ time: 0, key: -1, scale: 0 }); // F major
      expect(result.keySignatures[1]).toEqual({ time: 4, key: 2, scale: 1 }); // D minor, 1920/480 = 4s
      expect(mock.header.ticksToSeconds).toHaveBeenCalledWith(0);
      expect(mock.header.ticksToSeconds).toHaveBeenCalledWith(1920);
    });
  });
});
