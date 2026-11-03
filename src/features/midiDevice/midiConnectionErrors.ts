export const MIDI_CONNECTION_ERROR = {
  unsupported: "midi.unsupported",
  denied: "midi.denied",
  unavailable: "midi.unavailable",
  initFailed: "midi.initFailed",
  inputFailed: "midi.inputFailed",
  outputFailed: "midi.outputFailed",
  bluetoothUnsupported: "midi.bluetoothUnsupported",
} as const;

export type MidiConnectionErrorCode =
  (typeof MIDI_CONNECTION_ERROR)[keyof typeof MIDI_CONNECTION_ERROR];
