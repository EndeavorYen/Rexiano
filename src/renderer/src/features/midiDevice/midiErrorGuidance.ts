import type { TranslationKey, InterpolationParams } from "@renderer/i18n/types";

type Translate = (key: TranslationKey, params?: InterpolationParams) => string;

interface MidiErrorRule {
  match: (message: string) => boolean;
  titleKey: TranslationKey;
  guidanceKey: TranslationKey;
  canRetry: boolean;
  canUseBluetooth: boolean;
}

export interface MidiErrorGuidance {
  title: string;
  guidance: string;
  canRetry: boolean;
  canUseBluetooth: boolean;
  diagnostic: string;
}

const ERROR_RULES: MidiErrorRule[] = [
  {
    match: (message) => message.includes("not supported"),
    titleKey: "midi.errorUnsupported",
    guidanceKey: "midi.errorUnsupportedGuidance",
    canRetry: false,
    canUseBluetooth: false,
  },
  {
    match: (message) => message.includes("denied"),
    titleKey: "midi.errorDenied",
    guidanceKey: "midi.errorDeniedGuidance",
    canRetry: true,
    canUseBluetooth: false,
  },
  {
    match: (message) => message.includes("not available"),
    titleKey: "midi.errorUnavailable",
    guidanceKey: "midi.errorUnavailableGuidance",
    canRetry: true,
    canUseBluetooth: false,
  },
  {
    match: (message) => message.includes("input device"),
    titleKey: "midi.errorInput",
    guidanceKey: "midi.errorInputGuidance",
    canRetry: true,
    canUseBluetooth: true,
  },
  {
    match: (message) => message.includes("output device"),
    titleKey: "midi.errorOutput",
    guidanceKey: "midi.errorOutputGuidance",
    canRetry: true,
    canUseBluetooth: true,
  },
  {
    match: (message) => message.includes("Bluetooth not supported"),
    titleKey: "midi.errorBluetoothUnsupported",
    guidanceKey: "midi.errorBluetoothUnsupportedGuidance",
    canRetry: false,
    canUseBluetooth: false,
  },
];

export function getMidiErrorGuidance(
  connectionError: string,
  t: Translate,
): MidiErrorGuidance {
  const rule = ERROR_RULES.find(({ match }) => match(connectionError)) ?? {
    titleKey: "midi.errorGeneric",
    guidanceKey: "midi.errorGenericGuidance",
    canRetry: true,
    canUseBluetooth: true,
  };

  return {
    title: t(rule.titleKey),
    guidance: t(rule.guidanceKey),
    canRetry: rule.canRetry,
    canUseBluetooth: rule.canUseBluetooth,
    diagnostic: connectionError,
  };
}
