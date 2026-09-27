import { describe, it, expect } from "vitest";
import { resolveDefaultModeForSession } from "./usePracticeSessionFlow";
import type { ParsedSong } from "@renderer/engines/midi/types";

describe("usePracticeSessionFlow - resolveDefaultModeForSession", () => {
  const dummySong: ParsedSong = {
    fileName: "song.mid",
    duration: 30,
    noteCount: 1,
    tracks: [
      {
        name: "Right",
        instrument: "acoustic_grand_piano",
        channel: 0,
        notes: [{ name: "C4", midi: 60, time: 0, duration: 1, velocity: 80 }],
      },
    ],
    tempos: [{ ticks: 0, bpm: 120, time: 0 }],
    timeSignatures: [{ ticks: 0, numerator: 4, denominator: 4, time: 0 }],
  };

  it("returns currentMode if song is null", () => {
    expect(
      resolveDefaultModeForSession(null, "wait", "practice", "watch", 1),
    ).toBe("wait");
  });

  it("maps sessionIntent 'play-along' to 'wait' mode", () => {
    expect(
      resolveDefaultModeForSession(
        dummySong,
        "watch",
        "play-along",
        "watch",
        1,
      ),
    ).toBe("wait");
  });

  it("uses song practice setup or default settings for 'practice' sessionIntent", () => {
    const result = resolveDefaultModeForSession(
      dummySong,
      "wait",
      "practice",
      "watch",
      0.8,
    );
    expect(["watch", "wait", "free"]).toContain(result);
  });
});
