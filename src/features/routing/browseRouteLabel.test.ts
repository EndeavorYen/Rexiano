import { describe, expect, test } from "vitest";
import { backLabelKey } from "./browseRouteLabel";
import { zhTW } from "@renderer/locales/zh-TW";

describe("backLabelKey", () => {
  test("map origin says back to map, shelf origin says back to shelf", () => {
    expect(backLabelKey("menu")).toBe("nav.backToMap");
    expect(backLabelKey("library")).toBe("nav.backToShelf");
  });

  test("the zh-TW words match the places", () => {
    expect(zhTW[backLabelKey("menu")]).toBe("回地圖");
    expect(zhTW[backLabelKey("library")]).toBe("回書架");
  });
});
