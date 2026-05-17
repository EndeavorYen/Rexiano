import type { TranslationKey, InterpolationParams } from "@renderer/i18n/types";

type Translate = (key: TranslationKey, params?: InterpolationParams) => string;

interface MidiErrorRule {
  match: (message: string) => boolean;
  titleKey: TranslationKey;
  guidanceKey: TranslationKey;
  canRetry: boolean;
  canUseBluetooth: boolean;
  canOpenSettings: boolean;
}

export type MidiRecoveryActionId =
  | "retry-midi-access"
  | "open-midi-settings"
  | "connect-bluetooth-midi";

export interface MidiRecoveryAction {
  id: MidiRecoveryActionId;
  label: string;
  emphasis: "primary" | "secondary";
}

export interface MidiErrorGuidance {
  title: string;
  guidance: string;
  canRetry: boolean;
  canUseBluetooth: boolean;
  actions: MidiRecoveryAction[];
  diagnostic: string;
}

const ERROR_RULES: MidiErrorRule[] = [
  {
    match: (message) => message.includes("not supported"),
    titleKey: "midi.errorUnsupported",
    guidanceKey: "midi.errorUnsupportedGuidance",
    canRetry: false,
    canUseBluetooth: false,
    canOpenSettings: false,
  },
  {
    match: (message) => message.includes("denied"),
    titleKey: "midi.errorDenied",
    guidanceKey: "midi.errorDeniedGuidance",
    canRetry: true,
    canUseBluetooth: false,
    canOpenSettings: true,
  },
  {
    match: (message) => message.includes("not available"),
    titleKey: "midi.errorUnavailable",
    guidanceKey: "midi.errorUnavailableGuidance",
    canRetry: true,
    canUseBluetooth: false,
    canOpenSettings: false,
  },
  {
    match: (message) => message.includes("input device"),
    titleKey: "midi.errorInput",
    guidanceKey: "midi.errorInputGuidance",
    canRetry: true,
    canUseBluetooth: true,
    canOpenSettings: false,
  },
  {
    match: (message) => message.includes("output device"),
    titleKey: "midi.errorOutput",
    guidanceKey: "midi.errorOutputGuidance",
    canRetry: true,
    canUseBluetooth: true,
    canOpenSettings: false,
  },
  {
    match: (message) => message.includes("Bluetooth not supported"),
    titleKey: "midi.errorBluetoothUnsupported",
    guidanceKey: "midi.errorBluetoothUnsupportedGuidance",
    canRetry: false,
    canUseBluetooth: false,
    canOpenSettings: false,
  },
];

function buildActions(
  rule: Pick<MidiErrorRule, "canRetry" | "canUseBluetooth" | "canOpenSettings">,
  t: Translate,
): MidiRecoveryAction[] {
  const actions: MidiRecoveryAction[] = [];

  if (rule.canRetry) {
    actions.push({
      id: "retry-midi-access",
      label: t("audio.retry"),
      emphasis: "primary",
    });
  }
  if (rule.canOpenSettings) {
    actions.push({
      id: "open-midi-settings",
      label: t("midi.openSettings"),
      emphasis: "secondary",
    });
  }
  if (rule.canUseBluetooth) {
    actions.push({
      id: "connect-bluetooth-midi",
      label: t("midi.bluetooth"),
      emphasis: "secondary",
    });
  }

  return actions;
}

export function getMidiErrorGuidance(
  connectionError: string,
  t: Translate,
): MidiErrorGuidance {
  const rule = ERROR_RULES.find(({ match }) => match(connectionError)) ?? {
    titleKey: "midi.errorGeneric",
    guidanceKey: "midi.errorGenericGuidance",
    canRetry: true,
    canUseBluetooth: true,
    canOpenSettings: false,
  };

  return {
    title: t(rule.titleKey),
    guidance: t(rule.guidanceKey),
    canRetry: rule.canRetry,
    canUseBluetooth: rule.canUseBluetooth,
    actions: buildActions(rule, t),
    diagnostic: connectionError,
  };
}
