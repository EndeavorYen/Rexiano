import { describe, expect, test } from "vitest";
import type { TranslationKey } from "@renderer/i18n/types";
import { getMidiErrorGuidance } from "./midiErrorGuidance";

const t = (key: TranslationKey): string => key;

describe("getMidiErrorGuidance", () => {
  test("maps Web MIDI unsupported errors to localized unsupported guidance", () => {
    expect(
      getMidiErrorGuidance("Web MIDI API is not supported in this browser", t),
    ).toEqual({
      title: "midi.errorUnsupported",
      guidance: "midi.errorUnsupportedGuidance",
      canRetry: false,
      canUseBluetooth: false,
      diagnostic: "Web MIDI API is not supported in this browser",
    });
  });

  test("maps permission denial to actionable retry guidance", () => {
    expect(getMidiErrorGuidance("MIDI access was denied", t)).toMatchObject({
      title: "midi.errorDenied",
      guidance: "midi.errorDeniedGuidance",
      canRetry: true,
      canUseBluetooth: false,
    });
  });

  test("maps failed output connection to retry plus Bluetooth fallback guidance", () => {
    expect(
      getMidiErrorGuidance("Failed to connect to output device", t),
    ).toMatchObject({
      title: "midi.errorOutput",
      guidance: "midi.errorOutputGuidance",
      canRetry: true,
      canUseBluetooth: true,
    });
  });

  test("keeps unknown details as diagnostics while showing generic guidance", () => {
    expect(getMidiErrorGuidance("Unexpected MIDI transport fault", t)).toEqual({
      title: "midi.errorGeneric",
      guidance: "midi.errorGenericGuidance",
      canRetry: true,
      canUseBluetooth: true,
      diagnostic: "Unexpected MIDI transport fault",
    });
  });
});
