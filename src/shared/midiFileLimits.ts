/**
 * Maximum untrusted MIDI input size before Buffer -> number[] IPC expansion.
 * 8 MiB comfortably covers ordinary performance files while bounding the
 * multiple-copy structured-clone cost that can otherwise exhaust memory.
 */
export const MAX_MIDI_FILE_BYTES = 8 * 1024 * 1024;

export const MAX_MIDI_FILE_MEBIBYTES = 8;

/** Stable token preserved by Electron's serialized Error.message. */
export const MIDI_FILE_TOO_LARGE_DIAGNOSTIC = "REXIANO_MIDI_FILE_TOO_LARGE";
