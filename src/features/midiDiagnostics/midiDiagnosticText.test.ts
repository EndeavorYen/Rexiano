import { describe, expect, test } from "vitest";
import { zhTW } from "@renderer/locales/zh-TW";
import { en } from "@renderer/locales/en";
import type { MidiDiagnosticNotice } from "./midiDiagnosticNotice";
import { describeMidiDiagnosticNotice } from "./midiDiagnosticText";

function notice(
  overrides: Partial<MidiDiagnosticNotice> = {},
): MidiDiagnosticNotice {
  return {
    kind: "warning",
    title: "Review MIDI quality before practice",
    summary: "1 MIDI quality warning detected.",
    canPractice: true,
    details: [],
    diagnosticTitle: "",
    codes: ["missing-tempo"],
    ...overrides,
  };
}

const zh = (
  key: Parameters<typeof describeMidiDiagnosticNotice>[1] extends (
    k: infer K,
  ) => string
    ? K
    : never,
): string => zhTW[key];

describe("describeMidiDiagnosticNotice", () => {
  test("a missing time signature is said in plain Chinese", () => {
    const text = describeMidiDiagnosticNotice(
      notice({ codes: ["missing-time-signature"] }),
      zh,
    );
    expect(text.body).toBe(
      "這個檔案的拍號資料不完整，樂譜可能和原曲不太一樣。",
    );
  });

  test("the zh-TW text carries no English words from the diagnostics", () => {
    for (const codes of [
      ["missing-tempo"],
      ["notation-rhythm-approximation"],
      ["missing-time-signature"],
    ] as const) {
      const text = describeMidiDiagnosticNotice(
        notice({ codes: [...codes] }),
        zh,
      );
      expect(`${text.title}${text.body}`).not.toMatch(/MIDI|warning|detected/i);
    }
    const error = describeMidiDiagnosticNotice(notice({ kind: "error" }), zh);
    expect(`${error.title}${error.body}`).not.toMatch(/MIDI|blocking/i);
  });

  test("both languages have every message", () => {
    for (const key of [
      "midiNotice.warnTitle",
      "midiNotice.errorTitle",
      "midiNotice.errorBody",
      "midiNotice.timeSignatureBody",
      "midiNotice.rhythmBody",
      "midiNotice.genericBody",
      "midiNotice.dismiss",
    ] as const) {
      expect(zhTW[key]).toBeTruthy();
      expect(en[key]).toBeTruthy();
    }
  });
});
