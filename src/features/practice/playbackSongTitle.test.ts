import { describe, expect, test } from "vitest";
import { playbackSongTitle } from "./playbackSongTitle";

const builtin = [{ title: "Hot Cross Buns", titleZhTW: "熱十字麵包" }];
const imported = [
  { sourcePath: "local:ab12/阿哲的小曲.mid", title: "阿哲的小曲" },
  { sourcePath: "local:cd34/other.mid", title: "我改過的名字" },
];

describe("playbackSongTitle", () => {
  test("built-in songs follow the UI language", () => {
    expect(playbackSongTitle("Hot Cross Buns", builtin, [], "zh-TW")).toBe(
      "熱十字麵包",
    );
    expect(playbackSongTitle("Hot Cross Buns", builtin, [], "en")).toBe(
      "Hot Cross Buns",
    );
  });

  test("an imported song shows its shelf title, without the extension", () => {
    expect(
      playbackSongTitle("阿哲的小曲.mid", builtin, imported, "zh-TW"),
    ).toBe("阿哲的小曲");
  });

  test("a rename on the shelf shows in the player", () => {
    expect(playbackSongTitle("other.mid", builtin, imported, "zh-TW")).toBe(
      "我改過的名字",
    );
  });

  test("an unknown file just loses its extension", () => {
    expect(playbackSongTitle("lonely.MIDI", builtin, [], "en")).toBe("lonely");
  });
});
