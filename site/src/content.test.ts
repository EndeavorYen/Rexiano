import { describe, expect, it } from "vitest";
import { getSiteContent, localeOptions, resolveLocale } from "./content";

describe("site content localization", () => {
  it("supports English and Traditional Chinese locale options", () => {
    expect(localeOptions.map((locale) => locale.id)).toEqual(["en", "zh-TW"]);
    expect(localeOptions.map((locale) => locale.label)).toEqual([
      "English",
      "繁體中文",
    ]);
  });

  it("resolves browser language preferences to the supported site locales", () => {
    expect(resolveLocale("zh-TW")).toBe("zh-TW");
    expect(resolveLocale("zh-Hant")).toBe("zh-TW");
    expect(resolveLocale("zh-HK")).toBe("zh-TW");
    expect(resolveLocale("en-US")).toBe("en");
    expect(resolveLocale(undefined)).toBe("en");
  });

  it("keeps page sections and interactive collections aligned between locales", () => {
    const english = getSiteContent("en");
    const chinese = getSiteContent("zh-TW");

    expect(english.meta.htmlLang).toBe("en");
    expect(chinese.meta.htmlLang).toBe("zh-Hant-TW");
    expect(chinese.hero.actions.guide).toBe("閱讀指南");
    expect(chinese.docs.resources[0].href).toContain("docs/user-guide.md");
    expect(english.docs.resources).toHaveLength(chinese.docs.resources.length);
    expect(english.features.items).toHaveLength(chinese.features.items.length);
    expect(english.screenshots.items).toHaveLength(
      chinese.screenshots.items.length,
    );
    expect(english.platforms.items).toHaveLength(
      chinese.platforms.items.length,
    );
  });
});
