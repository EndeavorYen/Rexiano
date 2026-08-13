import { describe, expect, test } from "vitest";
import { en } from "@renderer/locales/en";
import { zhTW } from "@renderer/locales/zh-TW";

describe("locale key parity", () => {
  test("English and Traditional Chinese expose exactly the same keys", () => {
    expect(Object.keys(zhTW).sort()).toEqual(Object.keys(en).sort());
  });

  test.each([
    ["English", en],
    ["Traditional Chinese", zhTW],
  ])("%s translations are not empty", (_name, locale) => {
    const emptyKeys = Object.entries(locale)
      .filter(([, value]) => value.trim().length === 0)
      .map(([key]) => key);
    expect(emptyKeys).toEqual([]);
  });
});
