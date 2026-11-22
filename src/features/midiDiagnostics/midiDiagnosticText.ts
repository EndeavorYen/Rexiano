import type { TranslationKey } from "@renderer/i18n/types";
import type { MidiDiagnosticNotice } from "./midiDiagnosticNotice";

export interface MidiDiagnosticText {
  title: string;
  body: string;
}

type Translate = (key: TranslationKey) => string;

/**
 * What the yellow bar says, in plain words for a parent. The notice itself
 * keeps its English wording for diagnostics (tooltip, logs); this is the
 * part people read.
 */
export function describeMidiDiagnosticNotice(
  notice: MidiDiagnosticNotice,
  t: Translate,
): MidiDiagnosticText {
  if (notice.kind === "error") {
    return {
      title: t("midiNotice.errorTitle"),
      body: t("midiNotice.errorBody"),
    };
  }
  const onlyRhythm =
    notice.codes.length > 0 &&
    notice.codes.every((code) => code === "notation-rhythm-approximation");
  if (onlyRhythm) {
    return {
      title: t("midiNotice.warnTitle"),
      body: t("midiNotice.rhythmBody"),
    };
  }
  if (notice.codes.includes("missing-time-signature")) {
    return {
      title: t("midiNotice.warnTitle"),
      body: t("midiNotice.timeSignatureBody"),
    };
  }
  return {
    title: t("midiNotice.warnTitle"),
    body: t("midiNotice.genericBody"),
  };
}
