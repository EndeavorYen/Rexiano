import { describe, expect, test } from "vitest";
import { displayTitleForName, songDisplayTitle } from "./songTitle";

const twinkle = {
  title: "Twinkle Twinkle Little Star",
  titleZhTW: "小星星",
};

describe("songDisplayTitle (#308)", () => {
  test("zh-TW shows the Chinese title first and keeps the English one", () => {
    expect(songDisplayTitle(twinkle, "zh-TW")).toEqual({
      primary: "小星星",
      secondary: "Twinkle Twinkle Little Star",
    });
  });

  test("English shows only the English title", () => {
    expect(songDisplayTitle(twinkle, "en")).toEqual({
      primary: "Twinkle Twinkle Little Star",
      secondary: null,
    });
  });

  test("a song without a Chinese title stays as it is", () => {
    expect(songDisplayTitle({ title: "This Old Man" }, "zh-TW")).toEqual({
      primary: "This Old Man",
      secondary: null,
    });
  });
});

describe("displayTitleForName", () => {
  test("maps a stored English title (recents, player header) to zh-TW", () => {
    expect(
      displayTitleForName("Twinkle Twinkle Little Star", [twinkle], "zh-TW"),
    ).toBe("小星星");
  });

  test("leaves imported file names alone", () => {
    expect(displayTitleForName("my-song.mid", [twinkle], "zh-TW")).toBe(
      "my-song.mid",
    );
  });
});
