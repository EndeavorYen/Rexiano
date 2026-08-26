import { describe, expect, test } from "vitest";
import {
  builtinOriginLabelKey,
  builtinScoreFileName,
  practiceSourceFromFileName,
  preferredDisplayModeForSource,
  resolveBuiltinSongSource,
  sheetFidelityLabelKey,
} from "./builtinScoreSource";

describe("builtinScoreSource", () => {
  test("names the MusicXML file from the built-in song id", () => {
    expect(builtinScoreFileName("au-clair-de-la-lune")).toBe(
      "au-clair-de-la-lune.musicxml",
    );
  });

  test("prefers a present MusicXML score over generated MIDI", () => {
    expect(
      resolveBuiltinSongSource({
        songId: "au-clair-de-la-lune",
        scorePresent: true,
      }),
    ).toBe("score");
  });

  test("keeps generated MIDI when the built-in has no score", () => {
    expect(
      resolveBuiltinSongSource({
        songId: "hot-cross-buns",
        scorePresent: false,
      }),
    ).toBe("midi");
  });

  test("score-backed songs open in split so the score is visible", () => {
    expect(preferredDisplayModeForSource("score")).toBe("split");
    expect(preferredDisplayModeForSource("midi")).toBe("falling");
  });

  test("labels score-backed songs as score and MIDI-backed sheet as approximate", () => {
    expect(builtinOriginLabelKey("score")).toBe("library.origin.score");
    expect(builtinOriginLabelKey("midi")).toBe("library.origin.midi");
    expect(sheetFidelityLabelKey("score")).toBe("sheetMusic.fidelity.score");
    expect(sheetFidelityLabelKey("midi")).toBe("sheetMusic.fidelity.approximate");
  });

  test("imported MusicXML is treated as a score source", () => {
    expect(practiceSourceFromFileName("hot-cross-buns.musicxml")).toBe("score");
    expect(practiceSourceFromFileName("lesson.mid")).toBe("midi");
    expect(
      preferredDisplayModeForSource(
        practiceSourceFromFileName("au-clair.musicxml"),
      ),
    ).toBe("split");
  });
});
