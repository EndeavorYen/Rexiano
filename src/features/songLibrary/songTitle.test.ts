import { describe, expect, test } from "vitest";
import { displayTitleForName, songByline, songDisplayTitle } from "./songTitle";

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

describe("songByline", () => {
  const say = (): string => "傳統民謠";
  test("Chinese: no English title, Traditional in words", () => {
    expect(
      songByline(
        { secondary: "Lightly Row", composer: "Traditional" },
        "zh-TW",
        say,
      ),
    ).toBe("傳統民謠");
  });
  test("Chinese: other composers stay as written", () => {
    expect(
      songByline({ secondary: "Ode", composer: "Beethoven" }, "zh-TW", say),
    ).toBe("Beethoven");
  });
  test("English keeps the English title line", () => {
    expect(
      songByline(
        { secondary: "Lightly Row", composer: "Traditional" },
        "en",
        () => "Traditional",
      ),
    ).toBe("Lightly Row · Traditional");
  });
  test("no composer gives an empty line", () => {
    expect(songByline({ secondary: null, composer: "" }, "zh-TW", say)).toBe(
      "",
    );
  });
});
