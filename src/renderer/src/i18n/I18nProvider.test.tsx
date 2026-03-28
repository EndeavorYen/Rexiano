// @ts-nocheck
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { useSettingsStore } from "@renderer/stores/useSettingsStore";
import { I18nProvider } from "./I18nProvider";
import { useTranslation } from "./useTranslation";
import { useI18nContext } from "./useI18nContext";
import { I18nContext } from "./context";

function TranslationProbe(): React.JSX.Element {
  const { t, lang } = useTranslation();
  return (
    <div>
      <span data-testid="lang">{lang}</span>
      <span data-testid="title">{t("app.title")}</span>
    </div>
  );
}

function ContextProbe(): React.JSX.Element {
  const { language, t } = useI18nContext();
  return (
    <div>
      <span data-testid="ctx-lang">{language}</span>
      <span data-testid="ctx-title">{t("app.title")}</span>
    </div>
  );
}

describe("i18n provider/hooks", () => {
  beforeEach(() => {
    cleanup();
    useSettingsStore.setState({ language: "en" });
  });

  it("useTranslation returns active language and translated string", () => {
    render(<TranslationProbe />);
    expect(screen.getByTestId("lang").textContent).toBe("en");
    expect(screen.getByTestId("title").textContent).toBe("Rexiano");
  });

  it("I18nProvider provides context language and translator", () => {
    useSettingsStore.setState({ language: "zh-TW" });
    render(
      <I18nProvider>
        <ContextProbe />
      </I18nProvider>,
    );
    expect(screen.getByTestId("ctx-lang").textContent).toBe("zh-TW");
    expect(screen.getByTestId("ctx-title").textContent).toBe("Rexiano");
  });

  it("context default value works without provider", () => {
    expect(I18nContext._currentValue.language).toBe("en");
    expect(I18nContext._currentValue.t("app.title")).toBe("app.title");
  });
});
